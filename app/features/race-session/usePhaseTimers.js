"use client";

import { useEffect } from "react";
import { getRaceId } from "../../domain/race-session.js";
import { raceSessionActions } from "./race-session-actions.js";

export function usePhaseTimers(session, dispatch, enabled = true) {
  const raceId = getRaceId(session);
  useEffect(() => {
    if (!enabled || session.phase !== "COUNTDOWN" || !session.countdownEndsAt) return undefined;
    const wait = Math.max(0, session.countdownEndsAt - Date.now());
    let retry;
    const timer = window.setTimeout(() => {
      const start = () => dispatch(raceSessionActions.startRace(session.raceId));
      start();
      // The room uses its own clock. An early request from a fast device is
      // rejected; keep checking until the room acknowledges RACING.
      retry = window.setInterval(start, 250);
    }, wait);
    return () => { window.clearTimeout(timer); window.clearInterval(retry); };
  }, [enabled, dispatch, session.countdownEndsAt, session.phase, session.raceId]);

  useEffect(() => {
    if (!enabled || session.phase !== "RESULTS" || !session.resultsEndsAt) return undefined;
    const wait = Math.max(0, session.resultsEndsAt - Date.now());
    const timer = window.setTimeout(() => dispatch(raceSessionActions.resetSession(raceId)), wait);
    return () => window.clearTimeout(timer);
  }, [enabled, dispatch, session.phase, session.resultsEndsAt, raceId]);
}
