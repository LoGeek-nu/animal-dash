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
  RESET_SESSION: "RESET_SESSION",
};

export const raceSessionActions = {
  assignCharacter: (laneIndex, characterId, isBot = false) => ({ type: RaceSessionAction.ASSIGN_CHARACTER, laneIndex, characterId, isBot }),
  removeCharacter: (laneIndex) => ({ type: RaceSessionAction.REMOVE_CHARACTER, laneIndex }),
  fillBots: (startAfterFill = false) => ({ type: RaceSessionAction.FILL_BOTS, startAfterFill }),
  startCountdown: () => ({ type: RaceSessionAction.START_COUNTDOWN }),
  startRace: () => ({ type: RaceSessionAction.START_RACE }),
  finishRace: (results) => ({ type: RaceSessionAction.FINISH_RACE, results }),
  forceFinish: () => ({ type: RaceSessionAction.FORCE_FINISH }),
  showAttract: () => ({ type: RaceSessionAction.SHOW_ATTRACT }),
  showWaiting: () => ({ type: RaceSessionAction.SHOW_WAITING }),
  restartAttract: () => ({ type: RaceSessionAction.RESTART_ATTRACT }),
  resetSession: () => ({ type: RaceSessionAction.RESET_SESSION }),
};
