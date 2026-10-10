import assert from "node:assert/strict";
import test from "node:test";
import { createInitialSession } from "../app/domain/race-session.js";
import { RaceSessionRoom } from "../worker/race-session-room.js";

globalThis.WebSocketRequestResponsePair ??= class {};

function createSocket() {
  return { sent: [], send(payload) { this.sent.push(JSON.parse(payload)); } };
}

function createRoom(sockets, storedCharacterIds = []) {
  const storage = new Map();
  const ctx = {
    storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value) },
    getWebSockets: () => sockets,
    setWebSocketAutoResponse() {},
  };
  const bucket = { head: async (key) => storedCharacterIds.some((id) => key === `characters/${id}.png`) ? {} : null };
  return { room: new RaceSessionRoom(ctx, { CHARACTERS: bucket }), storage };
}

const session = (sequence) => ({ ...createInitialSession(), sequence, sessionId: "session_test", phase: "WAITING", lanes: [null, null, null, null] });
const frame = (value) => JSON.stringify({ type: "session", session: value });

test("a newer session is stored and relayed to every other screen", async () => {
  const [admin, game] = [createSocket(), createSocket()];
  const { room, storage } = createRoom([admin, game]);

  await room.webSocketMessage(admin, frame(session(1)));

  assert.equal(storage.get("session").sequence, 1);
  assert.deepEqual(admin.sent, []);
  assert.deepEqual(game.sent, [{ type: "session", session: session(1) }]);
});

test("a stale or concurrent session is answered with the stored one", async () => {
  const [admin, game] = [createSocket(), createSocket()];
  const { room, storage } = createRoom([admin, game]);
  await room.webSocketMessage(admin, frame(session(5)));
  game.sent.length = 0;

  await room.webSocketMessage(game, frame({ ...session(5), phase: "COUNTDOWN" }));

  assert.equal(storage.get("session").phase, "WAITING");
  assert.deepEqual(game.sent, [{ type: "session", session: session(5) }]);
  assert.deepEqual(admin.sent, []);
});

test("malformed frames are ignored and character changes reach everyone", async () => {
  const [admin, game] = [createSocket(), createSocket()];
  const { room, storage } = createRoom([admin, game]);

  await room.webSocketMessage(admin, "not json");
  await room.webSocketMessage(admin, JSON.stringify({ type: "session", session: { sequence: 9 } }));
  await room.webSocketMessage(admin, frame({ ...session(9), sessionId: undefined }));
  assert.equal(storage.size, 0);

  const response = await room.fetch(new Request("https://sync/characters-changed", { method: "POST" }));
  assert.equal(response.status, 204);
  assert.deepEqual(admin.sent, [{ type: "characters-changed" }]);
  assert.deepEqual(game.sent, [{ type: "characters-changed" }]);
});

test("sessions the screens would reject are never stored, so they cannot block later writes", async () => {
  const [admin, game] = [createSocket(), createSocket()];
  const { room, storage } = createRoom([admin, game], ["gen-stored"]);
  const withLane = (characterId) => ({ ...session(9), lanes: [{ characterId, isBot: false }, null, null, null] });

  await room.webSocketMessage(admin, frame({ ...session(9), lanes: [null, null, null] }));
  await room.webSocketMessage(admin, frame({ ...session(9), courseSeed: undefined }));
  await room.webSocketMessage(admin, frame(withLane("gen-missing")));
  assert.equal(storage.size, 0);

  await room.webSocketMessage(admin, frame(withLane("gen-stored")));
  assert.equal(storage.get("session").lanes[0].characterId, "gen-stored");
  await room.webSocketMessage(admin, frame({ ...withLane("momo"), sequence: 10 }));
  assert.equal(storage.get("session").sequence, 10);
});
