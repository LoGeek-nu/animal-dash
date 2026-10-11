import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const modeFile = new URL('../../.wrangler/ui-test/mode.txt', import.meta.url);
mkdirSync(new URL('../../.wrangler/ui-test', import.meta.url), { recursive: true });
if (!existsSync(modeFile)) writeFileSync(modeFile, 'retry');
const png = readFileSync(new URL('../../public/characters/keroppin/runner.png', import.meta.url));
http.createServer(async (request, response) => {
  for await (const chunk of request) { void chunk; }
  let mode = readFileSync(modeFile, 'utf8').trim();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  response.setHeader('Content-Type', 'application/json');
  if (mode === 'retry') {
    writeFileSync(modeFile, 'success');
    response.writeHead(503);
    response.end(JSON.stringify({error:'fixture_busy', detail:'テスト用：生成が混み合っています。もう一度試してください。', retryable:true}));
  } else if (mode === 'invalid') {
    response.writeHead(422);
    response.end(JSON.stringify({error:'fixture_invalid', detail:'テスト用：動物の絵を選んでください。', retryable:false}));
  } else {
    response.end(JSON.stringify({status:{title:'テストけろ',animal_type:'カエル',personality:'元気',stats:{speed:6,jump:7,power:7}},image_base64:png.toString('base64')}));
  }
}).listen(39002,'127.0.0.1',()=>console.log('Local generation fixture listening on 39002'));
