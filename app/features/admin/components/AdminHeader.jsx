import { ConnectionBadge } from "../../../components/ui/molecules/ConnectionBadge.jsx";

export function AdminHeader({ ready }) {
  return (
    <header className="admin-header">
      <div className="admin-brand"><strong>ANIMAL DASH!</strong><span>STAFF CONTROL</span></div>
      <nav><a href="/game" target="_blank">ゲーム画面を開く <i>↗</i></a><ConnectionBadge label={ready ? "SYNCED" : "CONNECTING"} /></nav>
    </header>
  );
}
