"use client";

import { useCallback, useMemo, useState } from "react";
import { characters } from "../../../domain/characters.js";

export function useCharacterSelection({ lanes }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const usedIds = useMemo(() => new Set(lanes.flatMap((lane) => lane ? [lane.characterId] : [])), [lanes]);
  const filteredCharacters = useMemo(
    () => characters.filter((character) => character.name.includes(query) || character.preset.includes(query)),
    [query],
  );

  const toggleSelected = useCallback((characterId) => {
    setSelectedId((current) => current === characterId ? null : characterId);
  }, []);

  return {
    query,
    setQuery,
    selectedId,
    setSelectedId,
    toggleSelected,
    usedIds,
    filteredCharacters,
  };
}
