import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(+(process.env.PORT||0),"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
for(const [w,h] of [[844,390],[390,844]]){
const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
await p.evaluate(()=>{ const G=__studyGame,s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
await p.waitForTimeout(1200); await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(700);
const c=await p.$("#hand .cc:not(.off)"); const box=await c.boundingBox(); await p.touchscreen.tap(box.x+box.width/2,box.y+box.height*.6); await p.waitForTimeout(250);
await p.tap(".bs-unit.enemy .bs-die"); await p.waitForTimeout(500);
const before=await p.$$eval(".bs-svg path",e=>e.length);
await p.evaluate(()=>__studyGame.showWin()); await p.waitForTimeout(300);
await p.evaluate(()=>{ BattleStage.redraw(); dispatchEvent(new Event("resize")); }); await p.waitForTimeout(500);
const after=await p.evaluate(()=>[...document.querySelectorAll(".bs-svg path")].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&getComputedStyle(e.closest("svg")).display!=="none";}).length);
await p.screenshot({path:`shots/resultarrows-${w}.png`});
const gifts=await p.evaluate(()=>{ const text=document.querySelector(".rb-card")?.innerText||"";
  const labs=[...document.querySelectorAll(".rb-gift:not(.book):not(.rb-nogift) .rb-gift-lab")].map(e=>e.innerText);
  const none=[...document.querySelectorAll(".rb-nogift")].map(e=>e.innerText.trim());
  return {labs,none,empty:/기프트 없음/.test(text)||/이번에는 떨어지지 않았다/.test(text),lv:/Lv\.\s*\d/.test(text)}; });
const bad=[]; if(before<1) bad.push("no arrows before"); if(after) bad.push("arrows left "+after);
if(gifts.empty) bad.push("empty gift rows"); if(gifts.lv) bad.push("level text");
if(!gifts.labs.length){ if(gifts.none.length!==1||gifts.none[0]!=="이번엔 기프트가 떨어지지 않았다") bad.push("no-gift line "+JSON.stringify(gifts)); }
else if(!gifts.labs.every(t=>/ · /.test(t))||gifts.none.length) bad.push("gift rows "+JSON.stringify(gifts));
if(errs.length) bad.push(errs.join());
console.log(bad.length?"FAIL":"PASS",w,h,before,after,gifts.labs.join(" / "),bad.join("; ")); if(bad.length) process.exitCode=1;
}
await b.close(); server.close();
