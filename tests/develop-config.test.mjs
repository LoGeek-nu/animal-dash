import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("develop custom domain and bindings stay isolated from production, including benchmark bypass", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const develop = config.env.develop;
  assert.equal(develop.name, "animaldash-develop");
  assert.deepEqual(develop.routes, [{ pattern: "animaldash-develop.logeek.tech", custom_domain: true }]);
  assert.equal(develop.d1_databases[0].database_id, "e4412a8f-8f4c-4479-b90d-ed7e43a691a7");
  assert.notEqual(develop.d1_databases[0].database_id, config.d1_databases[0].database_id);
  assert.equal(develop.r2_buckets[0].bucket_name, "animaldash-develop-characters");
  assert.notEqual(develop.r2_buckets[0].bucket_name, config.r2_buckets[0].bucket_name);
  assert.equal(develop.vars.IMAGE_CACHE_BENCHMARK, "true");
  assert.equal(config.vars?.IMAGE_CACHE_BENCHMARK, undefined);
});
