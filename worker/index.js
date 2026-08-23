/** Cloudflare Worker entry point for Animal Dash. */
import handler from "vinext/server/app-router-entry";

const worker = {
  async fetch(request, env, ctx) {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
