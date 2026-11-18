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
for(const [w,h] of [[844,390],[667,375],[390,844]]){
const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
await p.evaluate(()=>{ const G=__studyGame,s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
await p.waitForTimeout(1200); await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(700);
const n=await p.$$eval("#hand .cc",e=>e.length);
await p.tap(".bs-unit.enemy .bs-die"); await p.waitForTimeout(250);
const info=await p.evaluate(()=>{const e=document.querySelector(".bs-info"); if(!e) return null; const r=e.getBoundingClientRect(); return {t:e.innerText.replace(/\n/g," / "),in:r.left>=0&&r.right<=innerWidth&&r.top>=0}});
await p.screenshot({path:`shots/fanhand-${w}.png`});
// 카드 고르고 적에게
const c=await p.$("#hand .cc:not(.off)"); const box=await c.boundingBox(); await p.touchscreen.tap(box.x+box.width/2,box.y+box.height*.6); await p.waitForTimeout(250);
const pk=await p.evaluate(()=>BattleStage._state().pickCard);
await p.tap(".bs-unit.enemy .bs-die"); await p.waitForTimeout(300);
const asg=await p.evaluate(()=>__studyGame.battleApi.mb.battle.units.filter(u=>u.side==="ally").map(u=>u.dice.map(d=>d.card?1:0).join("")).join("|"));
// 손패가 캐릭터(무대 뒷면)를 가리는 것은 설계. 카드가 화면 안에 있고, 고른 카드는 한 장만 올라가게.
const ov=await p.evaluate(()=>{
  const cs=[...document.querySelectorAll("#hand .cc")];
  if(!cs.length) return "nohand";
  const off=cs.filter(c=>{ const r=c.getBoundingClientRect(); return r.bottom>innerHeight+2||r.left<-2||r.right>innerWidth+2; }).length;
  const picks=cs.filter(c=>c.classList.contains("pick")).length;
  return off?("offscreen "+off):picks>1?("multi-pick "+picks):0;
});
let bad=[]; if(n<1) bad.push("no fan cards"); if(!info||!info.in||!/속도/.test(info.t)) bad.push("die info"); if(!pk) bad.push("pick"); if(!/1/.test(asg)) bad.push("assign"); if(ov!==0) bad.push("hand "+ov); if(errs.length) bad.push(errs.join()); console.log(bad.length?"FAIL":"PASS",w,h,info&&info.t,bad.join("; ")); if(bad.length) process.exitCode=1;
await p.screenshot({path:`shots/fanhand2-${w}.png`});
}
await b.close(); server.close();
