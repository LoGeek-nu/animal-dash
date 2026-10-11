export function calculateLiveRanks(runners, lanes) {
  return runners
    .map((runner, index) => ({ index, progress: runner.progress, finishMs: runner.finishedAt }))
    .filter(({ index }) => lanes[index])
    .sort((a, b) => {
      if (a.finishMs !== null && b.finishMs !== null) {
        return a.finishMs - b.finishMs || a.index - b.index;
      }
      if (a.finishMs !== null) return -1;
      if (b.finishMs !== null) return 1;
      return b.progress - a.progress || a.index - b.index;
    })
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
