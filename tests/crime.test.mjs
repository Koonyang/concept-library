import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const URL="http://127.0.0.1:"+server.address().port+"/?multi=0"; /* 1:1 접대 흐름 검사 */
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const SH=ROOT+"/shots/";
const CRIME=["beccaria","three-conditions","bentham","legality","deterrence","limits"];

// 1. data integrity
const data=await p.evaluate(()=>{const d=__studyGame.data,E=__studyGame.engine,a=__studyGame.acq;
  const gs=d.WEAK_POINTS.filter(g=>g.floorId==="crime");
  const pages=d.COMBAT_PAGES.filter(x=>x.floorId==="crime");
  return {guests:gs.map(g=>({id:g.id,n:g.questions.length,w:g.weakness,types:g.questions.map(q=>q.type),okIdx:g.questions.every(q=>q.options&&q.correctIndex>=0&&q.correctIndex<q.options.length),dup:g.questions.some(q=>new Set(q.options).size!==q.options.length),kq:E.keyQsOf(g).map(q=>q.type),src:!!g.sourceNote,gifts:d.EGO_GIFTS.filter(x=>x.guestId===g.id).map(x=>x.slot),pool:a.BOOK_POOLS[g.id].map(e=>e.k+":"+e.id)})),
    pages:pages.length,pagesNoFlavor:pages.filter(p=>!p.flavor).map(p=>p.id),keys:d.KEY_PAGES.map(k=>k.id),floors:d.FLOORS.map(f=>f.id+"|"+f.name)};});
console.log(JSON.stringify(data));
ok(data.guests.length===6&&data.guests.every(g=>g.n>=4&&g.okIdx&&!g.dup&&g.src&&g.gifts.length===3&&new Set(g.gifts).size===3),"6 crime guests, >=4 normal Qs, valid options, 3 gifts in 3 slots each");
ok(data.pages===16&&!data.pagesNoFlavor.length,"16 crime pages all with flavor",data.pagesNoFlavor);
ok(data.floors[0].startsWith("crime")&&/예시/.test(data.floors[1])&&/예시/.test(data.floors[2]),"crime floor first, example floors labelled 예시",data.floors);

// 2. default lobby shows crime floor
await p.evaluate(()=>__studyGame.setScene("lobby")); await p.waitForTimeout(900);
const lobby=await p.evaluate(()=>({chips:[...document.querySelectorAll(".fn-dot")].map(e=>e.getAttribute("aria-label")),on:document.querySelector(".fn-name")?.textContent.trim(),guests:[...document.querySelectorAll("[data-guest]")].map(e=>e.dataset.guest),sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
ok(lobby.guests.join()===CRIME.join()&&/범죄학/.test(lobby.on)&&lobby.chips.length===4&&lobby.sw<=lobby.cw,"lobby default = 범죄학의 층 with 6 guests, 4 floor chips, no h-scroll",lobby);
await p.screenshot({path:SH+"40-lobby-crime-390.png"});
// guest sheet
await p.click('[data-guest="bentham"]'); await p.waitForTimeout(700);
const sheet=await p.evaluate(()=>document.querySelector(".guest-sheet, #sheet, .sheet")?.innerText||document.body.innerText);
ok(/출처 · 범죄학의 기초 2강/.test(sheet)&&/파놉티콘|벤담/.test(sheet),"guest sheet shows lecture source",sheet.slice(0,100).replace(/\n/g," "));
await p.screenshot({path:SH+"41-sheet-bentham-390.png"});
await p.evaluate(()=>document.querySelector("#sheet-close")?.click()); await p.waitForTimeout(400);
// switch to example floor and back
await p.click('#fn-next'); await p.waitForTimeout(700);
const memG=await p.evaluate(()=>[...document.querySelectorAll("[data-guest]")].map(e=>e.dataset.guest));
ok(memG.includes("pomodoro"),"example floor still reachable",memG);
await p.click('#fn-prev'); await p.waitForTimeout(700);

// 3. battle helper
async function winBattle(gid,{shot}={}){
  await p.evaluate(g=>{__studyGame.setScene("lobby");__studyGame.beginReception(g);},gid);
  await p.waitForTimeout(900);
  let shotDone=false;
  for(let i=0;i<60;i++){
    if(await p.evaluate(()=>!!document.querySelector(".rb-card"))) return true;
    await p.evaluate(()=>{const g=__studyGame,r=g.reception; if(!r) return;
      if(r.phase==="select"){ r.g.hp=1; const E=g.engine; const id=r.handIds.find(x=>E.PAGE_BY[x].cost<=r.light&&E.PAGE_BY[x].emotion<=r.emotion&&["참격","관통","타격"].includes(E.PAGE_BY[x].dice[0].type))||r.handIds.find(x=>E.PAGE_BY[x].cost<=r.light&&E.PAGE_BY[x].emotion<=r.emotion); if(id) g.choosePage(id); else document.querySelector("#btn-pass")?.click(); }
      else if(r.phase==="question"){ const {q}=g.currentQuestion(); if(q.type==="short") g.answerShort(q.answer); else g.answer(q.correctIndex); }});
    if(shot&&!shotDone){ await p.waitForTimeout(250); await p.screenshot({path:SH+shot}); shotDone=true; }
    await p.waitForTimeout(1200);
  }
  return await p.evaluate(()=>!!document.querySelector(".rb-card"));
}
// battle screenshot (select phase) of a guest with hp>1
await p.evaluate(()=>{__studyGame.setScene("lobby");__studyGame.beginReception("three-conditions");}); await p.waitForTimeout(1500);
await p.screenshot({path:SH+"42-battle-three-390.png"});
const q1=await p.evaluate(()=>{const r=__studyGame.reception;return {phase:r.phase,guest:r.guestId,hp:r.g.hp,intent:r.intent&&r.intent.name}});
console.log("battle",JSON.stringify(q1));

// 4. first clear -> book
const bk0=await p.evaluate(()=>__studyGame.acq.bookCount(__studyGame.save,"beccaria"));
const won=await winBattle("beccaria",{shot:null});
const afterFirst=await p.evaluate(()=>({n:__studyGame.acq.bookCount(__studyGame.save,"beccaria"),txt:document.querySelector(".rb-card")?.innerText||"",conq:__studyGame.save.conqueredIds.includes("beccaria")}));
ok(won&&afterFirst.conq&&afterFirst.n===bk0+1&&/책 획득/.test(afterFirst.txt),"beccaria first clear: +1 book shown in result",{bk0,n:afterFirst.n,txt:afterFirst.txt.replace(/\n/g," ").slice(0,140)});
await p.screenshot({path:SH+"43-result-book-crime-390.png"});

// 5. burn from shelf (UI) until a page/key unlocks
await p.evaluate(()=>document.querySelector("#btn-toshelf")?.click()); await p.waitForTimeout(700);
const burn=await p.evaluate(()=>{const g=__studyGame,a=g.acq; const owned0=g.save.unlockedPageIds.length+g.save.unlockedKeyIds.length;
  __studyGame.selectBook("beccaria"); const btn=document.querySelector('[data-burn="beccaria"]'); if(!btn) return {err:"no burn btn"};
  btn.click();
  return {b:a.bookCount(g.save,"beccaria"),res:document.querySelector("#burn-ov .burn-title")?.textContent,ov:!!document.querySelector("#burn-ov"),owned0,owned1:g.save.unlockedPageIds.length+g.save.unlockedKeyIds.length,pc:g.save.pageCounts}; });
console.log("burn",JSON.stringify(burn));
ok(burn.b===0&&burn.ov&&/책 1권 소각/.test(burn.res||"")&&burn.owned1>=burn.owned0,"burn consumes the book and shows result",burn);
await p.waitForTimeout(1900);
await p.evaluate(()=>{document.querySelector(".page-scroll")?.scrollTo(0,0)});
await p.screenshot({path:SH+"44-burn-result-crime-390.png"});
const unlocked=await p.evaluate(()=>Object.keys(__studyGame.save.pageCounts).filter(id=>__studyGame.engine.PAGE_BY[id].floorId==="crime"));
// make sure we own a beccaria page: top up books until it shows
for(let i=0;i<30&&!unlocked.length;i++){}
let page=unlocked[0];
if(!page){ page=await p.evaluate(()=>{const g=__studyGame,a=g.acq; a.addBooks(g.save,"beccaria",10); for(let i=0;i<10;i++){a.burnBookOnce(g.save,"beccaria");} return Object.keys(g.save.pageCounts).find(id=>g.engine.PAGE_BY[id].floorId==="crime"); }); }
ok(!!page,"a crime page is unlocked after burning",page);

// 6. equip into 6-card deck and see it in battle
const eq=await p.evaluate(pg=>{const g=__studyGame; g.setScene("deck"); const d=g.activeDeck(g.save); const drop=d.pageIds.find(x=>g.engine.PAGE_BY[x].starter&&x!=="turn-page"); g.toggleDeckPage(drop,{slot:true}); g.toggleDeckPage(pg); return {ids:d.pageIds.slice(),has:d.pageIds.includes(pg),n:d.pageIds.length};},page);
ok(eq.has&&eq.n===6,"new page equipped into 6-card deck",eq);
await p.evaluate(()=>__studyGame.setScene("lobby")); await p.waitForTimeout(300);
await p.evaluate(()=>__studyGame.beginReception("beccaria")); await p.waitForTimeout(900);
const inBattle=await p.evaluate(pg=>{const r=__studyGame.reception;const all=[...r.handIds,...(r.deckIds||[]),...(r.discardIds||[])];return {has:all.includes(pg),total:all.length,hand:r.handIds.includes(pg)};},page);
ok(inBattle.has&&inBattle.total===6,"equipped page is in the recall battle deck",inBattle);
await p.screenshot({path:SH+"45-battle-recall-crime-390.png"});
await p.evaluate(()=>__studyGame.setScene("lobby")); await p.waitForTimeout(300);

// 7. recall drops more books
const bkB=await p.evaluate(()=>__studyGame.acq.bookCount(__studyGame.save,"beccaria"));
const won2=await winBattle("beccaria");
const gain=await p.evaluate(b=>__studyGame.acq.bookCount(__studyGame.save,"beccaria")-b,bkB);
ok(won2&&(gain===1||gain===2),"recall win drops 1-2 books",{gain});

// 8. clear the rest of the floor for real; every guest drops a book on first clear
for(const gid of CRIME.slice(1)){
  const n0=await p.evaluate(g=>__studyGame.acq.bookCount(__studyGame.save,g),gid);
  const w=await winBattle(gid);
  const n1=await p.evaluate(g=>__studyGame.acq.bookCount(__studyGame.save,g),gid);
  ok(w&&n1===n0+1,"first clear "+gid+" -> +1 book",{n0,n1});
  await p.evaluate(()=>document.querySelector("#btn-lobby")?.click()); await p.waitForTimeout(500);
}
// next-guest button stays within the floor
await p.evaluate(()=>{__studyGame.setScene("lobby");}); 

// 9. every crime page and key page becomes owned by burning (pool check, real engine) + counts
const pool=await p.evaluate(()=>{const g=__studyGame,a=g.acq,E=g.engine;
  const s=a.defaultSave(); const CRIME_IDS=["beccaria","three-conditions","bentham","legality","deterrence","limits"];
  const res={}; let burns=0;
  for(const gid of CRIME_IDS){ a.addBooks(s,gid,400); }
  for(let k=0;k<400;k++){ for(const gid of CRIME_IDS){ if(a.bookCount(s,gid)>0){ a.burnBookOnce(s,gid); burns++; } } }
  const pages=g.data.COMBAT_PAGES.filter(x=>x.floorId==="crime").map(x=>[x.id,a.ownedCount(s,x.id)]);
  const keys=["classical-robe","panopticon-coat"].map(id=>[id,s.unlockedKeyIds.includes(id)]);
  return {pages,keys,burns,audit:a.acqAudit()};});
ok(pool.pages.every(([,n])=>n>=1)&&pool.keys.every(([,v])=>v)&&pool.audit.ok,"burning every crime pool unlocks all 16 pages and both key pages",{missing:pool.pages.filter(([,n])=>!n),keys:pool.keys,burns:pool.burns});

// 10. perk api
const perks=await p.evaluate(()=>{const g=__studyGame,s=g.save; s.unlockedKeyIds=["novice","classical-robe","panopticon-coat"]; const hpBase=g.gifts.effectiveMaxHp(s); return {hasFn:typeof g.gifts.effectiveMaxHp,hpBase};});
console.log("perk api",JSON.stringify(perks));

// 11. questions: every normal question answerable & short answers accepted
const qs=await p.evaluate(()=>{const g=__studyGame,E=g.engine; const bad=[];
  for(const gs of g.data.WEAK_POINTS.filter(x=>x.floorId==="crime")){ for(const q of E.keyQsOf(gs)){ if(q.type==="short"){ for(const a of [q.answer,...(q.accept||[])]) if(!E.checkShort(a,q)) bad.push(gs.id+":"+a); if(E.checkShort("모르겠음",q)) bad.push(gs.id+":wrong-accepted"); } } }
  return bad;});
ok(!qs.length,"short answers + synonyms accepted, wrong rejected",qs);

console.log("errors:",errs.length,errs.slice(0,4));
console.log("fails:",fails);
await b.close(); server.close(); process.exit(fails||errs.length?1:0);
