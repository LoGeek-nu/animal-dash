import { env } from "cloudflare:workers";
import { characters, characterType } from "../../../domain/characters.js";
import { readGeneratedStats } from "../../../domain/generated-stats.js";
import { isStaffRequest, unauthorizedResponse } from "../../../../worker/auth.js";
import { takeGenerationSlot } from "../../../../worker/generation-quota.js";
import { saveCharacter } from "../../../../worker/data-store.js";
import { notifyCharactersChanged } from "../../../../worker/sync.js";
import { characterImageKey, saveGeneratedCharacter } from "../character-store.js";

const PALETTE = characters.map(({ color, pale }) => ({ color, pale }));
// Just under the admin screen's 60s limit, so staff see the server's own timeout message.
const UPSTREAM_TIMEOUT_MS = 55_000;

function pickPalette(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function toRaceCharacter(status, stats) {
  const id = `gen-${crypto.randomUUID()}`;
  return {
    id,
    name: status.title,
    ...pickPalette(id),
    preset: characterType(stats),
    caption: `${status.animal_type}・${status.personality}`,
    stats,
    generated: true,
  };
}

function missingEnvResponse() {
  return Response.json(
    { error: "server_misconfigured", detail: "IMAGE_POC_API_URL/IMAGE_POC_API_KEY/CHARACTERS/DB is not configured", retryable: false },
    { status: 500 },
  );
}

export async function POST(request) {
  if (!(await isStaffRequest(request, env))) return unauthorizedResponse();

  // IMAGE_POC_BYPASS_SECRET is optional: it's only needed if Vercel's own
  // Deployment Protection is ever turned on for the production alias domain
  // (it currently isn't — the app-level X-API-Key is the real gate).
  const { IMAGE_POC_API_URL, IMAGE_POC_API_KEY, IMAGE_POC_BYPASS_SECRET, CHARACTERS, DB } = env;
  if (!IMAGE_POC_API_URL || !IMAGE_POC_API_KEY || !CHARACTERS || !DB) {
    return missingEnvResponse();
  }

  let incomingForm;
  try {
    incomingForm = await request.formData();
  } catch {
    return Response.json({ error: "invalid_form_data", detail: "expected multipart/form-data with an image field", retryable: false }, { status: 400 });
  }
  const image = incomingForm.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return Response.json({ error: "missing_image", detail: "image field is required", retryable: false }, { status: 400 });
  }

  // Counted only once the request will really reach Gemini; failed generations still count there.
  const slot = await takeGenerationSlot(env);
  if (!slot.allowed) {
    return Response.json(
      { error: "rate_limited", detail: `生成が混み合っています。${slot.retryAfter}秒ほど待ってから、もう一度試してください。`, retryable: true, retryAfter: slot.retryAfter },
      { status: 429, headers: { "Retry-After": String(slot.retryAfter) } },
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.append("image", image, image.name || "upload.png");

  let upstream;
  try {
    upstream = await fetch(`${IMAGE_POC_API_URL}/v1/characters/generate`, {
      method: "POST",
      headers: {
        "X-API-Key": IMAGE_POC_API_KEY,
        ...(IMAGE_POC_BYPASS_SECRET ? { "x-vercel-protection-bypass": IMAGE_POC_BYPASS_SECRET } : {}),
      },
      body: upstreamForm,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (cause) {
    if (cause?.name === "TimeoutError") {
      return Response.json({ error: "upstream_timeout", detail: "画像の生成に時間がかかりすぎました。もう一度試してください。", retryable: true }, { status: 504 });
    }
    return Response.json({ error: "upstream_unreachable", detail: String(cause), retryable: true }, { status: 502 });
  }

  let body;
  try {
    body = await upstream.json();
  } catch {
    return Response.json({ error: "upstream_invalid_response", retryable: true }, { status: 502 });
  }

  if (!upstream.ok) {
    // image-poc already returns {error, retryable} — pass its status and body through as-is.
    return Response.json(body, { status: upstream.status });
  }

  const stats = readGeneratedStats(body.status?.stats);
  if (!stats) {
    return Response.json({ error: "upstream_invalid_response", detail: "キャラクターのステータスを読み取れませんでした。もう一度試してください。", retryable: true }, { status: 502 });
  }

  let character;
  try {
    character = await saveGeneratedCharacter(CHARACTERS, toRaceCharacter(body.status, stats), body.image_base64);
    // Keep R2 metadata for recovery via /api/characters/import if the D1 write fails.
    await saveCharacter(DB, character, characterImageKey(character.id));
  } catch (cause) {
    return Response.json({ error: "storage_failed", detail: String(cause), retryable: true }, { status: 500 });
  }

  // Other screens can still pick the character up on their next reload, so a failed notice is not an error.
  await notifyCharactersChanged(env).catch(() => {});
  return Response.json(character);
}
