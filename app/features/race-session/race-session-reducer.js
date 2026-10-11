import { ATTRACT_SCENES } from "../../domain/attract.js";
import { characters, isKnownCharacterId } from "../../domain/characters.js";
import { createEmptySession, getRaceId } from "../../domain/race-session.js";
import { validRaceResults } from "../../domain/race-results.js";
import { COUNTDOWN_DURATION, RESULTS_DURATION } from "./constants.js";
import { RaceSessionAction } from "./race-session-actions.js";

function canEditLanes(phase) {
  return phase === "WAITING" || phase === "ATTRACT";
}

export function raceSessionReducer(session, action, now = Date.now()) {
  switch (action.type) {
    case RaceSessionAction.ASSIGN_CHARACTER: {
      if (!canEditLanes(session.phase) || !Number.isInteger(action.laneIndex) || action.laneIndex < 0 || action.laneIndex >= session.lanes.length) return session;
      if (!isKnownCharacterId(action.characterId)) return session;
      const lanes = session.lanes.map((lane) => lane?.characterId === action.characterId ? null : lane);
      lanes[action.laneIndex] = { characterId: action.characterId, isBot: Boolean(action.isBot) };
      return { ...session, lanes };
    }
    case RaceSessionAction.REMOVE_CHARACTER: {
      if (!canEditLanes(session.phase) || !Number.isInteger(action.laneIndex) || !session.lanes[action.laneIndex]) return session;
      const lanes = [...session.lanes];
      lanes[action.laneIndex] = null;
      return { ...session, lanes };
    }
    case RaceSessionAction.FILL_BOTS: {
      if (!canEditLanes(session.phase)) return session;
      const used = new Set(session.lanes.flatMap((lane) => lane ? [lane.characterId] : []));
      const available = characters.filter(({ id }) => !used.has(id));
      let cursor = 0;
      const lanes = session.lanes.map((lane) => lane ?? { characterId: available[cursor++].id, isBot: true });
      return {
        ...session,
        lanes,
        phase: action.startAfterFill ? "COUNTDOWN" : session.phase,
        raceId: action.startAfterFill ? action.raceId : session.raceId,
        countdownEndsAt: action.startAfterFill ? now + COUNTDOWN_DURATION : null,
        raceStartedAt: null,
        raceCompletedAt: null,
        results: [],
        resultsForced: false,
      };
    }
    case RaceSessionAction.START_COUNTDOWN:
      if (session.phase !== "WAITING" || !session.lanes.some(Boolean)) return session;
      return { ...session, phase: "COUNTDOWN", raceId: action.raceId, countdownEndsAt: now + COUNTDOWN_DURATION,
        raceStartedAt: null, raceCompletedAt: null, resultsEndsAt: null, results: [], resultsForced: false };
    case RaceSessionAction.START_RACE:
      if (session.phase !== "COUNTDOWN") return session;
      if (action.raceId !== undefined && action.raceId !== session.raceId) return session;
      if (!Number.isSafeInteger(session.countdownEndsAt) || session.countdownEndsAt <= 0) return session;
      return { ...session, phase: "RACING", raceId: session.raceId ?? `${session.sessionId}:${session.countdownEndsAt}`,
        raceStartedAt: session.countdownEndsAt, countdownEndsAt: null };
    case RaceSessionAction.FINISH_RACE:
      if (session.phase !== "RACING") return session;
      if (action.raceId !== getRaceId(session) || !validRaceResults(action.results, session.lanes)) return session;
      if (!Number.isSafeInteger(action.completedAt) || action.completedAt < session.raceStartedAt) return session;
      if (action.results.some((result) => result.finishMs !== null && result.finishMs > action.completedAt - session.raceStartedAt)) return session;
      return { ...session, phase: "RESULTS", raceCompletedAt: action.completedAt,
        results: action.results.map((result) => ({ ...result })), resultsForced: false, resultsEndsAt: now + RESULTS_DURATION };
    case RaceSessionAction.FORCE_FINISH: {
      if (session.phase !== "RACING" && session.phase !== "COUNTDOWN") return session;
      const finishers = session.lanes.flatMap((lane, index) => lane ? [{
        characterId: lane.characterId,
        lane: index + 1,
        finishMs: null,
        isBot: lane.isBot,
      }] : []);
      const results = finishers.map((result, index) => ({ ...result, rank: index + 1 }));
      return { ...session, phase: "RESULTS", results, resultsForced: true,
        raceStartedAt: session.phase === "COUNTDOWN" ? null : session.raceStartedAt,
        raceCompletedAt: session.phase === "COUNTDOWN" ? null : Math.max(now, session.raceStartedAt),
        resultsEndsAt: now + RESULTS_DURATION, countdownEndsAt: null };
    }
    case RaceSessionAction.SHOW_ATTRACT:
      return { ...session, phase: "ATTRACT", attractIndex: 0, raceId: null, countdownEndsAt: null,
        raceStartedAt: null, raceCompletedAt: null, resultsEndsAt: null, results: [], resultsForced: false };
    case RaceSessionAction.SHOW_WAITING:
      return { ...session, phase: "WAITING", raceId: null, countdownEndsAt: null,
        raceStartedAt: null, raceCompletedAt: null, resultsEndsAt: null, results: [], resultsForced: false };
    case RaceSessionAction.RESTART_ATTRACT:
      return session.phase === "ATTRACT" ? { ...session, attractIndex: 0 } : session;
    case RaceSessionAction.NEXT_ATTRACT: {
      if (session.phase !== "ATTRACT") {
        return { ...session, phase: "ATTRACT", attractIndex: 0, raceId: null, countdownEndsAt: null,
          raceStartedAt: null, raceCompletedAt: null, resultsEndsAt: null, results: [], resultsForced: false };
      }
      const currentScene = typeof session.attractIndex === "number" ? session.attractIndex : 0;
      return {
        ...session,
        attractIndex: (currentScene + 1) % ATTRACT_SCENES.length,
      };
    }
    case RaceSessionAction.RESET_SESSION:
      if (action.raceId !== undefined && (session.phase !== "RESULTS" || action.raceId !== getRaceId(session))) return session;
      return createEmptySession(session.sequence);
    default:
      return session;
  }
}
