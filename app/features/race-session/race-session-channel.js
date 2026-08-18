import { CHANNEL_NAME, STORAGE_KEY } from "./constants.js";
import { validSession } from "./race-session-validator.js";

export function createRaceSessionChannel(onSession) {
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

  const accept = (candidate) => {
    if (validSession(candidate)) onSession(candidate);
  };

  const onMessage = (event) => accept(event.data);
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      accept(JSON.parse(event.newValue));
    } catch {
      // Ignore incomplete writes from another tab.
    }
  };

  if (channel) channel.addEventListener("message", onMessage);
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  return {
    publish(session) {
      channel?.postMessage(session);
    },
    close() {
      if (channel) {
        channel.removeEventListener("message", onMessage);
        channel.close();
      }
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    },
  };
}
