import assert from "node:assert/strict";
import test from "node:test";
import { createInitialSession } from "../app/domain/race-session.js";
import { RaceSessionRoom } from "../worker/race-session-room.js";
import { MAX_RACE_INPUTS } from "../app/features/game/race/constants.js";
import { receiveRaceUpdate } from "../app/features/game/race/spectator-race.js";

globalThis.WebSocketRequestResponsePair ??= class {};
const socket = (role, id = role) => ({ readyState: 1, sent: [], deserializeAttachment: () => ({ role, id }), close() { this.readyState = 3; }, send(raw) { this.sent.push(JSON.parse(raw)); } });
function fixture(env = {}) {
  let now = 10000;
  const data = new Map([["session", createInitialSession()]]);
  const [admin, game, observer] = [socket("admin"), socket("game"), socket("game", "observer")];
  const storage = {
    get: async (key) => data.get(key),
    put: async (key, value) => { if (typeof key === "object") Object.entries(key).forEach(([k, v]) => data.set(k, v)); else data.set(key, value); },
    delete: async (key) => data.delete(key),
    list: async ({ prefix, limit = Infinity }) => new Map([...data].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)).slice(0, limit)),
    setAlarm: async (at) => data.set("alarm", at), deleteAlarm: async () => data.delete("alarm"),
    transaction: async (fn) => fn(storage),
  };
  const ctx = { storage, getWebSockets: () => [admin, game, observer], setWebSocketAutoResponse() {} };
  const room = new RaceSessionRoom(ctx, env);
  room.now = () => now;
  const send = async (actor, patch) => room.webSocketMessage(actor, JSON.stringify({ type: "session", session: { ...data.get("session"), sequence: data.get("session").sequence + 1, ...patch } }));
  const start = async () => {
    await send(admin, { phase: "WAITING" });
    await send(admin, { phase: "COUNTDOWN", raceId: "untrusted-id" });
    await send(game, { phase: "RACING" });
    assert.equal(data.get("session").phase, "COUNTDOWN");
    assert.equal(game.sent.at(-2).error, "invalid_transition");
    now = data.get("activeRace").startedAt;
    await send(game, { phase: "RACING" });
  };
  return { room, ctx, data, admin, game, observer, send, start, setNow: (value) => { now = value; } };
}

test("room acknowledges its authoritative state to sender and all screens", async () => {
  const f = fixture();
  await f.send(f.admin, { phase: "WAITING" });
  assert.equal(f.data.get("session").sequence, 2);
  for (const ws of [f.admin, f.game, f.observer]) assert.equal(ws.sent.at(-1).session.phase, "WAITING");
});

test("fabricated results, game control changes and arbitrary sequence jumps cannot change the room", async () => {
  const f = fixture();
  await f.send(f.admin, { phase: "RESULTS", raceId: "fake", raceStartedAt: 1000, raceCompletedAt: 5000,
    results: [{ characterId: "momo", lane: 1, rank: 1, finishMs: 1, isBot: false }] });
  assert.equal(f.admin.sent.at(-2).error, "race_not_started");
  await f.send(f.game, { phase: "WAITING" });
  assert.equal(f.game.sent.at(-2).error, "admin_required");
  for (const sequence of [1e100, -1, 9000]) await f.send(f.admin, { sequence, phase: "WAITING" });
  assert.equal(f.data.get("session").sequence, 1);
  assert.equal((await f.ctx.storage.list({ prefix: "result:" })).size, 0);
});

test("server generates race identity, fixes lanes and computes goal times from timestamped inputs", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture(); await f.start();
  const current = f.data.get("session");
  assert.notEqual(current.raceId, "untrusted-id");
  const result = { phase: "RESULTS", results: [{ characterId: "momo", lane: 1, rank: 1, finishMs: 1, isBot: false }] };
  await f.send(f.game, result);
  assert.equal(f.data.get("session").phase, "RACING");
  f.setNow(current.raceStartedAt + 20000);
  await f.send(f.observer, result);
  assert.equal(f.observer.sent.at(-2).error, "not_race_reporter");
  await f.send(f.game, { ...result, lanes: [current.lanes[1], current.lanes[0], null, null] });
  assert.equal(f.game.sent.at(-2).error, "race_not_started");
  await f.send(f.game, result);
  const final = f.data.get("session");
  assert.equal(final.phase, "RESULTS");
  assert.ok(final.results.every((r) => r.finishMs > 10000));
  assert.equal(final.results.length, 2);
  const pending = f.data.get(`result:${final.raceId}`);
  assert.deepEqual(pending.results, final.results);
  await f.send(f.game, { results: final.results.map((r) => ({ ...r, finishMs: 900 })) });
  assert.equal(f.game.sent.at(-2).error, "results_finalized");
  assert.deepEqual(f.data.get("session").results, final.results);
});

test("only the selected game socket can timestamp inputs, and reconnect transfers ownership", async () => {
  const f = fixture(); await f.start();
  const raceId = f.data.get("session").raceId;
  for (const actor of [f.admin, f.observer]) await f.room.webSocketMessage(actor, JSON.stringify({ type: "input", raceId, buttons: 16, at: 0 }));
  assert.equal(f.data.get("activeRace").inputs.length, 0);
  f.setNow(f.data.get("session").raceStartedAt + 500);
  await f.room.webSocketMessage(f.game, JSON.stringify({ type: "input", raceId, buttons: 16, at: -5000 }));
  assert.deepEqual(f.data.get("activeRace").inputs, [{ at: 500, buttons: 16 }]);
  await f.room.webSocketClose(f.game, 1000, "test");
  assert.equal(f.data.get("activeRace").reporterId, "observer");
  assert.equal(f.room.gameSocket(), f.observer);
});

test("force finish freezes DNF and durable outbox survives reset and room restart", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture(); await f.start();
  f.setNow(f.data.get("session").raceStartedAt + 1000);
  await f.send(f.admin, { phase: "RESULTS", resultsForced: true });
  const id = f.data.get("session").raceId;
  assert.ok(f.data.get("session").results.every((r) => r.finishMs === null));
  await f.send(f.admin, { phase: "WAITING" });
  const restarted = new RaceSessionRoom(f.ctx, {});
  await restarted.alarm();
  assert.ok(f.data.has(`result:${id}`));
  assert.ok(f.data.has("alarm"));
  assert.equal(f.data.get("session").phase, "WAITING");
});

test("permanent errors leave the retry queue, notify clients and do not starve later records", async (t) => {
  t.mock.method(console, "error", () => {});
  const saved = new Map();
  const db = { prepare(sql) { return { sql, bind(...args) { this.args = args; return this; }, async first() { const payload = saved.get(this.args[0]); return payload ? { payload_json: payload } : null; } }; },
    async batch(statements) { for (const stmt of statements) if (stmt.sql.startsWith("INSERT INTO races")) saved.set(stmt.args[0], stmt.args[4]); } };
  const f = fixture({ DB: db });
  for (let i = 0; i < 100; i++) f.data.set(`result:bad-${String(i).padStart(3, "0")}`, { raceId: `bad-${i}` });
  f.data.set("result:later", { raceId: "later", startedAt: 1000, completedAt: 5000, courseSeed: "course", results: [{ characterId: "momo", lane: 1, rank: 1, finishMs: 4000, isBot: false }] });
  await f.room.alarm();
  assert.equal((await f.ctx.storage.list({ prefix: "result:" })).size, 1);
  assert.equal((await f.ctx.storage.list({ prefix: "failed:" })).size, 100);
  assert.equal(f.data.get("alarm"), 15000);
  await f.room.alarm();
  assert.equal((await f.ctx.storage.list({ prefix: "result:" })).size, 0);
  assert.equal(f.data.has("alarm"), false);
  assert.ok(f.game.sent.some((m) => m.type === "results-failed"));
  assert.ok(saved.has("later"));
  const status = await f.room.fetch(new Request("https://sync/race-save-status?raceId=bad-0"));
  assert.deepEqual(await status.json(), { failed: true });
});

test("legacy unsafe stored sequence recovers to a usable initial session", async () => {
  const f = fixture(); f.data.set("session", { ...createInitialSession(), sequence: 1e100 });
  assert.equal((await f.room.session()).sequence, 1);
  await f.send(f.admin, { phase: "WAITING" });
  assert.equal(f.data.get("session").phase, "WAITING");
});

test("a saved race conflict is quarantined permanently rather than retried", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture({ DB: { prepare() { return { bind() { return this; }, first: async () => ({ payload_json: "different" }) }; } } });
  f.data.set("result:conflict", { raceId: "conflict", startedAt: 1000, completedAt: 5000, courseSeed: "course", results: [{ characterId: "momo", lane: 1, rank: 1, finishMs: 4000, isBot: false }] });
  await f.room.alarm();
  assert.equal(f.data.get("failed:conflict").code, "result_conflict");
  assert.equal(f.data.has("result:conflict"), false);
  assert.equal(f.data.has("alarm"), false);
});

test("a stored session holding removed characters frees those lanes instead of stranding clients", async () => {
  const f = fixture();
  const stored = { ...createInitialSession(), phase: "WAITING", lanes: [{ characterId: "keroppin", isBot: true }, { characterId: "momo", isBot: true }, { characterId: "koro", isBot: true }, null] };
  f.data.set("session", stored);
  const session = await f.room.session();
  assert.deepEqual(session.lanes, [null, { characterId: "momo", isBot: true }, null, null]);
  assert.equal(session.sequence, stored.sequence + 1);
  assert.deepEqual(f.data.get("session"), session);
  assert.equal(await f.room.session(), f.data.get("session"));
});

test("spectators cannot change any phase, input, ownership or final result", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture();
  const viewer = socket("viewer", "spectator");
  f.ctx.getWebSockets = () => [f.admin, f.game, f.observer, viewer];
  const unchanged = async (payload) => {
    const before = JSON.stringify([...f.data]);
    await f.room.webSocketMessage(viewer, JSON.stringify(payload));
    assert.equal(JSON.stringify([...f.data]), before);
    assert.equal(viewer.sent.at(-2).error, "read_only");
  };
  for (const phase of ["WAITING", "COUNTDOWN", "RACING", "RESULTS", "ATTRACT"]) {
    await unchanged({ type: "session", session: { ...f.data.get("session"), phase, sequence: 2, resultsForced: true } });
  }
  await f.start();
  const current = f.data.get("session");
  await unchanged({ type: "input", raceId: current.raceId, buttons: 255, role: "game" });
  await f.room.webSocketClose(viewer, 1000, "spectator left");
  assert.equal(f.data.get("activeRace").reporterId, "game");
  f.setNow(current.raceStartedAt + 20_000);
  await f.send(f.game, { phase: "RESULTS" });
  await unchanged({ type: "session", session: { ...f.data.get("session"), sequence: f.data.get("session").sequence + 1, results: [] } });
});

test("accepted input is broadcast with server time, and reconnect snapshots include its history", async () => {
  const f = fixture(); await f.start();
  const race = f.data.get("activeRace");
  f.setNow(race.startedAt + 500);
  await f.room.webSocketMessage(f.game, JSON.stringify({ type: "input", raceId: race.raceId, buttons: 17, at: -999 }));
  for (const ws of [f.admin, f.game, f.observer]) {
    assert.deepEqual(ws.sent.at(-1), { type: "race-input", raceId: race.raceId, input: { at: 500, buttons: 17 }, serverNow: race.startedAt + 500 });
  }
  const viewer = socket("viewer");
  f.data.set("gameOwner", "game");
  f.room.sendRace(viewer, race);
  assert.deepEqual(viewer.sent.at(-1).race.inputs, [{ at: 500, buttons: 17 }]);
  assert.deepEqual(viewer.sent.at(-1).race.characters, race.characters);
  await f.room.webSocketClose(f.game, 1000, "owner left");
  assert.equal(f.data.get("activeRace").inputs.at(-1).buttons, 0);
  assert.equal(f.observer.sent.at(-1).canControl, true);
});

test("a full input history still fits the release on reporter disconnect, so spectators can join", async () => {
  const f = fixture(); await f.start();
  const race = f.data.get("activeRace");
  race.inputs = Array.from({ length: MAX_RACE_INPUTS - 2 }, (_, i) => ({ at: i, buttons: i % 2 ? 0 : 16 }));
  f.setNow(race.startedAt + 30_000);
  const input = (buttons) => f.room.webSocketMessage(f.game, JSON.stringify({ type: "input", raceId: race.raceId, buttons }));
  await input(1);
  await input(16);
  assert.equal(f.data.get("activeRace").inputs.length, MAX_RACE_INPUTS - 1);
  await f.room.webSocketClose(f.game, 1000, "owner left");
  await f.room.webSocketClose(f.observer, 1000, "next owner left");
  const stored = f.data.get("activeRace");
  assert.equal(stored.inputs.length, MAX_RACE_INPUTS);
  assert.equal(stored.inputs.at(-1).buttons, 0);
  const viewer = socket("viewer");
  f.room.sendRace(viewer, stored);
  assert.ok(receiveRaceUpdate(null, viewer.sent.at(-1), 0));
});

test("a new connection gets its own control state without messaging every other socket", async () => {
  const f = fixture();
  const before = [f.admin, f.game, f.observer].map((ws) => ws.sent.length);
  const viewer = { ...socket("viewer", "late"), serializeAttachment() {} };
  f.ctx.acceptWebSocket = () => {};
  const { WebSocketPair } = globalThis;
  globalThis.WebSocketPair = class { constructor() { return [{}, viewer]; } };
  // Node's Response refuses status 101; the room has already sent its frames by then.
  try { await f.room.fetch(new Request("https://room/?role=viewer", { headers: { Upgrade: "websocket" } })); } catch { /* 101 */ }
  finally { globalThis.WebSocketPair = WebSocketPair; }
  assert.deepEqual([f.admin, f.game, f.observer].map((ws) => ws.sent.length), before);
  assert.deepEqual(viewer.sent.find((m) => m.type === "control"), { type: "control", canControl: false });
});
