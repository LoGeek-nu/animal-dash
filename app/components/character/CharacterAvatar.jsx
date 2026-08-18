/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { getCharacter } from "../../race-data.js";

export function CharacterAvatar({ id, compact = false }) {
  const character = getCharacter(id);
  return (
    <div className={`character-avatar ${compact ? "is-compact" : ""}`} style={{ "--char": character.color, "--char-pale": character.pale }}>
      <img src={`/characters/${character.id}/runner.png`} alt={`${character.name}の全身イラスト`} draggable={false} />
    </div>
  );
}
