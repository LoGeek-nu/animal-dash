/** Cloudflare Worker entry point for Animal Dash. */
import handler from "vinext/server/app-router-entry";
import { syncResponse } from "./sync-access.js";
import { GenerationQuota } from "./generation-quota.js";
import { RaceSessionRoom } from "./race-session-room.js";

export { GenerationQuota, RaceSessionRoom };

const worker = {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/api/sync") {
      return syncResponse(request, env);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
