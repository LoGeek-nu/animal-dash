/* global WebSocketPair, WebSocketRequestResponsePair -- Workers runtime globals */

import { generatedCharacterExists } from "../app/api/characters/character-store.js";
import { characters } from "../app/domain/characters.js";
import { validSession } from "../app/features/race-session/race-session-validator.js";
import { saveRace } from "./data-store.js";
import { raceRecordFromSession } from "./race-record.js";

const BUILT_IN_IDS = new Set(characters.map((character) => character.id));

// Same check the screens run. A session they would reject must never be stored:
// its sequence would make the room refuse every later (valid) write.
async function acceptableSession(session, bucket) {
  if (!validSession(session, (id) => typeof id === "string")) return false;
  const generatedIds = new Set(session.lanes.flatMap((lane) => lane && !BUILT_IN_IDS.has(lane.characterId) ? [lane.characterId] : []));
  if (generatedIds.size === 0) return true;
  if (!bucket) return false;
  const found = await Promise.all([...generatedIds].map((id) => generatedCharacterExists(bucket, id)));
  return found.every(Boolean);
}

// The single place every screen connects to. Holds the newest race session and
// relays it over WebSockets. Uses the Hibernation API so idle sockets cost nothing.
// It only needs fetch and WebSocket handlers (no RPC), so it does not extend DurableObject;
// that keeps cloudflare:workers out of the entry chunk the Node tests import.
export class RaceSessionRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // Serialize checks and commits across R2/D1 awaits; external I/O yields the DO input gate.
    this.work = Promise.resolve();
    // Heartbeats are answered without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/characters-changed") {
      this.broadcast({ type: "characters-changed" });
      return new Response(null, { status: 204 });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    const session = await this.ctx.storage.get("session");
    if (session) server.send(JSON.stringify({ type: "session", session }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, raw) {
    return this.runExclusive(() => this.acceptMessage(socket, raw));
  }

  runExclusive(callback) {
    const work = this.work.then(callback);
    this.work = work.catch(() => {});
    return work;
  }

  async acceptMessage(socket, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message?.type !== "session" || !(await acceptableSession(message.session, this.env?.CHARACTERS))) return;

    const current = await this.ctx.storage.get("session");
    if (current && message.session.sequence <= current.sequence) {
      // Stale or concurrent write: hand the sender the version everyone else has.
      socket.send(JSON.stringify({ type: "session", session: current }));
      return;
    }

    let race;
    try {
      race = raceRecordFromSession(message.session);
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "invalid_results" }));
      return;
    }
    const previousRaceId = current?.raceId ?? `${current?.sessionId}:${current?.raceStartedAt}`;
    const newResult = race && (current?.phase !== "RESULTS" || previousRaceId !== race.raceId);
    if (newResult) {
      // Commit the outbox and visible session together. Resetting the screen cannot lose results.
      await this.ctx.storage.transaction(async (txn) => {
        await txn.put({ session: message.session, [`result:${race.raceId}`]: race });
        await txn.setAlarm(Date.now() + 5_000);
      });
    } else {
      await this.ctx.storage.put("session", message.session);
    }
    this.broadcast({ type: "session", session: message.session }, socket);
    if (newResult) await this.flushResults();
  }

  alarm() {
    return this.runExclusive(() => this.flushResults());
  }

  async flushResults() {
    const pending = await this.ctx.storage.list({ prefix: "result:", limit: 100 });
    let failed = false;
    for (const [key, race] of pending) {
      try {
        if (!this.env.DB) throw new Error("D1 DB binding is not configured");
        await saveRace(this.env.DB, this.env.CHARACTERS, race);
        await this.ctx.storage.delete(key);
        this.broadcast({ type: "results-saved", raceId: race.raceId });
      } catch (error) {
        console.error("race_save_failed", { raceId: race.raceId, message: error.message });
        // A long outage must not exhaust the runtime's six automatic alarm retries.
        failed = true;
      }
    }
    if (failed) {
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    } else if ((await this.ctx.storage.list({ prefix: "result:", limit: 1 })).size) {
      await this.ctx.storage.setAlarm(Date.now() + 5_000);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  webSocketClose(socket, code, reason) {
    try {
      socket.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  broadcast(message, except) {
    const payload = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      try {
        socket.send(payload);
      } catch {
        // The socket is closing; its close handler cleans up.
      }
    }
  }
}
