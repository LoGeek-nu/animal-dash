import { cacheGeneratedCharacters, getGeneratedCharacters, subscribeCharacterCatalog } from "../../../domain/generated-characters.js";

// A revision isolates searches and disposal from old responses. A single in-flight
// request also coalesces repeated observer callbacks and refresh notifications.
export function createCharacterCatalog({ fetcher = (...args) => fetch(...args), cache = cacheGeneratedCharacters } = {}) {
  let state = { query: "", characters: [], total: 0, nextCursor: null, loading: false, error: null, started: false };
  let revision = 0, active = null, refreshQueued = false, unsubscribe = null, failedHead = false;
  const listeners = new Set();
  const publish = (changes) => { state = { ...state, ...changes }; for (const listener of listeners) listener(); };
  const request = async (head = false) => {
    if (active) { if (head) refreshQueued = true; return active.promise; }
    if (!head && state.started && !state.nextCursor) return;
    failedHead = head;
    const version = revision;
    const controller = new AbortController();
    const current = { controller };
    active = current;
    const params = new URLSearchParams({ limit: "12", query: state.query });
    if (!head && state.nextCursor) params.set("cursor", state.nextCursor);
    publish({ loading: true, error: null });
    current.promise = (async () => {
      try {
        const response = await fetcher(`/api/characters?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("取得に失敗しました。もう一度お試しください。");
        const page = await response.json();
        if (version !== revision) return;
        cache(page.characters);
        const cached = new Map(getGeneratedCharacters().map((c) => [c.id, c]));
        const existing = head ? state.characters.map((c) => cached.get(c.id) ?? c).filter((c) => c.name.includes(state.query.trim()) || c.preset.includes(state.query.trim())) : state.characters;
        // If more than a page arrived since the last visit, there may be a gap
        // between the new head and old items. Resume from the new head's cursor.
        const contiguous = !head || page.characters.some((c) => existing.some((old) => old.id === c.id)) || !page.nextCursor;
        const items = head ? [...page.characters, ...(contiguous ? existing : [])] : [...existing, ...page.characters];
        const ids = new Set();
        publish({ characters: items.filter((c) => !ids.has(c.id) && ids.add(c.id)), total: page.total,
          nextCursor: head && state.started && contiguous ? state.nextCursor : page.nextCursor, started: true });
      } catch (error) {
        if (version === revision && error.name !== "AbortError") publish({ error: error.message });
      } finally {
        if (version === revision) {
          active = null;
          publish({ loading: false });
          if (refreshQueued) { refreshQueued = false; void request(true); }
        }
      }
    })();
    return current.promise;
  };
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      unsubscribe = subscribeCharacterCatalog((change) => {
        // Discard pre-edit page responses before they can poison the fresh cache.
        revision++; active?.controller.abort(); active = null; refreshQueued = false;
        // An older character may enter/leave a filtered result anywhere in its
        // ordering. Restart that search instead of retaining an obsolete cursor.
        if (change.kind === "updated" && state.query.trim()) publish({ characters: [], nextCursor: null, started: false });
        void request(true);
      });
      if (!state.started) void request();
      else if (state.loading) { publish({ loading: false }); void request(); }
    },
    dispose() { revision++; active?.controller.abort(); active = null; refreshQueued = false; unsubscribe?.(); },
    setQuery(query) {
      revision++; active?.controller.abort(); active = null; refreshQueued = false;
      publish({ query, characters: [], total: 0, nextCursor: null, loading: false, error: null, started: false });
      void request();
    },
    loadMore: () => request(),
    retry: () => request(failedHead),
    refresh: () => request(true),
  };
}
