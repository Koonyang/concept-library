import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".svg":"image/svg+xml",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
for(const [W,H] of [[360,740],[390,844]]){
  const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true,isMobile:true});
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
  await p.goto("http://127.0.0.1:"+server.address().port+"/"); await p.waitForFunction(()=>window.__studyGame);
  await p.evaluate(()=>{ const s=__studyGame.save; COMBAT_PAGES.forEach(pg=>{ s.pageCounts={...s.pageCounts,[pg.id]:2}; if(!s.unlockedPageIds.includes(pg.id)) s.unlockedPageIds.push(pg.id); });
    const ids=COMBAT_PAGES.map(x=>x.id).slice(0,11); __studyGame.setDeckPages(ids); __studyGame.setScene("lobby"); openDeckEditor({to:"shelf"}); });
  await p.waitForTimeout(800);
  for(const where of ["middle","bottom"]){
    await p.evaluate(w=>{const sc=document.querySelector("#scene-deck .page-scroll"); const max=sc.scrollHeight-sc.clientHeight; sc.scrollTop=w==="middle"?max*0.5:max;},where);
    await p.waitForTimeout(400);
    let worst=0, taps=0, adds=0, removes=0;
    for(let i=0;i<10;i++){
      const pick=await p.evaluate(r=>{const sc=document.querySelector("#scene-deck .page-scroll").getBoundingClientRect(); const nav={top:innerHeight};
        const c=[...document.querySelectorAll("#deck-pool .dpage")].filter(e=>{const x=e.getBoundingClientRect();return x.top>sc.top+60&&x.bottom<nav.top-4}); if(!c.length) return null; const e=c[Math.floor(r*c.length)]; return {id:e.dataset.page,top:e.getBoundingClientRect().top,n:__studyGame.save.decks.find(d=>d.id===__studyGame.save.activeDeckId).pageIds.length}},rnd());
      if(!pick) continue;
      await p.tap(`#deck-pool [data-page="${pick.id}"]`); await p.waitForTimeout(220);
      const after=await p.evaluate(id=>{const e=document.querySelector(`#deck-pool [data-page="${id}"]`); return {top:e&&e.getBoundingClientRect().top,n:__studyGame.save.decks.find(d=>d.id===__studyGame.save.activeDeckId).pageIds.length}},pick.id);
      taps++; if(after.n>pick.n) adds++; else if(after.n<pick.n) removes++;
      worst=Math.max(worst,Math.abs(after.top-pick.top));
    }
    ok(taps>=8&&worst<=2&&adds>0,`${W}x${H} ${where}: ${taps} random taps (${adds} add / ${removes} remove) keep the tapped card within ${worst.toFixed(1)}px`,{taps,adds,removes,worst});
  }
  ok(errs.length===0,`${W} no console errors`,errs);
  await ctx.close();
}
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
