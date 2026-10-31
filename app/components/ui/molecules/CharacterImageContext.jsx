"use client";

import { createContext, useContext } from "react";

const ThumbnailContext = createContext(false);

export function AdminCharacterImages({ children }) {
  return <ThumbnailContext.Provider value={true}>{children}</ThumbnailContext.Provider>;
}

export function useCharacterThumbnails() {
  return useContext(ThumbnailContext);
}
