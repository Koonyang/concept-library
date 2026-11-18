import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
await p.goto("http://127.0.0.1:"+server.address().port+"/"); await p.waitForFunction(()=>window.__studyGame);


let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const tops=()=>p.evaluate(()=>{const w=document.querySelector(".dress-gridwrap"); const ps=document.querySelector("#scene-shelf .page-scroll"); return {grid:Math.round(w.scrollTop),page:Math.round(ps.scrollTop),pageMax:ps.scrollHeight-ps.clientHeight}});
const near=(a,b)=>Math.abs(a-b)<=2;
await p.evaluate(()=>{const g=__studyGame,d=g.data;
  // 30 owned gifts; outfits: 8 mock key pages so the outfit grid also has > 6 tiles
  g.setGifts(d.EGO_GIFTS.map(x=>x.id),{});
  for(let i=0;i<8;i++){ KEY_PAGES.push({...KEY_PAGES[0],id:"mock-"+i,name:"모의 장서복 "+i}); g.save.unlockedKeyIds.push("mock-"+i); }
  g.setScene("shelf");});
await p.waitForTimeout(500);
for(const tab of ["gifts","outfit"]){
  await p.click(`[data-stab="${tab}"]`); await p.waitForTimeout(500);
  const info=await p.evaluate(()=>{const w=document.querySelector(".dress-gridwrap"); return {tiles:document.querySelectorAll(".dtile").length,max:w.scrollHeight-w.clientHeight}});
  ok(info.tiles>6&&info.max>40,`${tab}: grid has more than 6 tiles and scrolls inside`,info);
  // scroll inner grid to page 2 (+ outer page a little if it can)
  await p.evaluate(()=>{const w=document.querySelector(".dress-gridwrap"); w.scrollTop=w.clientHeight-12+10; const ps=document.querySelector("#scene-shelf .page-scroll"); ps.scrollTop=Math.min(60,ps.scrollHeight-ps.clientHeight);});
  await p.waitForTimeout(500);
  const t0=await tops(); ok(t0.grid>40,`${tab}: scrolled to second page`,t0);
  // pick a tile that is visible on this page, select it (re-render), then equip with the button (re-render)
  const id=await p.evaluate(tab=>{const w=document.querySelector(".dress-gridwrap").getBoundingClientRect(); const t=[...document.querySelectorAll(".dtile")].find(t=>{const r=t.getBoundingClientRect();return t.dataset.locked==="0"&&!t.classList.contains("eq")&&r.top>=w.top&&r.bottom<=w.bottom}); return t&&t.dataset.t},tab);
  await p.tap(`[data-t="${id}"]`); await p.waitForTimeout(450);
  let t1=await tops(); ok(near(t1.grid,t0.grid)&&near(t1.page,t0.page),`${tab}: selecting a tile keeps scroll`,{t0,t1});
  if(tab==="gifts") await p.click("#dd-equip"); else await p.evaluate(id=>equipKey(id),id); await p.waitForTimeout(700);
  t1=await tops(); ok(near(t1.grid,t0.grid)&&near(t1.page,t0.page),`${tab}: equipping keeps scroll`,{t0,t1,eq:await p.evaluate(()=>document.querySelectorAll(".dtile.eq").length)});
  if(tab==="gifts"){
    await p.evaluate(id=>equipGift(id,false),id); await p.waitForTimeout(600);
    t1=await tops(); ok(near(t1.grid,t0.grid)&&near(t1.page,t0.page),"gifts: unequipping keeps scroll",{t0,t1});
  }
}
// deck editor still keeps its position
await p.evaluate(()=>{__studyGame.setScene("lobby"); openDeckEditor({to:"shelf"});}); await p.waitForTimeout(700);
const d0=await p.evaluate(()=>{const ps=document.querySelector("#scene-deck .page-scroll"); ps.scrollTop=Math.min(220,ps.scrollHeight-ps.clientHeight); return {top:Math.round(ps.scrollTop),max:ps.scrollHeight-ps.clientHeight}}); await p.waitForTimeout(300);
await p.evaluate(()=>{const e=[...document.querySelectorAll("#deck-pool .dpage:not(.in)")]; if(e.length) e[e.length>>1].click();}); await p.waitForTimeout(500);
const d1=await p.evaluate(()=>Math.round(document.querySelector("#scene-deck .page-scroll").scrollTop));
ok(d0.max<=0||near(d0.top,d1),"deck editor keeps scroll when a page is toggled",{d0,d1});
ok(errs.length===0,"no console errors",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
