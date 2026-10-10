"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { refreshGeneratedCharacters } from "../../domain/generated-characters.js";
import { createInitialSession } from "../../domain/race-session.js";
import { raceSessionActions } from "./race-session-actions.js";
import { createRaceSessionChannel } from "./race-session-channel.js";
import { raceSessionReducer } from "./race-session-reducer.js";
import { saveRaceSession } from "./race-session-storage.js";
import { usePhaseTimers } from "./usePhaseTimers.js";

export function useRaceSession(role = "viewer") {
  const [session, setSession] = useState(() => createInitialSession());
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("connecting");
  const channelRef = useRef(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    let cancelled = false;
    const adoptNewer = (incoming) => {
      if (incoming.sequence < sessionRef.current.sequence) return;
      sessionRef.current = incoming;
      saveRaceSession(incoming);
      setSession(incoming);
    };
    const channel = createRaceSessionChannel(adoptNewer, { role, onSyncStatus: setSyncStatus });
    channelRef.current = channel;

    // Load generated characters first so a saved session that references them still validates.
    refreshGeneratedCharacters().then(() => {
      if (cancelled) return;
      setReady(true);
    });

    return () => {
      cancelled = true;
      channel.close();
    };
  }, [role]);

  const dispatch = useCallback((action) => {
    const current = sessionRef.current;
    const proposed = raceSessionReducer(current, action);
    if (proposed === current) return;
    channelRef.current?.publish({ ...proposed, sequence: current.sequence + 1, lastSync: Date.now() });
  }, []);

  usePhaseTimers(session, dispatch);

  const actions = useMemo(() => ({
    assignCharacter: (laneIndex, characterId, isBot = false) => dispatch(raceSessionActions.assignCharacter(laneIndex, characterId, isBot)),
    removeCharacter: (laneIndex) => dispatch(raceSessionActions.removeCharacter(laneIndex)),
    fillBots: (startAfterFill = false) => dispatch(raceSessionActions.fillBots(startAfterFill)),
    startRace: () => dispatch(raceSessionActions.startCountdown()),
    finishRace: (result) => dispatch(raceSessionActions.finishRace(result)),
    reportInput: (input) => channelRef.current?.sendInput(input),
    forceFinish: () => dispatch(raceSessionActions.forceFinish()),
    resetSession: () => dispatch(raceSessionActions.resetSession()),
    showAttract: () => dispatch(raceSessionActions.showAttract()),
    showWaiting: () => dispatch(raceSessionActions.showWaiting()),
    restartAttract: () => dispatch(raceSessionActions.restartAttract()),
    nextAttract: () => dispatch(raceSessionActions.nextAttract()),
  }), [dispatch]);

  return { session, ready, syncStatus, actions };
}
