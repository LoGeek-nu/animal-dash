import { isSameOrigin, isStaffRequest, unauthorizedResponse } from "./auth.js";
import { getDailyRankings, importCharacterPage, listStoredCharacters, rankingDay } from "./data-store.js";
import { getSyncRoom } from "./sync.js";

const headers = { "Cache-Control": "no-store" };
const unavailable = () => Response.json({ error: "storage_unavailable", retryable: true }, { status: 503, headers });

export async function charactersResponse(env) {
  if (!env.DB) return unavailable();
  try {
    const characters = await listStoredCharacters(env.DB);
    return Response.json({ characters, total: characters.length }, { headers });
  } catch (error) {
    console.error("character_list_failed", error);
    return unavailable();
  }
}

export async function rankingsResponse(request, env) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? undefined;
  const limit = params.has("limit") ? Number(params.get("limit")) : 10;
  const afterRaceId = params.get("afterRaceId");
  // Validate separately from database errors so an unavailable DB is never an empty leaderboard.
  try {
    rankingDay(date);
    if (afterRaceId !== null && (afterRaceId.length === 0 || afterRaceId.length > 200)) throw new Error("Invalid race ID");
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("limit must be an integer from 1 to 10");
  } catch (error) {
    return Response.json({ error: "invalid_query", detail: error.message }, { status: 400, headers });
  }
  if (!env.DB) return unavailable();
  try {
    // Check first, then read the board: true must never accompany a pre-save leaderboard.
    const raceSaved = afterRaceId === null ? undefined
      : Boolean(await env.DB.prepare("SELECT id FROM races WHERE id = ?").bind(afterRaceId).first());
    let raceFailed = false;
    if (afterRaceId && !raceSaved && env.RACE_SESSION) {
      const status = await getSyncRoom(env).fetch(`https://sync/race-save-status?raceId=${encodeURIComponent(afterRaceId)}`);
      if (!status.ok) throw new Error("Race save status unavailable");
      raceFailed = (await status.json()).failed === true;
    }
    return Response.json({ ...await getDailyRankings(env.DB, { date, limit }),
      ...(afterRaceId !== null ? { afterRaceId, raceSaved, raceFailed } : {}) }, { headers });
  } catch (error) {
    console.error("rankings_failed", error);
    return unavailable();
  }
}

export async function importCharactersResponse(request, env) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  if (!(await isStaffRequest(request, env))) return unauthorizedResponse();
  if (!env.DB || !env.CHARACTERS) return unavailable();
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  try {
    return Response.json(await importCharacterPage(env.DB, env.CHARACTERS, cursor), { headers });
  } catch (error) {
    console.error("character_import_failed", error);
    return unavailable();
  }
}
