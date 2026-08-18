import { characters } from "../../race-data.js";

export async function GET() {
  return Response.json({ characters, total: characters.length, mock: true });
}
