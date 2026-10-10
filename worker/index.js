/** Cloudflare Worker entry point for Animal Dash. */
import handler from "vinext/server/app-router-entry";
import { isSameOrigin, isStaffRequest, unauthorizedResponse } from "./auth.js";
import { GenerationQuota } from "./generation-quota.js";
import { RaceSessionRoom } from "./race-session-room.js";
import { getSyncRoom } from "./sync.js";

export { GenerationQuota, RaceSessionRoom };

const worker = {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/api/sync") {
      if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
      if (!(await isStaffRequest(request, env))) return unauthorizedResponse();
      return getSyncRoom(env).fetch(request);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
