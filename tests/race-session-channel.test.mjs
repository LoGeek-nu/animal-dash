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
globalThis.WebSocket = FakeWebSocket;
globalThis.location = { protocol: "https:", host: "animaldash.logeek.tech" };
globalThis.window = {
  setTimeout: (callback) => timeouts.push(callback),
  clearTimeout() {},
  setInterval: () => 0,
  clearInterval() {},
  addEventListener() {},
  removeEventListener() {},
};

const { createRaceSessionChannel } = await import("../app/features/race-session/race-session-channel.js");

test("the sync status follows the WebSocket so screens can show when they are offline", () => {
  const statuses = [];
  const channel = createRaceSessionChannel(() => {}, { onSyncStatus: (status) => statuses.push(status) });
  const first = FakeWebSocket.instances.at(-1);
  assert.equal(first.url, "wss://animaldash.logeek.tech/api/sync");

  first.emit("open");
  first.emit("close");
  timeouts.shift()();
  FakeWebSocket.instances.at(-1).emit("open");

  assert.deepEqual(statuses, ["connecting", "open", "offline", "connecting", "open"]);
  channel.close();
});
