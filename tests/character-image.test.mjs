import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

async function fixture(t, benchmark = false) {
  const modules = await Promise.all(["tests/fixtures/character-image-worker.mjs", "worker/character-image.js", "app/api/characters/character-store.js"]
    .map(async (file) => ({ type: "ESModule", path: fileURLToPath(new URL(`../${file}`, import.meta.url)), contents: await readFile(new URL(`../${file}`, import.meta.url), "utf8") })));
  const mf = new Miniflare(convertV4MiniflareOptions({ modules, compatibilityDate: "2026-08-19", r2Buckets: ["CHARACTERS"], bindings: { IMAGE_CACHE_BENCHMARK: String(benchmark) } }));
  t.after(() => mf.dispose());
  const bucket = await mf.getR2Bucket("CHARACTERS");
  await bucket.put("characters/gen-test.png", "original-image-bytes", { httpMetadata: { contentType: "image/png" } });
  return { mf, bucket, fetch: (suffix = "", init) => mf.dispatchFetch(`https://images.example.test/image/gen-test${suffix}`, init) };
}

function observed(response, status, reads) {
  assert.equal(response.headers.get("X-Image-Cache"), status);
  assert.equal(response.headers.get("X-Image-R2-Reads"), String(reads));
  assert.equal(response.headers.get("X-Test-Observed-R2-Reads"), String(reads));
  assert.match(response.headers.get("Server-Timing"), /image_cache;dur=/);
}

test("workerd Cache API serves the second GET without touching R2; cookies/queries do not create variants", async (t) => {
  const { fetch } = await fixture(t);
  const miss = await fetch();
  observed(miss, "MISS", 1);
  assert.equal(await miss.text(), "original-image-bytes");
  assert.match(miss.headers.get("Cache-Control"), /immutable/);
  const hit = await fetch("?tracking=ignored", { headers: { Cookie: "staff=irrelevant" } });
  observed(hit, "HIT", 0);
  assert.equal(await hit.text(), "original-image-bytes");
  assert.equal(hit.headers.get("Content-Type"), "image/png");
  assert.equal(hit.headers.get("ETag"), miss.headers.get("ETag"));
  assert.doesNotMatch(hit.headers.get("Server-Timing"), /(?:^|, )r2;/);
});

test("benchmark bypass is enabled only in develop and never reads or populates cache", async (t) => {
  const { fetch } = await fixture(t, true);
  const headers = { "X-Image-Cache-Bypass": "1" };
  observed(await fetch("", { headers }), "BYPASS", 1);
  observed(await fetch("", { headers }), "BYPASS", 1);
  observed(await fetch(), "MISS", 1);
  observed(await fetch(), "HIT", 0);
  const production = await fixture(t);
  observed(await production.fetch("", { headers }), "MISS", 1);
  observed(await production.fetch("", { headers }), "HIT", 0);
});

test("HEAD never caches an empty body, and conditional requests retain the ETag", async (t) => {
  const { fetch } = await fixture(t);
  const head = await fetch("", { method: "HEAD" });
  observed(head, "MISS", 1);
  assert.equal(await head.text(), "");
  const get = await fetch();
  observed(get, "MISS", 1);
  const etag = get.headers.get("ETag");
  assert.equal(await get.text(), "original-image-bytes");
  const cachedHead = await fetch("", { method: "HEAD" });
  observed(cachedHead, "HIT", 0);
  assert.equal(await cachedHead.text(), "");
  const conditional = await fetch("", { headers: { "If-None-Match": `W/${etag}` } });
  observed(conditional, "HIT", 0);
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
  assert.equal(conditional.headers.get("Content-Length"), null);
});

test("404 and R2 failures are not cached; cache failures fall back to R2", async (t) => {
  const { mf, bucket, fetch } = await fixture(t);
  const missing = () => mf.dispatchFetch("https://images.example.test/image/missing");
  for (let i = 0; i < 2; i++) {
    const response = await missing();
    assert.equal(response.status, 404);
    observed(response, "MISS", 1);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  for (let i = 0; i < 2; i++) {
    const unavailable = await mf.dispatchFetch("https://images.example.test/image/retry-image", { headers: { "X-Test-R2-Failure": "1" } });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
    observed(unavailable, "MISS", 1);
  }
  await bucket.put("characters/retry-image.png", "recovered");
  const recovered = await mf.dispatchFetch("https://images.example.test/image/retry-image");
  assert.equal(recovered.status, 200);
  observed(recovered, "MISS", 1);
  const readFailure = await fetch("", { headers: { "X-Test-Cache-Read-Failure": "1" } });
  observed(readFailure, "MISS", 1);
  assert.equal(await readFailure.text(), "original-image-bytes");
  await bucket.put("characters/new-image.png", "new-bytes");
  const failedWrite = await mf.dispatchFetch("https://images.example.test/image/new-image", { headers: { "X-Test-Cache-Write-Failure": "1" } });
  observed(failedWrite, "MISS", 1);
  assert.equal(await failedWrite.text(), "new-bytes");
  const retry = await mf.dispatchFetch("https://images.example.test/image/new-image");
  observed(retry, "MISS", 1);
});

test("workers.dev is explicitly bypassed and unsupported methods do not read R2", async (t) => {
  const { mf, fetch } = await fixture(t);
  const response = await mf.dispatchFetch("https://test.example.workers.dev/image/gen-test");
  observed(response, "BYPASS", 1);
  const post = await fetch("", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("X-Test-Observed-R2-Reads"), "0");
});
