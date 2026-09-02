"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInitialSession } from "../../domain/race-session.js";
import { raceSessionActions } from "./race-session-actions.js";
import { createRaceSessionChannel } from "./race-session-channel.js";
import { raceSessionReducer } from "./race-session-reducer.js";
import { loadRaceSession, saveRaceSession } from "./race-session-storage.js";
import { usePhaseTimers } from "./usePhaseTimers.js";

export function useRaceSession() {
  const [session, setSession] = useState(() => createInitialSession());
  const [ready, setReady] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    const restored = loadRaceSession();
    const channel = createRaceSessionChannel((incoming) => {
      setSession((current) => incoming.sequence >= current.sequence ? incoming : current);
    });
    channelRef.current = channel;

    const hydrationTimer = window.setTimeout(() => {
      if (restored) setSession(restored);
      setReady(true);
    }, 0);

    return () => {
      window.clearTimeout(hydrationTimer);
      channel.close();
    };
  }, []);

  const dispatch = useCallback((action) => {
    setSession((current) => {
      const proposed = raceSessionReducer(current, action);
      if (proposed === current) return current;
      const next = { ...proposed, sequence: current.sequence + 1, lastSync: Date.now() };
      saveRaceSession(next);
      channelRef.current?.publish(next);
      return next;
    });
  }, []);

  usePhaseTimers(session, dispatch);

  const actions = useMemo(() => ({
    assignCharacter: (laneIndex, characterId, isBot = false) => dispatch(raceSessionActions.assignCharacter(laneIndex, characterId, isBot)),
    removeCharacter: (laneIndex) => dispatch(raceSessionActions.removeCharacter(laneIndex)),
    fillBots: (startAfterFill = false) => dispatch(raceSessionActions.fillBots(startAfterFill)),
    startRace: () => dispatch(raceSessionActions.startCountdown()),
    finishRace: (results) => dispatch(raceSessionActions.finishRace(results)),
    forceFinish: () => dispatch(raceSessionActions.forceFinish()),
    resetSession: () => dispatch(raceSessionActions.resetSession()),
    showAttract: () => dispatch(raceSessionActions.showAttract()),
    showWaiting: () => dispatch(raceSessionActions.showWaiting()),
    restartAttract: () => dispatch(raceSessionActions.restartAttract()),
    nextAttract: () => dispatch(raceSessionActions.nextAttract()),
  }), [dispatch]);

  return { session, ready, actions };
}
