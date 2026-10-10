import { refreshGeneratedCharacters } from "../../domain/generated-characters.js";
import { CHANNEL_NAME, STORAGE_KEY } from "./constants.js";
import { validSession } from "./race-session-validator.js";

const SYNC_PATH = "/api/sync";
const HEARTBEAT_INTERVAL = 15_000;
const HEARTBEAT_TIMEOUT = 40_000;
const RECONNECT_MIN_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 10_000;

// Keeps one WebSocket to the sync room open, reconnecting with backoff and
// detecting silently dropped connections (common on phones) with ping/pong.
// onStatus receives "connecting" | "open" | "offline", so screens can show whether they really sync.
function createSyncSocket({ onSession, onCharactersChanged, onStatus }) {
  if (typeof WebSocket === "undefined" || typeof location === "undefined") {
    return { send() {}, close() {} };
  }

  let socket = null;
  let closed = false;
  let reconnectDelay = RECONNECT_MIN_DELAY;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let lastHeard = 0;
  let pending = null;

  const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${SYNC_PATH}`;

  const scheduleReconnect = () => {
    window.clearInterval(heartbeatTimer);
    if (closed) return;
    onStatus("offline");
    reconnectTimer = window.setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY);
  };

  function connect() {
    onStatus("connecting");
    const ws = new WebSocket(url);
    socket = ws;

    ws.addEventListener("open", () => {
      if (socket !== ws) return;
      onStatus("open");
      reconnectDelay = RECONNECT_MIN_DELAY;
      lastHeard = Date.now();
      // Re-send our newest state; the room ignores it unless it is newer than its own.
      if (pending) ws.send(pending);
      heartbeatTimer = window.setInterval(() => {
        if (Date.now() - lastHeard > HEARTBEAT_TIMEOUT) {
          // On a half-open connection the close handshake can stall for minutes,
          // so give up on this socket now instead of waiting for its close event.
          socket = null;
          ws.close();
          scheduleReconnect();
          return;
        }
        ws.send("ping");
      }, HEARTBEAT_INTERVAL);
    });

    ws.addEventListener("message", (event) => {
      if (socket !== ws) return;
      lastHeard = Date.now();
      if (event.data === "pong") return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "session") onSession(message.session);
        if (message.type === "characters-changed") onCharactersChanged();
      } catch {
        // Ignore malformed frames.
      }
    });

    // A socket we already gave up on has been replaced; its late close must not reconnect again.
    ws.addEventListener("close", () => {
      if (socket === ws) scheduleReconnect();
    });
  }

  connect();

  return {
    send(session) {
      pending = JSON.stringify({ type: "session", session });
      if (socket?.readyState === WebSocket.OPEN) socket.send(pending);
    },
    close() {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      socket?.close();
    },
  };
}

export function createRaceSessionChannel(onSession, { onSyncStatus = () => {} } = {}) {
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

  let closed = false;

  const accept = async (candidate) => {
    if (validSession(candidate)) {
      onSession(candidate);
      return;
    }
    // The session may reference a character generated on another screen; reload the pool and retry once.
    await refreshGeneratedCharacters();
    if (!closed && validSession(candidate)) onSession(candidate);
  };

  const onMessage = (event) => accept(event.data);
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      accept(JSON.parse(event.newValue));
    } catch {
      // Ignore incomplete writes from another tab.
    }
  };

  if (channel) channel.addEventListener("message", onMessage);
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  const sync = createSyncSocket({ onSession: accept, onCharactersChanged: refreshGeneratedCharacters, onStatus: onSyncStatus });

  return {
    publish(session) {
      channel?.postMessage(session);
      sync.send(session);
    },
    close() {
      closed = true;
      sync.close();
      if (channel) {
        channel.removeEventListener("message", onMessage);
        channel.close();
      }
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    },
  };
}
