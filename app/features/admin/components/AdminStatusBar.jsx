import { PHASE_LABELS } from "../../../domain/race-session.js";

export function AdminStatusBar({ session, participantCount }) {
  const lastSync = new Date(session.lastSync).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  return (
    <section className="admin-statusbar">
      <div><span>EVENT</span><strong>桜麗祭 2026</strong><small>oureisai-2026</small></div>
      <div><span>PHASE</span><strong className={`status-phase status-${session.phase.toLowerCase()}`}><i />{PHASE_LABELS[session.phase]}</strong></div>
      <div><span>PARTICIPANTS</span><strong>{participantCount} / 4</strong></div>
      <div><span>LAST SYNC</span><strong>{lastSync}</strong><small>SEQ {String(session.sequence).padStart(4, "0")}</small></div>
      <div><span>SESSION</span><strong>{session.sessionId.replace("session_", "#").toUpperCase()}</strong></div>
    </section>
  );
}
