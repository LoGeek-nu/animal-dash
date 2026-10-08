import { ConnectionBadge } from "../../../components/ui/molecules/ConnectionBadge.jsx";
import { logout } from "../../auth/useStaffAuth.js";

export function AdminHeader({ ready, canLogout = false }) {
  return (
    <header className="admin-header">
      <div className="admin-brand"><strong>ANIMAL DASH!</strong><span>STAFF CONTROL</span></div>
      <nav><a href="/game" target="_blank">ゲーム画面を開く <i>↗</i></a><ConnectionBadge label={ready ? "SYNCED" : "CONNECTING"} />{canLogout && <button type="button" className="admin-logout" onClick={() => logout("/admin")}>ログアウト</button>}</nav>
    </header>
  );
}
