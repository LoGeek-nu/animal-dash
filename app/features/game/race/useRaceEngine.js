"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { courseObstacles } from "../../../domain/course.js";
import { getBotInput } from "./bot-controller.js";
import { PAINT_INTERVAL } from "./constants.js";
import { createRuntimeRunner, toRenderableRunner } from "./race-engine.js";
import { calculateLiveRanks } from "./race-ranking.js";
import { advanceRaceRuntime, createRaceRuntime } from "./race-runtime.js";
import { useRaceControls } from "./useRaceControls.js";

export function useRaceEngine({ raceId, lanes, raceStartedAt, onFinished, onInput }) {
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
    let lastReport = -Infinity;
    let lastButtons = null;
    let lastInputAt = -Infinity;

    const tick = (now) => {
      const gamepads = navigator.getGamepads?.() ?? [];
      const buttons = runtime.lanes.reduce((mask, lane, index) => {
        if (!lane || lane.isBot) return mask;
        const input = readInput(index, gamepads[index]);
        return mask | (input.jump ? 1 << index : 0) | (input.boost ? 1 << (index + 4) : 0);
      }, 0);
      if (!runtime.completed && (buttons !== lastButtons || now - lastInputAt >= 250)) { onInput?.({ raceId, buttons }); lastButtons = buttons; lastInputAt = now; }
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

      // Keep reporting until the room replies with its canonical RESULTS. A
      // slightly earlier local goal must not strand a race waiting for its owner.
      if (runtime.completed && now - lastReport >= 250) { onFinished(runtime.completed); lastReport = now; }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [raceId, raceStartedAt, lanes, onFinished, onInput, consumeJump, readInput]);

  const ranks = useMemo(() => calculateLiveRanks(runners, lanes), [lanes, runners]);
  return { runners, ranks };
}
