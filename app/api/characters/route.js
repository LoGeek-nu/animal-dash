import { env } from "cloudflare:workers";
import { characters } from "../../domain/characters.js";
import { listGeneratedCharacters } from "./character-store.js";

export async function GET() {
  const generated = env.CHARACTERS ? await listGeneratedCharacters(env.CHARACTERS) : [];
  return Response.json(
    { characters: [...characters, ...generated], total: characters.length + generated.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
