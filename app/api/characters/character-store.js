// Generated characters live in R2: one PNG per character, with the race data
// stored as JSON in the object's customMetadata so a single list() returns everything.
const PREFIX = "characters/";

export function characterImageUrl(id) {
  return `/api/characters/${encodeURIComponent(id)}/image`;
}

export function characterImageKey(id) {
  return `${PREFIX}${id}.png`;
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function saveGeneratedCharacter(bucket, character, imageBase64) {
  await bucket.put(characterImageKey(character.id), decodeBase64(imageBase64), {
    httpMetadata: { contentType: "image/png" },
    customMetadata: { character: JSON.stringify(character) },
  });
  return { ...character, imageUrl: characterImageUrl(character.id) };
}

export async function listGeneratedCharacters(bucket) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: PREFIX, cursor, include: ["customMetadata"] });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects
    .sort((a, b) => new Date(a.uploaded) - new Date(b.uploaded))
    .flatMap((object) => {
      try {
        const character = JSON.parse(object.customMetadata?.character ?? "");
        return [{ ...character, imageUrl: characterImageUrl(character.id) }];
      } catch {
        return [];
      }
    });
}

// R2 cannot update metadata alone, so the same PNG is written back with the changed name or catchphrase.
// Returns false when the object is missing or its metadata is unreadable.
export async function updateGeneratedCharacterMetadata(bucket, id, changes) {
  const object = await bucket.get(characterImageKey(id));
  if (!object) return false;
  let character;
  try {
    character = JSON.parse(object.customMetadata?.character ?? "");
  } catch {
    return false;
  }
  await bucket.put(characterImageKey(id), await object.arrayBuffer(), {
    httpMetadata: object.httpMetadata,
    customMetadata: { ...object.customMetadata, character: JSON.stringify({ ...character, ...changes }) },
  });
  return true;
}

export async function generatedCharacterExists(bucket, id) {
  return (await bucket.head(characterImageKey(id))) !== null;
}

export function getGeneratedCharacterImage(bucket, id) {
  return bucket.get(characterImageKey(id));
}
