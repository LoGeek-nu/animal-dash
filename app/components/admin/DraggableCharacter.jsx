"use client";

import { useDraggable } from "@dnd-kit/core";
import { CharacterAvatar } from "../character/CharacterAvatar.jsx";

export function DraggableCharacter({ character, disabled, isUsed, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `character-${character.id}`,
    data: { characterId: character.id },
    disabled,
  });

  return (
    <button
      ref={setNodeRef}
      className={`library-character ${selected ? "is-selected" : ""} ${isUsed ? "is-used" : ""} ${isDragging ? "is-being-dragged" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      style={{ "--char": character.color, "--char-pale": character.pale }}
      {...attributes}
      {...listeners}
    >
      <CharacterAvatar id={character.id} compact />
      <div><strong>{character.name}</strong><span>{character.preset}タイプ</span><small>{character.caption}</small></div>
      {isUsed ? <b>使用中</b> : <i>{selected ? "選択中" : "つかむ"}</i>}
    </button>
  );
}
