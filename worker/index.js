/** Cloudflare Worker entry point for Animal Dash. */
import { characterThumbnailResponse } from "./character-thumbnail.js";
import handler from "vinext/server/app-router-entry";
import { syncResponse } from "./sync-access.js";
import { GenerationQuota } from "./generation-quota.js";
import { RaceSessionRoom } from "./race-session-room.js";

export { GenerationQuota, RaceSessionRoom };

const worker = {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const thumbnail = path.match(/^\/api\/characters\/([^/]+)\/thumbnail\/v1$/);
    if (thumbnail) {
      let id;
      try { id = decodeURIComponent(thumbnail[1]); } catch { return new Response("Invalid character id", { status: 400 }); }
      return characterThumbnailResponse(request, env, id);
    }
    if (path === "/api/sync") {
      return syncResponse(request, env);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
