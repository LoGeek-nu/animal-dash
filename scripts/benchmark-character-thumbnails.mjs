// Optional browser tooling stays outside application dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import fs from 'node:fs/promises';
import path from 'node:path';
const base = new URL(process.argv[2] ?? 'https://animaldash-develop.logeek.tech').origin;
const output = path.resolve(process.argv[3] ?? 'outputs/thumbnail-display-benchmark.json');
if (!base.startsWith('https://')) throw new Error('HTTPS origin required');
const catalog=await fetch(base+'/api/characters?query='+encodeURIComponent('写真テスト')+'&limit=12');
if (!catalog.ok) throw new Error('Catalog unavailable');
const images=(await catalog.json()).characters;
if (images.length !== 12 || images.some(c => !c.generated)) throw new Error('Expected twelve photo fixtures');
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.goto(base+'/health');
 const samples=[];const startedAt=new Date().toISOString();
 for(let round=-1;round<10;round++){
  for(const mode of round%2===0?['original','thumbnail']:['thumbnail','original']){
   const urls=images.map(c=>base+(mode==='original'?c.imageUrl:`/api/characters/${encodeURIComponent(c.id)}/thumbnail/v1`)+`?thumbnail-benchmark=${mode}-${round}`);
   const result=await page.evaluate(async({urls,mode})=>{
    document.body.innerHTML='';performance.clearResourceTimings();
    const start=performance.now();
    const rows=await Promise.all(urls.map(async url=>{
      const img=new Image();img.style.width='96px';img.style.height='128px';img.style.objectFit='contain';
      const began=performance.now();img.src=url;document.body.append(img);await img.decode();
      const resource=performance.getEntriesByName(url).at(-1);
      return {url,displayMs:performance.now()-began,width:img.naturalWidth,height:img.naturalHeight,ttfbMs:resource.responseStart-resource.requestStart,downloadMs:resource.responseEnd-resource.startTime,transferSize:resource.transferSize,encodedBodySize:resource.encodedBodySize,protocol:resource.nextHopProtocol,status:resource.responseStatus};
    }));
    return {mode,batchDisplayMs:performance.now()-start,rows};
   },{urls,mode});
   if(result.rows.some(r=>r.transferSize<=0||r.status!==200))throw new Error('Cache/error in browser measurement');
   samples.push({round,...result});
  }
  console.log('Measured round',round);
 }
 const percentile=(v,p)=>[...v].sort((a,b)=>a-b)[Math.ceil(p*v.length)-1];
 const median=v=>{v=[...v].sort((a,b)=>a-b);return(v[Math.floor((v.length-1)/2)]+v[Math.ceil((v.length-1)/2)])/2;};
 const stats=mode=>{const batches=samples.filter(s=>s.mode===mode&&s.round>=0),rows=batches.flatMap(b=>b.rows);return{batches:batches.length,images:rows.length,medianBatchDisplayMs:median(batches.map(b=>b.batchDisplayMs)),p95BatchDisplayMs:percentile(batches.map(b=>b.batchDisplayMs),.95),medianImageDisplayMs:median(rows.map(r=>r.displayMs)),p95ImageDisplayMs:percentile(rows.map(r=>r.displayMs),.95),medianDownloadMs:median(rows.map(r=>r.downloadMs)),medianTtfbMs:median(rows.map(r=>r.ttfbMs)),totalEncodedBytes:rows.reduce((s,r)=>s+r.encodedBodySize,0),protocols:[...new Set(rows.map(r=>r.protocol))]};};
 const original=stats('original'),thumbnail=stats('thumbnail');
 const report={origin:base,startedAt,finishedAt:new Date().toISOString(),browser:browser.version(),method:'Chrome, 12 images in parallel, wait for img.decode, HTTP cache disabled via CDP, unique query per round to avoid decoded-image reuse, no throttling, same origin and browser context after warmup, alternating AB/BA, first batch per mode excluded',original,thumbnail,improvementPercent:{batchDisplay:(1-thumbnail.medianBatchDisplayMs/original.medianBatchDisplayMs)*100,imageDisplay:(1-thumbnail.medianImageDisplayMs/original.medianImageDisplayMs)*100,bytes:(1-thumbnail.totalEncodedBytes/original.totalEncodedBytes)*100},samples};
 await fs.mkdir(path.dirname(output), { recursive: true });
 await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,samples:undefined},null,2));
 await context.close();
}finally{await browser.close();}
