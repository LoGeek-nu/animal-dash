import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";

export function CharacterDragOverlay({ character }) {
  if (!character) return null;
  return (
    <div className="character-drag-overlay" style={{ "--char": character.color, "--char-pale": character.pale }}>
      <CharacterAvatar id={character.id} />
      <div><strong>{character.name}</strong><span>{character.preset}タイプ</span></div>
    </div>
  );
}
