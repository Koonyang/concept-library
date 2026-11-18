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
// 옛 저장(가챠·장서복·장신구 포함)을 심고 불러온다 → 조용히 이전
await p.goto(URL); await p.evaluate(()=>localStorage.clear());
await p.addInitScript(()=>{ if(sessionStorage.__seeded) return; sessionStorage.__seeded="1";
  const keys=Object.keys(localStorage); const SK=null;
});
await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
const SAVE_KEY=await p.evaluate(()=>__studyGame.acq.SAVE_KEY);
await p.evaluate(k=>{ const d=__studyGame.acq.defaultSave();
  const old={...d,ownedIds:["책갈피-황금","깃펜-은하"],equipped:{책갈피:"책갈피-황금",장식:null,깃펜:"깃펜-은하",동반자:null,서고:null,호칭:null},ticketsSpent:2,questionsAnswered:40,pullsSinceSr:3,pullsSinceSsr:7,unlockedKeyIds:["novice","reading-room"],equippedKeyId:"reading-room"};
  localStorage.setItem(k,JSON.stringify(old)); },SAVE_KEY);
await p.reload(); await p.waitForFunction(()=>window.__studyGame);
await p.waitForTimeout(600);
const mig=await p.evaluate(()=>{const s=__studyGame.save; return {gone:["ticketsSpent","pullsSinceSr","pullsSinceSsr"].filter(k=>k in s),keys:s.unlockedKeyIds,eq:s.equippedKeyId,own:s.ownedIds,cos:s.equipped["책갈피"],qa:s.questionsAnswered,popups:document.querySelectorAll(".burn-ov,.toast.on,#toast.on,[role=dialog]").length,svg:document.querySelector("#scene-lobby .pf-ring svg")?.getAttribute("aria-label")};});
ok(mig.gone.length===0&&mig.qa===40&&mig.popups===0&&mig.keys.includes("reading-room")&&mig.eq==="reading-room"&&mig.own.length===2&&mig.cos==="책갈피-황금","옛 저장 이전: 뽑기권/천장만 제거, 장서복·핵심 책장·장신구 유지, 팝업 없음",mig);
// 하단 내비
await p.evaluate(()=>__studyGame.setScene("lobby")); await p.waitForTimeout(500);
const nav=await p.evaluate(()=>[...document.querySelectorAll("#scene-lobby .botnav .btn")].map(b=>({t:b.textContent.trim(),w:Math.round(b.getBoundingClientRect().width)})));
ok(nav.length===3&&nav[0].t==="접대"&&nav[1].t==="도서관"&&nav[2].t==="계시"&&Math.max(...nav.map(n=>n.w))-Math.min(...nav.map(n=>n.w))<=2,"하단 내비 = 접대 · 도서관 · 계시, 균형 폭",nav);
ok(await p.evaluate(()=>!document.querySelector("#scene-collection")&&![...document.querySelectorAll("[data-go]")].some(b=>b.dataset.go==="collection")),"장서(collection) 장면/버튼 없음");
// 도서관 진입 → 하위 탭
await p.click('#scene-lobby .bm-btn'); await p.waitForTimeout(350); await p.click('#scene-lobby [data-go="shelf"]'); await p.waitForTimeout(900);
const tabs=async()=>p.evaluate(()=>[...document.querySelectorAll("#scene-shelf .shelf-tab")].map(t=>t.textContent.trim()+(t.classList.contains("on")?"*":"")).join("|"));
ok(await p.evaluate(()=>document.querySelector("#scene-shelf").classList.contains("on")),"도서관 장면으로 이동");
console.log("tabs:",await tabs());
for(const [k,label] of [["deck","덱 편성"],["books","책"],["outfit","장서복"],["gifts","에고 기프트"]]){
  await p.click(`[data-stab="${k}"]`); await p.waitForTimeout(500);
  const t=await tabs(); ok(t.includes(label+"*"),`하위 탭 "${label}" 선택됨`,t);
  await p.screenshot({path:`${ROOT}/shots/lib-${k}-390.png`});
}
// 덱 편성 탭 → 덱 편집기 → 닫으면 같은 탭으로 복귀
await p.click('[data-stab="deck"]'); await p.waitForTimeout(400);
await p.click("#btn-open-deck"); await p.waitForTimeout(1000);
ok(await p.evaluate(()=>document.querySelector("#scene-deck").classList.contains("on")),"덱 편성 버튼 → 덱 편집기");
await p.evaluate(()=>closeDeckEditor()); await p.waitForTimeout(1000);
ok(await p.evaluate(()=>document.querySelector("#scene-shelf").classList.contains("on")&&document.querySelector('[data-stab="deck"]').classList.contains("on")),"편집기 닫으면 도서관 · 덱 편성 탭으로 복귀");
// 옛 탭 값(outfit)이 들어와도 안전
await p.evaluate(()=>{__studyGame.setShelfTab("outfit"); __studyGame.setScene("shelf");}); await p.waitForTimeout(500);
await p.evaluate(()=>{__studyGame.setShelfTab("zzz"); __studyGame.setScene("shelf");}); await p.waitForTimeout(500);
ok((await tabs()).includes("책*"),"알 수 없는 탭은 '책'으로 대체");
// 기프트 착용은 그대로
await p.evaluate(()=>{const g=__studyGame; g.setGifts(g.data.EGO_GIFTS.slice(0,3).map(x=>x.id),{}); g.setShelfTab("gifts"); g.setScene("shelf");}); await p.waitForTimeout(500);
const gid=await p.evaluate(()=>__studyGame.data.EGO_GIFTS[0].id);
await p.click(`[data-t="${gid}"]`); await p.waitForTimeout(300); await p.click("#dd-equip"); await p.waitForTimeout(700);
ok(await p.evaluate(g=>Object.values(__studyGame.gifts.egoEquip(__studyGame.save)).includes(g),gid),"에고 기프트 착용 동작");
// 저장에 다시 쓰여도 옛 필드가 되살아나지 않는다
const resaved=await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)); return {gacha:["ticketsSpent","pullsSinceSr","pullsSinceSsr"].filter(x=>x in s),keys:s.unlockedKeyIds,eq:s.equippedKeyId};},SAVE_KEY);
ok(resaved.gacha.length===0&&resaved.keys.includes("reading-room")&&resaved.eq==="reading-room","저장 후에도 뽑기 필드 없음 · 장서복 데이터 유지",resaved);
// a892c54 저장(장서복 데이터 없음) → 기본값으로 안전하게
await p.evaluate(k=>{ const d=__studyGame.acq.defaultSave(); delete d.unlockedKeyIds; delete d.equippedKeyId; delete d.ownedIds; delete d.equipped; localStorage.setItem(k,JSON.stringify(d)); },SAVE_KEY);
await p.reload(); await p.waitForFunction(()=>window.__studyGame);
const lost=await p.evaluate(()=>{const s=__studyGame.save; return {keys:s.unlockedKeyIds,eq:s.equippedKeyId,own:s.ownedIds,sl:Object.keys(s.equipped).length}; });
ok(lost.keys.join()==="novice"&&lost.eq==="novice"&&lost.own.length===0&&lost.sl===6,"a892c54 저장(장서복 데이터 없음): 기본 장서복으로 안전하게 열림",lost);
ok(errs.length===0,"콘솔 오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
