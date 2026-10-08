// In-memory pool of generated characters, filled from GET /api/characters (backed by R2).
let pool = [];
let inflight = null;
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

// Concurrent callers share one request. Failures keep the current pool.
export function refreshGeneratedCharacters() {
  inflight ??= fetch("/api/characters", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : null)
    .then((body) => {
      if (!body) return;
      pool = body.characters.filter((character) => character.generated);
      notify();
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
