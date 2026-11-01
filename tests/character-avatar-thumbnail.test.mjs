import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("admin avatars use thumbnails, game avatars keep originals, and built-ins retain static sprites", async(t)=>{
  const root=fileURLToPath(new URL("../",import.meta.url));
  await mkdir(join(root,".wrangler"),{recursive:true});
  const dir=await mkdtemp(join(root,".wrangler/thumb-avatar-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const result=await build({stdin:{contents:"export {CharacterAvatar} from './app/components/ui/molecules/CharacterAvatar.jsx'; export {AdminCharacterImages} from './app/components/ui/molecules/CharacterImageContext.jsx';",resolveDir:root},bundle:true,write:false,format:"esm",platform:"node",packages:"external",jsx:"automatic"});
  const file=join(dir,"avatar.mjs");await writeFile(file,result.outputFiles[0].text);
  const {CharacterAvatar,AdminCharacterImages}=await import(pathToFileURL(file).href);
  const character={id:"gen-test",generated:true,imageUrl:"/api/characters/gen-test/image",name:"Test"};
  const avatar=()=>h(CharacterAvatar,{character});
  assert.match(renderToStaticMarkup(h(AdminCharacterImages,null,avatar())),/src="\/api\/characters\/gen-test\/thumbnail\/v1"/);
  assert.match(renderToStaticMarkup(avatar()),/src="\/api\/characters\/gen-test\/image"/);
  assert.match(renderToStaticMarkup(h(AdminCharacterImages,null,h(CharacterAvatar,{id:"konkon"}))),/\/characters\/.+\/runner.png/);
});
