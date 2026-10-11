/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { getCharacter } from "../../../domain/characters.js";

export function CharacterAvatar({ id, character: snapshot, compact = false }) {
  const character = snapshot ?? getCharacter(id);
  return (
    <div className={`character-avatar ${compact ? "is-compact" : ""}`} style={{ "--char": character.color, "--char-pale": character.pale }}>
      <img
        src={character.generated ? character.imageUrl : `/characters/${character.id}/runner.png`}
        alt={`${character.name}の全身イラスト`}
        draggable={false}
      />
    </div>
  );
}
