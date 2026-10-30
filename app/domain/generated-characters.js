// In-memory pool of generated characters, filled from GET /api/characters (backed by R2).
let pool = [];
let inflight = null;
let queued = null;
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

export function getGeneratedCharacters() {
  return pool;
}

export function addGeneratedCharacter(character) {
  if (pool.some((existing) => existing.id === character.id)) return;
  pool = [...pool, character];
  notify();
}

export function subscribeGeneratedCharacters(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  return fetch("/api/characters", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : null)
    .then((body) => {
      if (!body) return;
      const fetched = body.characters.filter((character) => character.generated);
      // Characters are never deleted, so keep any we already have that this response predates
      // (e.g. one added locally while the request was in flight).
      const fetchedIds = new Set(fetched.map((character) => character.id));
      pool = [...fetched, ...pool.filter((character) => !fetchedIds.has(character.id))];
      notify();
    })
    .catch(() => {});
}

// A request already in flight may have been answered before the change the caller wants to see,
// so callers arriving meanwhile share one fresh request that starts after it. Failures keep the current pool.
export function refreshGeneratedCharacters() {
  if (!inflight) {
    inflight = load().finally(() => {
      inflight = null;
    });
    return inflight;
  }
  queued ??= inflight.then(() => {
    queued = null;
    return refreshGeneratedCharacters();
  });
  return queued;
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
  return body;
}
