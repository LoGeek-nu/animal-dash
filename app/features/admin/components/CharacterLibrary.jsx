import { Button } from "../../../components/ui/atoms/Button.jsx";
import { SearchField } from "../../../components/ui/molecules/SearchField.jsx";
import { DraggableCharacter } from "./DraggableCharacter.jsx";

export function CharacterLibrary({ query, onQueryChange, filteredCharacters, usedIds, mutable, selectedId, onSelect, onInfo, totalCount, onRequestGenerate }) {
  return (
    <div className="character-library panel-card">
      <div className="panel-heading">
        <div><span>01</span><div><h1>キャラクターを選ぶ</h1><p>登録済みのキャラクター {totalCount}体</p></div></div>
        <div className="panel-heading-actions">
          <SearchField value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="名前・タイプで検索" />
          <Button variant="ghost" className="capture-button" disabled={!mutable} onClick={onRequestGenerate}><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 7h5l2-3h4l2 3h5v13H3Z" /><circle cx="12" cy="13" r="4" /></svg>撮影して追加</Button>
        </div>
      </div>
      <div className="character-list">
        {filteredCharacters.map((character) => {
          const isUsed = usedIds.has(character.id);
          return (
            <div className="library-character-item" key={character.id}>
              <DraggableCharacter
                character={character}
                disabled={isUsed || !mutable}
                isUsed={isUsed}
                selected={selectedId === character.id}
                onSelect={() => onSelect(character.id)}
              />
              <button type="button" className="library-character-info" aria-label={`${character.name}のステータス`} onClick={() => onInfo(character.id)}><span aria-hidden="true">ⓘ</span></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
