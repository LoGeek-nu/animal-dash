"use client";

/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { useCharacterThumbnails } from "./CharacterImageContext.jsx";
import { characterThumbnailUrl } from "../../../domain/character-thumbnail.js";
import { getCharacter } from "../../../domain/characters.js";

export function CharacterAvatar({ id, character: snapshot, compact = false, lazy = false }) {
  const character = snapshot ?? getCharacter(id);
  const thumbnails = useCharacterThumbnails();
  return (
    <div className={`character-avatar ${compact ? "is-compact" : ""}`} style={{ "--char": character.color, "--char-pale": character.pale }}>
      <img
        src={character.generated ? (thumbnails ? characterThumbnailUrl(character.id) : character.imageUrl) : `/characters/${character.id}/runner.png`}
        alt={`${character.name}の全身イラスト`}
        loading={lazy ? "lazy" : "eager"}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
