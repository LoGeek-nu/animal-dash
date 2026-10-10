import { env } from "cloudflare:workers";
import { rankingsResponse } from "../../../worker/data-api.js";

export function GET(request) {
  return rankingsResponse(request, env);
}
