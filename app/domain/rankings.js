export const staticRanking = [
  { characterId: "kon", finishMs: 28420 },
  { characterId: "momo", finishMs: 29180 },
  { characterId: "azuki", finishMs: 30460 },
  { characterId: "toramaru", finishMs: 31820 },
  { characterId: "koro", finishMs: 32760 },
  { characterId: "dorami", finishMs: 33910 },
  { characterId: "penta", finishMs: 34680 },
  { characterId: "keroppin", finishMs: 35940 },
  { characterId: "fuwa", finishMs: 37120 },
  { characterId: "panko", finishMs: 38960 },
];

export function formatTime(ms) {
  if (ms === null) return "DNF";
  return `${(ms / 1000).toFixed(2)}s`;
}

export function buildTopRanking(results, limit = 3) {
  const currentResults = results
    .filter((result) => result.finishMs !== null)
    .map(({ characterId, finishMs }) => ({ characterId, finishMs }));

  return [...currentResults, ...staticRanking]
    .sort((a, b) => a.finishMs - b.finishMs)
    .filter((item, index, all) => all.findIndex((other) => other.characterId === item.characterId) === index)
    .slice(0, limit);
}
