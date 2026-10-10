// Generated characters live in R2: one PNG per character, with the race data
// stored as JSON in the object's customMetadata so a single list() returns everything.
const PREFIX = "characters/";

export function characterImageUrl(id) {
  return `/api/characters/${encodeURIComponent(id)}/image`;
}

function imageKey(id) {
  return `${PREFIX}${id}.png`;
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function saveGeneratedCharacter(bucket, character, imageBase64) {
  await bucket.put(imageKey(character.id), decodeBase64(imageBase64), {
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

export async function generatedCharacterExists(bucket, id) {
  return (await bucket.head(imageKey(id))) !== null;
}

export function getGeneratedCharacterImage(bucket, id) {
  return bucket.get(imageKey(id));
}
