export const RACE_TIMEOUT = 60_000;

export function validRaceResults(results, lanes) {
  return Array.isArray(results) && results.length > 0
    && results.length === lanes.filter(Boolean).length
    && new Set(results.map((result) => result?.lane)).size === results.length
    && new Set(results.map((result) => result?.characterId)).size === results.length
    && results.every((result) => {
      if (!result || !Number.isInteger(result.lane) || result.lane < 1 || result.lane > 4) return false;
      const lane = lanes[result.lane - 1];
      return Boolean(lane) && lane.characterId === result.characterId && lane.isBot === result.isBot
        && Number.isInteger(result.rank) && result.rank >= 1 && result.rank <= results.length
        && (result.finishMs === null || (Number.isSafeInteger(result.finishMs) && result.finishMs >= 0 && result.finishMs < RACE_TIMEOUT));
    });
}
