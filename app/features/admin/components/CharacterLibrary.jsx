import { SearchField } from "../../../components/ui/molecules/SearchField.jsx";
import { characters } from "../../../domain/characters.js";
import { DraggableCharacter } from "./DraggableCharacter.jsx";

export function CharacterLibrary({ query, onQueryChange, filteredCharacters, usedIds, mutable, selectedId, onSelect }) {
  return (
    <div className="character-library panel-card">
      <div className="panel-heading">
        <div><span>01</span><div><h1>キャラクターを選ぶ</h1><p>登録済みのキャラクター {characters.length}体</p></div></div>
        <SearchField value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="名前・タイプで検索" />
      </div>
      <div className="character-list">
        {filteredCharacters.map((character) => {
          const isUsed = usedIds.has(character.id);
          return (
            <DraggableCharacter
              character={character}
              key={character.id}
              disabled={isUsed || !mutable}
              isUsed={isUsed}
              selected={selectedId === character.id}
              onSelect={() => onSelect(character.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
