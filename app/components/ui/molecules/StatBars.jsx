import { getCharacter } from "../../../domain/characters.js";

export function StatBars({ id, small = false, compact = false }) {
  const character = getCharacter(id);
  // Compact lanes only have room for two bars, matching the mobile admin lanes.
  const stats = compact ? [
    ["SPD", character.stats.speed],
    ["STM", character.stats.stamina],
  ] : [
    ["SPD", character.stats.speed],
    ["ACC", character.stats.acceleration],
    ["STM", character.stats.stamina],
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
