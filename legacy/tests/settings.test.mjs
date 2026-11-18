import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const hidden=()=>({away:document.getElementById("game")?.classList.contains("set-away"), cls:document.querySelector("#set-bm")?.classList.contains("away"),
  pe:getComputedStyle(document.querySelector("#set-bm")).pointerEvents, op:getComputedStyle(document.querySelector("#set-bm")).opacity,
  bottom:document.querySelector("#set-bm").getBoundingClientRect().bottom});
const isHidden=s=>!!(s.away||s.cls||s.pe==="none"||+s.op===0||s.bottom<=2);
for(const [w,h] of [[844,390],[390,844]]){
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame); await p.waitForTimeout(400);
  await p.evaluate(()=>__studyGame.setScene("lobby")); await p.waitForTimeout(400);
  const bad=[];
  const vis=await p.evaluate(()=>{const e=document.querySelector("#set-bm"),r=e.getBoundingClientRect(); return {r:[r.left,r.top,r.right,r.bottom], dr:getComputedStyle(document.querySelector("#set-drawer")).visibility, pe:getComputedStyle(e).pointerEvents, op:getComputedStyle(e).opacity, away:document.getElementById("game").classList.contains("set-away")};});
  if(vis.away||vis.pe==="none"||+vis.op===0||vis.r[2]>w||vis.r[1]>2||vis.r[3]<=0) bad.push("bm hidden or bad pos on lobby "+JSON.stringify(vis));
  if(vis.dr!=="hidden") bad.push("drawer visible at start");
  await p.tap("#set-bm"); await p.waitForTimeout(400);
  await p.screenshot({path:`shots/settings-${w}.png`});
  const st=await p.evaluate(()=>({open:document.querySelector("#set-drawer").classList.contains("open"),t:document.querySelector("#set-drawer").innerText.replace(/\n/g," ")}));
  if(!st.open||!/배경음악/.test(st.t)||!/효과음/.test(st.t)) bad.push("drawer "+JSON.stringify(st));
  const before=await p.evaluate(()=>__studyGame.SFX.sfxMuted); await p.tap("#btn-sfx"); await p.waitForTimeout(200);
  const after=await p.evaluate(()=>__studyGame.SFX.sfxMuted); if(before===after) bad.push("sfx toggle");
  await p.tap("#set-scrim",{position:{x:20,y:h/2}}); await p.waitForTimeout(400);
  if(await p.evaluate(()=>document.querySelector("#set-drawer").classList.contains("open"))) bad.push("scrim close");

  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>__studyGame.battleApi.begin("beccaria")); await p.waitForTimeout(1200);
  const qh=await p.evaluate(hidden);
  if(!isHidden(qh)) bad.push("bm visible on question "+JSON.stringify(qh));
  await p.screenshot({path:`shots/settings-question-${w}.png`});
  await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(700);
  const bh=await p.evaluate(hidden);
  if(!isHidden(bh)) bad.push("bm visible on battle/assign "+JSON.stringify(bh));
  if(await p.evaluate(()=>document.querySelector("#set-drawer").classList.contains("open"))) bad.push("drawer open on battle");
  await p.screenshot({path:`shots/settings-battle-${w}.png`});
  await p.evaluate(()=>__studyGame.showWin()); await p.waitForTimeout(500);
  const rh=await p.evaluate(hidden);
  if(!isHidden(rh)) bad.push("bm visible on result "+JSON.stringify(rh));
  await p.screenshot({path:`shots/settings-result-${w}.png`});
  if(errs.length) bad.push(errs.join());
  console.log(bad.length?"FAIL":"PASS",w,h,bad.join("; ")); if(bad.length) process.exitCode=1;
  await p.context().close();
}
await b.close(); server.close();
