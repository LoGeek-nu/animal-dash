import { env } from "cloudflare:workers";
import { characters } from "../../../domain/characters.js";
import { notifyCharactersChanged } from "../../../../worker/sync.js";
import { saveGeneratedCharacter } from "../character-store.js";

const PALETTE = characters.map(({ color, pale }) => ({ color, pale }));

function pickPalette(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function pickPreset(stats) {
  const { speed, acceleration, stamina } = stats;
  const max = Math.max(speed, acceleration, stamina);
  if (speed === max && acceleration === max && stamina === max) return "バランス";
  if (speed === max) return "スピード";
  if (acceleration === max) return "ダッシュ";
  return "スタミナ";
}

function toRaceCharacter(status) {
  const id = `gen-${crypto.randomUUID()}`;
  const stats = {
    speed: status.stats.speed,
    acceleration: status.stats.jump,
    stamina: status.stats.power,
  };
  return {
    id,
    name: status.title,
    ...pickPalette(id),
    preset: pickPreset(stats),
    caption: `${status.animal_type}・${status.personality}`,
    stats,
    generated: true,
  };
}

function missingEnvResponse() {
  return Response.json(
    { error: "server_misconfigured", detail: "IMAGE_POC_API_URL/IMAGE_POC_API_KEY/CHARACTERS is not configured", retryable: false },
    { status: 500 },
  );
}

export async function POST(request) {
  // IMAGE_POC_BYPASS_SECRET is optional: it's only needed if Vercel's own
  // Deployment Protection is ever turned on for the production alias domain
  // (it currently isn't — the app-level X-API-Key is the real gate).
  const { IMAGE_POC_API_URL, IMAGE_POC_API_KEY, IMAGE_POC_BYPASS_SECRET, CHARACTERS } = env;
  if (!IMAGE_POC_API_URL || !IMAGE_POC_API_KEY || !CHARACTERS) {
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
    });
  } catch (cause) {
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

  let character;
  try {
    character = await saveGeneratedCharacter(CHARACTERS, toRaceCharacter(body.status), body.image_base64);
  } catch (cause) {
    return Response.json({ error: "storage_failed", detail: String(cause), retryable: true }, { status: 500 });
  }

  // Other screens can still pick the character up on their next reload, so a failed notice is not an error.
  await notifyCharactersChanged(env).catch(() => {});
  return Response.json(character);
}
