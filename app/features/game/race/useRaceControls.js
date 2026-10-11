"use client";

import { useCallback, useEffect, useRef } from "react";
import { BOOST_KEY_MAP, JUMP_KEY_MAP } from "./constants.js";

export function useRaceControls(laneCount) {
  const controlsRef = useRef(Array.from({ length: laneCount }, () => ({ boost: false, jump: false })));

  useEffect(() => {
    const onKeyDown = (event) => {
      const jumpLane = JUMP_KEY_MAP[event.key];
      const boostLane = BOOST_KEY_MAP[event.key];
      if (jumpLane !== undefined) {
        controlsRef.current[jumpLane].jump = true;
        event.preventDefault();
      }
      if (boostLane !== undefined) {
        controlsRef.current[boostLane].boost = true;
        event.preventDefault();
      }
    };

    const onKeyUp = (event) => {
      const boostLane = BOOST_KEY_MAP[event.key];
      if (boostLane !== undefined) controlsRef.current[boostLane].boost = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const readInput = useCallback((laneIndex, gamepad) => ({
    jump: controlsRef.current[laneIndex]?.jump || Boolean(gamepad?.buttons[0]?.pressed),
    boost: controlsRef.current[laneIndex]?.boost || Boolean(gamepad?.buttons[1]?.pressed),
  }), []);

  const consumeJump = useCallback((laneIndex) => {
    if (controlsRef.current[laneIndex]) controlsRef.current[laneIndex].jump = false;
  }, []);

  return { readInput, consumeJump };
}
