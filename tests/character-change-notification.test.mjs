import assert from "node:assert/strict";
import test from "node:test";
import { notifyCharactersChanged } from "../worker/sync.js";
import { RaceSessionRoom } from "../worker/race-session-room.js";
import { ensureGeneratedCharacters, refreshGeneratedCharacters, getGeneratedCharacters } from "../app/domain/generated-characters.js";

test("generation notifications carry the ID through the room", async () => {
  const events = [];
  const room = { broadcast: event => events.push(event) };
  const env = { RACE_SESSION: { getByName: () => ({ fetch: (url, options) => RaceSessionRoom.prototype.fetch.call(room, new Request(url, options)) }) } };
  await notifyCharactersChanged(env, "gen-notification-id");
  assert.deepEqual(events, [{ type: "characters-changed", id: "gen-notification-id", kind: "created" }]);
});

test("a notification during a lookup rejects the stale response and fetches the new metadata", async (t) => {
  const id = "gen-inflight-change";
  const pending = [];
  t.mock.method(globalThis, "fetch", () => new Promise(resolve => pending.push(resolve)));
  const lookup = ensureGeneratedCharacters([id]);
  const refresh = refreshGeneratedCharacters([id]);
  pending[0](Response.json({ characters: [{ id, generated: true, name: "stale" }] }));
  await new Promise(r => setImmediate(r));
  assert.equal(pending.length, 2);
  pending[1](Response.json({ characters: [{ id, generated: true, name: "fresh" }] }));
  await Promise.all([lookup, refresh]);
  assert.equal(getGeneratedCharacters().find(c => c.id === id).name, "fresh");
});
