// Staff can rewrite a generated character's name and catchphrase; both show on the spectator screens.
// Drops control and invisible format characters and folds runs of spaces, so what is saved
// is what the screens show. Returns null when nothing usable is left.
export function normalizeCharacterText(input) {
  if (typeof input !== "string") return null;
  const text = input.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/gu, " ").trim();
  return text || null;
}
