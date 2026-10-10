import assert from "node:assert/strict";
import test from "node:test";
import { createInitialSession } from "../app/domain/race-session.js";
import { RaceSessionRoom } from "../worker/race-session-room.js";

globalThis.WebSocketRequestResponsePair ??= class {};

function createSocket() {
  return { sent: [], send(payload) { this.sent.push(JSON.parse(payload)); } };
}

function createRoom(sockets, storedCharacterIds = [], env = {}) {
  const storage = new Map();
  const ctx = {
    storage: {
      get: async (key) => storage.get(key),
      put: async (key, value) => {
        if (typeof key === "object") Object.entries(key).forEach(([k, v]) => storage.set(k, v));
        else storage.set(key, value);
      },
      delete: async (key) => storage.delete(key),
      list: async ({ prefix, limit = Infinity }) => new Map([...storage].filter(([key]) => key.startsWith(prefix)).slice(0, limit)),
      setAlarm: async (time) => storage.set("alarm", time),
      deleteAlarm: async () => storage.delete("alarm"),
      transaction: async (callback) => callback(ctx.storage),
    },
    getWebSockets: () => sockets,
    setWebSocketAutoResponse() {},
  };
  const bucket = { head: async (key) => storedCharacterIds.some((id) => key === `characters/${id}.png`) ? {} : null };
  return { room: new RaceSessionRoom(ctx, { CHARACTERS: bucket, ...env }), storage, ctx };
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

test("completed races survive reset, database failure and room restart in a durable outbox", async (t) => {
  t.mock.method(console, "error", () => {});
  const socket = createSocket();
  const { room, storage, ctx } = createRoom([socket]);
  const completed = { ...session(2), phase: "RESULTS", raceStartedAt: 1000, lastSync: 5000,
    lanes: [{ characterId: "momo", isBot: false }, null, null, null],
    results: [{ characterId: "momo", lane: 1, rank: 1, finishMs: 4000, isBot: false }] };
  await room.webSocketMessage(socket, frame(completed));
  assert.equal(storage.get("result:session_test:1000").results[0].finishMs, 4000);
  assert.ok(storage.get("alarm") > Date.now());
  await room.webSocketMessage(socket, frame(session(3)));
  const restarted = new RaceSessionRoom(ctx, {});
  await restarted.alarm();
  assert.equal(storage.get("session").phase, "WAITING");
  assert.ok(storage.has("result:session_test:1000"));
  assert.ok(storage.get("alarm") > Date.now());
});

test("invalid results cannot advance the shared sequence or enter the outbox", async () => {
  const socket = createSocket();
  const { room, storage } = createRoom([socket]);
  await room.webSocketMessage(socket, frame(session(1)));
  await room.webSocketMessage(socket, frame({ ...session(2), phase: "RESULTS", raceStartedAt: 1000, lastSync: 5000,
    results: [{ characterId: "momo", lane: 1, rank: 1, finishMs: 4000, isBot: false }] }));
  assert.equal(storage.get("session").sequence, 1);
  assert.equal(storage.size, 1);
  assert.equal(socket.sent.at(-1).error, "invalid_results");
});

test("concurrent frames cannot overwrite a newer sequence after an asynchronous check", async () => {
  const socket = createSocket();
  const { room, storage } = createRoom([socket], ["gen-stored"]);
  const next = (sequence) => ({ ...session(sequence), lanes: [{ characterId: "gen-stored", isBot: false }, null, null, null] });
  await Promise.all([room.webSocketMessage(socket, frame(next(10))), room.webSocketMessage(socket, frame(next(9)))]);
  assert.equal(storage.get("session").sequence, 10);
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
