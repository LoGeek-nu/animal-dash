/** Cloudflare Worker entry point for Animal Dash. */
import handler from "vinext/server/app-router-entry";
import { RaceSessionRoom } from "./race-session-room.js";
import { getSyncRoom } from "./sync.js";

export { RaceSessionRoom };

const worker = {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/api/sync") {
      return getSyncRoom(env).fetch(request);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
