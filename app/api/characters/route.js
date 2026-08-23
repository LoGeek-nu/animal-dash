import { characters } from "../../domain/characters.js";

export async function GET() {
  return Response.json({ characters, total: characters.length, mock: true });
}
