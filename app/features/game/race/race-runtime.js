import { getCharacter } from "../../../domain/characters.js";
import { courseObstacles } from "../../../domain/course.js";
import { RACE_TIMEOUT } from "./constants.js";
import { createRuntimeRunner, stepRaceRunner } from "./race-engine.js";
import { buildFinalResults } from "./race-ranking.js";

export const SIMULATION_STEP_MS = 1000 / 120;

export function createRaceRuntime({ raceId, raceStartedAt, lanes, now, epochNow, raceCharacters }) {
  if (!raceId || !Number.isSafeInteger(raceStartedAt) || raceStartedAt <= 0) throw new Error("Race identity and start time are required");
  return {
    raceId, raceStartedAt,
    lanes: lanes.map((lane) => lane ? { ...lane } : null),
    characters: lanes.map((lane, index) => {
      if (!lane) return null;
      const character = raceCharacters?.[index] ?? getCharacter(lane.characterId);
      return { ...character, stats: { ...character.stats } };
    }),
    runners: lanes.map(() => createRuntimeRunner()),
    origin: now, elapsedAtOrigin: epochNow - raceStartedAt, tick: 0, simulatedElapsed: 0, elapsed: 0,
    completed: null, reported: false,
  };
}

function completeRace(runtime) {
  runtime.completed = Object.freeze({
    raceId: runtime.raceId,
    completedAt: runtime.raceStartedAt + runtime.elapsed,
    results: Object.freeze(buildFinalResults(runtime.runners, runtime.lanes).map(Object.freeze)),
  });
}

// The hook owns scheduling and browser input. This owns one race's timing and finalization.
export function advanceRaceRuntime(runtime, { now, epochNow, readInput = () => ({ jump: false, boost: false }), onJump = () => {}, obstacles = courseObstacles }) {
  if (runtime.completed) return;
  const elapsed = runtime.elapsedAtOrigin + now - runtime.origin;
  runtime.elapsed = Math.max(runtime.elapsed, 0, Math.round(elapsed));

  // A suspended frame must not move a near-goal runner over the finish after the deadline.
  // Wall time also enforces the deadline on platforms where the monotonic clock pauses in sleep.
  if (runtime.elapsed >= RACE_TIMEOUT || epochNow - runtime.raceStartedAt >= RACE_TIMEOUT) {
    runtime.elapsed = Math.max(runtime.elapsed, Math.round(epochNow - runtime.raceStartedAt));
    completeRace(runtime);
    return;
  }
  if (elapsed < 0) return;

  // Consume every elapsed step instead of discarding time on slow frames. The
  // integer tick index also makes goal/collision times independent of paint FPS.
  while ((runtime.tick + 1) * SIMULATION_STEP_MS <= elapsed + 1e-7) {
    runtime.simulatedElapsed = ++runtime.tick * SIMULATION_STEP_MS;
    const simulationNow = runtime.simulatedElapsed;
    runtime.runners = runtime.runners.map((runner, index) => {
    const lane = runtime.lanes[index];
    if (!lane || (runner.finishedAt !== null && runner.y === 0)) return runner;
    const input = runner.finishedAt !== null ? { jump: false, boost: false } : readInput(index, runner, lane, simulationNow);
    const stepped = stepRaceRunner({ runner, character: runtime.characters[index], input, obstacles,
      now: simulationNow, dt: SIMULATION_STEP_MS / 1000, elapsed: simulationNow });
    if (stepped.jumped) onJump(index);
    return stepped.runner;
    });
    if (runtime.runners.every((runner, index) => !runtime.lanes[index] || runner.finishedAt !== null)) {
      completeRace(runtime);
      break;
    }
  }
}

export function takeRaceCompletion(runtime) {
  if (!runtime.completed || runtime.reported) return null;
  runtime.reported = true;
  return runtime.completed;
}
