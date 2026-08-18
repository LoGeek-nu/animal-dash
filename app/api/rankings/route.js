import { getCharacter, staticRanking } from "../../race-data.js";

export async function GET() {
  return Response.json({
    eventId: "oureisai-2026",
    date: "2026-08-19",
    rankings: staticRanking.map((entry, index) => ({ rank: index + 1, ...entry, displayName: getCharacter(entry.characterId).name })),
    mock: true,
  });
}
