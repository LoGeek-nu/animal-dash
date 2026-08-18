export function Badge({ children, className = "", tone = "default" }) {
  return <span className={["ui-badge", `ui-badge-${tone}`, className].filter(Boolean).join(" ")}>{children}</span>;
}
