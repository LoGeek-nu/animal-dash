import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COURSE_LENGTH,
  RUNNER_HIT_RANGE,
  courseGates,
  courseLeft,
  courseSegments,
  createCourseObstacles,
  getCourseSegment,
  getNearestUpcomingObstacle,
  getVisibleCourseObstacles,
  obstacleTypes,
} from "../app/domain/course.js";
import { ATTRACT_SCENES, TUTORIAL_STEP_DURATION, tutorialSteps } from "../app/domain/attract.js";
import { characters, getCharacter, isKnownCharacterId, retiredCharacterIds } from "../app/domain/characters.js";
import { addGeneratedCharacter, getGeneratedCharacters, refreshGeneratedCharacters } from "../app/domain/generated-characters.js";
import { createInitialSession } from "../app/domain/race-session.js";
import { raceSessionActions } from "../app/features/race-session/race-session-actions.js";
import { raceSessionReducer } from "../app/features/race-session/race-session-reducer.js";
import { validSession } from "../app/features/race-session/race-session-validator.js";
import { createRuntimeRunner, stepRaceRunner, toRenderableRunner } from "../app/features/game/race/race-engine.js";
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
  // Sessions arrive from other devices, so every field the screens read must be present.
  for (const field of ["sessionId", "courseSeed", "lastSync", "results"]) {
    assert.equal(validSession({ ...session, [field]: undefined }), false, field);
  }
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
    [[0, 30], [30, 85], [85, 140], [140, 200], [200, COURSE_LENGTH + 1]],
  );
  for (let progress = 0; progress <= COURSE_LENGTH; progress += 1) {
    assert.ok(getCourseSegment(progress));
  }
});

test("each lane meets the same hazards at the same spots, in its own order", () => {
  assert.deepEqual(createCourseObstacles("race-a", 4), createCourseObstacles("race-a", 4));
  assert.notDeepEqual(createCourseObstacles("race-a", 4)[0], createCourseObstacles("race-b", 4)[0]);
  let shuffled = 0;
  for (let i = 0; i < 50; i++) {
    const lanes = createCourseObstacles(`race-${i}`, 4);
    const [first] = lanes;
    assert.ok(first.length >= 10);
    first.slice(1).forEach((obstacle, index) => assert.ok(obstacle.position - first[index].position >= 10));
    assert.ok(first.every(({ position }) => position >= 30 && position < COURSE_LENGTH));
    for (const lane of lanes) {
      assert.equal(new Set(lane.map(({ id }) => id)).size, lane.length);
      assert.deepEqual(lane.map(({ position }) => position), first.map(({ position }) => position));
      assert.deepEqual(lane.map(({ type }) => type).sort(), first.map(({ type }) => type).sort());
    }
    // Types are dealt from a bag, so no type goes missing in a race.
    for (const type of Object.keys(obstacleTypes)) assert.ok(first.some((obstacle) => obstacle.type === type), type);
    if (lanes.some((lane) => lane.map(({ type }) => type).join() !== first.map(({ type }) => type).join())) shuffled++;
  }
  assert.ok(shuffled >= 45);
  assert.ok(courseLeft(20, 10) > courseLeft(10, 10));
});

test("each obstacle catches runners over a range that follows its drawn width and the runner's body", () => {
  const specs = Object.values(obstacleTypes);
  for (const wider of specs) for (const narrower of specs) if (wider.width > narrower.width) assert.ok(wider.hitRange > narrower.hitRange);
  const mud = { id: "mud-0", type: "mud", position: 50, ...obstacleTypes.mud };
  const standAt = (progress) => stepRaceRunner({ runner: { ...createRuntimeRunner(), progress }, character: characters[0],
    input: { jump: false, boost: false }, obstacles: [mud], now: 0, dt: .001, elapsed: 0 }).runner;
  // The runner's own body counts too: its front edge touching the mud's core is already a hit.
  const reach = mud.hitRange + RUNNER_HIT_RANGE;
  assert.ok(RUNNER_HIT_RANGE > 0);
  assert.ok(standAt(50 - reach + .1).hit.has("mud-0"));
  assert.equal(standAt(50 - reach - .3).hit.size, 0);
});

test("only nearby obstacles are rendered and the nearest hazard is selected", () => {
  const obstacles = [0, 40, 60, 90].map((position, index) => ({ id: `rock-${index}`, type: "rock", position, ...obstacleTypes.rock }));
  const visible = getVisibleCourseObstacles(obstacles, 35);
  assert.deepEqual(visible.map(({ id }) => id), ["rock-1", "rock-2"]);
  assert.equal(getNearestUpcomingObstacle(visible, 45)?.id, "rock-2");
  assert.equal(getNearestUpcomingObstacle(obstacles, 95), null);
});

test("every obstacle, landmark and gate has artwork", async () => {
  const names = [...Object.keys(obstacleTypes), ...courseSegments.map(({ id }) => id), ...courseGates.map(({ id }) => id)];
  for (const name of new Set(names)) await readFile(new URL(`../public/course/${name}.png`, import.meta.url));
});

test("the attract loop is nine seconds faster and tutorial steps fit the demo scene", () => {
  assert.deepEqual(ATTRACT_SCENES.map(({ duration }) => duration), [9_000, 21_000, 11_000]);
  assert.equal(ATTRACT_SCENES.reduce((total, scene) => total + scene.duration, 0), 41_000);
  assert.equal(tutorialSteps.length * TUTORIAL_STEP_DURATION, ATTRACT_SCENES[1].duration);
  assert.deepEqual(tutorialSteps.map(({ id }) => id), ["jump", "boost", "goal"]);
});

test("all eight runners have a full-body asset and the removed two are gone", async () => {
  assert.equal(characters.length, 8);
  for (const character of characters) {
    assert.match(`/characters/${character.id}/runner.png`, /^\/characters\/[a-z]+\/runner\.png$/);
    await readFile(new URL(`../public/characters/${character.id}/runner.png`, import.meta.url));
  }
  for (const id of retiredCharacterIds) {
    assert.equal(isKnownCharacterId(id), false);
    await assert.rejects(readFile(new URL(`../public/characters/${id}/runner.png`, import.meta.url)));
  }
});

test("generated characters are resolved alongside the static eight without mutating them", () => {
  assert.equal(isKnownCharacterId("gen-test-unknown"), false);
  assert.equal(getCharacter("gen-test-unknown").id, characters[0].id);

  const generated = { id: "gen-test-unknown", name: "テスト", stats: { speed: 10, acceleration: 10, stamina: 10 } };
  addGeneratedCharacter(generated);

  assert.equal(isKnownCharacterId("gen-test-unknown"), true);
  assert.deepEqual(getCharacter("gen-test-unknown"), generated);
  assert.equal(characters.length, 8);
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

test("admin character library offers a gated image picker without forcing camera capture", async () => {
  const [librarySource, dialogSource] = await Promise.all([
    readFile(new URL("../app/features/admin/components/CharacterLibrary.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/features/admin/components/CharacterGenerateDialog.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(librarySource, /撮影して追加/);
  assert.match(librarySource, /disabled=\{!mutable\}/);
  assert.match(dialogSource, /type="file"/);
  assert.match(dialogSource, /accept="image\/\*"/);
  assert.doesNotMatch(dialogSource, /\bcapture\s*=/);
  assert.match(dialogSource, /\/api\/characters\/generate/);
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
  // Built-in characters always run as BOT, even when staff pick them by hand.
  assert.deepEqual(assigned.lanes[2], { characterId: "momo", isBot: true });

  const moved = raceSessionReducer(assigned, raceSessionActions.assignCharacter(0, "momo"), 1_100);
  assert.equal(moved.lanes[2], null);
  assert.deepEqual(moved.lanes[0], { characterId: "momo", isBot: true });

  const countdown = raceSessionReducer(moved, raceSessionActions.startCountdown(), 2_000);
  assert.equal(countdown.phase, "COUNTDOWN");
  assert.equal(countdown.countdownEndsAt, 8_500);
  assert.equal(raceSessionReducer(countdown, raceSessionActions.removeCharacter(0), 2_100), countdown);

  const attract = raceSessionReducer(initial, raceSessionActions.showAttract());
  assert.equal(attract.phase, "ATTRACT");
  assert.equal(attract.attractIndex, 0);

  const nextScene1 = raceSessionReducer(attract, raceSessionActions.nextAttract());
  assert.equal(nextScene1.attractIndex, 1);
  const nextScene2 = raceSessionReducer(nextScene1, raceSessionActions.nextAttract());
  assert.equal(nextScene2.attractIndex, 2);
  const nextSceneLoop = raceSessionReducer(nextScene2, raceSessionActions.nextAttract());
  assert.equal(nextSceneLoop.attractIndex, 0);

  const restarted = raceSessionReducer(nextScene2, raceSessionActions.restartAttract());
  assert.equal(restarted.attractIndex, 0);

  const generatedId = "gen-test-reducer";
  addGeneratedCharacter({ id: generatedId });
  const withGenerated = { ...createInitialSession(), phase: "WAITING", lanes: [null, null, null, null] };
  const assignedGenerated = raceSessionReducer(withGenerated, raceSessionActions.assignCharacter(1, generatedId), 1_000);
  assert.deepEqual(assignedGenerated.lanes[1], { characterId: generatedId, isBot: false });
  assert.equal(validSession(assignedGenerated), true);
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
    obstacles: [{ id: "rock-0", type: "rock", position: 27, ...obstacleTypes.rock }],
    now: 2_000,
    dt: .01,
    elapsed: 200,
  }).runner;
  assert.ok(collided.collisionUntil > 2_000);
  assert.ok(collided.hit.has("rock-0"));

  const lanes = [{ characterId: "momo", isBot: false }, { characterId: "toramaru", isBot: true }];
  const runners = [{ ...createRuntimeRunner(), progress: 30, finishedAt: 30_000 }, { ...createRuntimeRunner(), progress: 40, finishedAt: 29_000 }];
  assert.deepEqual(calculateLiveRanks(runners, lanes), { 0: 2, 1: 1 });
  assert.deepEqual(buildFinalResults(runners, lanes).map(({ lane, rank }) => [lane, rank]), [[2, 1], [1, 2]]);

  const preGoalRunner = {
    ...createRuntimeRunner(),
    progress: COURSE_LENGTH - .2,
    velocity: 9,
    y: 120,
    vy: 200,
    boosting: true,
    collisionUntil: 5_000,
    collision: true,
  };
  const goalResult = stepRaceRunner({
    runner: preGoalRunner,
    character,
    input: { jump: false, boost: true },
    obstacles: [],
    now: 3_000,
    dt: 0.1,
    elapsed: 15_000,
  });
  assert.ok(goalResult.runner.progress >= COURSE_LENGTH);
  assert.equal(goalResult.runner.finishedAt, 15_000);
  assert.ok(goalResult.runner.y > 0);
  assert.equal(goalResult.runner.boosting, false);
  assert.equal(goalResult.runner.collision, false);
  assert.equal(goalResult.runner.collisionUntil, 0);

  const renderableAirborne = toRenderableRunner(goalResult.runner, 3_000);
  assert.ok(renderableAirborne.y > 0);
  assert.equal(renderableAirborne.boosting, false);
  assert.equal(renderableAirborne.collision, false);
  assert.equal(renderableAirborne.finishedAt, 15_000);

  const initialAirborneProgress = goalResult.runner.progress;
  let postGoalRunner = goalResult.runner;
  for (let i = 0; i < 20 && postGoalRunner.y > 0; i++) {
    postGoalRunner = stepRaceRunner({
      runner: postGoalRunner,
      character,
      input: { jump: true, boost: true },
      obstacles: [],
      now: 3_000 + i * 100,
      dt: 0.05,
      elapsed: 15_000 + i * 50,
    }).runner;
  }
  assert.equal(postGoalRunner.y, 0);
  assert.equal(postGoalRunner.vy, 0);
  assert.equal(postGoalRunner.boosting, false);
  assert.ok(postGoalRunner.progress > initialAirborneProgress);

  const landedProgress = postGoalRunner.progress;
  const subsequentStepped = stepRaceRunner({
    runner: postGoalRunner,
    character,
    input: { jump: true, boost: true },
    obstacles: [],
    now: 5_000,
    dt: 0.05,
    elapsed: 16_000,
  }).runner;
  assert.equal(subsequentStepped.progress, landedProgress);

  const renderableLanded = toRenderableRunner(postGoalRunner, 4_000);
  assert.equal(renderableLanded.y, 0);
  assert.equal(renderableLanded.boosting, false);
  assert.equal(renderableLanded.collision, false);
  assert.equal(renderableLanded.finishedAt, 15_000);

  const rankedRunners = [
    { ...createRuntimeRunner(), progress: 102.5, finishedAt: 12_000 },
    { ...createRuntimeRunner(), progress: 100.0, finishedAt: 11_000 },
    { ...createRuntimeRunner(), progress: 85.0, finishedAt: null },
  ];
  const threeLanes = [{ characterId: "momo", isBot: false }, { characterId: "toramaru", isBot: true }, { characterId: "penta", isBot: true }];
  assert.deepEqual(calculateLiveRanks(rankedRunners, threeLanes), { 0: 2, 1: 1, 2: 3 });
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

test("a refresh asked for mid-request gets a fresh response, and a stale one never drops a character", async (t) => {
  const responses = [];
  t.mock.method(globalThis, "fetch", () => new Promise((resolve) => responses.push(resolve)));
  const reply = (ids) => responses.shift()(Response.json({ characters: ids.map((id) => ({ id, generated: true })) }));

  const first = refreshGeneratedCharacters();
  addGeneratedCharacter({ id: "gen-refresh-local", generated: true });
  const second = refreshGeneratedCharacters();
  assert.equal(responses.length, 1);

  // The first answer predates both characters below.
  reply(["gen-refresh-old"]);
  await first;
  assert.ok(getGeneratedCharacters().some((character) => character.id === "gen-refresh-local"));

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(responses.length, 1);
  reply(["gen-refresh-old", "gen-refresh-local", "gen-refresh-new"]);
  await second;
  const ids = getGeneratedCharacters().map((character) => character.id);
  assert.ok(ids.includes("gen-refresh-new"));
  assert.equal(ids.filter((id) => id === "gen-refresh-local").length, 1);
});
