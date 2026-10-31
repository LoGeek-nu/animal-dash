"use client";

import { useEffect, useRef } from "react";

// startAt skips the short silence at the head of each file so the sound lands with the moment.
const SOUNDS = {
  jump: { src: "/audio/jump.mp3", startAt: 0.08 },
  boost: { src: "/audio/boost.mp3", startAt: 0.15 },
  goal: { src: "/audio/goal-yay.mp3", startAt: 0.1 },
};

function play(audio, startAt) {
  // A copy per event lets several runners' sounds overlap.
  const sound = audio.cloneNode();
  sound.currentTime = startAt;
  sound.play().catch(() => {});
}

// Sounds follow the runners' state, so they work the same for the screen that runs
// the race and for spectators replaying it. Only a jump lifts a runner off the ground.
export function useRaceSounds(runners, muted = false) {
  const audioRef = useRef(null);
  const previousRef = useRef([]);

  useEffect(() => {
    const audio = Object.fromEntries(Object.entries(SOUNDS).map(([name, { src }]) => {
      const element = new Audio(src);
      element.preload = "auto";
      return [name, element];
    }));
    audioRef.current = audio;
    return () => { audioRef.current = null; };
  }, []);

  useEffect(() => {
    runners.forEach((runner, index) => {
      const previous = previousRef.current[index];
      const current = { grounded: runner.y === 0, boosting: runner.boosting, finished: runner.finishedAt != null };
      previousRef.current[index] = current;
      // No sound for the first state seen, e.g. when joining mid-race.
      if (!previous || muted || !audioRef.current) return;
      if (previous.grounded && !current.grounded) play(audioRef.current.jump, SOUNDS.jump.startAt);
      if (!previous.boosting && current.boosting) play(audioRef.current.boost, SOUNDS.boost.startAt);
      if (!previous.finished && current.finished) play(audioRef.current.goal, SOUNDS.goal.startAt);
    });
  }, [runners, muted]);
}
