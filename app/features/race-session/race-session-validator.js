import { isKnownCharacterId } from "../../domain/characters.js";
import { RACE_PHASES } from "../../domain/race-session.js";

export function validSession(value) {
  if (!value || typeof value !== "object") return false;

  return value.version === 3
    && Number.isInteger(value.sequence)
    && typeof value.sessionId === "string"
    && typeof value.courseSeed === "string"
    && Number.isFinite(value.lastSync)
    && Array.isArray(value.results)
    && RACE_PHASES.includes(value.phase)
    && Array.isArray(value.lanes)
    && value.lanes.length === 4
    && value.lanes.every((lane) => lane === null || (
      typeof lane === "object"
      && isKnownCharacterId(lane.characterId)
      && typeof lane.isBot === "boolean"
    ));
}
