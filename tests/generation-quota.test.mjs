import assert from "node:assert/strict";
import test from "node:test";
import { GENERATION_LIMIT, GenerationQuota, takeGenerationSlot } from "../worker/generation-quota.js";

function createQuota() {
  const storage = new Map();
  const quota = new GenerationQuota({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value) } });
  const env = { GENERATION_QUOTA: { getByName: () => quota } };
  return () => takeGenerationSlot(env);
}

test("no 60-second span ever lets more than the limit through, even across a minute boundary", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const take = createQuota();

  // A burst late in one minute...
  t.mock.timers.setTime(55_000);
  for (let index = 0; index < GENERATION_LIMIT; index += 1) assert.deepEqual(await take(), { allowed: true });
  // ...cannot be followed by another right after the minute turns.
  t.mock.timers.setTime(61_000);
  assert.deepEqual(await take(), { allowed: false, retryAfter: 54 });

  // The burst's slots free up exactly 60 seconds after it.
  t.mock.timers.setTime(114_999);
  assert.deepEqual(await take(), { allowed: false, retryAfter: 1 });
  t.mock.timers.setTime(115_000);
  for (let index = 0; index < GENERATION_LIMIT; index += 1) assert.deepEqual(await take(), { allowed: true });
  assert.equal((await take()).allowed, false);
});

test("generation is unlimited where the quota binding is absent", async () => {
  assert.deepEqual(await takeGenerationSlot({}), { allowed: true });
});
