export function ConnectionBadge({ label = "LIVE SYNC", tone = "ok" }) {
  return <div className={`connection-badge is-${tone}`} role="status"><span />{label}</div>;
}
