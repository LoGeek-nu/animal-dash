export function calculateLiveRanks(runners, lanes) {
  return runners
    .map((runner, index) => ({ index, progress: runner.progress }))
    .filter(({ index }) => lanes[index])
    .sort((a, b) => b.progress - a.progress || a.index - b.index)
    .reduce((rankByLane, item, index) => ({ ...rankByLane, [item.index]: index + 1 }), {});
}

export function buildFinalResults(runners, lanes) {
  return runners
    .flatMap((runner, laneIndex) => lanes[laneIndex] ? [{
      characterId: lanes[laneIndex].characterId,
      lane: laneIndex + 1,
      finishMs: runner.finishedAt,
      isBot: lanes[laneIndex].isBot,
    }] : [])
    .sort((a, b) => (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity) || a.lane - b.lane)
    .map((result, index) => ({ ...result, rank: index + 1 }));
}
