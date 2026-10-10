import { isKnownCharacterId } from "../../domain/characters.js";
import { RACE_PHASES } from "../../domain/race-session.js";

// isKnownId is swapped out by the sync room, which checks generated characters against R2 instead of the local pool.
export function validSession(value, isKnownId = isKnownCharacterId) {
  if (!value || typeof value !== "object") return false;

  return value.version === 3
    && Number.isSafeInteger(value.sequence) && value.sequence >= 0 && value.sequence < Number.MAX_SAFE_INTEGER
    && typeof value.sessionId === "string"
    && (value.raceId == null || (typeof value.raceId === "string" && value.raceId.length > 0 && value.raceId.length <= 200))
    && (value.raceCompletedAt == null || (Number.isSafeInteger(value.raceCompletedAt) && value.raceCompletedAt > 0))
    && typeof value.courseSeed === "string"
    && Number.isFinite(value.lastSync)
    && Array.isArray(value.results)
    && RACE_PHASES.includes(value.phase)
    && Array.isArray(value.lanes)
    && value.lanes.length === 4
    && value.lanes.every((lane) => lane === null || (
      typeof lane === "object"
      && isKnownId(lane.characterId)
      && typeof lane.isBot === "boolean"
    ));
}
