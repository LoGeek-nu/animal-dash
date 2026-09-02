import { STORAGE_KEY } from "./constants.js";
import { validSession } from "./race-session-validator.js";

export function loadRaceSession() {
  if (typeof localStorage === "undefined") return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const session = JSON.parse(saved);
    return validSession(session) ? { ...session, attractIndex: 0 } : null;
  } catch {
    return null;
  }
}

export function saveRaceSession(session) {
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
