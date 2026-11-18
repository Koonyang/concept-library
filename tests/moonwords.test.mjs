// 달의 계시: 실제 단어 파일({id,en,ko,pos})의 단어가 화면에 실제로 나오는지 (빈 화면 회귀 방지)
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".mp3":"audio/mpeg",".json":"application/json"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const URL="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const errs=[];
for(const [w,h] of [[844,390],[390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
  const data=await p.evaluate(()=>{const a=window.MOON_WORDS; return {real:Array.isArray(a), n:a?a.length:0, enko:a?a.filter(x=>x&&x.en&&x.ko).length:0};});
  ok(data.real&&data.n>=3000&&data.enko===data.n,`실제 단어 파일이 {en,ko} 형식으로 3,000개 ${w}x${h}`,data);
  ok(await p.evaluate(()=>__studyGame.moon.words().length)>=3000,`words()가 실제 단어를 하나도 버리지 않음 ${w}x${h}`);
  await p.evaluate(()=>{const g=__studyGame; g.moon.setNow(()=>new Date("2026-11-18T03:00:00+09:00")); g.save.moon=null; g.save.moonChunk=0; g.setScene("lobby");}); await p.waitForTimeout(500);
  await p.tap('#scene-lobby .bm-btn'); await p.waitForTimeout(350);
  await p.tap('#scene-lobby .botnav [data-go="moon"]'); await p.waitForTimeout(700);
  await p.tap("#moon-start"); await p.waitForTimeout(300);
  const shown=await p.evaluate(()=>{
    const prompt=(document.querySelector("#moon-qcard .moon-prompt")||{}).textContent||"";
    const opts=[...document.querySelectorAll("[data-mopt]")].map(e=>e.textContent.trim().replace(/^\d+\s*/,""));
    const W=window.MOON_WORDS, en=new Set(W.map(x=>x.en)), ko=new Set(W.map(x=>x.ko));
    const r=document.querySelector("#moon-qcard .moon-prompt")?.getBoundingClientRect();
    return {prompt:prompt.trim(), opts, promptReal:en.has(prompt.trim())||ko.has(prompt.trim()),
      optsReal:opts.length===4&&opts.every(o=>en.has(o)||ko.has(o)), visible:!!r&&r.width>0&&r.height>0};
  });
  ok(shown.prompt.length>0&&shown.visible&&shown.promptReal,`문제 카드에 실제 단어가 보임 ${w}x${h}`,shown);
  ok(shown.optsReal,`보기 4개가 모두 실제 단어/뜻 ${w}x${h}`,shown.opts);
  await p.screenshot({path:ROOT+`/shots/moonwords-${w}.png`});
  await ctx.close();
}
ok(errs.length===0,"no errors",errs);
await b.close(); server.close();
console.log("fails:",fails); process.exit(fails?1:0);
