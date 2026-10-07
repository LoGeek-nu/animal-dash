"use client";

import { useSyncExternalStore } from "react";
import { getGeneratedCharacters, subscribeGeneratedCharacters } from "../../../domain/generated-characters.js";

const EMPTY = [];

export function useGeneratedCharacters() {
  return useSyncExternalStore(subscribeGeneratedCharacters, getGeneratedCharacters, () => EMPTY);
}
