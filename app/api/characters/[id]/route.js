import { env } from "cloudflare:workers";
import { updateCharacterResponse } from "../../../../worker/data-api.js";

export async function PATCH(request, { params }) {
  const { id } = await params;
  return updateCharacterResponse(request, env, id);
}
