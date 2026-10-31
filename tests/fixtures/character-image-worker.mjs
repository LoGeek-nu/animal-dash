import { characterImageResponse } from "../../worker/character-image.js";

export default {
  async fetch(request, env, ctx) {
    let observedReads = 0;
    const pending = [];
    const bucket = {
      get(key) { observedReads++; if (request.headers.has("X-Test-R2-Failure")) throw new Error("Test R2 failure"); return env.CHARACTERS.get(key); },
      head(key) { observedReads++; return env.CHARACTERS.head(key); },
    };
    const cache = request.headers.has("X-Test-Cache-Read-Failure") ? {
      match() { throw new Error("Test cache unavailable"); },
      put: (...args) => caches.default.put(...args),
    } : request.headers.has("X-Test-Cache-Write-Failure") ? {
      match: (...args) => caches.default.match(...args),
      put() { return Promise.reject(new Error("Test cache write failed")); },
    } : caches.default;
    const id = new URL(request.url).pathname.split("/").at(-1);
    const response = await characterImageResponse(request, { ...env, CHARACTERS: bucket }, {
      waitUntil(promise) { pending.push(promise); ctx.waitUntil(promise); },
    }, id, cache);
    await Promise.all(pending);
    const headers = new Headers(response.headers);
    headers.set("X-Test-Observed-R2-Reads", String(observedReads));
    return new Response(response.body, { status: response.status, headers });
  },
};
