"use client";

import { useEffect, useRef } from "react";
import { COUNTDOWN_DURATION, COUNTDOWN_LEAD_IN } from "../race-session/constants.js";

const COUNTDOWN_SOUND_SRC = "/audio/countdown.mp3";
// The first beep starts 0.1s into the file; it lines up with "3" on screen.
const FIRST_BEEP_AT = 0.1;

export function useCountdownSound(phase, countdownEndsAt, muted = false) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(COUNTDOWN_SOUND_SRC);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => { audio.pause(); audioRef.current = null; };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || phase !== "COUNTDOWN" || !countdownEndsAt) return undefined;
    // "3" appears once the lead-in (lobby music fade-out) is over.
    const numbersStartAt = countdownEndsAt - (COUNTDOWN_DURATION - COUNTDOWN_LEAD_IN);
    // Seek by elapsed time so late joiners and slow loads stay in sync with the screen.
    const sync = () => {
      audio.currentTime = Math.max(0, FIRST_BEEP_AT + (Date.now() - numbersStartAt) / 1000);
    };
    const start = () => {
      sync();
      // Autoplay is blocked until the page has had a click or key press.
      audio.play().then(sync).catch(() => {});
    };
    const timer = window.setTimeout(start, Math.max(0, numbersStartAt - FIRST_BEEP_AT * 1000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [phase, countdownEndsAt]);

  useEffect(() => {
    // The GO tone runs into the race; stop only when the countdown is cancelled.
    if (phase !== "COUNTDOWN" && phase !== "RACING") audioRef.current?.pause();
  }, [phase]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);
}
