import { getCharacter } from "../../../domain/characters.js";

export function StatBars({ id, small = false, compact = false }) {
  const character = getCharacter(id);
  // Compact lanes only have room for two bars, matching the mobile admin lanes.
  const stats = compact ? [
    ["スピード", character.stats.speed],
    ["スタミナ", character.stats.stamina],
  ] : [
    ["スピード", character.stats.speed],
    ["かそく", character.stats.acceleration],
    ["スタミナ", character.stats.stamina],
  ];

  return (
    <div className={`stat-bars ${small ? "is-small" : ""}`}>
      {stats.map(([label, value]) => (
        <div className="stat-row" key={label}>
          <span>{label}</span><i><b style={{ width: `${value * 10}%` }} /></i>
        </div>
      ))}
    </div>
  );
}
