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
import { calculateLiveRanks } from "../app/features/game/race/race-ranking.js";
import { replayRace } from "../worker/race-authority.js";

const lanes = [{ characterId: "momo", isBot: false }, { characterId: "toramaru", isBot: true }, null, null];
const waiting = () => ({ ...createInitialSession(), phase: "WAITING", lanes });
const startedAt = 100_000;
const runtime = (raceId = "test-race") => createRaceRuntime({ raceId, raceStartedAt: startedAt, lanes, now: 1000, epochNow: startedAt });
const step = (run, elapsed) => advanceRaceRuntime(run, { now: 1000 + elapsed, epochNow: startedAt + elapsed, obstacles: [] });

test("keyboard/gamepad input on BOT lanes cannot change displayed goals or ranks from the server result", () => {
  const botLanes = ["kon", "momo", "toramaru", "panko"].map((characterId) => ({ characterId, isBot: true }));
  const canonical = replayRace({ raceId: "bot-input", startedAt, lanes: botLanes,
    characters: botLanes.map(({ characterId }) => characters.find(({ id }) => id === characterId)), inputs: [] }, startedAt + 59_000);
  // Even if every controller is pressed, the on-screen BOTs must keep their automatic inputs.
  for (const fps of [120, 60, 20]) {
    const run = createRaceRuntime({ raceId: "bot-input", raceStartedAt: startedAt, lanes: botLanes, now: 0, epochNow: startedAt });
    for (let frame = 1; frame <= fps * 59 && !run.completed; frame++) {
      const now = frame * 1000 / fps;
      advanceRaceRuntime(run, { now, epochNow: startedAt + now,
        readInput: () => ({ jump: true, boost: true }) });
    }
    assert.deepEqual(run.completed.results, canonical.results, `${fps} FPS`);
    const liveRanks = calculateLiveRanks(run.runners, botLanes);
    for (const result of canonical.results) assert.equal(liveRanks[result.lane - 1], result.rank);
  }
  assert.ok(canonical.results.every(({ finishMs }) => finishMs !== null));
  const withBotInputs = replayRace({ raceId: "bot-input", startedAt, lanes: botLanes,
    characters: botLanes.map(({ characterId }) => characters.find(({ id }) => id === characterId)),
    inputs: [{ at: 0, buttons: 255 }, { at: 500, buttons: 0 }, { at: 1000, buttons: 255 }] }, startedAt + 59_000);
  assert.deepEqual(withBotInputs.results, canonical.results);
});

test("player jump input still reaches the runner", () => {
  const lane = { characterId: "kon", isBot: false };
  const run = createRaceRuntime({ raceId: "player-jump", raceStartedAt: startedAt, lanes: [lane], now: 0, epochNow: startedAt });
  let consumed = 0;
  advanceRaceRuntime(run, { now: 10, epochNow: startedAt + 10, obstacles: [],
    readInput: () => ({ jump: true, boost: false }),
    onJumpInput: () => { consumed++; } });
  assert.ok(run.runners[0].y > 0);
  assert.equal(consumed, 1);
});

test("player lanes still use manual boost while BOT lanes ignore it", () => {
  const finish = (isBot, boost) => {
    const lane = { characterId: "kon", isBot };
    const run = createRaceRuntime({ raceId: "player-input", raceStartedAt: startedAt, lanes: [lane], now: 0, epochNow: startedAt });
    for (let frame = 1; frame <= 60 * 59 && !run.completed; frame++) {
      const now = frame * 1000 / 60;
      advanceRaceRuntime(run, { now, epochNow: startedAt + now,
        readInput: () => ({ jump: false, boost }) });
    }
    return run.completed.results[0].finishMs;
  };
  assert.ok(finish(false, true) < finish(false, false));
  assert.equal(finish(true, true), finish(true, false));
});

test("120/60/20/10/1 FPS produce the same goals and BOT controls on the actual course", () => {
  const measured = [120, 60, 20, 10, 1].map((fps) => {
    const run = createRaceRuntime({ raceId: `fps-${fps}`, raceStartedAt: startedAt, lanes, now: 0, epochNow: startedAt });
    for (let frame = 1; frame <= fps * 59 && !run.completed; frame++) {
      const now = frame * 1000 / fps;
      advanceRaceRuntime(run, { now, epochNow: startedAt + Math.round(now) });
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
  // Runners near the goal are already up to speed; a standing start would take a while to cross.
  run.runners[0] = { ...run.runners[0], progress: 99.99, velocity: 9, y: 80, vy: 100 };
  step(run, 16.4);
  assert.equal(run.runners[0].finishedAt, 8);
  assert.equal(takeRaceCompletion(run), null);
  step(run, 26.4);
  assert.equal(run.runners[0].finishedAt, 8);
  assert.ok(run.runners[0].progress > 100);
  run.runners[1] = { ...run.runners[1], progress: 99.99, velocity: 9 };
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
  asleep.runners[0] = { ...asleep.runners[0], progress: 99.99, velocity: 9 };
  advanceRaceRuntime(asleep, { now: 1016, epochNow: startedAt + RACE_TIMEOUT, obstacles: [] });
  assert.ok(asleep.completed.results.every((result) => result.finishMs === null));
  assert.equal(asleep.completed.completedAt, startedAt + RACE_TIMEOUT);
  const run = runtime();
  run.runners[0] = { ...run.runners[0], progress: 99.99, velocity: 9 };
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
  const finished = stepRaceRunner({ ...args, runner: { ...createRuntimeRunner(), progress: 99.99, velocity: 9, y: 50, vy: 100 }, elapsed: 1234.6 }).runner;
  assert.equal(finished.finishedAt, 1235);
  const landed = stepRaceRunner({ ...args, runner: finished, elapsed: 9999, dt: 1 }).runner;
  assert.equal(landed.finishedAt, 1235);
});

// Count take-offs (leaving the ground) for lane 0 while a latched press is fed in, the way the game screen buffers a keydown.
const takeOffs = (pressAt) => {
  const run = runtime("jump-latch");
  const presses = [...pressAt];
  let latch = false;
  let wasGrounded = true;
  let count = 0;
  for (let elapsed = 0; elapsed <= 3000; elapsed += 1000 / 60) {
    if (presses.length && elapsed >= presses[0]) { presses.shift(); latch = true; }
    advanceRaceRuntime(run, { now: 1000 + elapsed, epochNow: startedAt + elapsed, obstacles: [],
      readInput: (laneIndex) => ({ jump: laneIndex === 0 && latch, boost: false }),
      onJumpInput: (laneIndex) => { if (laneIndex === 0) latch = false; } });
    const grounded = run.runners[0].y === 0;
    if (wasGrounded && !grounded) count++;
    wasGrounded = grounded;
  }
  return count;
};

test("jump presses made mid-air are dropped instead of firing again on landing", () => {
  assert.equal(takeOffs([0]), 1);
  // Mashing during one jump still gives one jump.
  assert.equal(takeOffs([0, 100, 200, 300, 400]), 1);
  // A fresh press after landing jumps again.
  assert.equal(takeOffs([0, 1500]), 2);
});

test("the room's replay drops mid-air presses too, so canonical times match the screen", async () => {
  const { replayRace } = await import("../worker/race-authority.js");
  const soloLanes = [{ characterId: "momo", isBot: false }, null, null, null];
  const race = (inputs) => ({ raceId: "replay-jump", startedAt, lanes: soloLanes, characters: [characters[0], null, null, null], courseSeed: "course", inputs });
  const press = (at) => [{ at, buttons: 1 }, { at: at + 30, buttons: 0 }];
  // Before the fix the 2.1s press, made mid-air, fired again on landing and changed the goal time.
  const finish = (inputs) => replayRace(race(inputs), startedAt + 60_000).results[0].finishMs;
  assert.equal(finish([...press(1800), ...press(2100)]), finish(press(1800)));
});

const statRunner = (speed, acceleration, stamina) => ({ stats: { speed, acceleration, stamina } });
// Seconds of fixed steps until the runner's velocity stops rising (reached its cruising speed).
const secondsToCruise = (character, runner = createRuntimeRunner(), input = { jump: false, boost: false }) => {
  let current = runner;
  for (let tick = 1; tick <= 120 * 20; tick++) {
    const next = stepRaceRunner({ runner: current, character, input, obstacles: [], now: tick * 1000 / 120, dt: 1 / 120, elapsed: tick * 1000 / 120 }).runner;
    if (next.velocity === current.velocity && tick > 1) return tick / 120;
    current = next;
  }
  return Infinity;
};

test("acceleration decides how fast a runner gets up to speed, from the start and after slowing down", () => {
  const quick = statRunner(13, 20, 7);
  const slow = statRunner(13, 1, 20);
  assert.ok(secondsToCruise(quick) < secondsToCruise(slow));
  // After a hit the runner keeps only part of its speed and has to build it back up.
  const slowed = { ...createRuntimeRunner(), velocity: 2 };
  assert.ok(secondsToCruise(quick, slowed) < secondsToCruise(slow, slowed));
});

test("stamina decides how long boost lasts", () => {
  const boostSeconds = (stamina) => {
    let runner = createRuntimeRunner();
    for (let tick = 1; tick <= 120 * 30; tick++) {
      runner = stepRaceRunner({ runner, character: statRunner(13, 13, stamina), input: { jump: false, boost: true }, obstacles: [], now: tick * 1000 / 120, dt: 1 / 120, elapsed: tick * 1000 / 120 }).runner;
      if (runner.exhausted) return tick / 120;
    }
    return Infinity;
  };
  assert.ok(boostSeconds(20) > boostSeconds(10) && boostSeconds(10) > boostSeconds(1));
});

test("every built-in character splits exactly 40 points across stats of 1–20", () => {
  for (const { name, stats } of characters) {
    const values = [stats.speed, stats.acceleration, stats.stamina];
    assert.ok(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 20), name);
    assert.equal(values.reduce((sum, value) => sum + value, 0), 40, name);
  }
});

test("types come from stats by one rule: even spreads are バランス, otherwise the strongest stat", async () => {
  const { characterType } = await import("../app/domain/characters.js");
  assert.equal(characterType({ speed: 14, acceleration: 13, stamina: 13 }), "バランス");
  assert.equal(characterType({ speed: 15, acceleration: 13, stamina: 12 }), "バランス");
  assert.equal(characterType({ speed: 16, acceleration: 12, stamina: 12 }), "スピード");
  assert.equal(characterType({ speed: 12, acceleration: 16, stamina: 12 }), "ダッシュ");
  assert.equal(characterType({ speed: 11, acceleration: 10, stamina: 19 }), "スタミナ");
  // Ties for the top stat favour speed, then acceleration.
  assert.equal(characterType({ speed: 18, acceleration: 18, stamina: 4 }), "スピード");
  assert.equal(characterType({ speed: 4, acceleration: 18, stamina: 18 }), "ダッシュ");
  for (const character of characters) assert.equal(character.preset, characterType(character.stats), character.name);
});
