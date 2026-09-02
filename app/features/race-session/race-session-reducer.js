import { ATTRACT_SCENES } from "../../domain/attract.js";
import { characters, getCharacter } from "../../domain/characters.js";
import { createEmptySession } from "../../domain/race-session.js";
import { COUNTDOWN_DURATION, RESULTS_DURATION } from "./constants.js";
import { RaceSessionAction } from "./race-session-actions.js";

function canEditLanes(phase) {
  return phase === "WAITING" || phase === "ATTRACT";
}

export function raceSessionReducer(session, action, now = Date.now()) {
  switch (action.type) {
    case RaceSessionAction.ASSIGN_CHARACTER: {
      if (!canEditLanes(session.phase) || !Number.isInteger(action.laneIndex) || action.laneIndex < 0 || action.laneIndex >= session.lanes.length) return session;
      if (!characters.some(({ id }) => id === action.characterId)) return session;
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
        countdownEndsAt: action.startAfterFill ? now + COUNTDOWN_DURATION : null,
        results: [],
      };
    }
    case RaceSessionAction.START_COUNTDOWN:
      if (session.phase !== "WAITING" || !session.lanes.some(Boolean)) return session;
      return { ...session, phase: "COUNTDOWN", countdownEndsAt: now + COUNTDOWN_DURATION, results: [] };
    case RaceSessionAction.START_RACE:
      if (session.phase !== "COUNTDOWN") return session;
      return { ...session, phase: "RACING", raceStartedAt: now, countdownEndsAt: null };
    case RaceSessionAction.FINISH_RACE:
      if (session.phase !== "RACING") return session;
      return { ...session, phase: "RESULTS", results: action.results, resultsEndsAt: now + RESULTS_DURATION };
    case RaceSessionAction.FORCE_FINISH: {
      if (session.phase !== "RACING" && session.phase !== "COUNTDOWN") return session;
      const finishers = session.lanes.flatMap((lane, index) => lane ? [{
        characterId: lane.characterId,
        lane: index + 1,
        finishMs: 28_000 + (10 - getCharacter(lane.characterId).stats.speed) * 760 + index * 530,
        isBot: lane.isBot,
      }] : []).sort((a, b) => a.finishMs - b.finishMs);
      const results = finishers.map((result, index) => ({ ...result, rank: index + 1 }));
      return { ...session, phase: "RESULTS", results, resultsEndsAt: now + RESULTS_DURATION, countdownEndsAt: null };
    }
    case RaceSessionAction.SHOW_ATTRACT:
      return { ...session, phase: "ATTRACT", attractIndex: 0, countdownEndsAt: null, raceStartedAt: null, resultsEndsAt: null, results: [] };
    case RaceSessionAction.SHOW_WAITING:
      return { ...session, phase: "WAITING", countdownEndsAt: null, raceStartedAt: null, resultsEndsAt: null, results: [] };
    case RaceSessionAction.RESTART_ATTRACT:
      return session.phase === "ATTRACT" ? { ...session, attractIndex: 0 } : session;
    case RaceSessionAction.NEXT_ATTRACT: {
      if (session.phase !== "ATTRACT") {
        return { ...session, phase: "ATTRACT", attractIndex: 0, countdownEndsAt: null, raceStartedAt: null, resultsEndsAt: null, results: [] };
      }
      const currentScene = typeof session.attractIndex === "number" ? session.attractIndex : 0;
      return {
        ...session,
        attractIndex: (currentScene + 1) % ATTRACT_SCENES.length,
      };
    }
    case RaceSessionAction.RESET_SESSION:
      return createEmptySession(session.sequence);
    default:
      return session;
  }
}
