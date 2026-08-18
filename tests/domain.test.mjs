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
} from "../app/course-data.js";
import { ATTRACT_SCENES, TUTORIAL_STEP_DURATION, tutorialSteps } from "../app/attract-data.js";
import { characters, createInitialSession } from "../app/race-data.js";
import { validSession } from "../app/use-race-session.js";

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
    readFile(new URL("../app/AnimalDashApp.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/character/CharacterAvatar.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(appSource, /キャラクター選択中/);
  assert.match(appSource, /4人集まったらエントリー完了/);
  assert.doesNotMatch(appSource, /<div className="empty-card-art"><strong>\?<\/strong><i>/);
  assert.doesNotMatch(avatarSource, /avatar-spark|spark-one|spark-two/);
});

test("admin drag collision only accepts pointer hits inside lanes", async () => {
  const source = await readFile(new URL("../app/AnimalDashApp.jsx", import.meta.url), "utf8");
  assert.match(source, /pointerWithin/);
  assert.match(source, /startsWith\("lane-"\)/);
  assert.doesNotMatch(source, /collisionDetection=\{closestCenter\}/);
});
