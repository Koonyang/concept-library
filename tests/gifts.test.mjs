import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(8770,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
await p.goto("http://127.0.0.1:8770/"); await p.waitForFunction(()=>window.__studyGame);
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
// data checks
const d=await p.evaluate(()=>{const g=__studyGame,d=g.data,R=g.gifts.EGO_GIFT_RULES;
  const slotsOk=d.EGO_GIFTS.every(x=>R.slots.includes(x.slot)); const ids=new Set(d.EGO_GIFTS.map(x=>x.id));
  const per=d.EGO_GIFTS.map(x=>({id:x.id,guest:x.guestId,slot:x.slot,perk:g.gifts.giftTotals(Object.assign({},{librarians:{kyu:{id:"kyu",name:"x",pity:{},gifts:{owned:[x.id],equipped:Object.assign(Object.fromEntries(R.slots.map(s=>[s,null])),{[x.slot]:x.id})}}},activeLibrarianId:"kyu"}))}));
  const mx=g.gifts.giftMaxTotals();
  return {slotsOk,n:ids.size,per:per.map(r=>({id:r.id,slot:r.slot,hp:r.perk.hp,st:r.perk.staggerPct,dmg:r.perk.dmgPct})),mx,slots:R.slots,unit:R.unit,setBonus:R.setBonus,bySlot:R.slots.map(s=>[s,d.EGO_GIFTS.filter(x=>x.slot===s).length])};});
ok(d.slotsOk&&d.n===33,"every gift belongs to exactly one valid body slot",d.bySlot);
console.log("STAT TABLE");console.table(d.per);
console.log("MAX TOTAL (best slot picks incl. sets):",JSON.stringify(d.mx));
ok(d.mx.hp<=8&&d.mx.staggerPct<=0.05&&d.mx.dmgPct<=0.05&&!d.mx.dieMin,"max total is tiny (hp<=8, stagger<=5%, dmg<=5%, no die-min)");
// one-per-slot + replace + set bonus by equipped
const t=await p.evaluate(()=>{const g=__studyGame,d=g.data,G=g.gifts;
  g.setGifts(d.EGO_GIFTS.map(x=>x.id),{});
  const L=G.libOf(g.save); const ids=d.EGO_GIFTS.filter(x=>x.slot==="손").map(x=>x.id);
  G.equipGift(ids[0]); G.equipGift(ids[1]);
  const hands=Object.values(L.gifts.equipped).filter(Boolean).filter(id=>d.EGO_GIFTS.find(x=>x.id===id).slot==="손");
  // set needs equipped (not owned)
  g.setGifts(d.EGO_GIFTS.map(x=>x.id),{}); const none=G.giftTotals(g.save);
  const pom=d.EGO_GIFTS.filter(x=>x.guestId==="pomodoro"); const eq={}; pom.forEach(x=>eq[x.slot]=x.id); g.setGifts(d.EGO_GIFTS.map(x=>x.id),eq); const withSet=G.giftTotals(g.save);
  return {hands,none,withSet,sets:G.activeSets(g.save)};});
ok(t.hands.length===1&&t.hands[0]!==undefined,"max one equipped per slot; equipping another replaces it",t.hands);
ok(t.none.sets===0&&t.none.hp===0,"owning every gift gives nothing until equipped",t.none);
ok(t.withSet.sets===1&&t.withSet.hp===2+1+0+2&&Math.abs(t.withSet.staggerPct-0.02)<1e-9,"pomodoro set equipped: pieces + set bonus",t.withSet);
// duplicate drop: no stacking, minor consolation
const dup=await p.evaluate(()=>{const g=__studyGame,d=g.data,G=g.gifts;
  g.setGifts(d.EGO_GIFTS.filter(x=>x.guestId==="pomodoro").map(x=>x.id),{});
  const before={own:G.egoOwned(g.save).length,}; const guest=d.WEAK_POINTS.find(x=>x.id==="pomodoro");
  const orig=Math.random; Math.random=()=>0.0; const r=G.rollEgoGift(guest,false,"kyu"); Math.random=orig;
  return {before,after:{own:G.egoOwned(g.save).length,},dup:r&&r.dup,libId:r&&r.libId};});
ok(dup.dup&&dup.after.own===dup.before.own&&dup.after.own===dup.before.own,"duplicate drop: ownership unchanged (no stacking), no ticket currency",dup);
// drops go only to the librarian who fought
const multi=await p.evaluate(()=>{const g=__studyGame,d=g.data,G=g.gifts;
  g.setGifts([],{}); const B=G.libOf(g.save,"bea"); const guest=d.WEAK_POINTS.find(x=>x.id==="active-recall");
  const orig=Math.random; Math.random=()=>0.0; const r=G.rollEgoGift(guest,false,"bea"); Math.random=orig; const K=G.libOf(g.save,"kyu");
  return {bea:B.gifts.owned.length,kyu:K.gifts.owned.length,name:B.name,got:r&&r.item&&r.item.id};});
ok(multi.bea===1&&multi.kyu===0,"drop goes only to the librarian passed in (multi-librarian structure)",multi);
// migration
const mig=await p.evaluate(()=>{const g=__studyGame,G=g.gifts; const old={...G.loadSave(),};
  const raw={...JSON.parse(JSON.stringify(old)),librarians:undefined,libV:undefined,egoOwned:["sand-heart","cycle-crest","short-rest-charm","blank-afterimage","review-clasp","blind-spot-pin"],egoEquipped:{손:"sand-heart",몸:"cycle-crest",목:"short-rest-charm",팔:"blank-afterimage",허리:"seer-orb",발:"blind-spot-pin"},egoPity:{pomodoro:2}};
  delete raw.librarians;delete raw.libV; localStorage.setItem(G.SAVE_KEY,JSON.stringify(raw)); const s=G.loadSave(); const L=s.librarians.kyu;
  return {owned:L.gifts.owned.length,eq:L.gifts.equipped,pity:L.pity,legacy:["egoOwned","egoEquipped","egoPity"].filter(k=>k in s),active:s.activeLibrarianId};});
ok(mig.owned===6&&mig.eq.손==="sand-heart"&&mig.eq.가슴==="cycle-crest"&&mig.eq.목==="short-rest-charm"&&mig.eq.발==="blind-spot-pin"&&!Object.values(mig.eq).includes("seer-orb")&&mig.legacy.length===0&&mig.pity.pomodoro===2,"migration: all owned kept, per-slot equip, legacy fields removed",mig);
// UI: name of librarian shown, whose gifts
await p.evaluate(()=>{const g=__studyGame,d=g.data;g.setGifts(d.EGO_GIFTS.slice(0,6).map(x=>x.id),{});g.setShelfTab("gifts");g.setScene("shelf");}); await p.waitForTimeout(400);
const ui=await p.evaluate(()=>({head:document.querySelector(".dress-side .dress-head").innerText,detail:document.querySelector("#dress-detail").innerText.slice(0,260),subs:[...document.querySelectorAll(".dt-sub")].map(e=>e.textContent)}));
ok(/큐 양의 기프트/.test(ui.head)&&/큐 양의 누적 효과/.test(ui.detail)&&ui.subs.includes("가슴"),"UI shows whose gifts + body slot names",ui);
console.log("errors:",errs.length,errs.slice(0,3)); console.log("fails:",fails);
await b.close(); server.close(); process.exit(fails?1:0);
