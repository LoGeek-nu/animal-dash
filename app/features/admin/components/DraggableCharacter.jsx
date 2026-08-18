"use client";

import { useDraggable } from "@dnd-kit/core";
import { Button } from "../../../components/ui/atoms/Button.jsx";
import { CharacterSummary } from "../../../components/ui/molecules/CharacterSummary.jsx";

export function DraggableCharacter({ character, disabled, isUsed, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `character-${character.id}`,
    data: { characterId: character.id },
    disabled,
  });

  return (
    <Button
      ref={setNodeRef}
      variant="unstyled"
      className={`library-character ${selected ? "is-selected" : ""} ${isUsed ? "is-used" : ""} ${isDragging ? "is-being-dragged" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      style={{ "--char": character.color, "--char-pale": character.pale }}
      {...attributes}
      {...listeners}
    >
      <CharacterSummary id={character.id} compact showCaption />
      {isUsed ? <b>使用中</b> : <i>{selected ? "選択中" : "つかむ"}</i>}
    </Button>
  );
}
