// Shared by the Worker entry and app routes that need to reach the sync room.
export const ROOM_NAME = "main";

export function getSyncRoom(env) {
  return env.RACE_SESSION.getByName(ROOM_NAME);
}

// Tells every connected screen to reload the generated character list.
export async function notifyCharactersChanged(env) {
  await getSyncRoom(env).fetch("https://sync/characters-changed", { method: "POST" });
}
