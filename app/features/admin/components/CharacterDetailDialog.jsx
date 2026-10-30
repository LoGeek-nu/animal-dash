"use client";

import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { StatMeters } from "../../../components/ui/molecules/StatMeters.jsx";
import { getCharacter } from "../../../domain/characters.js";
import { useGeneratedCharacters } from "../hooks/useGeneratedCharacters.js";
import { AdminModal } from "./AdminModal.jsx";
import { CharacterProfileEditor } from "./CharacterProfileEditor.jsx";

// Lets staff check a character before setting it in a lane. Generated ones can have their name and
// catchphrase changed unless they are already in a lane; built-in ones are fixed in code.
export function CharacterDetailDialog({ id, used, onClose }) {
  // Subscribed so an edit, here or from another staff screen, shows straight away.
  useGeneratedCharacters();
  const character = getCharacter(id);
  return (
    <AdminModal title="ステータス詳細" onClose={onClose} className="mobile-stats-dialog">
      <CharacterAvatar id={character.id} />
      {character.generated ? <CharacterProfileEditor key={character.id} character={character} locked={used} /> : <h3>{character.name}</h3>}
      <p>{character.preset}タイプ</p>
      <p>{character.caption}</p>
      <StatMeters character={character} />
    </AdminModal>
  );
}
