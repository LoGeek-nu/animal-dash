"use client";

import { useCallback, useMemo, useState } from "react";
import { characters } from "../../../domain/characters.js";
import { useGeneratedCharacters } from "./useGeneratedCharacters.js";

export function useCharacterSelection({ lanes }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const generatedCharacters = useGeneratedCharacters();
  const allCharacters = useMemo(() => [...characters, ...generatedCharacters], [generatedCharacters]);
  const usedIds = useMemo(() => new Set(lanes.flatMap((lane) => lane ? [lane.characterId] : [])), [lanes]);
  const filteredCharacters = useMemo(
    () => allCharacters.filter((character) => character.name.includes(query) || character.preset.includes(query)),
    [allCharacters, query],
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
    totalCount: allCharacters.length,
  };
}
