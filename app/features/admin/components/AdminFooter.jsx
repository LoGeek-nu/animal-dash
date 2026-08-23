export function AdminFooter({ session }) {
  const resetAt = session.resultsEndsAt
    ? new Date(session.resultsEndsAt).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "--:--";
  return (
    <footer className="admin-footer">
      <span>LOCAL MOCK MODE · BroadcastChannel + localStorage</span>
      <span>Race results: {session.results.length ? "SAVED" : "READY"} · Auto reset: {resetAt}</span>
    </footer>
  );
}
