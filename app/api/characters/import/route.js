import { env } from "cloudflare:workers";
import { importCharactersResponse } from "../../../../worker/data-api.js";

export function POST(request) {
  return importCharactersResponse(request, env);
}
