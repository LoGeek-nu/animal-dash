import { characterImageKey, characterImageUrl } from "../app/api/characters/character-store.js";

const IMAGE_TTL = "public, max-age=31536000, immutable";

function measured(response, request, status, started, cacheMs = 0, r2Ms = null, reads = 0) {
  const headers = new Headers(response.headers);
  headers.set("X-Image-Cache", status);
  headers.set("X-Image-R2-Reads", String(reads));
  const timing = [`image_cache;dur=${cacheMs.toFixed(2)}`];
  if (r2Ms !== null) timing.push(`r2;dur=${r2Ms.toFixed(2)}`);
  timing.push(`image;dur=${(performance.now() - started).toFixed(2)}`);
  headers.set("Server-Timing", timing.join(", "));
  return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
}

function notModified(request, response) {
  const etag = response.headers.get("ETag");
  const match = request.headers.get("If-None-Match");
  if (etag && match?.split(",").some((value) => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""))) {
    const headers = new Headers(response.headers);
    headers.delete("Content-Length");
    return new Response(null, { status: 304, headers });
  }
  return response;
}

// Public, immutable pixels only. Neither staff cookies nor arbitrary query strings
// belong in the key. Cache API entries remain local to the serving Cloudflare PoP.
export async function characterImageResponse(request, env, ctx, id, cache = globalThis.caches?.default) {
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
  const started = performance.now();
  const url = new URL(request.url);
  const bypass = env.IMAGE_CACHE_BENCHMARK === "true" && request.headers.get("X-Image-Cache-Bypass") === "1";
  const useCache = Boolean(cache) && !url.hostname.endsWith(".workers.dev") && !bypass;
  const key = new Request(new URL(characterImageUrl(id), url.origin));
  let cacheMs = 0;
  if (useCache) {
    const before = performance.now();
    try {
      const hit = await cache.match(key);
      cacheMs = performance.now() - before;
      if (hit) return measured(notModified(request, hit), request, "HIT", started, cacheMs);
    } catch (error) {
      cacheMs = performance.now() - before;
      console.warn("character_image_cache_read_failed", String(error));
    }
  }
  const status = useCache ? "MISS" : "BYPASS";
  const before = performance.now();
  let object;
  try {
    if (!env.CHARACTERS) throw new Error("Character bucket unavailable");
    object = request.method === "HEAD" ? await env.CHARACTERS.head(characterImageKey(id)) : await env.CHARACTERS.get(characterImageKey(id));
  } catch (error) {
    console.error("character_image_read_failed", String(error));
    return measured(new Response("Image unavailable", { status: 503, headers: { "Cache-Control": "no-store" } }), request, status, started, cacheMs, performance.now() - before, 1);
  }
  const r2Ms = performance.now() - before;
  if (!object) return measured(new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } }), request, status, started, cacheMs, r2Ms, 1);
  const response = new Response(request.method === "HEAD" ? null : object.body, { headers: {
    "Content-Type": object.httpMetadata?.contentType ?? "image/png",
    "Content-Length": String(object.size),
    "Cache-Control": IMAGE_TTL,
    ETag: object.httpEtag,
    "Last-Modified": object.uploaded.toUTCString(),
  } });
  if (useCache && request.method === "GET") {
    try {
      // Store the complete 200 response, without request-specific measurements.
      const write = cache.put(key, response.clone()).catch((error) => console.warn("character_image_cache_write_failed", String(error)));
      if (ctx) ctx.waitUntil(write);
      else await write;
    } catch (error) { console.warn("character_image_cache_write_failed", String(error)); }
  }
  return measured(notModified(request, response), request, status, started, cacheMs, r2Ms, 1);
}
