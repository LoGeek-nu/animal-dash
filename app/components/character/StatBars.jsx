import { getCharacter } from "../../race-data.js";

export function StatBars({ id, small = false }) {
  const character = getCharacter(id);
  const stats = [
    ["SPD", character.stats.speed],
    ["ACC", character.stats.acceleration],
    ["JMP", character.stats.jump],
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
