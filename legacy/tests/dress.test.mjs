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
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:false,deviceScaleFactor:2});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
await p.goto("http://127.0.0.1:"+server.address().port+"/"); await p.waitForFunction(()=>window.__studyGame);
await p.evaluate(()=>{const g=__studyGame,s=g.save,d=g.data; g.setGifts(d.EGO_GIFTS.slice(0,8).map(x=>x.id),{}); g.setScene("shelf");});
const tab=async(k)=>{ await p.click(`[data-stab="${k}"]`); await p.waitForTimeout(500); };

const center=(sel)=>p.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},sel);
async function drag(from,to,steps=10){ const a=await center(from); await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(a.x+12,a.y+12,{steps:3}); const mid=await p.evaluate(()=>({ghost:!!document.querySelector(".dghost")})); const t=typeof to==="string"?await center(to):to; await p.mouse.move(t.x,t.y,{steps}); const hl=await p.evaluate(()=>!!document.querySelector("#dress-char.drop-on")); await p.mouse.up(); await p.waitForTimeout(900); return {ghost:mid.ghost,highlight:hl}; }

// ---- outfit tab (장서복 / 핵심 책장)
{ const tabs=await p.evaluate(()=>[...document.querySelectorAll(".shelf-tab")].map(t=>t.textContent.trim()));
  ok(tabs.join("|")==="덱 편성|책|장서복|에고 기프트","도서관 하위 탭 = 덱 편성 · 책 · 장서복 · 에고 기프트",tabs);
  const gone=await p.evaluate(()=>({gacha:typeof pullGacha,tick:typeof ticketsHeld,rules:typeof GACHA_RULES,keyPages:typeof KEY_PAGES,cos:typeof COSMETIC_ITEMS}));
  ok(gone.gacha==="undefined"&&gone.tick==="undefined"&&gone.rules==="undefined"&&gone.keyPages==="object"&&gone.cos==="object","가챠 코드 없음 · 핵심 책장/장신구 데이터 유지",gone); }
await p.evaluate(()=>{const s=__studyGame.save; s.unlockedKeyIds=["novice","reading-room"]; s.equippedKeyId="novice";});
const eqKey=()=>p.evaluate(()=>__studyGame.save.equippedKeyId);
await tab("outfit");
const outfits=await p.evaluate(()=>[...document.querySelectorAll(".dtile")].map(t=>({id:t.dataset.t,locked:t.dataset.locked,eq:t.classList.contains("eq")})));
const nKeys=await p.evaluate(()=>__studyGame.data.KEY_PAGES.length);
ok(nKeys>=6&&outfits.length===nKeys&&outfits.filter(o=>o.locked==="1").length===nKeys-2&&outfits.find(o=>o.id==="novice").eq,`outfit grid: ${nKeys} icons, ${nKeys-2} locked, equipped marked`,outfits);
ok((await p.evaluate(()=>document.querySelector(".dd-name").textContent))==="초보 사서의 장서복"&&(await p.evaluate(()=>document.querySelector("#dress-detail").innerText)).includes("능력"),"detail shows equipped key page by default");
ok(await p.evaluate(()=>!!document.querySelector("#dress-char .lib-pick .lp-chip.on")),"사서 고르기 칩이 미리보기 카드 위에 있음");
await p.click('[data-t="archivist"]'); await p.waitForTimeout(300);
const lockedDetail=await p.evaluate(()=>document.querySelector("#dress-detail").innerText);
ok(/메타인지.*소각/.test(lockedDetail)&&await p.evaluate(()=>document.querySelector("#dd-equip").disabled),"locked icon detail names the guest book that drops it, equip disabled");
const lockedDrag=await drag('[data-t="archivist"]',"#dress-char");
ok(await eqKey()==="novice"&&!lockedDrag.ghost,"locked icon cannot be dragged/equipped");
const fromSvg=await p.evaluate(()=>document.querySelector("#dress-char .dc-new svg").getAttribute("data-outfit"));
const d1=await drag('[data-t="reading-room"]',"#dress-char");
ok(d1.ghost&&d1.highlight&&await eqKey()==="reading-room","drag ghost + drop highlight + drag-drop equips reading-room",d1);
const morphed=await p.evaluate(()=>({outfit:document.querySelector("#dress-char .dc-new svg")?.getAttribute("data-outfit")}));
ok(morphed.outfit==="reading-room"&&fromSvg==="novice","character outfit changed on preview",{fromSvg,morphed});
await drag('[data-t="novice"]',{x:195,y:790});
ok(await eqKey()==="reading-room","drop outside the character leaves outfit unchanged");
await p.click('[data-t="novice"]'); await p.waitForTimeout(300); await p.click("#dd-equip"); await p.waitForTimeout(700);
ok(await eqKey()==="novice","fallback: equip button works");
// stat bonuses still apply (hp10 key page)
{ const hp=await p.evaluate(()=>{const g=__studyGame,s=g.save; const k=g.data.KEY_PAGES.find(k=>k.perk==="hp10"); if(!k) return null; const before=g.gifts.effectiveMaxHp(s); s.unlockedKeyIds.push(k.id); s.equippedKeyId=k.id; const after=g.gifts.effectiveMaxHp(s); s.equippedKeyId="novice"; return {before,after}; });
  ok(hp&&hp.after===hp.before+10,"key-page stat bonus (최대 체력 +10) still applies",hp); }
await p.evaluate(()=>{__studyGame.save.unlockedKeyIds=["novice","reading-room","midnight","archivist"];__studyGame.save.equippedKeyId="archivist";__studyGame.setShelfTab("outfit");__studyGame.setScene("shelf");});
await p.waitForTimeout(3500);
await p.screenshot({path:ROOT+"/shots/22-keypage-390.png"});
await p.evaluate(()=>{__studyGame.save.unlockedKeyIds=["novice","reading-room"];__studyGame.save.equippedKeyId="novice";__studyGame.setScene("shelf");});
// ---- gifts tab
await tab("gifts");
const g0=await p.evaluate(()=>({tiles:document.querySelectorAll(".dtile").length,locked:document.querySelectorAll(".dtile.locked").length,detail:document.querySelector("#dress-detail").innerText}));
ok(g0.tiles===33&&g0.locked===25&&/누적 효과/.test(g0.detail)&&/세트/.test(g0.detail),"gifts grid: 33 icons, 25 locked, default detail = total + set progress",{tiles:g0.tiles,locked:g0.locked});
const GI=await p.evaluate(()=>__studyGame.data.EGO_GIFTS.map(x=>({id:x.id,slot:x.slot})));
const eqd=()=>p.evaluate(()=>Object.values(__studyGame.gifts.egoEquip(__studyGame.save)).filter(Boolean));
const g1=GI[0].id /*sand-heart 손*/, g2=GI[4].id /*recall-lens 눈*/, g3=GI[3].id /*blank-afterimage 손*/;
const d3=await drag(`[data-t="${g1}"]`,"#dress-char");
ok(d3.ghost&&d3.highlight&&(await eqd()).includes(g1)&&await p.evaluate(g=>!!document.querySelector(`#dress-char .gs[data-gift="${g}"]`),g1),"drag gift onto character: equipped + accessory visible on preview");
await drag(`[data-t="${g2}"]`,"#dress-char");
ok(await p.evaluate(()=>document.querySelectorAll("#dress-char .dc-new .gs").length)===2,"second gift (other slot) adds a second accessory");
// same-slot drop replaces
await drag(`[data-t="${g3}"]`,"#dress-char");
const sw=await p.evaluate(g=>({fresh:document.querySelector("#dress-char .gs.fresh.swap")?.dataset.gift,n:document.querySelectorAll("#dress-char .dc-new .gs").length}),g3);
const after=await eqd();
ok(after.includes(g3)&&!after.includes(g1)&&after.includes(g2)&&sw.n===2&&sw.fresh===g3,"dropping onto an occupied slot replaces that slot's gift (swap animation class)",{after,sw});
// drag equipped icon off the character => unequip
await drag(`[data-t="${g2}"]`,{x:195,y:700});
ok(!(await eqd()).includes(g2)&&await p.evaluate(g=>!document.querySelector(`#dress-char .dc-new .gs[data-gift="${g}"]`),g2),"drag equipped icon off the character unequips it");
// fallback buttons
await p.click(`[data-t="${g2}"]`); await p.waitForTimeout(300);
const btnTxt=await p.evaluate(()=>document.querySelector("#dd-equip").textContent);
await p.click("#dd-equip"); await p.waitForTimeout(600); const eqNow=(await eqd()).includes(g2);
await p.click("#dd-equip"); await p.waitForTimeout(600); const eqOff=(await eqd()).includes(g2);
ok(btnTxt==="착용"&&eqNow&&!eqOff,"fallback buttons equip / unequip gift");
await p.click('[data-t="'+GI[11].id+'"]'); await p.waitForTimeout(300);
ok(/획득처.*접대/.test(await p.evaluate(()=>document.querySelector("#dress-detail").innerText)),"locked gift detail names the guest that drops it");
await p.click("#dd-back"); await p.waitForTimeout(300);
await p.waitForTimeout(3000);
await p.screenshot({path:ROOT+"/shots/23-gifts-390.png"});
await p.evaluate(()=>{const g=__studyGame,d=g.data;const eq={};["fading-ribbon","recall-lens","underlined-mark","short-rest-charm","review-clasp","blank-afterimage","interval-gear","blind-spot-pin"].forEach(id=>{const x=d.EGO_GIFTS.find(y=>y.id===id);eq[x.slot]=id;});g.setGifts(d.EGO_GIFTS.map(x=>x.id),eq);g.setScene("shelf");});
await tab("gifts"); await p.waitForTimeout(500);
await p.screenshot({path:ROOT+"/shots/24-gifts-full-390.png"});
console.log("errors:",errs.length,errs.slice(0,3)); console.log("fails:",fails);
await b.close(); server.close(); process.exit(fails?1:0);
