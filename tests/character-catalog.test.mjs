import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterCatalog } from "../app/features/admin/model/character-catalog.js";

const character = (i) => ({ id: `gen-${i}`, name: `動物${i}`, preset: "スピード", generated: true });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("400 items are loaded in bounded pages with deduplication and a terminal cursor", async () => {
  const calls = [];
  const all = Array.from({ length: 400 }, (_, i) => character(399 - i));
  const catalog = createCharacterCatalog({ cache() {}, fetcher: async (url) => {
    const params = new URL(url, "https://catalog").searchParams;
    calls.push(params);
    const start = Number(params.get("cursor") ?? 0);
    return Response.json({ characters: all.slice(start, start + 12), total: 400, nextCursor: start + 12 < 400 ? String(start + 12) : null });
  } });
  await Promise.all([catalog.loadMore(), catalog.loadMore(), catalog.loadMore()]);
  assert.equal(calls.length, 1);
  assert.equal(catalog.getSnapshot().characters.length, 12);
  for (let i = 0; i < 40; i++) await catalog.loadMore();
  assert.equal(calls.length, 34);
  assert.deepEqual(catalog.getSnapshot().characters, all);
  assert.ok(calls.every((p) => p.get("limit") === "12"));
});

test("search changes and disposal reject stale responses even when abort is ignored", async () => {
  const pending = [];
  const catalog = createCharacterCatalog({ cache() {}, fetcher: (url) => new Promise((resolve) => pending.push({ url, resolve })) });
  const first = catalog.loadMore();
  catalog.setQuery("古いページ以外");
  pending[1].resolve(Response.json({ characters: [character("found")], total: 1, nextCursor: null }));
  await tick();
  pending[0].resolve(Response.json({ characters: [character("stale")], total: 900, nextCursor: "old" }));
  await first;
  assert.deepEqual(catalog.getSnapshot().characters.map((c) => c.id), ["gen-found"]);
  catalog.setQuery("dispose");
  catalog.dispose();
  pending[2].resolve(Response.json({ characters: [character("late")], total: 1, nextCursor: null }));
  await tick();
  assert.equal(catalog.getSnapshot().characters.length, 0);
});

test("failed pages retry the same cursor; head refresh preserves loaded pages and handles duplicates", async () => {
  let fail = false, head = false;
  const calls = [];
  const catalog = createCharacterCatalog({ cache() {}, fetcher: async (url) => {
    const cursor = new URL(url, "https://catalog").searchParams.get("cursor");
    calls.push(cursor);
    if (fail) return new Response("offline", { status: 503 });
    return Response.json({ characters: cursor ? [character(1)] : head ? [character(3), character(2)] : [character(2)], total: 3, nextCursor: cursor ? null : "next" });
  } });
  await catalog.loadMore();
  fail = true;
  await catalog.loadMore();
  assert.ok(catalog.getSnapshot().error);
  fail = false;
  await catalog.retry();
  assert.deepEqual(calls, [null, "next", "next"]);
  head = true;
  fail = true;
  await catalog.refresh();
  fail = false;
  await catalog.retry();
  assert.deepEqual(catalog.getSnapshot().characters.map((c) => c.id), ["gen-3", "gen-2", "gen-1"]);
  assert.equal(catalog.getSnapshot().nextCursor, null);
});

test("head refresh with more than a page of new arrivals resumes without skipping the gap", async () => {
  let refreshed = false;
  const catalog = createCharacterCatalog({ cache() {}, fetcher: async () => Response.json({
    characters: refreshed ? Array.from({ length: 12 }, (_, i) => character(30 - i)) : [character(1)],
    total: refreshed ? 31 : 1, nextCursor: refreshed ? "after-new-head" : null,
  }) });
  await catalog.loadMore();
  refreshed = true;
  await catalog.refresh();
  assert.equal(catalog.getSnapshot().nextCursor, "after-new-head");
  assert.equal(catalog.getSnapshot().characters.length, 12);
});
