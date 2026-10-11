import { characters } from "../app/domain/characters.js";
import { characterImageUrl, characterImageKey } from "../app/api/characters/character-store.js";
import { validRaceRecord } from "./race-record.js";

export class RaceStorageError extends Error {
  constructor(code, message) { super(message); this.code = code; this.permanent = true; }
}

function characterFromRow(row) {
  const character = JSON.parse(row.data_json);
  return { ...character, name: row.name, stats: { speed: row.speed, acceleration: row.acceleration, stamina: row.stamina },
    ...(row.image_key ? { imageUrl: characterImageUrl(row.id) } : {}) };
}

function validCharacter(character) {
  return character && typeof character.id === "string" && character.id.length > 0 && character.id.length <= 200
    && typeof character.name === "string" && character.name.length > 0
    && ["speed", "acceleration", "stamina"].every((key) => Number.isFinite(character.stats?.[key]) && character.stats[key] >= 0);
}

export function characterStatement(db, character, imageKey = null, createdAt = Date.now()) {
  if (!validCharacter(character)) throw new Error("Invalid character metadata");
  const data = { ...character };
  delete data.imageUrl;
  return db.prepare(`INSERT INTO characters (id, name, speed, acceleration, stamina, image_key, generated, data_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, speed=excluded.speed, acceleration=excluded.acceleration,
      stamina=excluded.stamina, image_key=excluded.image_key, generated=excluded.generated, data_json=excluded.data_json`)
    .bind(character.id, character.name, character.stats.speed, character.stats.acceleration, character.stats.stamina,
      imageKey, character.generated ? 1 : 0, JSON.stringify(data), createdAt);
}

export async function saveCharacter(db, character, imageKey = null, createdAt = Date.now()) {
  await characterStatement(db, character, imageKey, createdAt).run();
  return { ...character, ...(imageKey ? { imageUrl: characterImageUrl(character.id) } : {}) };
}

export async function getStoredCharacter(db, id) {
  const row = await db.prepare("SELECT * FROM characters WHERE id = ?").bind(id).first();
  return row ? characterFromRow(row) : null;
}

export async function listStoredCharacters(db) {
  const { results } = await db.prepare("SELECT * FROM characters ORDER BY generated, created_at, id").all();
  return results.map(characterFromRow);
}

// One R2 page per call; repeat with cursor until done. Safe to rerun after partial failure.
export async function importCharacterPage(db, bucket, cursor) {
  const page = await bucket.list({ prefix: "characters/", cursor, limit: 100, include: ["customMetadata"] });
  const statements = [];
  const skipped = [];
  for (const object of page.objects) {
    try {
      const character = JSON.parse(object.customMetadata?.character ?? "");
      if (!character.generated || object.key !== characterImageKey(character.id)) throw new Error("Image key mismatch");
      statements.push(characterStatement(db, character, object.key, new Date(object.uploaded).getTime()));
    } catch {
      skipped.push(object.key);
    }
  }
  if (statements.length) await db.batch(statements);
  return { imported: statements.length, skipped, cursor: page.truncated ? page.cursor : null, done: !page.truncated };
}

export async function resolveCharacter(db, bucket, id) {
  const builtin = characters.find((character) => character.id === id);
  if (builtin) return builtin;
  const stored = await getStoredCharacter(db, id);
  if (stored) return stored;
  const object = await bucket?.head(characterImageKey(id));
  if (!object) throw new RaceStorageError("unknown_character", `Unknown character: ${id}`);
  let character;
  try { character = JSON.parse(object.customMetadata?.character ?? ""); }
  catch { throw new RaceStorageError("invalid_character", "Invalid character metadata"); }
  if (character.id !== id || !character.generated || !validCharacter(character)) throw new RaceStorageError("invalid_character", "Invalid character metadata");
  return character;
}

export async function saveRace(db, bucket, race) {
  if (!validRaceRecord(race)) throw new RaceStorageError("invalid_results", "Invalid race results");
  // First submission wins, including DNF. A resend never rewrites a finalized result.
  const normalized = { raceId: race.raceId, startedAt: race.startedAt, completedAt: race.completedAt, courseSeed: race.courseSeed,
    results: race.results.map(({ characterId, lane, rank, finishMs, isBot }) => ({ characterId, lane, rank, finishMs, isBot }))
      .sort((a, b) => a.lane - b.lane) };
  const payload = JSON.stringify(normalized);
  const existing = await db.prepare("SELECT payload_json FROM races WHERE id = ?").bind(race.raceId).first();
  if (existing) {
    if (existing.payload_json !== payload) throw new RaceStorageError("result_conflict", "Race already saved with different results");
    return { raceId: race.raceId, duplicate: true };
  }
  const entrants = await Promise.all(race.results.map((result) => resolveCharacter(db, bucket, result.characterId)));
  const statements = entrants.map((character) => characterStatement(db, character,
    character.generated ? characterImageKey(character.id) : null));
  statements.push(db.prepare(`INSERT INTO races (id, started_at, completed_at, course_seed, payload_json)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(race.raceId, race.startedAt, race.completedAt, race.courseSeed, payload));
  for (let index = 0; index < race.results.length; index += 1) {
    const result = race.results[index];
    statements.push(db.prepare(`INSERT INTO race_results (race_id, character_id, lane, rank, finish_ms, is_bot, character_snapshot)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT payload_json FROM races WHERE id = ?) = ?
      ON CONFLICT(race_id, lane) DO NOTHING`).bind(race.raceId, result.characterId, result.lane, result.rank, result.finishMs,
      result.isBot ? 1 : 0, JSON.stringify(entrants[index]), race.raceId, payload));
  }
  // D1 batch is atomic: character relations, race and every entrant commit together.
  await db.batch(statements);
  const saved = await db.prepare("SELECT payload_json FROM races WHERE id = ?").bind(race.raceId).first();
  if (saved.payload_json !== payload) throw new RaceStorageError("result_conflict", "Race already saved with different results");
  return { raceId: race.raceId, duplicate: false };
}

export const RANKING_TIMEZONE = "Asia/Tokyo";
const JST_OFFSET = 9 * 60 * 60 * 1000;

export function rankingDay(date = new Date(Date.now() + JST_OFFSET).toISOString().slice(0, 10)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
  const midnight = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) throw new Error("Invalid calendar date");
  return { date, start: midnight - JST_OFFSET, end: midnight - JST_OFFSET + 24 * 60 * 60 * 1000 };
}

export async function getDailyRankings(db, { date, limit = 10 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("limit must be an integer from 1 to 10");
  const day = rankingDay(date);
  const { results } = await db.prepare(`WITH attempts AS (
    SELECT rr.*, r.started_at, ROW_NUMBER() OVER (
      PARTITION BY rr.character_id ORDER BY rr.finish_ms, r.started_at, rr.race_id, rr.lane
    ) AS attempt FROM race_results rr JOIN races r ON r.id = rr.race_id
    WHERE r.started_at >= ? AND r.started_at < ? AND rr.finish_ms IS NOT NULL AND rr.is_bot = 0
  ), best AS (SELECT * FROM attempts WHERE attempt = 1)
  SELECT *, RANK() OVER (ORDER BY finish_ms) AS daily_rank FROM best
  ORDER BY finish_ms, character_id LIMIT ?`).bind(day.start, day.end, limit).all();
  return { date: day.date, timezone: RANKING_TIMEZONE, metric: "finishMs", unit: "milliseconds",
    tiePolicy: "competition", botsIncluded: false, mock: false,
    rankings: results.map((row) => {
      const character = JSON.parse(row.character_snapshot);
      if (character.generated) character.imageUrl = characterImageUrl(character.id);
      return { rank: row.daily_rank, characterId: row.character_id, displayName: character.name,
        character, finishMs: row.finish_ms, raceId: row.race_id };
    }) };
}
