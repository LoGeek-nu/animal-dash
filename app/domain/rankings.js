export function formatTime(ms) {
  if (ms === null) return "DNF";
  return `${(ms / 1000).toFixed(3)}秒`;
}

export function formatRankingDate(date) {
  return date ? date.replaceAll("-", ".") : "対象日を取得中";
}

const RANK_STEP_MS = 120;
const TOP_THREE_PAUSE_MS = 360;

// Rows enter from the lowest rank upward; TOP 3 waits a beat so it lands last.
export function rankRevealDelay(index, total, rank) {
  const fromBottom = total - 1 - index;
  return fromBottom * RANK_STEP_MS + (rank <= 3 ? TOP_THREE_PAUSE_MS : 0);
}
