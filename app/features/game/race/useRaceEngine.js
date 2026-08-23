"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCharacter } from "../../../domain/characters.js";
import { courseObstacles } from "../../../domain/course.js";
import { getBotInput } from "./bot-controller.js";
import { MAX_FRAME_DELTA, PAINT_INTERVAL, RACE_TIMEOUT } from "./constants.js";
import { createRuntimeRunner, stepRaceRunner, toRenderableRunner } from "./race-engine.js";
import { buildFinalResults, calculateLiveRanks } from "./race-ranking.js";
import { useRaceControls } from "./useRaceControls.js";

export function useRaceEngine({ lanes, raceStartedAt, onFinished }) {
  const initialRunners = useMemo(() => lanes.map(() => createRuntimeRunner()), [lanes]);
  const [runners, setRunners] = useState(() => initialRunners.map((runner) => toRenderableRunner(runner, 0)));
  const runtimeRef = useRef(initialRunners);
  const sentRef = useRef(false);
  const { readInput, consumeJump } = useRaceControls(lanes.length);

  useEffect(() => {
    runtimeRef.current = lanes.map(() => createRuntimeRunner());
    sentRef.current = false;
  }, [lanes]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastPaint = 0;
    const started = raceStartedAt ?? Date.now();

    const tick = (now) => {
      const dt = Math.min(MAX_FRAME_DELTA, (now - last) / 1000);
      last = now;
      const elapsed = Date.now() - started;
      const gamepads = navigator.getGamepads?.() ?? [];

      runtimeRef.current = runtimeRef.current.map((runner, laneIndex) => {
        const lane = lanes[laneIndex];
        if (!lane || runner.finishedAt !== null) return runner;

        const manualInput = readInput(laneIndex, gamepads[laneIndex]);
        const botInput = lane.isBot ? getBotInput({ laneIndex, runner, now, obstacles: courseObstacles }) : { jump: false, boost: false };
        const input = { jump: manualInput.jump || botInput.jump, boost: manualInput.boost || botInput.boost };
        const stepped = stepRaceRunner({
          runner,
          character: getCharacter(lane.characterId),
          input,
          obstacles: courseObstacles,
          now,
          dt,
          elapsed,
        });
        if (stepped.jumped) consumeJump(laneIndex);
        return stepped.runner;
      });

      if (now - lastPaint > PAINT_INTERVAL) {
        setRunners(runtimeRef.current.map((runner) => toRenderableRunner(runner, now)));
        lastPaint = now;
      }

      const active = runtimeRef.current.filter((_, laneIndex) => lanes[laneIndex]);
      if (!sentRef.current && (active.every((runner) => runner.finishedAt !== null) || elapsed >= RACE_TIMEOUT)) {
        sentRef.current = true;
        onFinished(buildFinalResults(runtimeRef.current, lanes));
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [consumeJump, lanes, onFinished, raceStartedAt, readInput]);

  const ranks = useMemo(() => calculateLiveRanks(runners, lanes), [lanes, runners]);
  return { runners, ranks };
}
