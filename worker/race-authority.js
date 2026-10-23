import { createRaceReplay, advanceRaceReplay } from "../app/features/game/race/race-replay.js";

// A client cannot backdate inputs or supply a goal time. The room's input log
// drives both the canonical result and every spectator's deterministic replay.
export function replayRace(race, now) {
  return advanceRaceReplay(createRaceReplay(race), now - race.startedAt).completed;
}
