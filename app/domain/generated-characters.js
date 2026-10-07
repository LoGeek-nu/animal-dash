const STORAGE_KEY = "animal-dash-generated-characters-v1";

function loadPool() {
  if (typeof localStorage === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function savePool(pool) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pool));
  } catch {
    // Storage quota or privacy mode — the in-memory pool still works for this tab.
  }
}

let pool = loadPool();
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

export function getGeneratedCharacters() {
  return pool;
}

export function addGeneratedCharacter(character) {
  pool = [...pool, character];
  savePool(pool);
  notify();
}

export function subscribeGeneratedCharacters(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    pool = loadPool();
    notify();
  });
}
