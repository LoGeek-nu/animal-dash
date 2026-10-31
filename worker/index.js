/** Cloudflare Worker entry point for Animal Dash. */
import handler from "vinext/server/app-router-entry";
import { characterImageResponse } from "./character-image.js";
import { syncResponse } from "./sync-access.js";
import { GenerationQuota } from "./generation-quota.js";
import { RaceSessionRoom } from "./race-session-room.js";

export { GenerationQuota, RaceSessionRoom };

const worker = {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    const image = pathname.match(/^\/api\/characters\/([^/]+)\/image$/);
    if (image) {
      let id;
      try { id = decodeURIComponent(image[1]); }
      catch { return new Response("Invalid character ID", { status: 400, headers: { "Cache-Control": "no-store" } }); }
      return characterImageResponse(request, env, ctx, id);
    }
    if (pathname === "/api/sync") {
      return syncResponse(request, env);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
