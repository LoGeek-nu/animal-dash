// Compare edge HIT and an explicit R2 bypass on the same develop origin.
// curl sends every request to the network (no browser/disk HTTP cache).
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = new URL(process.argv[2] ?? "https://animaldash-develop.logeek.tech");
const rounds = Number(process.argv[3] ?? 10);
const output = path.resolve(process.argv[4] ?? "outputs/image-cache-benchmark.json");
if (base.protocol !== "https:" || !Number.isInteger(rounds) || rounds < 2 || rounds > 30) throw new Error("Usage: node scripts/benchmark-image-cache.mjs https://develop-host [rounds=10, max=30] [report.json]");
const startedAt = new Date().toISOString();
const catalog = await fetch(new URL("/api/characters?query=" + encodeURIComponent("写真テスト") + "&limit=12", base));
if (!catalog.ok) throw new Error(`Catalog HTTP ${catalog.status}`);
const images = (await catalog.json()).characters;
if (images.length !== 12 || images.some((c) => !c.imageUrl?.startsWith("/api/characters/"))) throw new Error("Expected twelve photo fixtures");
const warmup = [];
for (const image of images) {
  const url = new URL(image.imageUrl, base);
  let firstDigest, firstEtag, hit = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(url);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!r.ok) throw new Error(`Warmup HTTP ${r.status}`);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (!firstDigest) { firstDigest = digest; firstEtag = r.headers.get("etag"); }
    if (digest !== firstDigest || r.headers.get("etag") !== firstEtag) throw new Error("Cached bytes/ETag differ from R2");
    const status = r.headers.get("x-image-cache"), reads = r.headers.get("x-image-r2-reads");
    warmup.push({ id: image.id, status, reads, bytes: bytes.length, cfRay: r.headers.get("cf-ray"), serverTiming: r.headers.get("server-timing"), sha256: digest });
    if (status === "HIT" && reads === "0") { hit = true; break; }
  }
  if (!hit) throw new Error(`Cache did not produce a HIT: ${image.id}`);
  const direct = await fetch(url, { headers: { "X-Image-Cache-Bypass": "1" } });
  const bytes = new Uint8Array(await direct.arrayBuffer());
  if (!direct.ok || direct.headers.get("x-image-cache") !== "BYPASS" || direct.headers.get("x-image-r2-reads") !== "1") throw new Error("Develop-only bypass is not enabled");
  if (createHash("sha256").update(bytes).digest("hex") !== firstDigest || direct.headers.get("etag") !== firstEtag) throw new Error("HIT and BYPASS bodies/ETags differ");
}
console.log(`Verified identical HIT/BYPASS bodies for ${images.length} images`);
const transfers = [
  { mode: "HIT", phase: "connection-warmup", image: images[0] },
  { mode: "BYPASS", phase: "connection-warmup", image: images[0] },
];
for (let round = 0; round < rounds; round++) {
  for (let index = 0; index < images.length; index++) {
    const order = (round + index) % 2 ? ["BYPASS", "HIT"] : ["HIT", "BYPASS"];
    for (const mode of order) transfers.push({ mode, phase: "measured", pair: `${round}-${index}`, round, image: images[index] });
  }
}
const args = [];
for (const [index, transfer] of transfers.entries()) {
  if (index) args.push("--next");
  const prefix = JSON.stringify({ phase: transfer.phase, mode: transfer.mode, id: transfer.image.id, pair: transfer.pair ?? null }).slice(0, -1);
  const format = prefix + ',"code":%{http_code},"http":"%{http_version}","ttfb":%{time_starttransfer},"total":%{time_total},"bytes":%{size_download},"connections":%{num_connects},"cache":"%header{x-image-cache}","r2Reads":"%header{x-image-r2-reads}","cfRay":"%header{cf-ray}","serverTiming":"%header{server-timing}"}\n';
  args.push("--silent", "--show-error", "--http2", "--connect-timeout", "10", "--max-time", "30", "--output", "/dev/null", "--write-out", format);
  if (transfer.mode === "BYPASS") args.push("--header", "X-Image-Cache-Bypass: 1");
  args.push(new URL(transfer.image.imageUrl, base).toString());
}
const samples = [], errors = [];
await new Promise((resolve, reject) => {
  const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
  createInterface({ input: child.stdout }).on("line", (line) => {
    try { samples.push(JSON.parse(line)); if (samples.length % 40 === 0) console.log(`Measured ${samples.length - 2}/${transfers.length - 2} transfers`); }
    catch { errors.push(line); }
  });
  child.stderr.on("data", (data) => errors.push(data.toString()));
  child.once("error", reject);
  child.once("close", (code) => code === 0 && !errors.length ? resolve() : reject(new Error(`curl ${code}: ${errors.join(" ")}`)));
});
if (samples.length !== transfers.length) throw new Error("Missing transfer results");
for (const s of samples) {
  if (s.code !== 200 || s.cache !== s.mode || s.r2Reads !== (s.mode === "HIT" ? "0" : "1")) throw new Error(`Unexpected cache result: ${JSON.stringify(s)}`);
}
const groups = Map.groupBy(samples.filter((s) => s.phase === "measured"), (s) => s.pair);
const valid = [], excluded = [];
for (const [pair, rows] of groups) {
  if (rows.length !== 2 || rows.some((r) => r.connections !== 0) || new Set(rows.map((r) => r.cfRay.split("-").at(-1))).size !== 1 || rows[0].bytes !== rows[1].bytes) excluded.push({ pair, rows });
  else valid.push(...rows);
}
if (valid.length < images.length * rounds) throw new Error("Too many samples lost to connection/PoP changes");
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.ceil(q * values.length) - 1];
const median = (values) => { const sorted = [...values].sort((a, b) => a - b), half = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2; };
const stats = (rows) => ({ count: rows.length, medianTtfbMs: median(rows.map((r) => r.ttfb * 1000)), p95TtfbMs: percentile(rows.map((r) => r.ttfb * 1000), .95), medianTotalMs: median(rows.map((r) => r.total * 1000)), p95TotalMs: percentile(rows.map((r) => r.total * 1000), .95), medianHandlerMs: median(rows.map((r) => Number(r.serverTiming.match(/(?:^|, )image;dur=([\d.]+)/)?.[1]))) });
const hit = stats(valid.filter((s) => s.mode === "HIT")), bypass = stats(valid.filter((s) => s.mode === "BYPASS"));
const report = { startedAt, finishedAt: new Date().toISOString(), base: base.origin, method: "curl HTTP/2, one connection pool, alternating AB/BA pairs, full bodies downloaded, no local HTTP cache, reconnect/mismatched-PoP pairs excluded", rounds, imageCount: images.length, pops: [...new Set(valid.map((r) => r.cfRay.split("-").at(-1)))], excludedPairs: excluded.length, hit, bypass, improvementPercent: { medianTtfb: (1 - hit.medianTtfbMs / bypass.medianTtfbMs) * 100, medianTotal: (1 - hit.medianTotalMs / bypass.medianTotalMs) * 100 }, warmup, samples, excluded };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, ...Object.fromEntries(Object.entries(report).filter(([key]) => !["warmup", "samples", "excluded"].includes(key))) }, null, 2));
