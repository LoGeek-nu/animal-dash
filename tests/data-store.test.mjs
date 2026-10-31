import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { characters, retiredCharacterIds } from "../app/domain/characters.js";
import { createInitialSession } from "../app/domain/race-session.js";
import { characterImageKey, saveGeneratedCharacter } from "../app/api/characters/character-store.js";
import { getDailyRankings, getStoredCharacter, importCharacterPage, listStoredCharacters, rankingDay, resolveCharacter, saveCharacter, saveRace } from "../worker/data-store.js";
import { charactersResponse, importCharactersResponse, rankingsResponse, updateCharacterResponse } from "../worker/data-api.js";
import { normalizeCharacterText } from "../app/domain/character-text.js";
import { raceRecordFromSession, validRaceRecord } from "../worker/race-record.js";
import { gameCookie, staffCookie } from "../worker/auth.js";

// Actual workerd D1/R2 bindings, isolated from the app's local and remote data.
async function fixture(t, runtimeRoom = false) {
  const modulePaths = ["tests/fixtures/race-worker.mjs", "app/api/characters/generate/route.js", "app/api/characters/import/route.js", "worker/generation-quota.js", "worker/data-api.js", "worker/sync-access.js", "worker/auth.js", "worker/sync.js", "worker/race-session-room.js", "worker/data-store.js", "worker/race-record.js",
    "app/api/characters/character-store.js", "app/domain/characters.js", "app/domain/generated-characters.js", "app/domain/generated-stats.js", "app/domain/character-text.js",
    "app/features/race-session/race-session-validator.js", "app/domain/race-session.js", "app/domain/race-results.js",
    "app/features/race-session/constants.js", "worker/race-authority.js", "app/domain/course.js",
    "app/features/game/race/race-replay.js", "app/features/game/race/race-runtime.js", "app/features/game/race/race-engine.js", "app/features/game/race/race-ranking.js",
    "app/features/game/race/bot-controller.js", "app/features/game/race/constants.js"];
  const modules = runtimeRoom ? await Promise.all(modulePaths.map(async (path) => ({ type: "ESModule",
    path: fileURLToPath(new URL(`../${path}`, import.meta.url)), contents: await readFile(new URL(`../${path}`, import.meta.url), "utf8") }))) : true;
  const script = runtimeRoom ? {
    durableObjects: { ROOM: { className: "RaceSessionRoom", useSQLite: true } } }
    : { script: "export default { fetch() { return new Response('ok'); } };" };
  const mf = new Miniflare(convertV4MiniflareOptions({ modules, ...script,
    compatibilityDate: "2026-08-19", bindings: { STAFF_PASSCODE: "test-spectator-passcode", GAME_PASSCODE: "test-game-passcode" }, d1Databases: { DB: "test-races" }, r2Buckets: ["CHARACTERS"] }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  const bucket = await mf.getR2Bucket("CHARACTERS");
  for (const migration of ["0001_race_storage.sql", "0002_builtin_characters.sql", "0003_builtin_stats_40.sql"]) {
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
  // D1 keeps removed built-ins so their past race results stay valid.
  assert.equal(body.total, characters.length + retiredCharacterIds.length + 4);
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
  const storedIds = [...characters.map(({ id }) => id), ...retiredCharacterIds];
  for (let i = 0; i < storedIds.length; i++) await saveRace(db, bucket, race(`limit-${i}`, [result(storedIds[i], 1, 1000 + i)]));
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

test("rankings confirm persistence before returning the current race's leaderboard", async (t) => {
  const { db, bucket } = await fixture(t);
  const query = new Request("https://example.test/api/rankings?date=2026-10-10&afterRaceId=race-pending");
  const pending = await (await rankingsResponse(query, { DB: db })).json();
  assert.equal(pending.raceSaved, false);
  await saveRace(db, bucket, race("race-pending"));
  const committed = await (await rankingsResponse(query, { DB: db })).json();
  assert.equal(committed.raceSaved, true);
  assert.equal(committed.afterRaceId, "race-pending");
  assert.equal(committed.rankings[0].raceId, "race-pending");
  assert.equal((await rankingsResponse(new Request("https://example.test/api/rankings?afterRaceId="), { DB: db })).status, 400);
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
  // The newest game screen takes control, so the reporter connects last.
  const admin = await connect("admin"); const other = await connect("game"); const game = await connect("game");
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
  // Human-controlled lanes, so the finished race reaches the daily ranking.
  await send(admin, { phase: "WAITING", lanes: [{ characterId: "momo", isBot: false }, { characterId: "toramaru", isBot: false }, null, null] });
  await send(admin, { phase: "COUNTDOWN", raceId: "chosen-by-client" });
  assert.notEqual(current.raceId, "chosen-by-client");
  await clock(current.countdownEndsAt);
  await send(game, { phase: "RACING" });
  const start = current.raceStartedAt;
  await clock(start + 59_000);
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

test("API reports permanent outbox failures after a missed notification", async (t) => {
  const { db, mf } = await fixture(t, true);
  await mf.dispatchFetch("https://example.test/test-failure?raceId=failed-race");
  const env = { DB: db, RACE_SESSION: { getByName: () => ({ fetch: (url) => mf.dispatchFetch(url) }) } };
  const response = await rankingsResponse(new Request("https://example.test/api/rankings?date=2026-10-10&afterRaceId=failed-race"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.raceSaved, false);
  assert.equal(body.raceFailed, true);
});

test("after migrations, the built-in rows carry the same stats the race uses", async (t) => {
  const { db } = await fixture(t);
  for (const character of characters) {
    const row = await db.prepare("SELECT speed, acceleration, stamina, data_json FROM characters WHERE id=?").bind(character.id).first();
    assert.deepEqual({ speed: row.speed, acceleration: row.acceleration, stamina: row.stamina }, character.stats, character.id);
    assert.deepEqual(JSON.parse(row.data_json).stats, character.stats, character.id);
  }
});

test("generated characters saved before the total of 40 are read back fitted, with the type recomputed", async (t) => {
  const { db, bucket } = await fixture(t);
  // Shape of a character made with the old prompt (total 30), as found in local data.
  const old = { id: "gen-old-scale", name: "もふもふのりすさん", generated: true, preset: "ダッシュ", caption: "リス・おだやか", color: "#ff6b8a", pale: "#ffe1e8", stats: { speed: 10, acceleration: 12, stamina: 8 } };
  await saveCharacter(db, old, characterImageKey(old.id));
  for (const read of [await getStoredCharacter(db, old.id), (await listStoredCharacters(db)).find((c) => c.id === old.id), await resolveCharacter(db, bucket, old.id)]) {
    assert.equal(read.stats.speed + read.stats.acceleration + read.stats.stamina, 40);
    assert.ok(read.stats.acceleration > read.stats.speed && read.stats.speed > read.stats.stamina);
    assert.equal(read.preset, "ダッシュ");
  }
  // Built-ins are left exactly as defined.
  assert.deepEqual((await listStoredCharacters(db)).find((c) => c.id === "momo").stats, characters[0].stats);
});


test("public spectators join mid-race, reconnect and watch canonical results without acquiring control", { timeout: 15000 }, async (t) => {
  const { db, mf } = await fixture(t, true);
  const wait = async (predicate) => {
    const deadline = Date.now() + 5000;
    while (!await predicate()) { if (Date.now() > deadline) throw new Error("Missing spectator update"); await new Promise((resolve) => setTimeout(resolve, 10)); }
  };
  const passcodes = { STAFF_PASSCODE: "test-spectator-passcode", GAME_PASSCODE: "test-game-passcode" };
  const authRequest = new Request("https://example.test/api/auth");
  // Each writing role signs in with its own passcode.
  const cookies = { admin: (await staffCookie(authRequest, passcodes)).split(";")[0], game: (await gameCookie(authRequest, passcodes)).split(";")[0] };
  const connect = async (role, authenticated = false) => {
    const response = await mf.dispatchFetch(`https://example.test/api/sync?role=${role}`, { headers: {
      Upgrade: "websocket", Origin: "https://example.test", ...(authenticated ? { Cookie: cookies[role] } : {}) } });
    assert.equal(response.status, 101);
    const ws = response.webSocket, frames = [];
    ws.addEventListener("message", (event) => frames.push(JSON.parse(event.data)));
    ws.accept(); t.after(() => { try { ws.close(); } catch { /* already closed */ } });
    await wait(() => frames.some((m) => m.type === "session"));
    return { ws, frames };
  };
  for (const path of ["/api/characters/generate", "/api/characters/import"]) {
    assert.equal((await mf.dispatchFetch(`https://example.test${path}`, { method: "POST" })).status, 401, path);
  }
  for (const role of ["game", "admin"]) {
    assert.equal((await mf.dispatchFetch(`https://example.test/api/sync?role=${role}`, { headers: { Upgrade: "websocket" } })).status, 401);
  }
  const viewer = await connect("viewer");
  const admin = await connect("admin", true);
  const initial = admin.frames.find((m) => m.type === "session").session;
  admin.ws.send(JSON.stringify({ type: "session", session: { ...initial, phase: "COUNTDOWN", sequence: initial.sequence + 1 } }));
  await wait(() => admin.frames.some((m) => m.error === "game_not_connected"));
  // The newest game screen takes control from the one opened before it.
  const lastControl = (actor) => actor.frames.filter((m) => m.type === "control").at(-1)?.canControl;
  const otherGame = await connect("game", true);
  const game = await connect("game", true);
  await wait(() => lastControl(game) === true && lastControl(otherGame) === false);
  assert.equal(viewer.frames.some((m) => m.canControl === true), false);
  const session = () => admin.frames.filter((m) => m.type === "session").at(-1).session;
  const send = async (actor, patch) => {
    const sequence = session().sequence + 1;
    actor.ws.send(JSON.stringify({ type: "session", session: { ...session(), ...patch, sequence } }));
    await wait(() => session().sequence === sequence);
  };
  const clock = (now) => mf.dispatchFetch(`https://example.test/test-clock?now=${now}`);
  await clock(startedAt);
  await send(admin, { phase: "WAITING", lanes: [{ characterId: "momo", isBot: false }, { characterId: "kon", isBot: true }, null, null] });
  await send(admin, { phase: "COUNTDOWN" });
  await clock(session().countdownEndsAt);
  await send(game, { phase: "RACING" });
  const start = session().raceStartedAt, raceId = session().raceId;
  await clock(start + 500);
  game.ws.send(JSON.stringify({ type: "input", raceId, buttons: 17 }));
  await wait(() => viewer.frames.some((m) => m.type === "race-input" && m.input.buttons === 17));
  await clock(start + 5000);
  const late = await connect("viewer");
  await wait(() => late.frames.some((m) => m.type === "race"));
  const snapshot = late.frames.find((m) => m.type === "race").race;
  assert.deepEqual(snapshot.inputs, [{ at: 500, buttons: 17 }]);
  assert.equal(snapshot.raceId, raceId);
  const before = session().sequence;
  late.ws.send(JSON.stringify({ type: "session", session: { ...session(), phase: "RESULTS", sequence: before + 1, resultsForced: true } }));
  await wait(() => late.frames.some((m) => m.error === "read_only"));
  assert.equal(session().sequence, before);
  late.ws.send(JSON.stringify({ type: "input", raceId, buttons: 255 }));
  await wait(() => late.frames.filter((m) => m.error === "read_only").length === 2);
  late.ws.close();
  const reconnected = await connect("viewer");
  await wait(() => reconnected.frames.some((m) => m.type === "race"));
  assert.deepEqual(reconnected.frames.find((m) => m.type === "race").race.inputs, snapshot.inputs);
  assert.equal(reconnected.frames.some((m) => m.canControl === true), false);
  game.ws.close();
  await wait(() => lastControl(otherGame) === true);
  assert.equal(viewer.frames.some((m) => m.canControl === true), false);
  await clock(start + 59_000);
  await send(otherGame, { phase: "RESULTS" });
  await wait(() => reconnected.frames.some((m) => m.session?.phase === "RESULTS") && viewer.frames.some((m) => m.type === "results-saved"));
  const expected = session().results;
  assert.deepEqual(reconnected.frames.filter((m) => m.session?.phase === "RESULTS").at(-1).session.results, expected);
  const rows = (await db.prepare("SELECT finish_ms FROM race_results WHERE race_id=? ORDER BY lane").bind(raceId).all()).results;
  assert.deepEqual(rows.map((row) => row.finish_ms), [...expected].sort((a, b) => a.lane - b.lane).map((r) => r.finishMs));
});

test("character names and catchphrases are trimmed and cleaned of invisible characters, with no length limit", () => {
  assert.equal(normalizeCharacterText("  ふわ\u200Bふわ　 うさぎ\n"), "ふわふわ うさぎ");
  assert.equal(normalizeCharacterText("あいうえおかきくけこさしすせそ"), "あいうえおかきくけこさしすせそ");
  for (const text of ["", " \t", "\u200B", null, 12]) assert.equal(normalizeCharacterText(text), null);
});

test("staff edit generated characters' names and catchphrases through the room, which refuses ones set in a lane", { timeout: 15000 }, async (t) => {
  const { db, bucket, mf } = await fixture(t, true);
  await saveCharacter(db, await saveGeneratedCharacter(bucket, { ...gen("gen-edit"), caption: "もとの一言" }, btoa("png")), characterImageKey("gen-edit"));
  const env = { DB: db, CHARACTERS: bucket, STAFF_PASSCODE: "test-passcode",
    RACE_SESSION: { getByName: () => ({ fetch: (url, init) => mf.dispatchFetch(url, init) }) } };
  const cookie = (await staffCookie(new Request("https://example.test/api/auth"), env)).split(";")[0];
  const update = async (id, changes, headers = { Cookie: cookie }) => {
    const response = await updateCharacterResponse(new Request(`https://example.test/api/characters/${id}`,
      { method: "PATCH", headers, body: JSON.stringify(changes) }), env, id);
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  const stored = async () => {
    const row = await db.prepare("SELECT name, data_json FROM characters WHERE id = ?").bind("gen-edit").first();
    const metadata = JSON.parse((await bucket.get(characterImageKey("gen-edit"))).customMetadata.character);
    return { name: row.name, data: JSON.parse(row.data_json), metadata };
  };
  const response = await mf.dispatchFetch("https://example.test/sync?role=admin", { headers: { Upgrade: "websocket" } });
  const admin = response.webSocket;
  const frames = [];
  admin.addEventListener("message", (event) => frames.push(JSON.parse(event.data)));
  admin.accept(); t.after(() => admin.close());
  const wait = async (predicate) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() > deadline) throw new Error("Missing worker message"); await new Promise((resolve) => setTimeout(resolve, 10)); }
  };
  await wait(() => frames.some((m) => m.type === "session"));

  assert.equal((await update("gen-edit", { name: "なまえ" }, {})).status, 401);
  assert.equal((await update("gen-edit", { name: "なまえ" }, { Cookie: cookie, Origin: "https://evil.test" })).status, 403);
  for (const changes of [{ name: " \u200B " }, { caption: "" }, { name: "なまえ", caption: " " }, {}, { color: "#000" }]) {
    assert.equal((await update("gen-edit", changes)).status, 400, JSON.stringify(changes));
  }
  assert.equal((await update("momo", { name: "なまえ" })).status, 404);
  assert.equal((await update("gen-missing", { name: "なまえ" })).status, 404);
  assert.equal((await stored()).name, "生成うさぎ");

  const renamed = await update("gen-edit", { name: "  ぴょん\u200Bきち " });
  assert.equal(renamed.status, 200);
  assert.deepEqual([renamed.body.name, renamed.body.caption], ["ぴょんきち", "もとの一言"]);
  await wait(() => frames.some((m) => m.type === "characters-changed"));
  let saved = await stored();
  assert.deepEqual([saved.name, saved.data.name, saved.metadata.name, saved.data.caption, saved.metadata.caption],
    ["ぴょんきち", "ぴょんきち", "ぴょんきち", "もとの一言", "もとの一言"]);

  const recaptioned = await update("gen-edit", { caption: "はしるのだいすき" });
  assert.deepEqual([recaptioned.body.name, recaptioned.body.caption], ["ぴょんきち", "はしるのだいすき"]);
  await update("gen-edit", { name: "ぴょんた", caption: "ぴょんと跳ねる" });
  saved = await stored();
  assert.deepEqual([saved.name, saved.data.caption, saved.metadata.name, saved.metadata.caption], ["ぴょんた", "ぴょんと跳ねる", "ぴょんた", "ぴょんと跳ねる"]);
  const object = await bucket.get(characterImageKey("gen-edit"));
  assert.equal(object.httpMetadata.contentType, "image/png");
  assert.equal(await object.text(), "png");
  const listed = (await charactersResponse({ DB: db }).then((r) => r.json())).characters.find((c) => c.id === "gen-edit");
  assert.deepEqual([listed.name, listed.caption], ["ぴょんた", "ぴょんと跳ねる"]);

  const current = frames.findLast((m) => m.type === "session").session;
  admin.send(JSON.stringify({ type: "session", session: { ...current, sequence: current.sequence + 1,
    lanes: [{ characterId: "gen-edit", isBot: false }, null, null, null] } }));
  await wait(() => frames.some((m) => m.session?.sequence === current.sequence + 1));
  const refused = await update("gen-edit", { caption: "べつの一言" });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error, "character_in_use");
  assert.equal((await getStoredCharacter(db, "gen-edit")).caption, "ぴょんと跳ねる");
});
