import { ConnectionBadge } from "../../../components/ui/molecules/ConnectionBadge.jsx";
import { logout } from "../../auth/useStaffAuth.js";

// The badge reflects the live WebSocket, not just local hydration, so staff can tell
// when their actions are not reaching the game screen.
function syncBadge(ready, syncStatus) {
  if (ready && syncStatus === "open") return { label: "SYNCED", tone: "ok" };
  if (syncStatus === "offline") return { label: "OFFLINE", tone: "offline" };
  return { label: "CONNECTING", tone: "pending" };
}

export function AdminHeader({ ready, syncStatus, canLogout = false }) {
  const badge = syncBadge(ready, syncStatus);
  return (
    <header className="admin-header">
      <div className="admin-brand"><strong>ANIMAL DASH!</strong><span>STAFF CONTROL</span></div>
      <nav><a href="/game" target="_blank">ゲーム画面を開く <i>↗</i></a><ConnectionBadge label={badge.label} tone={badge.tone} />{canLogout && <button type="button" className="admin-logout" onClick={() => logout("/admin")}>ログアウト</button>}</nav>
    </header>
  );
}
