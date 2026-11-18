import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
await p.goto("http://127.0.0.1:"+server.address().port+"/");
await p.waitForFunction(()=>window.__studyGame);

await p.evaluate(()=>{const g=__studyGame,s=g.save,d=g.data;g.giveAllPages();
  g.setGifts(d.EGO_GIFTS.map(x=>x.id),{});
  s.questionsAnswered=500;
  d.WEAK_POINTS.forEach(w=>{s.conqueredIds.push(w.id); s.bookCounts[w.id]=3; });});
let fails=0;
const pass=(ok,name,o)=>{if(!ok)fails++;console.log(ok?"PASS":"FAIL",name,JSON.stringify(o));};
// generic: scroll container sc to 60%, run action (in page), assert unchanged
async function check(name,scene,sc,action,{pct=0.6}={}){
  await p.evaluate(x=>{window.__studyGame.setScene(x)},scene); await p.waitForTimeout(350);
  const r=await p.evaluate(([sc,pct])=>{const el=document.querySelector(sc);if(!el)return null;const max=el.scrollHeight-el.clientHeight;el.scrollTop=max*pct;return {max,top:el.scrollTop};},[sc,pct]);
  if(!r){pass(false,name,{why:"no container"});return;}
  await p.waitForTimeout(100);
  const acted=await p.evaluate(action);
  await p.waitForTimeout(250);
  const after=await p.evaluate(sc=>document.querySelector(sc).scrollTop,sc);
  pass(r.max>20&&r.top>8&&acted!==false&&Math.abs(after-r.top)<=1,name,{max:Math.round(r.max),before:Math.round(r.top),after:Math.round(after),acted});
}
// click without scrolling (element-in-view clicking would move scroll): use .click() in page
const clickNth=(sel,fromEnd)=>`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})];if(!e.length)return false;const el=e[${fromEnd?"e.length-1":"0"}];el.click();return true;})()`;
const act=(code)=>new Function("return "+code);
const SC={deck:"#scene-deck .page-scroll",shelf:"#scene-shelf .page-scroll",lobby:"#scene-lobby"};
await check("deck: equip page (unequipped card)","deck",SC.deck,act(`(()=>{const e=[...document.querySelectorAll("#deck-pool .dpage:not(.in)")];if(!e.length)return false;e[e.length>>1].click();return true})()`));
await check("deck: unequip page (pool card)","deck",SC.deck,act(`(()=>{const e=[...document.querySelectorAll("#deck-pool .dpage.in")];if(!e.length)return false;e[0].click();return true})()`));
await check("deck: unequip via slot","deck",SC.deck,act(clickNth("[data-off]")));
await check("deck: filter select","deck",SC.deck,act(`(()=>{const s=document.querySelector('[data-df="sort"]');s.value="name";s.dispatchEvent(new Event("change",{bubbles:true}));return true})()`));
await check("deck: type filter chip/select","deck",SC.deck,act(`(()=>{const s=document.querySelector('[data-df="rarity"]');s.value="N";s.dispatchEvent(new Event("change",{bubbles:true}));return true})()`),{pct:0.3});
await check("deck: preset copy","deck",SC.deck,act(clickNth("#deck-copy")));
await check("deck: preset switch","deck",SC.deck,act(`(()=>{const e=[...document.querySelectorAll("[data-preset]")];if(e.length<2)return false;e.find(x=>!x.classList.contains("on")&&!x.classList.contains("active"))?.click();return true})()`));
await check("lobby: guest select","lobby",SC.lobby,act(clickNth("[data-guest]",true)),{pct:0.5});
console.log("errors:",errs.length,errs.slice(0,3));
console.log("fails:",fails);
await b.close(); server.close(); process.exit(fails?1:0);
