import { STAT_MAX } from "../../../domain/characters.js";

// Stats as meters with their values; compact drops the numbers for tight lanes.
export function StatMeters({ character, compact = false }) {
  const stats = [["スピード", character.stats.speed], ["かそく", character.stats.acceleration], ["スタミナ", character.stats.stamina]];
  return <div className={`mobile-stats ${compact ? "is-compact" : ""}`}>{stats.map(([label, value]) => (
    <div key={label}><span>{label}</span><meter min="0" max={STAT_MAX} value={value} aria-label={label}>{value} / {STAT_MAX}</meter>{!compact && <strong>{value} / {STAT_MAX}</strong>}</div>
  ))}</div>;
}
