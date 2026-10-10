import assert from "node:assert/strict";
import test from "node:test";
import { createRankingClient, INITIAL_RANKINGS, japanDate } from "../app/features/rankings/ranking-client.js";
import { formatTime } from "../app/domain/rankings.js";

const day = "2026-10-10";
const character = { id: "gen-test", name: "テストキャラ", generated: true, imageUrl: "/api/characters/gen-test/image" };
const entry = { characterId: character.id, displayName: character.name, character, rank: 1, finishMs: 30123 };
const data = (extra = {}) => ({ date: day, timezone: "Asia/Tokyo", metric: "finishMs", unit: "milliseconds",
  tiePolicy: "competition", botsIncluded: false, mock: false, rankings: [entry], ...extra });
const response = (body, status = 200) => Response.json(body, { status });
const settle = () => new Promise((resolve) => setImmediate(resolve));

function fixture(fetcher) {
  const timers = new Map();
  let clock = Date.parse("2026-10-10T12:00:00+09:00");
  const client = createRankingClient({ fetcher, now: () => clock,
    schedule: (fn, ms) => { const id = Symbol(); timers.set(id, { fn, ms }); return id; },
    cancel: (id) => timers.delete(id),
  });
  return { client, timers, setClock: (value) => { clock = value; } };
}

test("both boards share the same real daily records and JST query without an SSR fetch", async () => {
  const calls = [];
  const { client } = fixture(async (url) => { calls.push(url); return response(data()); });
  assert.equal(client.getServerSnapshot(), INITIAL_RANKINGS);
  assert.equal(calls.length, 0);
  const stop3 = client.observe();
  const stop10 = client.observe();
  assert.equal(client.getSnapshot().status, "loading");
  await settle();
  assert.deepEqual(calls, ["/api/rankings?date=2026-10-10&limit=10"]);
  assert.equal(client.getSnapshot().rankings[0].finishMs, 30123);
  assert.equal(client.getSnapshot().status, "ready");
  assert.equal(client.getServerSnapshot(), INITIAL_RANKINGS);
  stop3(); stop10();
});

test("saving results holds the board pending and a completion refresh publishes the committed records", async () => {
  const calls = [];
  let saved = false;
  const { client, timers } = fixture(async (url) => { calls.push(url); return response(data({ afterRaceId: "race-current", raceSaved: saved })); });
  const stop = client.observe("race-current");
  await settle();
  assert.equal(client.getSnapshot().status, "pending");
  assert.equal([...timers.values()][0].ms, 1500);
  saved = true;
  await client.refresh();
  assert.equal(client.getSnapshot().status, "ready");
  assert.ok(calls.every((url) => url.includes("afterRaceId=race-current")));
  assert.equal([...timers.values()][0].ms, 30000);
  stop();
});

test("a lost save notification is recovered by polling", async () => {
  let saved = false;
  const { client, timers } = fixture(async () => response(data({ afterRaceId: "race-lost", raceSaved: saved })));
  const stop = client.observe("race-lost");
  await settle();
  const timer = [...timers.values()][0];
  saved = true;
  await timer.fn();
  assert.equal(client.getSnapshot().status, "ready");
  stop();
});

test("late responses cannot overwrite a refresh requested after result persistence", async () => {
  const requests = [];
  const { client } = fixture((url, options) => new Promise((resolve) => requests.push({ url, options, resolve })));
  const stop = client.observe("race-current");
  const fresh = client.refresh();
  assert.equal(requests[0].options.signal.aborted, true);
  requests[1].resolve(response(data({ afterRaceId: "race-current", raceSaved: true })));
  await fresh;
  requests[0].resolve(response(data({ afterRaceId: "race-current", raceSaved: false, rankings: [] })));
  await settle();
  assert.equal(client.getSnapshot().status, "ready");
  assert.deepEqual(client.getSnapshot().rankings, [entry]);
  stop();
});

test("failed or malformed requests expose an error, clear stale records and support retry", async () => {
  let body = data();
  let status = 200;
  const { client } = fixture(async () => response(body, status));
  const stop = client.observe();
  await settle();
  status = 503;
  await client.refresh();
  assert.equal(client.getSnapshot().status, "error");
  assert.deepEqual(client.getSnapshot().rankings, []);
  status = 200;
  for (const invalid of [data({ mock: true }), data({ date: "2026-10-09" }), data({ rankings: [{ ...entry, finishMs: null }] }),
    data({ rankings: [{ ...entry, character: { ...character, id: "mismatch" } }] })]) {
    body = invalid;
    await client.refresh();
    assert.equal(client.getSnapshot().status, "error");
  }
  body = data({ rankings: [] });
  await client.refresh();
  assert.equal(client.getSnapshot().status, "ready");
  assert.deepEqual(client.getSnapshot().rankings, []);
  stop();
});

test("midnight refresh requests the new JST day and disposal cancels polling and in-flight updates", async () => {
  const calls = [];
  const f = fixture(async (url) => { calls.push(url); return response(data({ date: new URL(url, "https://example.test").searchParams.get("date") })); });
  const stop = f.client.observe();
  await settle();
  f.setClock(Date.parse("2026-10-10T15:00:00Z"));
  await [...f.timers.values()][0].fn();
  assert.equal(f.client.getSnapshot().date, "2026-10-11");
  assert.ok(calls.at(-1).includes("date=2026-10-11"));
  stop();
  assert.equal(f.timers.size, 0);
  const count = calls.length;
  await f.client.refresh();
  assert.equal(calls.length, count);
  assert.equal(japanDate(Date.parse("2026-10-10T14:59:59Z")), "2026-10-10");
  assert.equal(formatTime(30123), "30.123秒");
  assert.equal(formatTime(null), "DNF");
});

test("a stalled network request times out into a retryable error", async () => {
  const { client, timers } = fixture((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  const stop = client.observe();
  [...timers.values()].find((timer) => timer.ms === 10000).fn();
  await settle();
  assert.equal(client.getSnapshot().status, "error");
  assert.equal([...timers.values()][0].ms, 30000);
  stop();
});
