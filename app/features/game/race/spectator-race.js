import { MAX_RACE_INPUTS } from "./constants.js";

function validInput(input) {
  return input && Number.isFinite(input.at) && input.at >= 0 && input.at <= 60_000
    && Number.isInteger(input.buttons) && input.buttons >= 0 && input.buttons <= 255;
}

// Anchor playback to server time at receipt, not the spectator device's wall clock.
// Ignore delayed frames from a previous race or an earlier connection.
export function receiveRaceUpdate(current, message, receivedAt) {
  if (message.type === "race") {
    const race = message.race;
    if (!race || typeof race.raceId !== "string" || !Number.isSafeInteger(race.startedAt) || race.startedAt <= 0
      || !Number.isFinite(race.serverNow) || !Array.isArray(race.lanes) || race.lanes.length !== 4
      || !Array.isArray(race.characters) || race.characters.length !== 4
      || !Array.isArray(race.inputs) || race.inputs.length > MAX_RACE_INPUTS
      || !race.inputs.every((input, i) => validInput(input) && (!i || input.at >= race.inputs[i - 1].at))) return current;
    if (current && (race.startedAt < current.startedAt || race.serverNow < current.serverNow)) return current;
    return { ...race, receivedAt };
  }
  if (message.type !== "race-input" || !current || message.raceId !== current.raceId
    || !validInput(message.input) || !Number.isFinite(message.serverNow) || message.serverNow < current.serverNow
    || message.input.at < (current.inputs.at(-1)?.at ?? 0)) return current;
  const last = current.inputs.at(-1);
  if (last?.at === message.input.at && last.buttons === message.input.buttons) return current;
  return { ...current, inputs: [...current.inputs, message.input], serverNow: message.serverNow, receivedAt };
}

export function spectatorElapsed(race, now) {
  return Math.max(0, Math.min(60_000, race.serverNow - race.startedAt + Math.max(0, now - race.receivedAt)));
}
