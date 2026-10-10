"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { courseObstacles } from "../../../domain/course.js";
import { getBotInput } from "./bot-controller.js";
import { PAINT_INTERVAL } from "./constants.js";
import { createRuntimeRunner, toRenderableRunner } from "./race-engine.js";
import { calculateLiveRanks } from "./race-ranking.js";
import { advanceRaceRuntime, createRaceRuntime, takeRaceCompletion } from "./race-runtime.js";
import { useRaceControls } from "./useRaceControls.js";

export function useRaceEngine({ raceId, lanes, raceStartedAt, onFinished }) {
  const [runners, setRunners] = useState(() => lanes.map(() => toRenderableRunner(createRuntimeRunner(), 0)));
  const runtimeRef = useRef(null);
  const { readInput, consumeJump } = useRaceControls(lanes.length);

  useEffect(() => {
    // Sync replaces lane objects and callbacks. Preserve this race's runners, clock and completion.
    if (!runtimeRef.current || runtimeRef.current.raceId !== raceId) {
      runtimeRef.current = createRaceRuntime({ raceId, raceStartedAt, lanes, now: performance.now(), epochNow: Date.now() });
    }
    const runtime = runtimeRef.current;
    let frame = 0;
    let lastPaint = 0;

    const tick = (now) => {
      const gamepads = navigator.getGamepads?.() ?? [];
      advanceRaceRuntime(runtime, {
        now, epochNow: Date.now(), onJump: consumeJump,
        readInput: (laneIndex, runner, lane, simulationNow) => {
          const manual = readInput(laneIndex, gamepads[laneIndex]);
          const bot = lane.isBot ? getBotInput({ laneIndex, runner, now: simulationNow, obstacles: courseObstacles }) : { jump: false, boost: false };
          return { jump: manual.jump || bot.jump, boost: manual.boost || bot.boost };
        },
      });

      if (runtime.completed || now - lastPaint > PAINT_INTERVAL) {
        setRunners(runtime.runners.map((runner) => toRenderableRunner(runner, runtime.simulatedElapsed)));
        lastPaint = now;
      }

      const completed = takeRaceCompletion(runtime);
      if (completed) onFinished(completed);
      if (!runtime.completed) frame = requestAnimationFrame(tick);
    };

    if (!runtime.completed) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [raceId, raceStartedAt, lanes, onFinished, consumeJump, readInput]);

  const ranks = useMemo(() => calculateLiveRanks(runners, lanes), [lanes, runners]);
  return { runners, ranks };
}
