"use client";

import { useEffect } from "react";
import { getRaceId } from "../../domain/race-session.js";
import { raceSessionActions } from "./race-session-actions.js";

export function usePhaseTimers(session, dispatch) {
  const raceId = getRaceId(session);
  useEffect(() => {
    if (session.phase !== "COUNTDOWN" || !session.countdownEndsAt) return undefined;
    const wait = Math.max(0, session.countdownEndsAt - Date.now());
    const timer = window.setTimeout(() => dispatch(raceSessionActions.startRace(session.raceId)), wait);
    return () => window.clearTimeout(timer);
  }, [dispatch, session.countdownEndsAt, session.phase, session.raceId]);

  useEffect(() => {
    if (session.phase !== "RESULTS" || !session.resultsEndsAt) return undefined;
    const wait = Math.max(0, session.resultsEndsAt - Date.now());
    const timer = window.setTimeout(() => dispatch(raceSessionActions.resetSession(raceId)), wait);
    return () => window.clearTimeout(timer);
  }, [dispatch, session.phase, session.resultsEndsAt, raceId]);
}
