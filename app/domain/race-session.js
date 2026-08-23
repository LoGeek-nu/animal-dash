/** @typedef {"ATTRACT"|"WAITING"|"COUNTDOWN"|"RACING"|"RESULTS"|"RECOVERY"} RacePhase */
/** @typedef {{characterId:string, isBot:boolean}} LaneAssignment */
/** @typedef {{characterId:string, lane:number, rank:number, finishMs:number|null, isBot:boolean}} RaceResult */
/** @typedef {{version:3, sequence:number, sessionId:string, phase:RacePhase, lanes:Array<LaneAssignment|null>, lastSync:number, courseSeed:string, countdownEndsAt:number|null, raceStartedAt:number|null, resultsEndsAt:number|null, results:RaceResult[]}} RaceSession */

export const RACE_PHASES = ["ATTRACT", "WAITING", "COUNTDOWN", "RACING", "RESULTS", "RECOVERY"];

export const PHASE_LABELS = {
  ATTRACT: "アトラクト",
  WAITING: "参加受付中",
  COUNTDOWN: "カウントダウン",
  RACING: "レース中",
  RESULTS: "リザルト",
  RECOVERY: "復旧待ち",
};

/** @returns {RaceSession} */
export function createInitialSession() {
  return {
    version: 3,
    sequence: 1,
    sessionId: "session_demo01",
    phase: "ATTRACT",
    lanes: [
      { characterId: "momo", isBot: false },
      { characterId: "toramaru", isBot: false },
      null,
      null,
    ],
    lastSync: Date.UTC(2026, 7, 19, 10, 0, 0),
    courseSeed: "oureisai-2026-demo",
    countdownEndsAt: null,
    raceStartedAt: null,
    resultsEndsAt: null,
    results: [],
  };
}

export function createEmptySession(sequence = 1) {
  return {
    ...createInitialSession(),
    sequence,
    sessionId: `session_${Math.random().toString(36).slice(2, 8)}`,
    lanes: [null, null, null, null],
  };
}
