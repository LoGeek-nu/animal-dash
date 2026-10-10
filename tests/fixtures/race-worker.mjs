import { RaceSessionRoom } from "../../worker/race-session-room.js";

export { RaceSessionRoom };
export default {
  fetch(request, env) {
    return env.ROOM.getByName("runtime-test").fetch(request);
  },
};
