"use client";

import { useCallback, useEffect, useRef } from "react";
import { BOOST_KEY_MAP, JUMP_KEY_MAP } from "./constants.js";

export function useRaceControls(laneCount, enabled = true) {
  const controlsRef = useRef(Array.from({ length: laneCount }, () => ({ boost: false, jump: false, padJumpHeld: false })));

  useEffect(() => {
    if (!enabled) {
      controlsRef.current.forEach((control) => { control.jump = false; control.boost = false; control.padJumpHeld = false; });
      return undefined;
    }
    const onKeyDown = (event) => {
      const jumpLane = JUMP_KEY_MAP[event.key];
      const boostLane = BOOST_KEY_MAP[event.key];
      if (jumpLane !== undefined) {
        // Holding a key auto-repeats keydown; only the first press is a jump.
        if (!event.repeat) controlsRef.current[jumpLane].jump = true;
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
  }, [enabled]);

  // Call once per frame: a gamepad jump counts on the press, like a keydown, not while held.
  const pollGamepads = useCallback((gamepads) => {
    if (!enabled) return;
    controlsRef.current.forEach((control, laneIndex) => {
      const held = Boolean(gamepads[laneIndex]?.buttons[0]?.pressed);
      if (held && !control.padJumpHeld) control.jump = true;
      control.padJumpHeld = held;
    });
  }, [enabled]);

  const readInput = useCallback((laneIndex, gamepad) => ({
    jump: enabled && Boolean(controlsRef.current[laneIndex]?.jump),
    boost: enabled && (controlsRef.current[laneIndex]?.boost || Boolean(gamepad?.buttons[1]?.pressed)),
  }), [enabled]);

  const consumeJump = useCallback((laneIndex) => {
    if (controlsRef.current[laneIndex]) controlsRef.current[laneIndex].jump = false;
  }, []);

  return { readInput, consumeJump, pollGamepads };
}
