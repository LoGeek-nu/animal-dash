export function formatTime(ms) {
  if (ms === null) return "DNF";
  return `${(ms / 1000).toFixed(3)}秒`;
}

export function formatRankingDate(date) {
  return date ? date.replaceAll("-", ".") : "対象日を取得中";
}
