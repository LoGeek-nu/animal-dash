"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { characters, createInitialSession, getCharacter, type RaceResult, type RaceSession } from "./race-data";

const STORAGE_KEY = "animal-dash-session-v2";
const CHANNEL_NAME = "animal-dash-live-session";

function validSession(value: unknown): value is RaceSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<RaceSession>;
  return session.version === 2 && Array.isArray(session.lanes) && session.lanes.length === 4;
}

export function useRaceSession() {
  const [session, setSession] = useState<RaceSession>(() => createInitialSession());
  const [ready, setReady] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let restored: RaceSession | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validSession(parsed)) restored = parsed;
      }
    } catch {
      // Corrupt local mock state falls back to a clean demo session.
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<RaceSession>) => {
      if (validSession(event.data)) setSession((current) => event.data.sequence >= current.sequence ? event.data : current);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue);
        if (validSession(parsed)) setSession((current) => parsed.sequence >= current.sequence ? parsed : current);
      } catch {
        // Ignore incomplete writes from another tab.
      }
    };
    window.addEventListener("storage", onStorage);
    const hydrationTimer = window.setTimeout(() => {
      if (restored) setSession(restored);
      setReady(true);
    }, 0);
    return () => {
      window.clearTimeout(hydrationTimer);
      channel.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((recipe: (current: RaceSession) => RaceSession) => {
    setSession((current) => {
      const proposed = recipe(current);
      const next = { ...proposed, sequence: current.sequence + 1, lastSync: Date.now() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        channelRef.current?.postMessage(next);
      } catch {
        // The experience remains usable in-memory if storage is unavailable.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (session.phase !== "COUNTDOWN" || !session.countdownEndsAt) return;
    const wait = Math.max(0, session.countdownEndsAt - Date.now());
    const timer = window.setTimeout(() => {
      update((current) => current.phase === "COUNTDOWN" ? {
        ...current,
        phase: "RACING",
        raceStartedAt: Date.now(),
        countdownEndsAt: null,
      } : current);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [session.phase, session.countdownEndsAt, update]);

  useEffect(() => {
    if (session.phase !== "RESULTS" || !session.resultsEndsAt) return;
    const wait = Math.max(0, session.resultsEndsAt - Date.now());
    const timer = window.setTimeout(() => {
      update((current) => current.phase === "RESULTS" ? {
        ...createInitialSession(),
        sequence: current.sequence,
        sessionId: `session_${Math.random().toString(36).slice(2, 8)}`,
        lanes: [null, null, null, null],
      } : current);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [session.phase, session.resultsEndsAt, update]);

  const assignCharacter = (laneIndex: number, characterId: string, isBot = false) => update((current) => {
    if (current.phase !== "WAITING" && current.phase !== "ATTRACT") return current;
    const lanes = current.lanes.map((lane) => lane?.characterId === characterId ? null : lane);
    lanes[laneIndex] = { characterId, isBot };
    return { ...current, lanes };
  });

  const removeCharacter = (laneIndex: number) => update((current) => {
    if (current.phase !== "WAITING" && current.phase !== "ATTRACT") return current;
    const lanes = [...current.lanes];
    lanes[laneIndex] = null;
    return { ...current, lanes };
  });

  const fillBots = (startAfterFill = false) => update((current) => {
    if (current.phase !== "WAITING" && current.phase !== "ATTRACT") return current;
    const used = new Set(current.lanes.flatMap((lane) => lane ? [lane.characterId] : []));
    const available = characters.filter((character) => !used.has(character.id));
    let cursor = 0;
    const lanes = current.lanes.map((lane) => lane ?? { characterId: available[cursor++].id, isBot: true });
    return {
      ...current,
      lanes,
      phase: startAfterFill ? "COUNTDOWN" : current.phase,
      countdownEndsAt: startAfterFill ? Date.now() + 3600 : null,
      results: [],
    };
  });

  const startRace = () => update((current) => {
    if (current.phase !== "WAITING" || !current.lanes.some(Boolean)) return current;
    return { ...current, phase: "COUNTDOWN", countdownEndsAt: Date.now() + 3600, results: [] };
  });

  const finishRace = (results: RaceResult[]) => update((current) => ({
    ...current,
    phase: "RESULTS",
    results,
    resultsEndsAt: Date.now() + 90_000,
  }));

  const forceFinish = () => update((current) => {
    if (current.phase !== "RACING" && current.phase !== "COUNTDOWN") return current;
    const finishers = current.lanes.flatMap((lane, index) => lane ? [{
      characterId: lane.characterId,
      lane: index + 1,
      finishMs: 28_000 + (10 - getCharacter(lane.characterId).stats.speed) * 760 + index * 530,
      isBot: lane.isBot,
    }] : []).sort((a, b) => a.finishMs - b.finishMs);
    const results = finishers.map((result, index) => ({ ...result, rank: index + 1 }));
    return { ...current, phase: "RESULTS", results, resultsEndsAt: Date.now() + 90_000, countdownEndsAt: null };
  });

  const resetSession = () => update((current) => ({
    ...createInitialSession(),
    sequence: current.sequence,
    sessionId: `session_${Math.random().toString(36).slice(2, 8)}`,
    lanes: [null, null, null, null],
  }));

  const showAttract = () => update((current) => ({ ...current, phase: "ATTRACT", countdownEndsAt: null, raceStartedAt: null, resultsEndsAt: null, results: [] }));
  const showWaiting = () => update((current) => ({ ...current, phase: "WAITING", countdownEndsAt: null, raceStartedAt: null, resultsEndsAt: null, results: [] }));
  const restartAttract = () => update((current) => current.phase === "ATTRACT" ? { ...current } : current);

  return { session, ready, assignCharacter, removeCharacter, fillBots, startRace, finishRace, forceFinish, resetSession, showAttract, showWaiting, restartAttract };
}
