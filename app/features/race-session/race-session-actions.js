import { createRaceId } from "../../domain/race-session.js";

export const RaceSessionAction = {
  ASSIGN_CHARACTER: "ASSIGN_CHARACTER",
  REMOVE_CHARACTER: "REMOVE_CHARACTER",
  FILL_BOTS: "FILL_BOTS",
  START_COUNTDOWN: "START_COUNTDOWN",
  START_RACE: "START_RACE",
  FINISH_RACE: "FINISH_RACE",
  FORCE_FINISH: "FORCE_FINISH",
  SHOW_ATTRACT: "SHOW_ATTRACT",
  SHOW_WAITING: "SHOW_WAITING",
  RESTART_ATTRACT: "RESTART_ATTRACT",
  NEXT_ATTRACT: "NEXT_ATTRACT",
  RESET_SESSION: "RESET_SESSION",
};

export const raceSessionActions = {
  assignCharacter: (laneIndex, characterId, isBot = false) => ({ type: RaceSessionAction.ASSIGN_CHARACTER, laneIndex, characterId, isBot }),
  removeCharacter: (laneIndex) => ({ type: RaceSessionAction.REMOVE_CHARACTER, laneIndex }),
  fillBots: (startAfterFill = false) => ({ type: RaceSessionAction.FILL_BOTS, startAfterFill, raceId: startAfterFill ? createRaceId() : undefined }),
  startCountdown: () => ({ type: RaceSessionAction.START_COUNTDOWN, raceId: createRaceId() }),
  startRace: (raceId) => ({ type: RaceSessionAction.START_RACE, raceId }),
  finishRace: ({ results, raceId, completedAt }) => ({ type: RaceSessionAction.FINISH_RACE, results, raceId, completedAt }),
  forceFinish: () => ({ type: RaceSessionAction.FORCE_FINISH }),
  showAttract: () => ({ type: RaceSessionAction.SHOW_ATTRACT }),
  showWaiting: () => ({ type: RaceSessionAction.SHOW_WAITING }),
  restartAttract: () => ({ type: RaceSessionAction.RESTART_ATTRACT }),
  nextAttract: () => ({ type: RaceSessionAction.NEXT_ATTRACT }),
  resetSession: (raceId) => ({ type: RaceSessionAction.RESET_SESSION, raceId }),
};
