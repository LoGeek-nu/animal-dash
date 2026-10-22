import { courseObstacles } from "../app/domain/course.js";
import { createRaceRuntime, advanceRaceRuntime, SIMULATION_STEP_MS } from "../app/features/game/race/race-runtime.js";
import { getRaceInput } from "../app/features/game/race/race-input.js";

// The room records when inputs arrive. A client cannot backdate inputs or supply
// a goal time. Replaying the same fixed-step engine yields the canonical result.
export function replayRace(race, now) {
  const runtime = createRaceRuntime({ raceId: race.raceId, raceStartedAt: race.startedAt,
    lanes: race.lanes, raceCharacters: race.characters, now: 0, epochNow: race.startedAt });
  let cursor = 0;
  let buttons = 0;
  let jumps = 0;
  const elapsed = Math.min(60_000, Math.max(0, now - race.startedAt));
  for (let tick = 1; tick * SIMULATION_STEP_MS <= elapsed + 1e-7 && !runtime.completed; tick++) {
    const time = tick * SIMULATION_STEP_MS;
    while (cursor < race.inputs.length && race.inputs[cursor].at <= time) {
      const next = race.inputs[cursor++].buttons;
      jumps |= (next & ~buttons) & 15;
      buttons = next;
    }
    advanceRaceRuntime(runtime, { now: time, epochNow: race.startedAt + time,
      readInput: (index, runner, lane, simulationNow) => getRaceInput({ lane, laneIndex: index, runner,
        now: simulationNow, obstacles: courseObstacles,
        manualInput: { jump: Boolean(jumps & (1 << index)), boost: Boolean(buttons & (1 << (index + 4))) } }),
      onJumpInput: (index) => { jumps &= ~(1 << index); } });
  }
  return runtime.completed;
}
