// Only characters already viewed or referenced by a session live in this cache.
let pool = [];
const listeners = new Set();
const catalogListeners = new Set();
const pending = new Map();

function notify() { for (const listener of listeners) listener(); }
export function getGeneratedCharacters() { return pool; }
export function subscribeGeneratedCharacters(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function subscribeCharacterCatalog(listener) { catalogListeners.add(listener); return () => catalogListeners.delete(listener); }
export function invalidateCharacterCatalog() { for (const listener of catalogListeners) listener(); }

export function cacheGeneratedCharacters(characters) {
  const incoming = new Map(characters.filter((c) => c.generated).map((c) => [c.id, c]));
  if (!incoming.size) return;
  pool = pool.map((c) => { const updated = incoming.get(c.id); incoming.delete(c.id); return updated ?? c; });
  pool = [...pool, ...incoming.values()];
  notify();
}

export function addGeneratedCharacter(character) {
  cacheGeneratedCharacters([{ ...character, generated: true }]);
  invalidateCharacterCatalog();
}

// At most twelve explicit IDs per request; never fall back to fetching the catalog.
export async function ensureGeneratedCharacters(ids, { refresh = false } = {}) {
  const needed = [...new Set(ids)].filter((id) => refresh || !pool.some((c) => c.id === id));
  for (let start = 0; start < needed.length; start += 12) {
    const batch = needed.slice(start, start + 12);
    const key = batch.slice().sort().join(",");
    if (!pending.has(key)) {
      const request = fetch(`/api/characters?${new URLSearchParams({ ids: key })}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Character lookup failed");
          cacheGeneratedCharacters((await response.json()).characters);
        }).finally(() => pending.delete(key));
      pending.set(key, request);
    }
    await pending.get(key);
  }
}

export async function refreshGeneratedCharacters(ids = []) {
  await ensureGeneratedCharacters(ids, { refresh: true });
  invalidateCharacterCatalog();
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
  invalidateCharacterCatalog();
  return body;
}
