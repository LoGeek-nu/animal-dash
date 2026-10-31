"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { refreshGeneratedCharacters } from "../../domain/generated-characters.js";
import { createInitialSession } from "../../domain/race-session.js";
import { raceSessionActions } from "./race-session-actions.js";
import { createRaceSessionChannel } from "./race-session-channel.js";
import { raceSessionReducer } from "./race-session-reducer.js";
import { saveRaceSession } from "./race-session-storage.js";
import { receiveRaceUpdate } from "../game/race/spectator-race.js";
import { usePhaseTimers } from "./usePhaseTimers.js";
import { dailyRankings } from "../rankings/ranking-client.js";

export function useRaceSession(role = "viewer") {
  const [session, setSession] = useState(() => createInitialSession());
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [raceFeed, setRaceFeed] = useState(null);
  const [ownsControls, setOwnsControls] = useState(false);
  const [muted, setMuted] = useState(false);
  const canControl = role === "game" && ownsControls && syncStatus === "open";
  const channelRef = useRef(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    if (!role) return undefined;
    const adoptNewer = (incoming) => {
      if (incoming.sequence < sessionRef.current.sequence) return;
      sessionRef.current = incoming;
      saveRaceSession(incoming);
      setSession(incoming);
      setReady(true);
    };
    const channel = createRaceSessionChannel(adoptNewer, { role,
      onSyncStatus: (status) => {
        setSyncStatus(status);
        if (status !== "open") setOwnsControls(false);
        if (status === "connecting") { setReady(false); setRaceFeed(null); }
        if (status === "open") void dailyRankings.refresh();
      },
      onControl: setOwnsControls,
      onSound: setMuted,
      onRace: (message) => setRaceFeed((current) => receiveRaceUpdate(current, message, performance.now())),
      onResultsSaved: () => { void dailyRankings.refresh(); }, onResultsFailed: () => { void dailyRankings.refresh(); },
    });
    channelRef.current = channel;

    // Load generated characters first so a saved session that references them still validates.
    void refreshGeneratedCharacters();

    return () => {
      channel.close();
    };
  }, [role]);

  const dispatch = useCallback((action) => {
    if (role !== "admin" && !canControl) return;
    const current = sessionRef.current;
    const proposed = raceSessionReducer(current, action);
    if (proposed === current) return;
    channelRef.current?.publish({ ...proposed, sequence: current.sequence + 1, lastSync: Date.now() });
  }, [role, canControl]);

  usePhaseTimers(session, dispatch, role === "admin" || canControl);

  const actions = useMemo(() => ({
    assignCharacter: (laneIndex, characterId, isBot = false) => dispatch(raceSessionActions.assignCharacter(laneIndex, characterId, isBot)),
    removeCharacter: (laneIndex) => dispatch(raceSessionActions.removeCharacter(laneIndex)),
    fillBots: (startAfterFill = false) => dispatch(raceSessionActions.fillBots(startAfterFill)),
    startRace: () => dispatch(raceSessionActions.startCountdown()),
    finishRace: (result) => dispatch(raceSessionActions.finishRace(result)),
    reportInput: (input) => { if (canControl) channelRef.current?.sendInput(input); },
    forceFinish: () => dispatch(raceSessionActions.forceFinish()),
    resetSession: () => dispatch(raceSessionActions.resetSession()),
    showAttract: () => dispatch(raceSessionActions.showAttract()),
    showWaiting: () => dispatch(raceSessionActions.showWaiting()),
    restartAttract: () => dispatch(raceSessionActions.restartAttract()),
    nextAttract: () => dispatch(raceSessionActions.nextAttract()),
    setMuted: (value) => { if (role === "admin") channelRef.current?.sendSound(value); },
  }), [dispatch, canControl, role]);

  return { session, ready, syncStatus, actions, canControl, raceFeed, muted };
}
