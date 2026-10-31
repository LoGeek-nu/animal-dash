"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createCharacterCatalog } from "../model/character-catalog.js";

export function useCharacterSelection({ lanes }) {
  const [selectedId, setSelectedId] = useState(null);
  const [catalog] = useState(() => createCharacterCatalog());
  const page = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot, catalog.getSnapshot);
  const usedIds = useMemo(() => new Set(lanes.flatMap((lane) => lane ? [lane.characterId] : [])), [lanes]);
  useEffect(() => { catalog.start(); return () => catalog.dispose(); }, [catalog]);
  const toggleSelected = useCallback((id) => setSelectedId((current) => current === id ? null : id), []);
  return {
    query: page.query,
    setQuery: (query) => { setSelectedId(null); catalog.setQuery(query); },
    selectedId, setSelectedId, toggleSelected, usedIds,
    filteredCharacters: page.characters, totalCount: page.total,
    loading: page.loading, error: page.error, hasMore: !page.started || page.nextCursor !== null,
    loadMore: catalog.loadMore, retry: catalog.retry,
  };
}
