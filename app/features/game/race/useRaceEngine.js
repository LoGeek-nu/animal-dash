"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { courseObstacles } from "../../../domain/course.js";
import { getRaceInput } from "./race-input.js";
import { PAINT_INTERVAL } from "./constants.js";
import { createRuntimeRunner, toRenderableRunner } from "./race-engine.js";
import { calculateLiveRanks } from "./race-ranking.js";
import { advanceRaceRuntime, createRaceRuntime } from "./race-runtime.js";
import { createRaceReplay, advanceRaceReplay } from "./race-replay.js";
import { spectatorElapsed } from "./spectator-race.js";
import { useRaceControls } from "./useRaceControls.js";

export function useRaceEngine({ raceId, lanes, raceStartedAt, onFinished, onInput, canControl = false, raceFeed = null, connected = true }) {
  const [runners, setRunners] = useState(() => lanes.map(() => toRenderableRunner(createRuntimeRunner(), 0)));
  const runtimeRef = useRef(null);
  const { readInput, consumeJump, pollGamepads } = useRaceControls(lanes.length, canControl && connected);
  const feedRef = useRef(raceFeed);
  useEffect(() => { feedRef.current = raceFeed; }, [raceFeed]);
  const playbackFeed = canControl ? null : raceFeed;

  useEffect(() => {
    if (!connected) { runtimeRef.current = null; return undefined; }
    if (!canControl) {
      runtimeRef.current = null;
      if (playbackFeed?.raceId !== raceId) return undefined;
      const replay = createRaceReplay(playbackFeed);
      let frame;
      const paint = (now) => {
        const runtime = advanceRaceReplay(replay, spectatorElapsed(playbackFeed, now));
        setRunners(runtime.runners.map((runner) => toRenderableRunner(runner, runtime.simulatedElapsed)));
        frame = requestAnimationFrame(paint);
      };
      frame = requestAnimationFrame(paint);
      return () => cancelAnimationFrame(frame);
    }
    // Sync replaces lane objects and callbacks. Preserve this race's runners, clock and completion.
    if (!runtimeRef.current || runtimeRef.current.raceId !== raceId) {
      const now = performance.now();
      const feed = feedRef.current;
      if (feed?.raceId === raceId) {
        const elapsed = spectatorElapsed(feed, now);
        runtimeRef.current = advanceRaceReplay(createRaceReplay(feed), elapsed);
        runtimeRef.current.origin = now;
        runtimeRef.current.elapsedAtOrigin = elapsed;
      } else {
        runtimeRef.current = createRaceRuntime({ raceId, raceStartedAt, lanes, now, epochNow: Date.now() });
      }
      runtimeRef.current.wallOrigin = Date.now();
    }
    const runtime = runtimeRef.current;
    let frame = 0;
    let lastPaint = 0;
    let lastReport = -Infinity;
    let lastButtons = null;
    let lastInputAt = -Infinity;

    const tick = (now) => {
      const gamepads = navigator.getGamepads?.() ?? [];
      pollGamepads(gamepads);
      const buttons = runtime.lanes.reduce((mask, lane, index) => {
        if (!lane || lane.isBot) return mask;
        const input = readInput(index, gamepads[index]);
        return mask | (input.jump ? 1 << index : 0) | (input.boost ? 1 << (index + 4) : 0);
      }, 0);
      if (!runtime.completed && (buttons !== lastButtons || now - lastInputAt >= 250)) { onInput?.({ raceId, buttons }); lastButtons = buttons; lastInputAt = now; }
      advanceRaceRuntime(runtime, {
        now, epochNow: runtime.raceStartedAt + runtime.elapsedAtOrigin + Math.max(now - runtime.origin, Date.now() - runtime.wallOrigin), onJumpInput: consumeJump,
        readInput: (laneIndex, runner, lane, simulationNow) => {
          return getRaceInput({ lane, laneIndex, runner, now: simulationNow, obstacles: courseObstacles,
            manualInput: readInput(laneIndex, gamepads[laneIndex]) });
        },
      });

      if (runtime.completed || now - lastPaint > PAINT_INTERVAL) {
        setRunners(runtime.runners.map((runner) => toRenderableRunner(runner, runtime.simulatedElapsed)));
        lastPaint = now;
      }

      // Keep reporting until the room replies with its canonical RESULTS. A
      // slightly earlier local goal must not strand a race waiting for its owner.
      if (runtime.completed && now - lastReport >= 250) { onFinished?.(runtime.completed); lastReport = now; }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [raceId, raceStartedAt, lanes, onFinished, onInput, consumeJump, readInput, pollGamepads, canControl, playbackFeed, connected]);

  const ranks = useMemo(() => calculateLiveRanks(runners, lanes), [lanes, runners]);
  return { runners, ranks };
}
