import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { getCharacter, laneColors } from "../../../domain/characters.js";

export function CountdownGrid({ lanes }) {
  return (
    <div className="starting-grid">
      {lanes.map((lane, index) => lane && (
        <div className="starting-runner" key={lane.characterId} style={{ "--lane": laneColors[index] }}>
          <span>LANE {index + 1}</span>
          <CharacterAvatar id={lane.characterId} />
          <strong>{getCharacter(lane.characterId).name}</strong>
        </div>
      ))}
    </div>
  );
}
