export function AdminFooter({ session }) {
  const resetAt = session.resultsEndsAt
    ? new Date(session.resultsEndsAt).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "--:--";
  return (
    <footer className="admin-footer">
      <span>LIVE SYNC · SERVER CONFIRMED</span>
      <span>Race results: {session.results.length ? "CONFIRMED" : "READY"} · Auto reset: {resetAt}</span>
    </footer>
  );
}
