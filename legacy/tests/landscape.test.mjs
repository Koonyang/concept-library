import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const URL="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
const wait=ms=>p.waitForTimeout(ms);
const rotate=async(w,h)=>{ await p.setViewportSize({width:w,height:h}); await wait(450); };
const handInfo=()=>p.evaluate(()=>{ const cs=[...document.querySelectorAll("#hand .cc[data-card]")].map(c=>c.getBoundingClientRect()); return {n:cs.length,minL:Math.min(...cs.map(r=>r.left)),maxR:Math.max(...cs.map(r=>r.right)),maxB:Math.max(...cs.map(r=>r.bottom)),W:innerWidth,H:innerHeight}; });
/* 다대다 접대(기본): 막마다 문제 1개 → 배치 단계에서 양피지 손패(#hand .cc[data-card]) */
const snap=()=>p.evaluate(()=>{const B=__studyGame.battle, A=__studyGame.battleApi; return B&&{scene:B.scene,phase:B.phase,hp:B.units.map(u=>u.hp).join(),hand:A.hand("a1").join(),light:B.units[0].light,q:B.question.id};});
// ---- battle: start portrait, question in landscape, rotate mid-question, wrong answer, then 9-card hand
await p.evaluate(async()=>{ const g=__studyGame; g.setScene("lobby"); g.beginReception(document.querySelector("[data-guest]").dataset.guest); });
await wait(900);
await rotate(844,390);
await p.waitForFunction(()=>__studyGame.battle&&__studyGame.battle.phase==="question"&&document.querySelector(".qpanel.on"),null,{timeout:5000}).catch(()=>{});
await wait(300);
const q=await p.evaluate(()=>{ const qp=document.querySelector(".qpanel.on"); if(!qp) return null; const r=qp.getBoundingClientRect(); return {sh:qp.scrollHeight,ch:qp.clientHeight,top:r.top,bottom:r.bottom,H:innerHeight,short:qp.classList.contains("short"),opts:[...qp.querySelectorAll("[data-opt]")].map(b=>{const o=b.getBoundingClientRect();return [Math.round(o.left),Math.round(o.top)]})}; });
ok(q&&(q.short||q.sh<=q.ch+2)&&q.top>=0&&q.bottom<=q.H,"quiz panel fits the landscape screen without scrolling",q);
if(q&&!q.short) ok(new Set(q.opts.map(o=>o[1])).size<q.opts.length,"options are laid out in 2 columns",q.opts);
await p.screenshot({path:ROOT+"/shots/land-quiz-844.png"});
// rotate mid-question → portrait and back; question still there
await rotate(390,844); const sp=await snap(); await rotate(844,390); const sl=await snap();
ok(sp.phase==="question"&&sl.phase==="question"&&JSON.stringify(sp)===JSON.stringify(sl)&&await p.evaluate(()=>!!document.querySelector(".qpanel.on")),"rotating mid-question keeps the question",{sp,sl});
// wrong answer effect in landscape
const fx=await p.evaluate(async()=>{ __studyGame.battleApi.answerUI(false);
  await new Promise(r=>setTimeout(r,170)); return {book:!!document.querySelector(".wrong-book"),vig:!!document.querySelector(".wrong-vig"),shake:!!document.querySelector(".wrong-shake"),phase:__studyGame.battle.phase}; });
await p.screenshot({path:ROOT+"/shots/land-wrong-844.png"});
ok(fx.book&&fx.vig&&fx.phase==="assign","wrong-answer bonk effect plays in landscape, then 배치",fx);
await wait(2600);
// 9-card hand of the selected librarian: set in portrait, rotate to landscape
await rotate(390,844);
await p.evaluate(()=>{ const g=__studyGame,A=g.battleApi,u=g.battle.units[0],X=A.internals()[u.id]; X.handIds.splice(0,X.handIds.length,...g.engine.COMBAT_PAGES.slice(0,9).map(x=>x.id)); u.light=6; u.maxLight=6; u.emotion=4; g.renderBattle(); });
await wait(400);
const s0=await snap();
await rotate(844,390);
const s1=await snap(); const h1=await handInfo();
ok(JSON.stringify(s0)===JSON.stringify(s1),"rotating mid-battle keeps reception state",{s0,s1});
/* 다대다 손패: 바깥 카드 아랫모서리도 화면 안에 (허용 0~2px) */
ok(h1.n===9&&h1.minL>=0&&h1.maxR<=h1.W&&h1.maxB<=h1.H+2,"9-card hand fits the landscape screen after rotation",h1);
await p.screenshot({path:ROOT+"/shots/land-battle-hand9-844.png"});
// hot card (touch scrub) still works in landscape
const hot=await p.evaluate(()=>{ const c=document.querySelectorAll("#hand .cc")[4], r=c.getBoundingClientRect(); const ev=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:7,pointerType:"touch",clientX:x,clientY:y,isPrimary:true}));
  ev("pointerdown",r.left+r.width/2,r.top+20); return new Promise(res=>setTimeout(()=>{ const h=document.querySelector("#hand .cc.hot"); const hr=h&&h.getBoundingClientRect(); ev("pointercancel",0,0); window.dispatchEvent(new PointerEvent("pointercancel",{pointerId:7})); res(h?{top:Math.round(hr.top),bottom:Math.round(hr.bottom),H:innerHeight}:null); },450)); });
ok(hot&&hot.top>=0,"long-press lifts a readable hot card inside the screen",hot);
await p.evaluate(()=>{ closeCardInspect(); __studyGame.renderBattle(); }); await wait(300);
// ---- library: gifts grid scroll keep + rotation
await p.evaluate(()=>{ const g=__studyGame,d=g.data; g.setGifts(d.EGO_GIFTS.map(x=>x.id),{}); g.setShelfTab("gifts"); g.setScene("shelf"); });
await wait(600);
const gi=await p.evaluate(()=>{const w=document.querySelector(".dress-gridwrap"); w.scrollTop=w.clientHeight-12+8; return {max:w.scrollHeight-w.clientHeight,tiles:document.querySelectorAll(".dtile").length};});
await wait(400);
const t0=await p.evaluate(()=>Math.round(document.querySelector(".dress-gridwrap").scrollTop));
const id=await p.evaluate(()=>{const w=document.querySelector(".dress-gridwrap").getBoundingClientRect(); const t=[...document.querySelectorAll(".dtile")].find(t=>{const r=t.getBoundingClientRect();return t.dataset.locked==="0"&&!t.classList.contains("eq")&&r.top>=w.top&&r.bottom<=w.bottom;}); return t&&t.dataset.t;});
await p.tap(`[data-t="${id}"]`); await wait(450); await p.click("#dd-equip"); await wait(700);
const t1=await p.evaluate(()=>Math.round(document.querySelector(".dress-gridwrap").scrollTop));
ok(gi.max>40&&t0>40&&Math.abs(t1-t0)<=2,"landscape gift grid: 6-per-view scroll + equip keeps scroll",{gi,t0,t1});
const vis6=await p.evaluate(()=>{const w=document.querySelector(".dress-gridwrap").getBoundingClientRect(); return [...document.querySelectorAll(".dtile")].filter(t=>{const r=t.getBoundingClientRect();return r.top>=w.top-1&&r.bottom<=w.bottom+1;}).length;});
ok(vis6===6,"exactly 6 gift tiles per view in landscape",vis6);
await rotate(390,844); await rotate(844,390);
ok(await p.evaluate(()=>!!document.querySelector("#scene-shelf.on .dress-gridwrap")),"library survives rotation");
// 장서복 + deck screenshots
await p.evaluate(()=>{ const g=__studyGame; g.save.unlockedKeyIds=["novice","reading-room","midnight"]; g.save.equippedKeyId="reading-room"; g.setShelfTab("outfit"); g.setScene("shelf"); }); await wait(3200);
await p.screenshot({path:ROOT+"/shots/land-outfit-844.png"});
await p.evaluate(()=>{ const g=__studyGame; g.setShelfTab("deck"); g.setScene("shelf"); }); await wait(600);
await p.screenshot({path:ROOT+"/shots/land-libdeck-844.png"});
await p.evaluate(()=>{ const g=__studyGame; g.giveAllPages(); g.setDeckPages(g.engine.COMBAT_PAGES.slice(0,12).map(x=>x.id)); g.setScene("deck"); }); await p.mouse.move(2,2); await wait(700); await p.evaluate(()=>closeCardInspect()); await wait(150);
await p.screenshot({path:ROOT+"/shots/land-deck-844.png"});
const cols=await p.evaluate(()=>{const c=[...document.querySelectorAll("#deck-pool .dpage")].slice(0,8).map(e=>Math.round(e.getBoundingClientRect().top)); return c.filter(t=>t===c[0]).length;});
ok(cols>=4,"deck editor uses a wider grid in landscape (>=4 per row)",cols);
await p.evaluate(()=>{ const g=__studyGame; g.setScene("lobby"); }); await wait(700);
await p.screenshot({path:ROOT+"/shots/land-lobby-844.png"});
const rail=await p.evaluate(()=>{const n=document.querySelector("#scene-lobby .botnav").getBoundingClientRect(); return {w:Math.round(n.width),h:Math.round(n.height),left:Math.round(n.left)};});
const bm=await p.evaluate(()=>{const r=document.querySelector("#scene-lobby .bm-btn").getBoundingClientRect(); return {l:Math.round(r.left),t:Math.round(r.top)};});
ok(rail.left<0&&bm.l<60&&bm.t<=1,"landscape: no left rail, drawer hidden until the top-left bookmark is tapped",{rail,bm});
await p.tap("#scene-lobby .bm-btn"); await wait(350);
const opened=await p.evaluate(()=>{const n=document.querySelector("#scene-lobby .botnav").getBoundingClientRect(); return {left:Math.round(n.left),w:Math.round(n.width)};});
ok(opened.left===0&&opened.w<=240,"bookmark opens the drawer from the left",opened);
await p.tap('#scene-lobby .botnav [data-go="lobby"]'); await wait(700);
await rotate(390,844);
const bot=await p.evaluate(()=>{const n=document.querySelector("#scene-lobby .botnav").getBoundingClientRect(); return {top:Math.round(n.top),h:Math.round(n.height),H:innerHeight};});
const bm2=await p.evaluate(()=>{const r=document.querySelector("#scene-lobby .bm-btn").getBoundingClientRect(); const n=document.querySelector("#scene-lobby .botnav"); return {l:Math.round(r.left),t:Math.round(r.top),hidden:getComputedStyle(n).visibility==="hidden"};});
ok(bm2.l<60&&bm2.t<=1&&bm2.hidden,"portrait uses the same bookmark drawer (no bottom nav)",{bot,bm2});
ok(errs.length===0,"no console errors",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
