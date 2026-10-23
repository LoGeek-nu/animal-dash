import assert from "node:assert/strict";
import test from "node:test";
import { characters } from "../app/domain/characters.js";
import { createRaceReplay, advanceRaceReplay } from "../app/features/game/race/race-replay.js";
import { receiveRaceUpdate, spectatorElapsed } from "../app/features/game/race/spectator-race.js";
import { replayRace } from "../worker/race-authority.js";

const race = () => ({ raceId: "spectated", startedAt: 100_000, serverNow: 105_000,
  lanes: [{ characterId: "momo", isBot: false }, { characterId: "kon", isBot: true }, null, null],
  characters: [characters.find((c) => c.id === "momo"), characters.find((c) => c.id === "kon"), null, null],
  inputs: [{ at: 1000, buttons: 17 }, { at: 1010, buttons: 16 }, { at: 3000, buttons: 0 }] });

test("late join, live inputs and reconnect replay exactly the same positions, jumps, stamina and goals", () => {
  let feed = receiveRaceUpdate(null, { type: "race", race: race() }, 20);
  const full = createRaceReplay(feed);
  advanceRaceReplay(full, 5000);
  const lateJoin = advanceRaceReplay(createRaceReplay(feed), spectatorElapsed(feed, 20));
  assert.deepEqual(lateJoin.runners, full.runtime.runners);
  feed = receiveRaceUpdate(feed, { type: "race-input", raceId: feed.raceId, input: { at: 5010, buttons: 17 }, serverNow: 105_010 }, 30);
  const refreshed = advanceRaceReplay(createRaceReplay(feed), spectatorElapsed(feed, 50));
  const completeLog = createRaceReplay({ ...race(), inputs: feed.inputs });
  assert.deepEqual(refreshed.runners, advanceRaceReplay(completeLog, 5030).runners);
  assert.ok(refreshed.runners[0].y > 0, "player's jump reaches spectators");
  assert.equal(refreshed.runners[0].boosting, true);
  const reconnected = receiveRaceUpdate(null, { type: "race", race: { ...feed, serverNow: 107_000 } }, 900);
  const resumed = advanceRaceReplay(createRaceReplay(reconnected), spectatorElapsed(reconnected, 900));
  assert.deepEqual(resumed.runners, advanceRaceReplay(completeLog, 7000).runners);
  const finished = advanceRaceReplay(createRaceReplay(reconnected), 59_000).completed;
  assert.deepEqual(finished.results, replayRace(reconnected, 159_000).results);
});

test("spectator wall clock and refresh FPS cannot change race timing", () => {
  const feed = receiveRaceUpdate(null, { type: "race", race: race() }, 1234);
  assert.equal(spectatorElapsed(feed, 1334), 5100);
  const results = [20, 60, 120].map((fps) => {
    const replay = createRaceReplay(feed);
    for (let now = 1234; now < 60_234 && !replay.runtime.completed; now += 1000 / fps) {
      advanceRaceReplay(replay, spectatorElapsed(feed, now));
    }
    return replay.runtime.completed.results;
  });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
});

test("delayed input from an old race, older snapshots and malformed replay frames are ignored", () => {
  const feed = receiveRaceUpdate(null, { type: "race", race: race() }, 10);
  const stale = [
    { type: "race-input", raceId: "previous", input: { at: 4000, buttons: 17 }, serverNow: 106_000 },
    { type: "race-input", raceId: feed.raceId, input: { at: -1, buttons: 17 }, serverNow: 106_000 },
    { type: "race", race: { ...race(), serverNow: 104_000 } },
    { type: "race", race: { ...race(), raceId: "previous", startedAt: 90_000, serverNow: 99_000 } },
    { type: "race", race: { ...race(), inputs: [{ at: 5000, buttons: 256 }] } },
  ];
  for (const message of stale) assert.equal(receiveRaceUpdate(feed, message, 100), feed);
});
