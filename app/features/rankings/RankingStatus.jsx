export function RankingStatus({ status, empty = false, onRetry }) {
  if (status === "ready" && !empty) return null;
  const message = status === "failed" ? "今回の記録を保存できませんでした。スタッフにお知らせください。"
    : status === "error" ? "ランキングを取得できませんでした。"
    : status === "pending" ? "今回の記録を反映しています…"
    : status === "ready" ? "今日はまだ完走記録がありません。"
    : "ランキングを読み込んでいます…";
  return (
    <div className={`ranking-status is-${status}`} role={status === "error" || status === "failed" ? "alert" : "status"}>
      <p>{message}</p>
      {status === "ready" && <small>完走すると、ここに記録が表示されます。</small>}
      {(status === "error" || status === "pending" || status === "failed") && <button type="button" onClick={onRetry}>再読み込み</button>}
    </div>
  );
}
