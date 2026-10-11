import { Button } from "../../../components/ui/atoms/Button.jsx";
import { SearchField } from "../../../components/ui/molecules/SearchField.jsx";
import { DraggableCharacter } from "./DraggableCharacter.jsx";

export function CharacterLibrary({ query, onQueryChange, filteredCharacters, usedIds, mutable, selectedId, onSelect, totalCount, onRequestGenerate }) {
  return (
    <div className="character-library panel-card">
      <div className="panel-heading">
        <div><span>01</span><div><h1>キャラクターを選ぶ</h1><p>登録済みのキャラクター {totalCount}体</p></div></div>
        <div className="panel-heading-actions">
          <SearchField value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="名前・タイプで検索" />
          <Button variant="ghost" className="capture-button" disabled={!mutable} onClick={onRequestGenerate}>撮影して追加</Button>
        </div>
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
