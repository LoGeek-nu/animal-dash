import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRaceSessionChannel } from "../app/features/race-session/race-session-channel.js";

test("the control check follows ownership changes and disappears offline or while reconnecting", async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  await mkdir(join(root, ".wrangler"), { recursive: true });
  const dir = await mkdtemp(join(root, ".wrangler/control-badge-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bundled = await build({ stdin: { contents: "export { GameControlContext, GameControlBadge } from './app/features/game/components/GameControlBadge.jsx';",
    resolveDir: root }, bundle: true, write: false, format: "esm", platform: "node", packages: "external", jsx: "automatic" });
  const path = join(dir, "badge.mjs");
  await writeFile(path, bundled.outputFiles[0].text);
  const { GameControlContext, GameControlBadge } = await import(pathToFileURL(path).href);
  const render = (value) => renderToStaticMarkup(createElement(GameControlContext.Provider, { value }, createElement(GameControlBadge)));

  class Socket {
    static OPEN = 1;
    static all = [];
    constructor() { this.listeners = {}; Socket.all.push(this); }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    emit(type, event = {}) { for (const fn of this.listeners[type] ?? []) fn(event); }
    send() {}
    close() {}
  }
  const originalSocket = globalThis.WebSocket;
  globalThis.WebSocket = Socket;
  const channels = [];
  globalThis.location = { protocol: "https:", host: "game.test" };
  globalThis.window = { setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} };
  t.after(() => {
    for (const channel of channels) channel.close();
    globalThis.WebSocket = originalSocket;
    delete globalThis.location; delete globalThis.window;
  });
  const device = () => {
    const state = { canControl: false, syncStatus: "connecting" };
    const channel = createRaceSessionChannel(() => {}, { role: "game",
      onControl: (value) => { state.canControl = value; }, onSyncStatus: (value) => { state.syncStatus = value; } });
    channels.push(channel);
    const socket = Socket.all.at(-1);
    socket.emit("open");
    return { state, socket, html: () => render(state) };
  };
  const a = device(), b = device();
  const control = (device, value) => device.socket.emit("message", { data: JSON.stringify({ type: "control", canControl: value }) });
  control(a, true); control(b, false);
  assert.match(a.html(), /✓.*操作可能/);
  assert.match(b.html(), /観戦中/);
  assert.doesNotMatch(b.html(), /✓|操作可能/);
  control(a, false); control(b, true);
  assert.doesNotMatch(a.html(), /✓|操作可能/);
  assert.match(b.html(), /✓.*操作可能/);
  b.socket.emit("close");
  assert.match(b.html(), /通信切断/);
  assert.doesNotMatch(b.html(), /✓|操作可能/);
  assert.doesNotMatch(render({ canControl: true, syncStatus: "connecting" }), /✓|操作可能/);
});
