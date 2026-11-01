// Only characters already viewed or referenced by a session live in this cache.
let pool = [];
const listeners = new Set();
const catalogListeners = new Set();
const pending = new Map();
const stale = new Set();
const versions = new Map();

function notify() { for (const listener of listeners) listener(); }
export function getGeneratedCharacters() { return pool; }
export function subscribeGeneratedCharacters(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function subscribeCharacterCatalog(listener) { catalogListeners.add(listener); return () => catalogListeners.delete(listener); }
export function invalidateCharacterCatalog(change = {}) { for (const listener of catalogListeners) listener(change); }

export function cacheGeneratedCharacters(characters) {
  const incoming = new Map(characters.filter((c) => c.generated).map((c) => [c.id, c]));
  if (!incoming.size) return;
  pool = pool.map((c) => { const updated = incoming.get(c.id); incoming.delete(c.id); return updated ?? c; });
  pool = [...pool, ...incoming.values()];
  notify();
}

export function addGeneratedCharacter(character) {
  cacheGeneratedCharacters([{ ...character, generated: true }]);
  invalidateCharacterCatalog({ kind: "created", id: character.id });
}

// At most twelve explicit IDs per request; never fall back to fetching the catalog.
export async function ensureGeneratedCharacters(ids) {
  const missing = (id) => stale.has(id) || !pool.some((c) => c.id === id);
  const needed = [...new Set(ids)].filter(missing);
  for (let start = 0; start < needed.length; start += 12) {
    const batch = needed.slice(start, start + 12);
    const key = batch.slice().sort().join(",");
    // A notification during an older lookup requires a fresh response, not the
    // stale in-flight response. A later assignment also waits for this repair.
    while (batch.some(missing)) {
      if (!pending.has(key)) {
        const requestedVersions = new Map(batch.map((id) => [id, versions.get(id) ?? 0]));
        const request = fetch(`/api/characters?${new URLSearchParams({ ids: key })}`, { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok) throw new Error("Character lookup failed");
            const characters = (await response.json()).characters;
            if (batch.some((id) => !characters.some((c) => c.id === id && c.generated))) throw new Error("Character lookup incomplete");
            const current = characters.filter((c) => requestedVersions.has(c.id) && requestedVersions.get(c.id) === (versions.get(c.id) ?? 0));
            cacheGeneratedCharacters(current);
            for (const c of current) stale.delete(c.id);
          }).finally(() => pending.delete(key));
        pending.set(key, request);
      }
      await pending.get(key);
    }
  }
}

export async function refreshGeneratedCharacters(ids = [], change = { kind: "updated" }) {
  for (const id of ids) { stale.add(id); versions.set(id, (versions.get(id) ?? 0) + 1); }
  try { await ensureGeneratedCharacters(ids); }
  finally { invalidateCharacterCatalog(change); }
}

// The server refuses characters set in a lane; its message is shown to staff as-is.
// `changes` holds a new name, caption or both.
export async function updateGeneratedCharacter(id, changes) {
  let response;
  try {
    response = await fetch(`/api/characters/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
  } catch {
    throw new Error("通信に失敗しました。ネットワークを確認してください。");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail ?? "変更できませんでした。");
  pool = pool.map((character) => character.id === id ? { ...character, name: body.name, caption: body.caption } : character);
  notify();
  invalidateCharacterCatalog({ kind: "updated", id });
  return body;
}
