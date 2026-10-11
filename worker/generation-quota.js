// Image-poc asks Gemini once per generation, and Gemini stops answering above 15 requests a minute.
// One shared object counts every generation in a sliding 60-second window, so no 60-second span
// ever sees more than GENERATION_LIMIT (a fixed-window limiter would let two windows' worth through
// back to back). Like RaceSessionRoom, it needs only fetch, so it does not extend DurableObject.
export const GENERATION_LIMIT = 10;
export const GENERATION_WINDOW_MS = 60_000;
const QUOTA_NAME = "main";

export class GenerationQuota {
  constructor(ctx) {
    this.ctx = ctx;
  }

  // Takes one slot if the window has room. Storage calls run behind the input gate, so
  // concurrent requests cannot both see the last free slot.
  async fetch() {
    const now = Date.now();
    const recent = ((await this.ctx.storage.get("recent")) ?? []).filter((at) => now - at < GENERATION_WINDOW_MS);
    if (recent.length >= GENERATION_LIMIT) {
      return Response.json({ allowed: false, retryAfter: Math.ceil((recent[0] + GENERATION_WINDOW_MS - now) / 1000) });
    }
    recent.push(now);
    await this.ctx.storage.put("recent", recent);
    return Response.json({ allowed: true });
  }
}

// Returns { allowed: true } or { allowed: false, retryAfter } (seconds). Unlimited when the binding is absent.
export async function takeGenerationSlot(env) {
  if (!env.GENERATION_QUOTA) return { allowed: true };
  const response = await env.GENERATION_QUOTA.getByName(QUOTA_NAME).fetch("https://quota/take", { method: "POST" });
  return response.json();
}
