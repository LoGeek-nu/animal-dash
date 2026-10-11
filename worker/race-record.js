import { RACE_TIMEOUT } from "../app/domain/race-results.js";

// Storage contract for #45. finishMs is integer milliseconds; null means DNF.
export function validRaceRecord(race) {
  if (!race || typeof race !== "object") return false;
  const validId = (id) => typeof id === "string" && id.length > 0 && id.length <= 200;
  const validTime = (time) => Number.isSafeInteger(time) && time > 0 && time <= 8_640_000_000_000_000;
  return validId(race.raceId)
    && validTime(race.startedAt)
    && validTime(race.completedAt) && race.completedAt >= race.startedAt
    && validId(race.courseSeed)
    && Array.isArray(race.results) && race.results.length > 0 && race.results.length <= 4
    && new Set(race.results.map((result) => result?.lane)).size === race.results.length
    && new Set(race.results.map((result) => result?.characterId)).size === race.results.length
    && race.results.every((result) => result && validId(result.characterId)
      && Number.isInteger(result.lane) && result.lane >= 1 && result.lane <= 4
      && Number.isInteger(result.rank) && result.rank >= 1 && result.rank <= race.results.length
      && typeof result.isBot === "boolean"
      && (result.finishMs === null || (Number.isSafeInteger(result.finishMs) && result.finishMs >= 0
        && result.finishMs < RACE_TIMEOUT && result.finishMs <= race.completedAt - race.startedAt)));
}

export function raceRecordFromSession(session) {
  if (session.phase !== "RESULTS" || !Number.isSafeInteger(session.raceStartedAt) || session.raceStartedAt <= 0) return null;
  const race = {
    // Compatibility for saved sessions from before explicit race IDs were introduced.
    raceId: session.raceId ?? `${session.sessionId}:${session.raceStartedAt}`,
    startedAt: session.raceStartedAt,
    completedAt: session.raceCompletedAt ?? session.lastSync,
    courseSeed: session.courseSeed,
    results: session.results.map((result) => ({ ...result, finishMs: session.resultsForced ? null : result.finishMs })),
  };
  if (!validRaceRecord(race)) throw new Error("Invalid race results");
  const active = session.lanes.filter(Boolean);
  if (active.length !== race.results.length || !race.results.every((result) => {
    const lane = session.lanes[result.lane - 1];
    return lane?.characterId === result.characterId && lane.isBot === result.isBot;
  })) throw new Error("Race results do not match the starting lanes");
  return race;
}
