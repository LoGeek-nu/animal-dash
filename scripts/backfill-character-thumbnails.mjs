// Staff-only, paged, resumable backfill. Secrets are read from a file, never argv/logs.
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { characterThumbnailUrl } from "../app/domain/character-thumbnail.js";

const [origin, passcodeFile, outputFile, query = "", workers = "2"] = process.argv.slice(2);
if (!origin || !passcodeFile || !outputFile) throw new Error("Usage: node scripts/backfill-character-thumbnails.mjs https://host passcode-file report.json [query] [concurrency=2]");
const base = new URL(origin);
const concurrency = Number(workers);
if (base.protocol !== "https:" || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error("HTTPS and concurrency 1..4 required");
const startedAt = new Date().toISOString(), started = performance.now();
const auth = await fetch(new URL("/api/auth", base), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: (await fs.readFile(passcodeFile, "utf8")).trim() }) });
if (!auth.ok) throw new Error(`Login HTTP ${auth.status}`);
const cookie = auth.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Missing staff cookie");
const characters = new Map();
let cursor;
do {
  const params = new URLSearchParams({ limit: "12", query });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(new URL(`/api/characters?${params}`, base));
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const page = await response.json();
  for (const c of page.characters) if (c.generated) characters.set(c.id, c);
  cursor = page.nextCursor;
} while (cursor);
const catalogMs = performance.now() - started;
const queue = [...characters.keys()], results = [];
const conversionStarted = performance.now();
let next = 0;
async function run(limit = queue.length) {
  while (next < limit) {
    const id = queue[next++];
    const began = performance.now();
    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(new URL(characterThumbnailUrl(id), base), { method: "POST", headers: { Cookie: cookie, Origin: base.origin }, signal: AbortSignal.timeout(60_000) });
        if (!r.ok) { await r.text(); throw new Error(`HTTP ${r.status}`); }
        result = { ...await r.json(), requestMs: performance.now() - began, attempts: attempt };
        break;
      } catch (error) {
        if (attempt === 3) result = { id, status: "failed", error: String(error), attempts: attempt, requestMs: performance.now() - began };
        else await delay(1000 * 2 ** (attempt - 1));
      }
    }
    results.push(result);
    await fs.appendFile(outputFile + ".jsonl", JSON.stringify(result) + "\n");
    if (results.length % 25 === 0) console.log(`Processed ${results.length}/${queue.length}`);
  }
}
await fs.mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });
// Stop after one failure if the binding/account configuration is unavailable.
await run(Math.min(1, queue.length));
if (results.some(r => r.status === "failed")) throw new Error("Preflight failed; see report.jsonl before retrying");
await Promise.all(Array.from({ length: concurrency }, () => run()));
const report = { origin: base.origin, startedAt, finishedAt: new Date().toISOString(), concurrency, query, count: results.length, created: results.filter(r=>r.status==="created").length, existing: results.filter(r=>r.status==="existing").length, failed: results.filter(r=>r.status==="failed").length, catalogMs, conversionMs: performance.now() - conversionStarted, totalMs: performance.now() - started, results };
await fs.writeFile(outputFile, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
if (report.failed) process.exitCode = 1;
