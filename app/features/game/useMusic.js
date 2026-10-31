"use client";

import { useEffect, useRef } from "react";

const MUSIC_VOLUME = 0.6;
// Finishes inside COUNTDOWN_LEAD_IN, before the countdown beeps start.
const FADE_OUT_MS = 2_000;

export const MUSIC = {
  lobby: "/audio/mitsubachi-derby.mp3",
  race: "/audio/critter-dash.mp3",
  results: "/audio/victory-paws.mp3",
};

function fadeOut(audio) {
  const from = audio.volume;
  const startedAt = performance.now();
  let frame;
  const step = (now) => {
    const progress = Math.min(1, (now - startedAt) / FADE_OUT_MS);
    // A squared curve sounds smoother to the ear than a straight line.
    audio.volume = from * (1 - progress) ** 2;
    if (progress < 1) frame = window.requestAnimationFrame(step);
    else { audio.pause(); audio.currentTime = 0; }
  };
  frame = window.requestAnimationFrame(step);
  return () => window.cancelAnimationFrame(frame);
}

// Loops while playing is true and fades out when it turns false.
export function useMusic(src, playing, muted = false) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => { audio.pause(); audioRef.current = null; };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    if (!playing) return audio.paused ? undefined : fadeOut(audio);

    // Staying on the same song (e.g. ATTRACT to WAITING) keeps it going.
    audio.volume = MUSIC_VOLUME;
    if (!audio.paused) return undefined;
    let cancelled = false;
    const resume = () => { if (!cancelled) audio.play().catch(() => {}); };
    // Autoplay is blocked until the page has had a click or key press; start on the first one.
    audio.play().catch(() => {
      if (cancelled) return;
      window.addEventListener("pointerdown", resume, { once: true });
      window.addEventListener("keydown", resume, { once: true });
    });
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, [playing]);

  // Muting keeps the song running, so it comes back in time when unmuted.
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);
}
