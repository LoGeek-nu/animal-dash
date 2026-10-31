import { env } from "cloudflare:workers";
import { characterImageResponse } from "../../../../../worker/character-image.js";

export async function GET(request, { params }) {
  const { id } = await params;
  return characterImageResponse(request, env, null, id);
}

export const HEAD = GET;
