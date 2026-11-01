import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { staffCookie } from "../worker/auth.js";

test("successful generation persists both original and thumbnail through the real Worker route", {timeout:15000},async(t)=>{
  const root=fileURLToPath(new URL("../",import.meta.url));
  const compiled=await build({stdin:{contents:"import {POST} from './app/api/characters/generate/route.js'; export default {fetch: POST};",resolveDir:root},bundle:true,write:false,format:"esm",platform:"neutral",external:["cloudflare:workers"]});
  const source=await readFile(new URL("../public/characters/momo/runner.png",import.meta.url));
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:compiled.outputFiles[0].text,
    compatibilityDate:"2026-08-19",bindings:{STAFF_PASSCODE:"thumbnail-test",IMAGE_POC_API_URL:"https://upstream.test",IMAGE_POC_API_KEY:"test"},
    d1Databases:{DB:"thumbnail-generation"},r2Buckets:["CHARACTERS"],images:{binding:"IMAGES"},
    outboundService:async(r)=>{ await r.arrayBuffer(); return Response.json({image_base64:source.toString("base64"),status:{title:"Thumbnail test",animal_type:"Rabbit",personality:"Test",stats:{speed:14,acceleration:13,stamina:13}}}); },
  }));
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database("DB");
  for(const migration of ["0001_race_storage.sql","0002_builtin_characters.sql","0003_builtin_stats_40.sql","0004_character_paging.sql"]){
    const sql=await readFile(new URL(`../migrations/${migration}`,import.meta.url),"utf8");
    await db.batch(sql.split(";").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  }
  const cookie=(await staffCookie(new Request("https://example.test"),{STAFF_PASSCODE:"thumbnail-test"})).split(";")[0];
  const form=new FormData();form.append("image",new Blob([source],{type:"image/png"}),"capture.png");
  const upload=new Request("https://example.test/api/characters/generate",{method:"POST",body:form});
  const response=await mf.dispatchFetch(upload.url,{method:"POST",headers:{Cookie:cookie,"Content-Type":upload.headers.get("content-type")},body:await upload.arrayBuffer()});
  if(response.status!==200)assert.fail(await response.text());
  const character=await response.json();
  const bucket=await mf.getR2Bucket("CHARACTERS");
  const original=await bucket.get(`characters/${character.id}.png`);
  assert.deepEqual(new Uint8Array(await original.arrayBuffer()),new Uint8Array(source));
  const thumbnail=await bucket.get(`thumbnails/v1/${character.id}.webp`);
  assert.ok(thumbnail,"generation must finish storing thumbnail before returning");
  assert.equal(thumbnail.httpMetadata.contentType,"image/webp");
  const bytes=Buffer.from(await thumbnail.arrayBuffer());
  assert.equal(bytes.toString("ascii",0,4),"RIFF");assert.equal(bytes.toString("ascii",8,12),"WEBP");
  assert.equal((await db.prepare("SELECT image_key FROM characters WHERE id=?").bind(character.id).first()).image_key,`characters/${character.id}.png`);
});
