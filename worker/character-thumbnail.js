import { characterImageKey, characterImageUrl } from "../app/api/characters/character-store.js";
import { characterThumbnailKey } from "../app/domain/character-thumbnail.js";
import { isSameOrigin, isStaffRequest, unauthorizedResponse } from "./auth.js";

// Transform once at creation/backfill time, then serve the persisted bytes from R2.
// Keeping thumbnails outside characters/ prevents old R2 metadata import from listing them.
export async function ensureCharacterThumbnail(env, id) {
  const started = performance.now();
  const key = characterThumbnailKey(id);
  const existing = await env.CHARACTERS.head(key);
  if (existing) return { id, status: "existing", bytes: existing.size, elapsedMs: performance.now() - started };
  const source = await env.CHARACTERS.get(characterImageKey(id));
  if (!source) return null;
  if (!env.IMAGES) throw new Error("Images binding unavailable");
  const output = await env.IMAGES.input(source.body)
    .transform({ width: 256, height: 256, fit: "scale-down" })
    .output({ format: "image/webp", quality: 80 });
  const image = output.response();
  if (!image.ok || image.headers.get("Content-Type")?.split(";")[0] !== "image/webp") throw new Error("Thumbnail transformation failed");
  // R2 requires a known-length body; only the bounded 256px result is buffered.
  const bytes = await image.arrayBuffer();
  if (bytes.byteLength > 1024 * 1024) throw new Error("Thumbnail unexpectedly large");
  const saved = await env.CHARACTERS.put(key, bytes, {
    httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { sourceEtag: source.etag, variant: "v1-256-q80" },
  });
  return { id, status: "created", bytes: saved.size, sourceBytes: source.size, elapsedMs: performance.now() - started };
}

// Thumbnail errors must not turn an otherwise successfully generated character into
// a failed generation (which would encourage another expensive, duplicate generation).
export async function prepareGeneratedCharacterThumbnail(env, id) {
  try {
    const result = await ensureCharacterThumbnail(env, id);
    if (!result) throw new Error("Original image missing");
    return result;
  } catch (error) {
    console.error("character_thumbnail_generation_failed", { id, error: String(error) });
    return null;
  }
}

export async function characterThumbnailResponse(request, env, id) {
  if (!id || id.length > 200) return new Response("Invalid character id", { status: 400 });
  if (request.method === "POST") {
    if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
    if (!(await isStaffRequest(request, env))) return unauthorizedResponse();
    try {
      const result = await ensureCharacterThumbnail(env, id);
      return Response.json(result ?? { error: "not_found" }, { status: result ? 200 : 404, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("character_thumbnail_backfill_failed", { id, error: String(error) });
      return Response.json({ error: "thumbnail_failed", retryable: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD, POST" } });
  try {
    const key = characterThumbnailKey(id);
    const object = request.method === "HEAD" ? await env.CHARACTERS.head(key) : await env.CHARACTERS.get(key);
    if (!object) return new Response(null, { status: 307, headers: { Location: characterImageUrl(id), "Cache-Control": "no-store" } });
    const headers = {
      "Content-Type": "image/webp", "Content-Length": String(object.size),
      "Cache-Control": "public, max-age=31536000, immutable", ETag: object.httpEtag,
    };
    const matched = request.headers.get("If-None-Match")?.split(",").some((value) => value.trim() === "*" || value.trim().replace(/^W\//, "") === object.httpEtag);
    if (matched) { delete headers["Content-Length"]; return new Response(null, { status: 304, headers }); }
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  } catch (error) {
    console.error("character_thumbnail_read_failed", { id, error: String(error) });
    return new Response(null, { status: 307, headers: { Location: characterImageUrl(id), "Cache-Control": "no-store" } });
  }
}
