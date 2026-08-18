import { characters } from "../../race-data";

export async function GET() {
  return Response.json({ characters, total: characters.length, mock: true });
}
