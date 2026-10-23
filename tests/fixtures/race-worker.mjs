import { POST as generateCharacter } from "../../app/api/characters/generate/route.js";
import { POST as importCharacters } from "../../app/api/characters/import/route.js";
import { syncResponse } from "../../worker/sync-access.js";
import { RaceSessionRoom as BaseRoom } from "../../worker/race-session-room.js";
export class RaceSessionRoom extends BaseRoom {
  constructor(ctx, env) { super(ctx, env); this.now = () => this.testNow ?? Date.now(); }
  async fetch(request) {
    if (new URL(request.url).pathname === "/test-failure") {
      const raceId = new URL(request.url).searchParams.get("raceId");
      await this.ctx.storage.put(`result:${raceId}`, { raceId });
      await this.flushResults();
      return new Response("ok");
    }
    if (new URL(request.url).pathname === "/test-clock") {
      this.testNow = Number(new URL(request.url).searchParams.get("now"));
      await this.ctx.storage.put("test-clock", this.testNow);
      return new Response("ok");
    }
    return super.fetch(request);
  }
  async webSocketMessage(socket, message) {
    this.testNow = await this.ctx.storage.get("test-clock");
    return super.webSocketMessage(socket, message);
  }
}
export default { fetch(request, env) {
  if (new URL(request.url).pathname === "/api/characters/generate") return generateCharacter(request);
  if (new URL(request.url).pathname === "/api/characters/import") return importCharacters(request);
  if (new URL(request.url).pathname === "/api/sync") {
    return syncResponse(request, { ...env, RACE_SESSION: { getByName: () => env.ROOM.getByName("runtime-test") } });
  }
  return env.ROOM.getByName("runtime-test").fetch(request);
} };
