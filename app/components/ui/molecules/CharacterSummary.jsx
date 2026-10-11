import { getCharacter } from "../../../domain/characters.js";
import { CharacterAvatar } from "./CharacterAvatar.jsx";

export function CharacterSummary({ id, compact = true, showCaption = false }) {
  const character = getCharacter(id);
  return (
    <>
      <CharacterAvatar id={id} compact={compact} />
      <div className="character-summary-copy">
        <strong>{character.name}</strong>
        <span>{character.preset}タイプ</span>
        {showCaption && <small>{character.caption}</small>}
      </div>
    </>
  );
}
