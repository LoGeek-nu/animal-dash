import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Cloudflare Workers is the only configured deployment target", async () => {
  const [packageSource, viteSource, workerSource, wranglerSource] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("vite.config.js", root), "utf8"),
    readFile(new URL("worker/index.js", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
  ]);

  const packageJson = JSON.parse(packageSource);
  const wrangler = JSON.parse(wranglerSource);

  assert.equal(packageJson.version, "0.5.5");
  assert.equal(packageJson.devDependencies["@openai/sites-vite-plugin"], undefined);
  assert.equal(packageJson.devDependencies["@vinext/cloudflare"], "1.0.0-beta.2");
  assert.match(packageJson.scripts.deploy, /vinext-cloudflare deploy/);

  assert.equal(wrangler.name, "animaldash");
  assert.equal(wrangler.main, "./worker/index.js");
  assert.equal(wrangler.compatibility_date, "2026-08-19");
  assert.deepEqual(wrangler.compatibility_flags, ["nodejs_compat"]);
  assert.equal(wrangler.workers_dev, true);
  assert.equal(wrangler.preview_urls, false);
  assert.deepEqual(wrangler.assets, {
    directory: "./dist/client",
    binding: "ASSETS",
    not_found_handling: "none",
  });
  assert.equal(wrangler.observability.enabled, true);

  assert.doesNotMatch(viteSource, /@openai\/sites-vite-plugin|hosting\.json|\bsites\(/);
  assert.doesNotMatch(workerSource, /\bIMAGES\b|image-optimization/);
  await assert.rejects(access(new URL(".openai/hosting.json", root)));
});
