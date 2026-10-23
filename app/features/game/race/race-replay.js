import { createRaceRuntime, advanceRaceRuntime, SIMULATION_STEP_MS } from "./race-runtime.js";

// Both the authoritative result and spectators replay server-timestamped inputs.
export function createRaceReplay(race) {
  return { runtime: createRaceRuntime({ raceId: race.raceId, raceStartedAt: race.startedAt,
    lanes: race.lanes, raceCharacters: race.characters, now: 0, epochNow: race.startedAt }),
  inputs: race.inputs, cursor: 0, buttons: 0, jumps: 0 };
}

export function advanceRaceReplay(replay, elapsed) {
  const { runtime, inputs } = replay;
  const end = Math.min(60_000, Math.max(0, elapsed));
  while ((runtime.tick + 1) * SIMULATION_STEP_MS <= end + 1e-7 && !runtime.completed) {
    const time = (runtime.tick + 1) * SIMULATION_STEP_MS;
    while (replay.cursor < inputs.length && inputs[replay.cursor].at <= time) {
      const next = inputs[replay.cursor++].buttons;
      replay.jumps |= (next & ~replay.buttons) & 15;
      replay.buttons = next;
    }
    advanceRaceRuntime(runtime, { now: time, epochNow: runtime.raceStartedAt + time,
      readInput: (index) => ({ jump: Boolean(replay.jumps & (1 << index)), boost: Boolean(replay.buttons & (1 << (index + 4))) }),
      onJumpInput: (index) => { replay.jumps &= ~(1 << index); } });
  }
  return runtime;
}
