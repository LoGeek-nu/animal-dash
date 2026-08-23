import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  courseLeft,
  courseObstacles,
  courseSegments,
  getCourseSegment,
  getNearestUpcomingObstacle,
  getVisibleCourseObstacles,
} from "../app/domain/course.js";
import { ATTRACT_SCENES, TUTORIAL_STEP_DURATION, tutorialSteps } from "../app/domain/attract.js";
import { characters } from "../app/domain/characters.js";
import { createInitialSession } from "../app/domain/race-session.js";
import { raceSessionActions } from "../app/features/race-session/race-session-actions.js";
import { raceSessionReducer } from "../app/features/race-session/race-session-reducer.js";
import { validSession } from "../app/features/race-session/race-session-validator.js";
import { createRuntimeRunner, stepRaceRunner } from "../app/features/game/race/race-engine.js";
import { buildFinalResults, calculateLiveRanks } from "../app/features/game/race/race-ranking.js";

test("the initial session is valid JavaScript runtime data", () => {
  const session = createInitialSession();
  assert.equal(validSession(session), true);
  assert.equal(session.version, 3);
  assert.equal(session.lanes.length, 4);
});

test("invalid phases, lanes, and characters are rejected", () => {
  const session = createInitialSession();
  assert.equal(validSession({ ...session, phase: "SIGNED_IN" }), false);
  assert.equal(validSession({ ...session, lanes: [] }), false);
  assert.equal(
    validSession({
      ...session,
      lanes: [{ characterId: "unknown", isBot: false }, null, null, null],
    }),
    false,
  );
});

test("course sections cover the complete race without gaps", () => {
  assert.deepEqual(
    courseSegments.map(({ start, end }) => [start, end]),
    [[0, 18], [18, 40], [40, 62], [62, 82], [82, 101]],
  );
  for (let progress = 0; progress <= 100; progress += 1) {
    assert.ok(getCourseSegment(progress));
  }
});

test("course hazards are unique, ordered, and visible ahead of a racer", () => {
  assert.equal(new Set(courseObstacles.map(({ id }) => id)).size, courseObstacles.length);
  assert.deepEqual(
    courseObstacles.map(({ position }) => position),
    [...courseObstacles].map(({ position }) => position).sort((a, b) => a - b),
  );
  assert.ok(courseObstacles.every(({ position, warningDistance }) => position > warningDistance));
  assert.ok(courseLeft(20, 10) > courseLeft(10, 10));
});

test("only nearby obstacles are rendered and the nearest hazard is selected", () => {
  const visible = getVisibleCourseObstacles(35);
  assert.ok(visible.length <= 3);
  assert.ok(visible.every(({ position }) => position >= 32.5 && position <= 70));
  assert.equal(getNearestUpcomingObstacle(35, visible)?.id, "garden-hay");
  assert.equal(getNearestUpcomingObstacle(95), null);
});

test("the attract loop is nine seconds faster and tutorial steps fit the demo scene", () => {
  assert.deepEqual(ATTRACT_SCENES.map(({ duration }) => duration), [9_000, 21_000, 11_000]);
  assert.equal(ATTRACT_SCENES.reduce((total, scene) => total + scene.duration, 0), 41_000);
  assert.equal(tutorialSteps.length * TUTORIAL_STEP_DURATION, ATTRACT_SCENES[1].duration);
  assert.deepEqual(tutorialSteps.map(({ id }) => id), ["jump", "boost", "goal"]);
});

test("all ten runners have a generated full-body asset", () => {
  assert.equal(characters.length, 10);
  for (const character of characters) {
    assert.match(`/characters/${character.id}/runner.png`, /^\/characters\/[a-z]+\/runner\.png$/);
  }
});

test("waiting cards use the new copy without plus or avatar dot decorations", async () => {
  const [appSource, avatarSource] = await Promise.all([
    readFile(new URL("../app/features/game/screens/WaitingScreen.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ui/molecules/CharacterAvatar.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(appSource, /キャラクター選択中/);
  assert.match(appSource, /4人集まったらエントリー完了/);
  assert.doesNotMatch(appSource, /<div className="empty-card-art"><strong>\?<\/strong><i>/);
  assert.doesNotMatch(avatarSource, /avatar-spark|spark-one|spark-two/);
});

test("admin drag collision only accepts pointer hits inside lanes", async () => {
  const source = await readFile(new URL("../app/features/admin/model/lane-collision.js", import.meta.url), "utf8");
  assert.match(source, /pointerWithin/);
  assert.match(source, /startsWith\("lane-"\)/);
  assert.doesNotMatch(source, /collisionDetection=\{closestCenter\}/);
});

test("session transitions are isolated in the reducer", () => {
  const initial = { ...createInitialSession(), phase: "WAITING", lanes: [null, null, null, null] };
  const assigned = raceSessionReducer(initial, raceSessionActions.assignCharacter(2, "momo"), 1_000);
  assert.deepEqual(assigned.lanes[2], { characterId: "momo", isBot: false });

  const moved = raceSessionReducer(assigned, raceSessionActions.assignCharacter(0, "momo"), 1_100);
  assert.equal(moved.lanes[2], null);
  assert.deepEqual(moved.lanes[0], { characterId: "momo", isBot: false });

  const countdown = raceSessionReducer(moved, raceSessionActions.startCountdown(), 2_000);
  assert.equal(countdown.phase, "COUNTDOWN");
  assert.equal(countdown.countdownEndsAt, 5_600);
  assert.equal(raceSessionReducer(countdown, raceSessionActions.removeCharacter(0), 2_100), countdown);
});

test("race engine calculates jump, boost, collision, and rankings without React", () => {
  const character = characters[0];
  const boosted = stepRaceRunner({
    runner: createRuntimeRunner(),
    character,
    input: { jump: true, boost: true },
    obstacles: [],
    now: 1_000,
    dt: .1,
    elapsed: 100,
  });
  assert.equal(boosted.jumped, true);
  assert.equal(boosted.runner.boosting, true);
  assert.ok(boosted.runner.y > 0);
  assert.ok(boosted.runner.stamina < 100);

  const collisionRunner = { ...createRuntimeRunner(), progress: 26.98 };
  const collided = stepRaceRunner({
    runner: collisionRunner,
    character,
    input: { jump: false, boost: false },
    obstacles: [courseObstacles[0]],
    now: 2_000,
    dt: .01,
    elapsed: 200,
  }).runner;
  assert.ok(collided.collisionUntil > 2_000);
  assert.ok(collided.hit.has("garden-rock"));

  const lanes = [{ characterId: "momo", isBot: false }, { characterId: "toramaru", isBot: true }];
  const runners = [{ ...createRuntimeRunner(), progress: 30, finishedAt: 30_000 }, { ...createRuntimeRunner(), progress: 40, finishedAt: 29_000 }];
  assert.deepEqual(calculateLiveRanks(runners, lanes), { 0: 2, 1: 1 });
  assert.deepEqual(buildFinalResults(runners, lanes).map(({ lane, rank }) => [lane, rank]), [[2, 1], [1, 2]]);
});

test("route entries and phase rendering stay separated", async () => {
  const [gamePage, adminPage, phaseRenderer] = await Promise.all([
    readFile(new URL("../app/game/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/features/game/GamePhaseRenderer.jsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(gamePage, /AdminPage|AnimalDashApp/);
  assert.doesNotMatch(adminPage, /GamePage|AnimalDashApp/);
  assert.match(phaseRenderer, /AttractScreen/);
  assert.match(phaseRenderer, /RacingScreen/);
  assert.doesNotMatch(phaseRenderer, /import\s*\(|React\.lazy/);
});
