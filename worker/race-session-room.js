/* global WebSocketPair, WebSocketRequestResponsePair -- Workers runtime globals */

function looksLikeSession(value) {
  return value !== null
    && typeof value === "object"
    && value.version === 3
    && Number.isInteger(value.sequence)
    && Array.isArray(value.lanes);
}

// The single place every screen connects to. Holds the newest race session and
// relays it over WebSockets. Uses the Hibernation API so idle sockets cost nothing.
// It only needs fetch and WebSocket handlers (no RPC), so it does not extend DurableObject;
// that keeps cloudflare:workers out of the entry chunk the Node tests import.
export class RaceSessionRoom {
  constructor(ctx) {
    this.ctx = ctx;
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

  async webSocketMessage(socket, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message?.type !== "session" || !looksLikeSession(message.session)) return;

    const current = await this.ctx.storage.get("session");
    if (current && message.session.sequence <= current.sequence) {
      // Stale or concurrent write: hand the sender the version everyone else has.
      socket.send(JSON.stringify({ type: "session", session: current }));
      return;
    }

    await this.ctx.storage.put("session", message.session);
    this.broadcast({ type: "session", session: message.session }, socket);
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
