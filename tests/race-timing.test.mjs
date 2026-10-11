import assert from "node:assert/strict";
import test from "node:test";
import { createInitialSession, getRaceId } from "../app/domain/race-session.js";
import { RACE_TIMEOUT } from "../app/domain/race-results.js";
import { raceSessionActions } from "../app/features/race-session/race-session-actions.js";
import { raceSessionReducer } from "../app/features/race-session/race-session-reducer.js";
import { validSession } from "../app/features/race-session/race-session-validator.js";
import { createRuntimeRunner, stepRaceRunner } from "../app/features/game/race/race-engine.js";
import { advanceRaceRuntime, createRaceRuntime, takeRaceCompletion } from "../app/features/game/race/race-runtime.js";
import { raceRecordFromSession } from "../worker/race-record.js";
import { characters } from "../app/domain/characters.js";
import { getBotInput } from "../app/features/game/race/bot-controller.js";
import { courseObstacles } from "../app/domain/course.js";

const lanes = [{ characterId: "momo", isBot: false }, { characterId: "toramaru", isBot: true }, null, null];
const waiting = () => ({ ...createInitialSession(), phase: "WAITING", lanes });
const startedAt = 100_000;
const runtime = (raceId = "test-race") => createRaceRuntime({ raceId, raceStartedAt: startedAt, lanes, now: 1000, epochNow: startedAt });
const step = (run, elapsed) => advanceRaceRuntime(run, { now: 1000 + elapsed, epochNow: startedAt + elapsed, obstacles: [] });

test("120/60/20/10/1 FPS produce the same goals and BOT controls on the actual course", () => {
  const measured = [120, 60, 20, 10, 1].map((fps) => {
    const run = createRaceRuntime({ raceId: `fps-${fps}`, raceStartedAt: startedAt, lanes, now: 0, epochNow: startedAt });
    for (let frame = 1; frame <= fps * 59 && !run.completed; frame++) {
      const now = frame * 1000 / fps;
      advanceRaceRuntime(run, { now, epochNow: startedAt + Math.round(now),
        readInput: (laneIndex, runner, lane, simulationNow) => lane.isBot
          ? getBotInput({ laneIndex, runner, now: simulationNow, obstacles: courseObstacles }) : { jump: false, boost: false } });
    }
    assert.ok(run.completed);
    return run.completed.results;
  });
  measured.forEach((results) => assert.deepEqual(results, measured[0]));
  assert.ok(measured[0].every((result) => result.finishMs !== null));
});

test("unsafe, negative and exhausted sequences are rejected before adoption", () => {
  for (const sequence of [1e100, -1, 1.5, Number.MAX_SAFE_INTEGER, Infinity]) {
    assert.equal(validSession({ ...waiting(), sequence }), false);
  }
  assert.equal(validSession({ ...waiting(), sequence: 0 }), true);
});

test("each countdown identifies one race and delayed devices share its start without countdown time", () => {
  const countdown = raceSessionReducer(waiting(), raceSessionActions.startCountdown(), startedAt);
  const onTime = raceSessionReducer(countdown, raceSessionActions.startRace(countdown.raceId), countdown.countdownEndsAt);
  const late = raceSessionReducer(countdown, raceSessionActions.startRace(countdown.raceId), countdown.countdownEndsAt + 250);
  assert.equal(onTime.raceId, countdown.raceId);
  assert.equal(late.raceId, onTime.raceId);
  assert.equal(late.raceStartedAt, onTime.raceStartedAt);
  assert.equal(late.raceStartedAt, countdown.countdownEndsAt);
  const run = createRaceRuntime({ raceId: late.raceId, raceStartedAt: late.raceStartedAt, lanes, now: 1000, epochNow: late.raceStartedAt + 250 });
  run.runners[0].progress = 99.99;
  advanceRaceRuntime(run, { now: 1016, epochNow: late.raceStartedAt + 266, obstacles: [] });
  assert.ok(run.runners[0].finishedAt > 0 && run.runners[0].finishedAt <= 266);
  assert.notEqual(raceSessionReducer(waiting(), raceSessionActions.startCountdown(), startedAt).raceId, countdown.raceId);
  const bots = raceSessionReducer({ ...waiting(), lanes: [lanes[0], null, null, null] }, raceSessionActions.fillBots(true), startedAt);
  assert.ok(bots.raceId);
  assert.equal(bots.raceStartedAt, null);
  assert.equal(bots.phase, "COUNTDOWN");
});

test("different goals are fixed in integer milliseconds even while a finisher is still landing", () => {
  const run = runtime();
  run.runners[0] = { ...run.runners[0], progress: 99.99, y: 80, vy: 100 };
  step(run, 16.4);
  assert.equal(run.runners[0].finishedAt, 8);
  assert.equal(takeRaceCompletion(run), null);
  step(run, 26.4);
  assert.equal(run.runners[0].finishedAt, 8);
  assert.ok(run.runners[0].progress > 100);
  run.runners[1].progress = 99.99;
  step(run, 36.4);
  const completed = takeRaceCompletion(run);
  assert.deepEqual(completed.results, [
    { characterId: "momo", lane: 1, rank: 1, finishMs: 8, isBot: false },
    { characterId: "toramaru", lane: 2, rank: 2, finishMs: 33, isBot: true },
  ]);
  assert.equal(completed.raceId, "test-race");
  assert.equal(completed.completedAt, startedAt + 36);
  step(run, RACE_TIMEOUT + 1000);
  assert.equal(run.completed, completed);
  assert.equal(takeRaceCompletion(run), null);
  assert.throws(() => { completed.results[0].finishMs = 1; }, TypeError);
});

test("a delayed deadline frame leaves unfinished runners DNF instead of moving them across the goal", () => {
  const run = runtime();
  run.runners[0] = { ...run.runners[0], progress: 100, finishedAt: 30000 };
  run.runners[1].progress = 99.99;
  step(run, RACE_TIMEOUT);
  const completed = takeRaceCompletion(run);
  assert.deepEqual(completed.results.map((result) => result.finishMs), [30000, null]);
  assert.equal(run.runners[1].progress, 99.99);
  assert.equal(completed.completedAt, startedAt + RACE_TIMEOUT);
  step(run, RACE_TIMEOUT + 10000);
  assert.equal(run.runners[1].finishedAt, null);
  assert.equal(takeRaceCompletion(run), null);
});

test("a sleeping monotonic clock cannot extend the deadline, and wall clock changes cannot rewrite goal times", () => {
  const asleep = runtime();
  asleep.runners[0].progress = 99.99;
  advanceRaceRuntime(asleep, { now: 1016, epochNow: startedAt + RACE_TIMEOUT, obstacles: [] });
  assert.ok(asleep.completed.results.every((result) => result.finishMs === null));
  assert.equal(asleep.completed.completedAt, startedAt + RACE_TIMEOUT);
  const run = runtime();
  run.runners[0].progress = 99.99;
  advanceRaceRuntime(run, { now: 1016, epochNow: startedAt - 5000, obstacles: [] });
  assert.equal(run.runners[0].finishedAt, 8);
});

test("new races reset clock, runners, results and stale finish/reset/start notifications are ignored", () => {
  const countdown = raceSessionReducer(waiting(), raceSessionActions.startCountdown(), startedAt);
  const first = raceSessionReducer(countdown, raceSessionActions.startRace(countdown.raceId), countdown.countdownEndsAt);
  const results = [
    { characterId: "momo", lane: 1, rank: 1, finishMs: 100, isBot: false },
    { characterId: "toramaru", lane: 2, rank: 2, finishMs: null, isBot: true },
  ];
  const finish = raceSessionActions.finishRace({ raceId: first.raceId, results, completedAt: first.raceStartedAt + RACE_TIMEOUT });
  const final = raceSessionReducer(first, finish, first.raceStartedAt + RACE_TIMEOUT);
  assert.equal(raceSessionReducer(final, finish), final);
  results[0].finishMs = 999;
  assert.equal(final.results[0].finishMs, 100);
  const nextWaiting = raceSessionReducer(final, raceSessionActions.showWaiting());
  assert.equal(nextWaiting.raceId, null);
  assert.equal(nextWaiting.raceStartedAt, null);
  assert.equal(nextWaiting.raceCompletedAt, null);
  assert.deepEqual(nextWaiting.results, []);
  const nextCountdown = raceSessionReducer(nextWaiting, raceSessionActions.startCountdown(), startedAt + 100000);
  assert.notEqual(nextCountdown.raceId, first.raceId);
  assert.equal(raceSessionReducer(nextCountdown, raceSessionActions.startRace(first.raceId)), nextCountdown);
  const next = raceSessionReducer(nextCountdown, raceSessionActions.startRace(nextCountdown.raceId), nextCountdown.countdownEndsAt);
  assert.equal(raceSessionReducer(next, finish), next);
  assert.equal(raceSessionReducer(next, raceSessionActions.resetSession(first.raceId)), next);
  const nextRun = createRaceRuntime({ raceId: next.raceId, raceStartedAt: next.raceStartedAt, lanes, now: 0, epochNow: next.raceStartedAt });
  assert.ok(nextRun.runners.every((runner) => runner.progress === 0 && runner.finishedAt === null));
  assert.equal(nextRun.elapsed, 0);
  assert.equal(nextRun.completed, null);
});

test("invalid final results are rejected and force finish supplies DNF instead of synthetic times", () => {
  const countdown = raceSessionReducer(waiting(), raceSessionActions.startCountdown(), startedAt);
  const racing = raceSessionReducer(countdown, raceSessionActions.startRace(countdown.raceId), countdown.countdownEndsAt);
  const results = lanes.flatMap((lane, index) => lane ? [{ ...lane, lane: index + 1, rank: index + 1, finishMs: 1000 }] : []);
  for (const bad of [results.slice(0, 1), [results[0], results[0]],
    [{ ...results[0], finishMs: -1 }, results[1]], [{ ...results[0], finishMs: RACE_TIMEOUT }, results[1]],
    [{ ...results[0], isBot: true }, results[1]], [{ lane: 4, rank: 1, finishMs: 1000, isBot: false }, results[1]]]) {
    assert.equal(raceSessionReducer(racing, raceSessionActions.finishRace({ raceId: racing.raceId, completedAt: racing.raceStartedAt + 1000, results: bad })), racing);
  }
  assert.equal(raceSessionReducer(racing, raceSessionActions.finishRace({ raceId: racing.raceId,
    completedAt: racing.raceStartedAt + 999, results })), racing);
  const forced = raceSessionReducer(racing, raceSessionActions.forceFinish(), racing.raceStartedAt + 1000);
  assert.deepEqual(forced.results.map((result) => result.finishMs), [null, null]);
  assert.ok(raceRecordFromSession(forced).results.every((result) => result.finishMs === null));
  const beforeStart = raceSessionReducer(countdown, raceSessionActions.forceFinish(), countdown.countdownEndsAt - 1);
  assert.equal(raceRecordFromSession(beforeStart), null);
});

test("storage uses the explicit race ID and frozen completion time, with compatibility for old sessions", () => {
  const session = { ...waiting(), phase: "RESULTS", raceId: "fixed-race", raceStartedAt: startedAt,
    raceCompletedAt: startedAt + 1000, lastSync: startedAt + 5000,
    results: lanes.flatMap((lane, index) => lane ? [{ ...lane, lane: index + 1, rank: index + 1, finishMs: 1000 }] : []) };
  const record = raceRecordFromSession(session);
  assert.equal(record.raceId, "fixed-race");
  assert.equal(record.completedAt, startedAt + 1000);
  assert.deepEqual(raceRecordFromSession({ ...session, lastSync: startedAt + 10000 }), record);
  const legacy = { ...session, raceId: undefined, raceCompletedAt: undefined };
  assert.equal(getRaceId(legacy), `${legacy.sessionId}:${startedAt}`);
  assert.equal(raceRecordFromSession(legacy).raceId, getRaceId(legacy));
  assert.equal(validSession({ ...session, raceId: 12 }), false);
  assert.equal(validSession({ ...session, raceCompletedAt: "now" }), false);
});

test("the runner captures a goal time once and never rewrites it after landing", () => {
  const args = { character: characters[0], input: { jump: false, boost: false }, obstacles: [], now: 1000, dt: 0.04 };
  const finished = stepRaceRunner({ ...args, runner: { ...createRuntimeRunner(), progress: 99.99, y: 50, vy: 100 }, elapsed: 1234.6 }).runner;
  assert.equal(finished.finishedAt, 1235);
  const landed = stepRaceRunner({ ...args, runner: finished, elapsed: 9999, dt: 1 }).runner;
  assert.equal(landed.finishedAt, 1235);
});
