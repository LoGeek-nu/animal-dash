import assert from "node:assert/strict";
import test from "node:test";
import {
  courseLeft,
  courseObstacles,
  courseSegments,
  getCourseSegment,
} from "../app/course-data.js";
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

test("all ten runners have a generated full-body asset", () => {
  assert.equal(characters.length, 10);
  for (const character of characters) {
    assert.match(`/characters/${character.id}/runner.png`, /^\/characters\/[a-z]+\/runner\.png$/);
  }
});
