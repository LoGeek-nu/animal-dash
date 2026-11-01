import assert from "node:assert/strict";
import test from "node:test";
import { ensureCharacterThumbnail, prepareGeneratedCharacterThumbnail, characterThumbnailResponse } from "../worker/character-thumbnail.js";
import { characterThumbnailKey, characterThumbnailUrl } from "../app/domain/character-thumbnail.js";
import { staffCookie } from "../worker/auth.js";

function setup() {
  const objects = new Map();
  const bytes = new TextEncoder().encode("transparent-webp");
  objects.set("characters/gen-a.png", { size: 2_000_000, etag: "original", body: new Blob(["original"]).stream() });
  let transforms = 0;
  const env = {
    STAFF_PASSCODE: "test-only",
    CHARACTERS: {
      async head(key) { return objects.get(key) ?? null; },
      async get(key) { const o = objects.get(key); return o ? { ...o, body: new Blob([o.bytes ?? "original"]).stream() } : null; },
      async put(key, body, metadata) {
        const value = new Uint8Array(await new Response(body).arrayBuffer());
        const o = { size: value.length, bytes: value, httpEtag: '"thumb"', ...metadata };
        objects.set(key, o); return o;
      },
    },
    IMAGES: { input(stream) {
      assert.ok(stream instanceof ReadableStream);
      return { transform(options) {
        transforms++; assert.deepEqual(options, { width: 256, height: 256, fit: "scale-down" });
        return { async output(options) {
          assert.deepEqual(options, { format: "image/webp", quality: 80 });
          return { response: () => new Response(bytes, { headers: { "Content-Type": "image/webp" } }) };
        } };
      } };
    } },
  };
  return { env, objects, transforms: () => transforms };
}

test("thumbnail creation keeps the original, uses an isolated versioned key and skips completed work", async () => {
  const {env,objects,transforms}=setup();
  const original=objects.get("characters/gen-a.png");
  const result=await ensureCharacterThumbnail(env,"gen-a");
  assert.equal(result.status,"created"); assert.equal(result.sourceBytes,2_000_000);
  assert.equal(objects.get("characters/gen-a.png"),original);
  assert.equal(objects.get(characterThumbnailKey("gen-a")).httpMetadata.contentType,"image/webp");
  assert.equal((await ensureCharacterThumbnail(env,"gen-a")).status,"existing");
  assert.equal(transforms(),1);
  assert.equal(await ensureCharacterThumbnail(env,"missing"),null);
  assert.equal(characterThumbnailUrl("a/b"),"/api/characters/a%2Fb/thumbnail/v1");
});

test("public thumbnail reads never transform; missing images redirect without caching; HEAD and conditional GET work", async () => {
  const {env,transforms}=setup();
  const request=(method="GET",headers={})=>new Request("https://example.test/api/characters/gen-a/thumbnail/v1",{method,headers});
  const missing=await characterThumbnailResponse(request(),env,"gen-a");
  assert.equal(missing.status,307); assert.equal(missing.headers.get("cache-control"),"no-store");
  assert.equal(missing.headers.get("location"),"/api/characters/gen-a/image"); assert.equal(transforms(),0);
  await ensureCharacterThumbnail(env,"gen-a");
  const get=await characterThumbnailResponse(request(),env,"gen-a");
  assert.equal(get.status,200); assert.equal(await get.text(),"transparent-webp");
  assert.equal(get.headers.get("content-type"),"image/webp");
  const head=await characterThumbnailResponse(request("HEAD"),env,"gen-a");
  assert.equal(await head.text(),""); assert.equal(head.headers.get("content-length"),"16");
  assert.equal((await characterThumbnailResponse(request("GET",{"If-None-Match":'W/"thumb"'}),env,"gen-a")).status,304);
  assert.equal(transforms(),1);
});

test("backfill requires staff auth and same origin, and can repair a failed generation", async () => {
  const {env}=setup();
  const url="https://example.test/api/characters/gen-a/thumbnail/v1";
  assert.equal((await characterThumbnailResponse(new Request(url,{method:"POST"}),env,"gen-a")).status,401);
  const cookie=(await staffCookie(new Request(url),env)).split(";")[0];
  assert.equal((await characterThumbnailResponse(new Request(url,{method:"POST",headers:{Cookie:cookie,Origin:"https://evil.test"}}),env,"gen-a")).status,403);
  const images=env.IMAGES; env.IMAGES={input(){throw new Error("conversion unavailable");}};
  assert.equal(await prepareGeneratedCharacterThumbnail(env,"gen-a"),null);
  const failed=await characterThumbnailResponse(new Request(url,{method:"POST",headers:{Cookie:cookie}}),env,"gen-a");
  assert.equal(failed.status,503); assert.equal(failed.headers.get("cache-control"),"no-store");
  env.IMAGES=images;
  const repaired=await characterThumbnailResponse(new Request(url,{method:"POST",headers:{Cookie:cookie}}),env,"gen-a");
  assert.equal(repaired.status,200); assert.equal((await repaired.json()).status,"created");
});
