// Isolated local fixtures only. Never reads credentials or connects to remote D1/R2.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { characters } from "../app/domain/characters.js";
import { characterStatement } from "../worker/data-store.js";

const root = path.resolve("outputs/issue88-scroll");
await mkdir(root, { recursive: true });
const dbId = "issue88-scroll-db";
const bucketId = "issue88-scroll-images";
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: "export default { fetch() { return new Response('fixture'); } }",
  compatibilityDate: "2026-08-19",
  d1Databases: { DB: dbId }, r2Buckets: { CHARACTERS: bucketId },
  resourcePersistencePath: path.join(root, "state/v3"),
}));
try {
  const db = await mf.getD1Database("DB"), bucket = await mf.getR2Bucket("CHARACTERS");
  const existing = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='characters'").first();
  if (!existing) {
    for (const file of ["0001_race_storage.sql", "0002_builtin_characters.sql", "0003_builtin_stats_40.sql", "0004_character_paging.sql"]) {
      const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
      await db.batch(sql.split(";").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s)));
    }
  }
  let imageBytes = 0;
  for (let i = 0; i < 400; i++) {
    const base = characters[i % characters.length];
    const character = { ...base, id: `gen-scroll-${String(i).padStart(3, "0")}`, name: `検証アニマル${String(i).padStart(3, "0")}`, generated: true };
    const key = `characters/${character.id}.png`;
    const image = await readFile(new URL(`../public/characters/${base.id}/runner.png`, import.meta.url));
    imageBytes += image.length;
    await bucket.put(key, image, { httpMetadata: { contentType: "image/png" }, customMetadata: { character: JSON.stringify(character) } });
    await characterStatement(db, character, key, 1000 + Math.floor(i / 3)).run();
  }
  // Build first (npm run build). This config deliberately excludes real account IDs,
  // domains and secrets. The test passcode is only for this loopback fixture server.
  await writeFile(path.join(root, "wrangler.json"), JSON.stringify({
    name: "issue88-scroll-test", main: path.resolve("dist/server/index.js"),
    compatibility_date: "2026-08-19", compatibility_flags: ["nodejs_compat"],
    assets: { directory: path.resolve("dist/client"), binding: "ASSETS" },
    vars: { STAFF_PASSCODE: "issue88-local-test" },
    d1_databases: [{ binding: "DB", database_name: dbId, database_id: dbId }],
    r2_buckets: [{ binding: "CHARACTERS", bucket_name: bucketId }],
    durable_objects: { bindings: [{ name: "RACE_SESSION", class_name: "RaceSessionRoom" }, { name: "GENERATION_QUOTA", class_name: "GenerationQuota" }] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["RaceSessionRoom", "GenerationQuota"] }],
  }, null, 2));
  console.log(JSON.stringify({ generated: 400, imageBytes, root }));
  console.log("npx wrangler dev --local --config outputs/issue88-scroll/wrangler.json --persist-to outputs/issue88-scroll/state --port 8788");
} finally { await mf.dispose(); }
