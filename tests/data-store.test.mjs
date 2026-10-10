import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { characters } from "../app/domain/characters.js";
import { createInitialSession } from "../app/domain/race-session.js";
import { characterImageKey, saveGeneratedCharacter } from "../app/api/characters/character-store.js";
import { getDailyRankings, getStoredCharacter, importCharacterPage, rankingDay, saveCharacter, saveRace } from "../worker/data-store.js";
import { charactersResponse, importCharactersResponse, rankingsResponse } from "../worker/data-api.js";
import { raceRecordFromSession, validRaceRecord } from "../worker/race-record.js";
import { staffCookie } from "../worker/auth.js";

// Actual workerd D1/R2 bindings, isolated from the app's local and remote data.
async function fixture(t, runtimeRoom = false) {
  const modulePaths = ["tests/fixtures/race-worker.mjs", "worker/race-session-room.js", "worker/data-store.js", "worker/race-record.js",
    "app/api/characters/character-store.js", "app/domain/characters.js", "app/domain/generated-characters.js",
    "app/features/race-session/race-session-validator.js", "app/domain/race-session.js", "app/domain/race-results.js",
    "app/features/race-session/constants.js", "worker/race-authority.js", "app/domain/course.js",
    "app/features/game/race/race-runtime.js", "app/features/game/race/race-engine.js", "app/features/game/race/race-ranking.js",
    "app/features/game/race/bot-controller.js", "app/features/game/race/constants.js"];
  const modules = runtimeRoom ? await Promise.all(modulePaths.map(async (path) => ({ type: "ESModule",
    path: fileURLToPath(new URL(`../${path}`, import.meta.url)), contents: await readFile(new URL(`../${path}`, import.meta.url), "utf8") }))) : true;
  const script = runtimeRoom ? {
    durableObjects: { ROOM: { className: "RaceSessionRoom", useSQLite: true } } }
    : { script: "export default { fetch() { return new Response('ok'); } };" };
  const mf = new Miniflare(convertV4MiniflareOptions({ modules, ...script,
    compatibilityDate: "2026-08-19", d1Databases: { DB: "test-races" }, r2Buckets: ["CHARACTERS"] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  const bucket = await mf.getR2Bucket("CHARACTERS");
  for (const migration of ["0001_race_storage.sql", "0002_builtin_characters.sql"]) {
    const sql = await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8");
    await db.batch(sql.split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
  }
  return { db, bucket, mf };
}

const startedAt = Date.parse("2026-10-10T12:00:00+09:00");
const result = (id, lane, finishMs, isBot = false) => ({ characterId: id, lane, rank: lane, finishMs, isBot });
const race = (raceId, results = [result("momo", 1, 30000)], start = startedAt) => ({ raceId,
  startedAt: start, completedAt: start + 60000, courseSeed: "oureisai-2026-demo", results });
const gen = (id) => ({ ...characters[0], id, name: "生成うさぎ", generated: true });

test("D1 preserves character IDs, stats and image keys; imports old R2 metadata without changing images", async (t) => {
  const { db, bucket } = await fixture(t);
  await saveCharacter(db, gen("gen-new"), characterImageKey("gen-new"));
  assert.equal((await getStoredCharacter(db, "gen-new")).imageUrl, "/api/characters/gen-new/image");
  assert.deepEqual((await getStoredCharacter(db, "gen-new")).stats, characters[0].stats);
  assert.equal((await db.prepare("SELECT image_key FROM characters WHERE id = ?").bind("gen-new").first()).image_key, "characters/gen-new.png");
  for (const id of ["gen-old-a", "gen-old-b", "gen-old-c"]) await saveGeneratedCharacter(bucket, gen(id), btoa("png"));
  await bucket.put("characters/broken.png", "png", { customMetadata: { character: "{" } });
  await bucket.put("characters/mismatch.png", "png", { customMetadata: { character: JSON.stringify(gen("momo")) } });
  // Force pagination while still using the real R2 list response.
  const pagedBucket = { list: (options) => bucket.list({ ...options, limit: 2 }) };
  let cursor;
  let imported = 0;
  const skipped = [];
  do {
    const page = await importCharacterPage(db, pagedBucket, cursor);
    imported += page.imported;
    skipped.push(...page.skipped);
    cursor = page.cursor;
  } while (cursor);
  assert.equal(imported, 3);
  assert.equal(skipped.length, 2);
  await importCharacterPage(db, bucket);
  const response = await charactersResponse({ DB: db });
  const body = await response.json();
  assert.equal(body.total, characters.length + 4);
  assert.equal(body.characters.find((c) => c.id === "gen-old-a").name, "生成うさぎ");
  assert.equal(await (await bucket.get("characters/gen-old-a.png")).text(), "png");
});

test("final results are atomic, idempotent and immutable, and reference static and generated characters", async (t) => {
  const { db, bucket } = await fixture(t);
  await saveGeneratedCharacter(bucket, gen("gen-racer"), btoa("png"));
  const record = race("race-one", [result("momo", 1, 30000), result("gen-racer", 2, null, true)]);
  await saveRace(db, bucket, record);
  assert.equal((await saveRace(db, bucket, { ...record, results: [...record.results].reverse() })).duplicate, true);
  await Promise.all([saveRace(db, bucket, record), saveRace(db, bucket, record)]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM races").first()).count, 1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM race_results").first()).count, 2);
  assert.ok(await getStoredCharacter(db, "gen-racer"));
  await assert.rejects(saveRace(db, bucket, race("race-one", [result("momo", 1, 1)])), /different results/);
  await assert.rejects(saveRace(db, bucket, race("unknown", [result("no-such-character", 1, 1)])), /Unknown character/);
  assert.equal(await db.prepare("SELECT * FROM races WHERE id = 'unknown'").first(), null);
  // A real SQL constraint failure rolls back the whole D1 batch.
  await assert.rejects(db.batch([
    db.prepare("INSERT INTO races VALUES ('rollback', 1, 2, 'course', '{}')"),
    db.prepare("INSERT INTO race_results VALUES ('rollback', 'missing', 1, 1, 100, 0, '{}')"),
  ]), /FOREIGN KEY/);
  assert.equal(await db.prepare("SELECT * FROM races WHERE id = 'rollback'").first(), null);
});

test("daily rankings use JST, per-character bests, competition ties and exclude BOT/DNF", async (t) => {
  const { db, bucket } = await fixture(t);
  const day = rankingDay("2026-10-10");
  await saveRace(db, bucket, race("before", [result("momo", 1, 1)], day.start - 1));
  await saveRace(db, bucket, race("first", [result("momo", 1, 30000), result("toramaru", 2, 25000), result("kon", 3, 1, true), result("penta", 4, null)], day.start));
  await saveRace(db, bucket, race("best", [result("momo", 1, 25000), result("panko", 2, 28000)], day.end - 1));
  await saveRace(db, bucket, race("after", [result("momo", 1, 2)], day.end));
  const board = await getDailyRankings(db, { date: "2026-10-10" });
  assert.equal(board.timezone, "Asia/Tokyo");
  assert.equal(board.mock, false);
  assert.deepEqual(board.rankings.map((r) => [r.characterId, r.rank, r.finishMs]), [["momo", 1, 25000], ["toramaru", 1, 25000], ["panko", 3, 28000]]);
  assert.equal(board.rankings[0].raceId, "best");
  // Rankings retain the name/stats of the best attempt even if the catalog later changes.
  await saveCharacter(db, { ...characters[0], name: "変更後", stats: { speed: 1, acceleration: 1, stamina: 1 } });
  assert.equal((await getDailyRankings(db, { date: "2026-10-10" })).rankings[0].displayName, "ももラビ");
  assert.deepEqual((await getDailyRankings(db, { date: "2026-10-11" })).rankings.map((r) => r.finishMs), [2]);
  assert.deepEqual((await getDailyRankings(db, { date: "2026-10-12" })).rankings, []);
});

test("TOP 3/TOP 10 API limits and errors are explicit and import requires staff authorization", async (t) => {
  const { db, bucket } = await fixture(t);
  for (let i = 0; i < characters.length; i++) await saveRace(db, bucket, race(`limit-${i}`, [result(characters[i].id, 1, 1000 + i)]));
  const env = { DB: db, CHARACTERS: bucket, STAFF_PASSCODE: "test-passcode" };
  const request = (query = "") => new Request(`https://example.test/api/rankings?${query}`);
  assert.equal((await (await rankingsResponse(request("date=2026-10-10&limit=3"), env)).json()).rankings.length, 3);
  assert.equal((await (await rankingsResponse(request("date=2026-10-10&limit=10"), env)).json()).rankings.length, 10);
  for (const query of ["date=2026-02-30", "date=bad", "limit=11", "limit=0", "limit=3.5", "limit="]) {
    assert.equal((await rankingsResponse(request(query), env)).status, 400);
  }
  assert.equal((await rankingsResponse(request(), {})).status, 503);
  t.mock.method(console, "error", () => {});
  assert.equal((await rankingsResponse(request(), { DB: { prepare() { throw new Error("offline"); } } })).status, 503);
  assert.equal((await importCharactersResponse(new Request("https://example.test/api/characters/import", { method: "POST" }), env)).status, 401);
  const cookie = (await staffCookie(new Request("https://example.test/api/auth"), env)).split(";")[0];
  const response = await importCharactersResponse(new Request("https://example.test/api/characters/import", { method: "POST", headers: { Cookie: cookie } }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).done, true);
});

test("session adapter distinguishes consecutive races and rejects invalid or mismatched results", () => {
  const session = { phase: "RESULTS", sessionId: "session-demo", raceStartedAt: startedAt, lastSync: startedAt + 60000,
    courseSeed: "course", lanes: [{ characterId: "momo", isBot: false }, null, null, null], results: [result("momo", 1, 30000)] };
  assert.notEqual(raceRecordFromSession(session).raceId, raceRecordFromSession({ ...session, raceStartedAt: startedAt + 1 }).raceId);
  assert.equal(raceRecordFromSession({ ...session, raceId: "explicit-id" }).raceId, "explicit-id");
  assert.equal(raceRecordFromSession({ ...session, resultsForced: true }).results[0].finishMs, null);
  assert.equal(raceRecordFromSession({ ...session, raceStartedAt: null }), null);
  assert.throws(() => raceRecordFromSession({ ...session, lanes: [null, null, null, null] }), /starting lanes/);
  assert.throws(() => raceRecordFromSession({ ...session, results: [result("momo", 1, -1)] }), /Invalid race/);
  assert.equal(validRaceRecord(race("fraction", [result("momo", 1, 1.5)])), false);
});

test("workerd validates race registration, ownership, canonical times, immutability and DNF persistence", { timeout: 15000 }, async (t) => {
  const { db, mf } = await fixture(t, true);
  const messages = new Map();
  const connect = async (role) => {
    const response = await mf.dispatchFetch(`https://example.test/sync?role=${role}`, { headers: { Upgrade: "websocket" } });
    const ws = response.webSocket;
    const frames = []; messages.set(ws, frames);
    ws.addEventListener("message", (event) => frames.push(JSON.parse(event.data)));
    ws.accept(); t.after(() => ws.close()); return ws;
  };
  const admin = await connect("admin"); const game = await connect("game"); const other = await connect("game");
  const received = messages.get(game);
  const wait = async (predicate) => {
    const deadline = Date.now() + 5000;
    while (!await predicate()) { if (Date.now() > deadline) throw new Error("Missing worker acknowledgement"); await new Promise((resolve) => setTimeout(resolve, 10)); }
  };
  const clock = (now) => mf.dispatchFetch(`https://example.test/test-clock?now=${now}`);
  let current = createInitialSession();
  const send = async (ws, patch, accepted = true) => {
    const next = { ...current, sequence: current.sequence + 1, ...patch };
    const frames = messages.get(ws);
    const offset = frames.length;
    ws.send(JSON.stringify({ type: "session", session: next }));
    await wait(() => frames.slice(offset).some((m) => accepted ? m.session?.sequence === next.sequence : m.type === "error"));
    if (accepted) current = frames.slice(offset).find((m) => m.session?.sequence === next.sequence).session;
  };
  await clock(startedAt);
  await send(admin, { phase: "RESULTS", raceId: "forged", raceStartedAt: startedAt - 1000, raceCompletedAt: startedAt,
    results: [result("momo", 1, 1)] }, false);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM races").first()).count, 0);
  await send(admin, { phase: "WAITING" });
  await send(admin, { phase: "COUNTDOWN", raceId: "chosen-by-client" });
  assert.notEqual(current.raceId, "chosen-by-client");
  await clock(current.countdownEndsAt);
  await send(game, { phase: "RACING" });
  const start = current.raceStartedAt;
  await clock(start + 20000);
  await send(other, { phase: "RESULTS", results: [result("momo", 1, 1)] }, false);
  await send(game, { phase: "RESULTS", results: [result("momo", 1, 1)], raceCompletedAt: start + 1 });
  const canonical = current;
  await wait(() => received.some((m) => m.type === "results-saved" && m.raceId === canonical.raceId));
  const rows = (await db.prepare("SELECT character_id, finish_ms FROM race_results WHERE race_id=? ORDER BY lane").bind(canonical.raceId).all()).results;
  assert.deepEqual(rows.map((r) => r.finish_ms), canonical.results.map((r) => r.finishMs));
  assert.ok(rows.every((r) => r.finish_ms > 10000));
  await send(game, { results: canonical.results.map((r) => ({ ...r, finishMs: 900 })) }, false);
  assert.equal((await db.prepare("SELECT finish_ms FROM race_results WHERE race_id=? AND lane=1").bind(canonical.raceId).first()).finish_ms, canonical.results[0].finishMs);
  await send(admin, { phase: "WAITING" });
  await send(admin, { phase: "COUNTDOWN" });
  await clock(current.countdownEndsAt);
  await send(game, { phase: "RACING" });
  await clock(current.raceStartedAt + 1000);
  await send(admin, { phase: "RESULTS", resultsForced: true });
  await wait(() => received.some((m) => m.type === "results-saved" && m.raceId === current.raceId));
  assert.ok((await db.prepare("SELECT finish_ms FROM race_results WHERE race_id=?").bind(current.raceId).all()).results.every((r) => r.finish_ms === null));
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM races").first()).count, 2);
  assert.equal((await getDailyRankings(db, { date: "2026-10-10" })).rankings.length, 2);
});
