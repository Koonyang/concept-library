import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(8767,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||""))||m.text().startsWith("ACQ"))errs.push(m.text());});
await p.goto("http://127.0.0.1:8767/?multi=0"); /* 1:1 접대 흐름(choosePage/answer)을 몰아서 검사 — 다대다는 multibattle.test.mjs */ await p.waitForFunction(()=>window.__studyGame);
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};

// 1. every page/key page has >=1 obtainable source
const audit=await p.evaluate(()=>{const a=__studyGame.acq,d=__studyGame.data,E=__studyGame.engine;
  const rows=[];
  Object.values(E.PAGE_BY).forEach(pg=>{ if(!pg.starter) rows.push({id:pg.id,src:a.sourcesOf("page",pg.id)}); });
  d.KEY_PAGES.forEach(k=>{ if(k.id!=="novice") rows.push({id:k.id,src:a.sourcesOf("key",k.id)}); });
  return {audit:a.acqAudit(),rows};});
ok(audit.audit.ok,"acqAudit: no orphan page/key page",audit.audit);
ok(audit.rows.every(r=>r.src.length>0),"every non-starter page & key page has a source guest",audit.rows.map(r=>r.id+"<-"+r.src.join("+")));
// negative: an orphan is detected
const neg=await p.evaluate(()=>{const a=__studyGame.acq;const saved=a.BOOK_POOLS["metacognition"].slice();a.BOOK_POOLS["metacognition"].splice(0,9);const r=a.acqAudit();a.BOOK_POOLS["metacognition"].push(...saved);return r;});
ok(!neg.ok&&neg.orphans.includes("page:night-study"),"acqAudit detects a page whose source was removed",neg.orphans);

// 2. completion simulation per guest (fresh save), seeded rng
const sim=await p.evaluate(()=>{const a=__studyGame.acq;
  function mulberry(x){return()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const out={};
  for(const gid of Object.keys(a.BOOK_POOLS)){ const arr=[];
    for(let k=0;k<2000;k++){ const rng=mulberry(k*7+1); const s=a.defaultSave(); a.addBooks(s,gid,9999); let n=0; while(n<200){ const r=a.burnBookOnce(s,gid,rng); if(!r.ok) break; n++; }
      arr.push(n); }
    const first=[];for(let k=0;k<2000;k++){const rng=mulberry(k*13+3);const s=a.defaultSave();a.addBooks(s,gid,9999);let n=0;while(n<200&&!a.poolEntries(s,gid).every(e=>e.count>0)){a.burnBookOnce(s,gid,rng);n++;}first.push(n);}first.sort((x,y)=>x-y);
    arr.sort((x,y)=>x-y); out[gid]={min:arr[0],avg:+(arr.reduce((x,y)=>x+y,0)/arr.length).toFixed(2),p90:arr[Math.floor(arr.length*.9)],max:arr[arr.length-1],entries:a.BOOK_POOLS[gid].length,firstAll:{avg:+(first.reduce((x,y)=>x+y,0)/first.length).toFixed(2),p90:first[Math.floor(first.length*.9)],max:first[first.length-1]}};}
  // recall book rate
  let t=0;const rng=mulberry(5);for(let i=0;i<20000;i++)t+=a.rollRecallBooks(rng);
  out.recallAvgBooks=+(t/20000).toFixed(3);
  // first-new guarantee: steps until first duplicate-free after pity
  return out;});
console.log("burns to finish each pool (all pages x2 copies + key):",JSON.stringify(sim));
ok(Object.entries(sim).filter(([k])=>k!=="recallAvgBooks").every(([,v])=>v.max<=30),"every pool completes within 30 burns (worst case over 2000 seeds)");

// 3. migration from an old save
const mig=await p.evaluate(()=>{const a=__studyGame.acq;
  const old={...a.defaultSave(),acqV:undefined,books:{pomodoro:"read","active-recall":"burned","spaced-repetition":"shelved"},conqueredIds:["pomodoro","active-recall","spaced-repetition","metacognition"],
    unlockedPageIds:[...a.defaultSave().unlockedPageIds,"underline","heavy-tome","repeat-line"],unlockedKeyIds:["novice","reading-room"],equippedKeyId:"reading-room"};
  delete old.bookCounts;delete old.pageCounts;delete old.bookPity;delete old.acqV;
  localStorage.setItem(a.SAVE_KEY,JSON.stringify(old));
  const s=a.loadSave(); return {books:s.bookCounts,pages:Object.keys(s.pageCounts),keys:s.unlockedKeyIds,v:s.acqV,own:["underline","heavy-tome","repeat-line"].map(id=>a.ownedCount(s,id)),total:a.totalBooks(s)};});
ok(mig.v===2&&mig.total===4&&["pomodoro","active-recall","spaced-repetition","metacognition"].every(g=>mig.books[g]===1)&&mig.own.every(n=>n>=1)&&mig.keys.includes("reading-room"),"migration keeps pages/keys and grants 1 book per shelved/read/burned/conquered guest",mig);
localStorage_reset: await p.evaluate(()=>localStorage.clear());
await p.reload(); await p.waitForFunction(()=>window.__studyGame);

// 4. real battle win grants a book (first clear) and again on recall
async function winBattle(gid){
  await p.evaluate(g=>{__studyGame.setScene("lobby");__studyGame.beginReception(g);},gid);
  await p.waitForTimeout(900);
  for(let i=0;i<40;i++){
    if(await p.evaluate(()=>!!document.querySelector(".rb-card"))) return true;
    await p.evaluate(()=>{const g=__studyGame,r=g.reception; if(!r) return;
      if(r.phase==="select"){ r.g.hp=1; const E=g.engine; const id=r.handIds.find(x=>E.PAGE_BY[x].cost<=r.light&&["참격","관통","타격"].includes(E.PAGE_BY[x].dice[0].type))||r.handIds.find(x=>E.PAGE_BY[x].cost<=r.light); if(id) g.choosePage(id); }
      else if(r.phase==="question"){ const {q}=g.currentQuestion(); if(q.type==="short") g.answerShort(q.answer); else g.answer(q.correctIndex); }});
    await p.waitForTimeout(1200);
  }
  return await p.evaluate(()=>!!document.querySelector(".rb-card"));
}
const before=await p.evaluate(()=>__studyGame.acq.bookCount(__studyGame.save,"pomodoro"));
const won=await winBattle("pomodoro");
const afterFirst=await p.evaluate(()=>({n:__studyGame.acq.bookCount(__studyGame.save,"pomodoro"),txt:document.querySelector(".rb-card")?.innerText||""}));
ok(won&&afterFirst.n===before+1&&/책 획득/.test(afterFirst.txt),"first clear drops exactly 1 book + shown on result",{before,after:afterFirst.n,txt:afterFirst.txt.replace(/\n/g," ").slice(0,120)});
await p.screenshot({path:ROOT+"/shots/28-result-book-390.png"});
await p.evaluate(()=>{document.querySelector("#btn-lobby").click();});
await p.waitForTimeout(700);
const won2=await winBattle("pomodoro");
const afterRecall=await p.evaluate(()=>__studyGame.acq.bookCount(__studyGame.save,"pomodoro"));
ok(won2&&(afterRecall-afterFirst.n===1||afterRecall-afterFirst.n===2),"recall win drops 1-2 books",{gain:afterRecall-afterFirst.n});

// 5. shelf UI: pool + rates + locked source text + burn
await p.evaluate(()=>{document.querySelector("#btn-lobby")?.click();}); await p.waitForTimeout(500);
await p.evaluate(()=>__studyGame.setScene("shelf")); await p.waitForTimeout(500);
const ui=await p.evaluate(()=>({pools:document.querySelectorAll(".bk-pool").length,rows:document.querySelectorAll(".bk-row").length,rates:[...document.querySelectorAll(".bk-rate")].map(e=>e.textContent),src:[...document.querySelectorAll(".src")].map(e=>e.textContent),oldBtn:!!document.querySelector("[data-read]")}));
ok(ui.pools===0&&ui.rows===0&&!ui.oldBtn,"shelf has no per-guest pool list (carousel only)",{pools:ui.pools,rows:ui.rows,src:ui.src.slice(0,3)});
const burned=await p.evaluate(()=>{const g=__studyGame,a=g.acq;const b0=a.bookCount(g.save,"pomodoro");(__studyGame.selectBook('pomodoro'),document.querySelector('[data-burn="pomodoro"]')).click();return {b0,b1:a.bookCount(g.save,"pomodoro"),pages:g.save.unlockedPageIds.length,keys:g.save.unlockedKeyIds.length,res:document.querySelector(".bk-result")?.textContent};});
ok(burned.b1===burned.b0-1&&/소각 결과/.test(burned.res||""),"burn consumes 1 book and shows result",burned);
await p.screenshot({path:ROOT+"/shots/29-shelf-pools-390.png"});
await p.evaluate(()=>{document.querySelector(".page-scroll").scrollTop=0});
// 6. deck copies: max 2
const copies=await p.evaluate(()=>{const g=__studyGame,a=g.acq;g.giveAllPages();g.save.pageCounts={underline:2};g.setScene("deck");
  const d=g.activeDeck(g.save);d.pageIds=[];const t=g.toggleDeckPage;
  t("underline");t("underline");t("underline"); const n=d.pageIds.filter(x=>x==="underline").length; // third tap clears
  t("underline");t("underline"); const n2=d.pageIds.filter(x=>x==="underline").length;
  return {afterThree:n,afterTwoMore:n2,lim:a.deckLimit(g.save,"underline"),limStarter:a.deckLimit(g.save,"turn-page"),badge:document.querySelector('[data-page="underline"] .copies')?.textContent};});
ok(copies.afterThree===0&&copies.afterTwoMore===2&&copies.lim===2,"deck allows max 2 copies; 3rd tap clears",copies);
console.log("errors:",errs.length,errs.slice(0,4));
console.log("fails:",fails);
await b.close(); server.close(); process.exit(fails?1:0);
