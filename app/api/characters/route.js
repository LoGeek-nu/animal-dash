import { env } from "cloudflare:workers";
import { charactersResponse } from "../../../worker/data-api.js";

export function GET(request) {
  return charactersResponse(env, request);
}
