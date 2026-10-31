import assert from "node:assert/strict";
import test from "node:test";

// Stand-in browser globals: a WebSocket we can open/close by hand and timers we can fire.
class FakeWebSocket {
  static OPEN = 1;
  static instances = [];
  constructor(url) {
    this.url = url;
    this.listeners = {};
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type, event = {}) {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
  send() {}
  close() {}
}

const timeouts = [];
const intervals = [];
globalThis.WebSocket = FakeWebSocket;
globalThis.location = { protocol: "https:", host: "animaldash.logeek.tech" };
globalThis.window = {
  setTimeout: (callback) => timeouts.push(callback),
  clearTimeout() {},
  setInterval: (callback) => intervals.push(callback),
  clearInterval() {},
  addEventListener() {},
  removeEventListener() {},
};

const { createRaceSessionChannel } = await import("../app/features/race-session/race-session-channel.js");

test("the sync status follows the WebSocket so screens can show when they are offline", () => {
  const statuses = [];
  const channel = createRaceSessionChannel(() => {}, { onSyncStatus: (status) => statuses.push(status) });
  const first = FakeWebSocket.instances.at(-1);
  assert.equal(first.url, "wss://animaldash.logeek.tech/api/sync?role=viewer");

  first.emit("open");
  first.emit("close");
  timeouts.shift()();
  FakeWebSocket.instances.at(-1).emit("open");

  assert.deepEqual(statuses, ["connecting", "open", "offline", "connecting", "open"]);
  channel.close();
});

test("save notifications reach the ranking refresh only while the channel is active", () => {
  const saved = [];
  const channel = createRaceSessionChannel(() => {}, { onResultsSaved: (raceId) => saved.push(raceId) });
  const socket = FakeWebSocket.instances.at(-1);
  socket.emit("message", { data: JSON.stringify({ type: "results-saved", raceId: "race-new" }) });
  socket.emit("message", { data: JSON.stringify({ type: "results-saved" }) });
  assert.deepEqual(saved, ["race-new"]);
  channel.close();
  socket.emit("message", { data: JSON.stringify({ type: "results-saved", raceId: "race-late" }) });
  assert.deepEqual(saved, ["race-new"]);
});

test("a silent connection is replaced without waiting for its close event", (t) => {
  const statuses = [];
  const channel = createRaceSessionChannel(() => {}, { onSyncStatus: (status) => statuses.push(status) });
  t.after(() => channel.close());
  const stalled = FakeWebSocket.instances.at(-1);
  stalled.emit("open");

  const realNow = Date.now;
  Date.now = () => realNow() + 60_000;
  try {
    intervals.at(-1)();
  } finally {
    Date.now = realNow;
  }
  assert.equal(statuses.at(-1), "offline");

  timeouts.shift()();
  const replacement = FakeWebSocket.instances.at(-1);
  assert.notEqual(replacement, stalled);
  // The stalled socket's close finally arrives; it must not start another reconnect.
  stalled.emit("close");
  assert.equal(timeouts.length, 0);
  replacement.emit("open");
  assert.equal(statuses.at(-1), "open");
});

test("game connections identify their role and forward permanent failure notices only while active", () => {
  const failed = [];
  const channel = createRaceSessionChannel(() => {}, { role: "game", onResultsFailed: (id) => failed.push(id) });
  const socket = FakeWebSocket.instances.at(-1);
  assert.match(socket.url, /role=game$/);
  socket.emit("message", { data: JSON.stringify({ type: "results-failed", raceId: "failed-race" }) });
  assert.deepEqual(failed, ["failed-race"]);
  channel.close();
  socket.emit("message", { data: JSON.stringify({ type: "results-failed", raceId: "late" }) });
  assert.deepEqual(failed, ["failed-race"]);
});

test("viewer channels never publish state or input, and receive control and replay frames only while open", () => {
  const controls = [], races = [];
  const channel = createRaceSessionChannel(() => {}, { role: "viewer", onControl: (v) => controls.push(v), onRace: (v) => races.push(v) });
  const socket = FakeWebSocket.instances.at(-1);
  socket.readyState = FakeWebSocket.OPEN;
  const sent = [];
  socket.send = (raw) => sent.push(raw);
  channel.publish({ sequence: 99 });
  channel.sendInput({ buttons: 255 });
  socket.emit("open");
  assert.deepEqual(sent, []);
  socket.emit("message", { data: JSON.stringify({ type: "control", canControl: false }) });
  for (const type of ["race", "race-input"]) socket.emit("message", { data: JSON.stringify({ type, raceId: "current" }) });
  assert.deepEqual(controls, [false]);
  assert.equal(races.length, 2);
  channel.close();
  socket.emit("message", { data: JSON.stringify({ type: "control", canControl: true }) });
  socket.emit("message", { data: JSON.stringify({ type: "race-input" }) });
  assert.deepEqual(controls, [false]);
  assert.equal(races.length, 2);
});

test("only the admin channel sends mute changes, and every channel receives them", () => {
  for (const role of ["admin", "game", "viewer"]) {
    const sounds = [];
    const channel = createRaceSessionChannel(() => {}, { role, onSound: (muted) => sounds.push(muted) });
    const socket = FakeWebSocket.instances.at(-1);
    socket.readyState = FakeWebSocket.OPEN;
    const sent = [];
    socket.send = (raw) => sent.push(raw);
    channel.sendSound(true);
    assert.deepEqual(sent, role === "admin" ? [JSON.stringify({ type: "sound", muted: true })] : []);
    socket.emit("message", { data: JSON.stringify({ type: "sound", muted: true }) });
    socket.emit("message", { data: JSON.stringify({ type: "sound", muted: "no" }) });
    assert.deepEqual(sounds, [true]);
    channel.close();
  }
});

test("sessions resolve only referenced unknown characters and adopt them after lookup", async (t) => {
  const { createInitialSession } = await import("../app/domain/race-session.js");
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    const ids = new URL(url, "https://catalog").searchParams.get("ids").split(",");
    return Response.json({ characters: ids.map((id) => ({ id, name: id, generated: true })) });
  });
  const sessions = [];
  const channel = createRaceSessionChannel((s) => sessions.push(s));
  t.after(() => channel.close());
  const socket = FakeWebSocket.instances.at(-1);
  const candidate = { ...createInitialSession(), lanes: [{ characterId: "gen-outside-page", isBot: false }, null, null, null] };
  socket.emit("message", { data: JSON.stringify({ type: "session", session: candidate }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sessions.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0], "https://catalog").searchParams.get("ids"), "gen-outside-page");
  socket.emit("message", { data: JSON.stringify({ type: "session", session: { ...candidate, sequence: 2 } }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(sessions.length, 2);
});

test("a failed targeted lookup retries without a WebSocket reconnect", async (t) => {
  const { createInitialSession } = await import("../app/domain/race-session.js");
  let attempt = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++attempt === 1) throw new Error("offline");
    return Response.json({ characters: [{ id: "gen-lookup-retry", generated: true }] });
  });
  const sessions = [];
  const channel = createRaceSessionChannel((s) => sessions.push(s));
  t.after(() => channel.close());
  FakeWebSocket.instances.at(-1).emit("message", { data: JSON.stringify({ type: "session", session: {
    ...createInitialSession(), lanes: [{ characterId: "gen-lookup-retry", isBot: false }, null, null, null],
  } }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sessions.length, 0);
  timeouts.pop()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sessions.length, 1);
  assert.equal(attempt, 2);
});
