import assert from "node:assert/strict";
import test from "node:test";
import { GENERATED_STAT_MAX, GENERATED_STAT_MIN, GENERATED_STAT_TOTAL, fitGeneratedStats, readGeneratedStats } from "../app/domain/generated-stats.js";

const total = (stats) => stats.speed + stats.acceleration + stats.stamina;
const inRange = (stats) => Object.values(stats).every((value) => Number.isInteger(value) && value >= GENERATED_STAT_MIN && value <= GENERATED_STAT_MAX);

test("new and old image-poc keys both map to speed / acceleration / stamina", () => {
  assert.deepEqual(readGeneratedStats({ speed: 9, acceleration: 7, stamina: 6 }), { speed: 9, acceleration: 7, stamina: 6 });
  // Before the prompt change, jump meant acceleration and power meant stamina.
  assert.deepEqual(readGeneratedStats({ speed: 9, jump: 7, power: 6 }), { speed: 9, acceleration: 7, stamina: 6 });
});

test("old 1–20 output is brought onto the game's scale without changing which stat is strongest", () => {
  const stats = readGeneratedStats({ speed: 18, jump: 8, power: 4 });
  assert.equal(total(stats), GENERATED_STAT_TOTAL);
  assert.ok(inRange(stats));
  assert.ok(stats.speed > stats.acceleration && stats.acceleration >= stats.stamina);
});

test("any positive input lands on the exact total within bounds, even when the model misses the sum", () => {
  const samples = [[1, 1, 1], [20, 20, 20], [20, 1, 1], [1, 1, 20], [10, 10, 3], [7, 7, 7.5], [0.4, 0.3, 0.3], [100, 50, 1], [9, 8, 6], [5, 5, 5]];
  for (const [speed, acceleration, stamina] of samples) {
    const stats = fitGeneratedStats({ speed, acceleration, stamina });
    assert.equal(total(stats), GENERATED_STAT_TOTAL, JSON.stringify([speed, acceleration, stamina]));
    assert.ok(inRange(stats), JSON.stringify(stats));
  }
});

test("missing, zero or non-numeric stats are rejected instead of saved", () => {
  for (const stats of [undefined, null, {}, { speed: 8, acceleration: 7 }, { speed: "8", acceleration: 7, stamina: 7 }, { speed: 0, acceleration: 7, stamina: 7 }, { speed: Number.NaN, jump: 7, power: 7 }]) {
    assert.equal(readGeneratedStats(stats), null, JSON.stringify(stats));
  }
});
