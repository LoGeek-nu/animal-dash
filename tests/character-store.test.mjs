import assert from "node:assert/strict";
import test from "node:test";
import {
  characterImageUrl,
  getGeneratedCharacterImage,
  listGeneratedCharacters,
  saveGeneratedCharacter,
} from "../app/api/characters/character-store.js";

// Minimal in-memory stand-in for an R2 bucket binding, paging two objects at a time.
function createFakeBucket() {
  const objects = new Map();
  let clock = 0;
  return {
    objects,
    async put(key, value, options) {
      objects.set(key, { key, value, ...options, uploaded: new Date(++clock * 1000) });
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async list({ prefix, cursor, include }) {
      assert.deepEqual(include, ["customMetadata"]);
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + 2).map((key) => objects.get(key));
      const truncated = start + 2 < keys.length;
      return { objects: page, truncated, cursor: truncated ? String(start + 2) : undefined };
    },
  };
}

const character = (id) => ({ id, name: `テスト${id}`, generated: true, stats: { speed: 5, acceleration: 6, stamina: 7 } });

test("saving a generated character stores the PNG with its race data as metadata", async () => {
  const bucket = createFakeBucket();
  const saved = await saveGeneratedCharacter(bucket, character("gen-a"), btoa("png-bytes"));

  assert.equal(saved.imageUrl, "/api/characters/gen-a/image");
  const stored = bucket.objects.get("characters/gen-a.png");
  assert.equal(new TextDecoder().decode(stored.value), "png-bytes");
  assert.equal(stored.httpMetadata.contentType, "image/png");
  assert.deepEqual(JSON.parse(stored.customMetadata.character), character("gen-a"));
  assert.equal(await getGeneratedCharacterImage(bucket, "gen-a"), stored);
});

test("listing walks every page in upload order and skips unreadable metadata", async () => {
  const bucket = createFakeBucket();
  for (const id of ["gen-c", "gen-a", "gen-b"]) await saveGeneratedCharacter(bucket, character(id), btoa(id));
  await bucket.put("characters/broken.png", new Uint8Array(), { customMetadata: { character: "{" } });

  const listed = await listGeneratedCharacters(bucket);
  assert.deepEqual(listed.map(({ id }) => id), ["gen-c", "gen-a", "gen-b"]);
  assert.equal(listed[0].imageUrl, characterImageUrl("gen-c"));
});
