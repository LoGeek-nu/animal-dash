import { getCharacter } from "../../../domain/characters.js";
import { courseObstacles } from "../../../domain/course.js";
import { MAX_FRAME_DELTA, RACE_TIMEOUT } from "./constants.js";
import { createRuntimeRunner, stepRaceRunner } from "./race-engine.js";
import { buildFinalResults } from "./race-ranking.js";

export function createRaceRuntime({ raceId, raceStartedAt, lanes, now, epochNow }) {
  if (!raceId || !Number.isSafeInteger(raceStartedAt) || raceStartedAt <= 0) throw new Error("Race identity and start time are required");
  return {
    raceId, raceStartedAt,
    lanes: lanes.map((lane) => lane ? { ...lane } : null),
    characters: lanes.map((lane) => {
      if (!lane) return null;
      const character = getCharacter(lane.characterId);
      return { ...character, stats: { ...character.stats } };
    }),
    runners: lanes.map(() => createRuntimeRunner()),
    origin: now, elapsedAtOrigin: epochNow - raceStartedAt, lastFrame: now, elapsed: 0,
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
  const dt = Math.min(MAX_FRAME_DELTA, Math.max(0, now - runtime.lastFrame) / 1000);
  runtime.lastFrame = now;

  // A suspended frame must not move a near-goal runner over the finish after the deadline.
  // Wall time also enforces the deadline on platforms where the monotonic clock pauses in sleep.
  if (runtime.elapsed >= RACE_TIMEOUT || epochNow - runtime.raceStartedAt >= RACE_TIMEOUT) {
    runtime.elapsed = Math.max(runtime.elapsed, Math.round(epochNow - runtime.raceStartedAt));
    completeRace(runtime);
    return;
  }
  if (elapsed < 0) return;

  runtime.runners = runtime.runners.map((runner, index) => {
    const lane = runtime.lanes[index];
    if (!lane || (runner.finishedAt !== null && runner.y === 0)) return runner;
    const input = runner.finishedAt !== null ? { jump: false, boost: false } : readInput(index, runner, lane);
    const stepped = stepRaceRunner({ runner, character: runtime.characters[index], input, obstacles, now, dt, elapsed: runtime.elapsed });
    if (stepped.jumped) onJump(index);
    return stepped.runner;
  });
  if (runtime.runners.every((runner, index) => !runtime.lanes[index] || runner.finishedAt !== null)) completeRace(runtime);
}

export function takeRaceCompletion(runtime) {
  if (!runtime.completed || runtime.reported) return null;
  runtime.reported = true;
  return runtime.completed;
}
