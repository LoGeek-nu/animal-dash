export function SectionKicker({ children, className = "" }) {
  return <p className={["section-kicker", className].filter(Boolean).join(" ")}>{children}</p>;
}
