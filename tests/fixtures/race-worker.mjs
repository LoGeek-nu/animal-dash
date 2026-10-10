import { RaceSessionRoom as BaseRoom } from "../../worker/race-session-room.js";
export class RaceSessionRoom extends BaseRoom {
  constructor(ctx, env) { super(ctx, env); this.now = () => this.testNow ?? Date.now(); }
  async fetch(request) {
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
export default { fetch(request, env) { return env.ROOM.getByName("runtime-test").fetch(request); } };
