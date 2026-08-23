import { characters } from "../../domain/characters.js";
import { RACE_PHASES } from "../../domain/race-session.js";

export function validSession(value) {
  if (!value || typeof value !== "object") return false;

  return value.version === 3
    && Number.isInteger(value.sequence)
    && RACE_PHASES.includes(value.phase)
    && Array.isArray(value.lanes)
    && value.lanes.length === 4
    && value.lanes.every((lane) => lane === null || (
      typeof lane === "object"
      && characters.some((character) => character.id === lane.characterId)
      && typeof lane.isBot === "boolean"
    ));
}
