"use client";

import { useId, useState } from "react";
import { Button } from "../../../components/ui/atoms/Button.jsx";
import { normalizeCharacterText } from "../../../domain/character-text.js";
import { updateGeneratedCharacter } from "../../../domain/generated-characters.js";

// The name heading of a generated character, with a button to change its name and catchphrase.
// `locked` explains why editing is off (the character is set in a lane).
export function CharacterProfileEditor({ character, locked = false, onUpdated }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const nameId = useId();
  const captionId = useId();

  if (draft === null) {
    return (
      <div className="character-profile-editor">
        <h3>{character.name}</h3>
        <Button variant="ghost" className="character-profile-edit" disabled={locked}
          onClick={() => { setDraft({ name: character.name, caption: character.caption ?? "" }); setError(null); }}>名前・一言を変える</Button>
        {locked && <small>レーンにセットされているあいだは名前や一言を変えられません。</small>}
      </div>
    );
  }

  const name = normalizeCharacterText(draft.name);
  const caption = normalizeCharacterText(draft.caption);
  const changes = {
    ...(name !== character.name ? { name } : {}),
    ...(caption !== character.caption ? { caption } : {}),
  };
  const cancel = () => { setDraft(null); setError(null); };
  const submit = async (event) => {
    event.preventDefault();
    if (!name || !caption || saving) return;
    if (!Object.keys(changes).length) { cancel(); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateGeneratedCharacter(character.id, changes);
      setDraft(null);
      onUpdated?.(updated);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="character-profile-editor is-editing" onSubmit={submit}>
      <label htmlFor={nameId}>名前</label>
      <input id={nameId} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} disabled={saving}
        autoComplete="off" enterKeyHint="next" aria-invalid={!name} autoFocus />
      <label htmlFor={captionId}>一言</label>
      <input id={captionId} value={draft.caption} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} disabled={saving}
        autoComplete="off" enterKeyHint="done" aria-invalid={!caption} />
      {error && <p className="character-profile-error" role="alert">{error}</p>}
      <div className="generate-dialog-actions">
        <Button variant="secondary" disabled={saving} onClick={cancel}>やめる</Button>
        <Button variant="primary" type="submit" disabled={!name || !caption || saving}>{saving ? "保存中…" : "保存する"}</Button>
      </div>
    </form>
  );
}
