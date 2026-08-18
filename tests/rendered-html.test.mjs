import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker(suffix) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${suffix}`);
  return (await import(workerUrl.href)).default;
}

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function render(pathname) {
  const worker = await loadWorker(pathname);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), env, ctx);
}

test("server-renders the public game screen", async () => {
  const response = await render("/game");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /ANIMAL DASH!/);
  assert.match(html, /アニマル/);
  assert.match(html, /ANIMAL PARADE/);
  assert.match(html, /DEMO RACE/);
  assert.match(html, /TODAY(?:&#x27;|')S RANKING/);
  assert.match(html, /\/characters\/momo\/runner\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the staff control screen", async () => {
  const response = await render("/admin");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /STAFF CONTROL/);
  assert.match(html, /キャラクターを選ぶ/);
  assert.match(html, /レース開始/);
  assert.match(html, /参加待機画面/);
  assert.match(html, /上映を最初から/);
});

test("health endpoint reports the mock ready", async () => {
  const worker = await loadWorker("health");
  const response = await worker.fetch(new Request("http://localhost/health"), env, ctx);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});
