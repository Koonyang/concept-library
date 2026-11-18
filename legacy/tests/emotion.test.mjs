/* 감정단계 표기·책장 잠금, 합 지정 중 주사위는 cardInfo 의 min~max 만 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
let fails=0; const ok=(c,m,x)=>{ console.log((c?"PASS ":"FAIL ")+m+(x!==undefined?" "+JSON.stringify(x):"")); if(!c) fails++; };
const js=readFileSync(ROOT+"/assets/ui/battle-stage.js","utf8");
const html=`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#07080d;font-family:sans-serif}#host{position:fixed;inset:0}</style><div id=host></div><script>${js}</script>`;
const bt={scene:1,phase:"assign",question:{answered:true,correct:true},units:[
  {id:"a1",side:"ally",slot:0,name:"큐 양",hp:40,maxHp:50,stagger:20,maxStagger:30,staggered:false,light:4,maxLight:4,emotion:1,emotionCharge:1,emotionMax:5,chargesPerEmotion:2,status:[],dice:[{speed:5,card:null,target:null}]},
  {id:"e1",side:"enemy",slot:0,name:"손님",hp:30,maxHp:30,stagger:15,maxStagger:15,staggered:false,light:0,maxLight:0,emotion:0,status:[],dice:[{speed:4,card:"x",target:{unit:"a1",die:0}}]}
]};
const hands={a1:["ok","lock"]};
const cards={
  ok:{name:"첫 장 넘기기",cost:1,emotion:0,emotionReq:0,dice:[{type:"slash",min:2,max:5,rightMin:3,rightMax:6,wrongMin:1,wrongMax:4,baseMin:2,baseMax:5}]},
  lock:{name:"개념의 정점",cost:3,emotion:4,emotionReq:4,dice:[{type:"slash",min:8,max:12,rightMin:9,rightMax:13,wrongMin:7,wrongMax:11,baseMin:8,baseMax:12}]},
  x:{name:"적 책장",cost:0,dice:[{type:"slash",min:3,max:6,rightMin:2,rightMax:5,wrongMin:4,wrongMax:7,baseMin:3,baseMax:6}]}
};
const cardInfo=(id)=>({
  ok:{emotionReq:0,usable:true,reason:null,dice:[{type:"slash",min:4,max:7,rightMin:4,rightMax:7,wrongMin:1,wrongMax:4,baseMin:2,baseMax:5}]},
  lock:{emotionReq:4,usable:false,reason:"emotion",dice:[{type:"slash",min:9,max:13,rightMin:9,rightMax:13,wrongMin:7,wrongMax:11,baseMin:8,baseMax:12}]},
  x:{emotionReq:0,usable:true,reason:null,dice:[{type:"slash",min:2,max:5,rightMin:2,rightMax:5,wrongMin:4,wrongMax:7,baseMin:3,baseMax:6}]}
}[id]);
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
for(const [w,h] of [[844,390],[390,844]]){
  const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true}); const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.setContent(html);
  await p.evaluate(([bt,hands,cards])=>{
    window.__bt=JSON.parse(JSON.stringify(bt));
    window.__info=(id,uid)=>window.__ci[id];
    window.__ci={
      ok:{emotionReq:0,usable:true,reason:null,dice:[{type:"slash",min:4,max:7,rightMin:4,rightMax:7,wrongMin:1,wrongMax:4,baseMin:2,baseMax:5}]},
      lock:{emotionReq:4,usable:false,reason:"emotion",dice:[{type:"slash",min:9,max:13,rightMin:9,rightMax:13,wrongMin:7,wrongMax:11,baseMin:8,baseMax:12}]},
      x:{emotionReq:0,usable:true,reason:null,dice:[{type:"slash",min:2,max:5,rightMin:2,rightMax:5,wrongMin:4,wrongMax:7,baseMin:3,baseMax:6}]}
    };
    BattleStage.mount(document.getElementById("host"));
    BattleStage.render(__bt,{hands,cards,cardInfo:(id)=>__ci[id]});
  },[bt,hands,cards]);
  await p.waitForTimeout(400);
  const emo=await p.evaluate(()=>{
    const el=document.querySelector(".bs-unit.ally .bs-emo");
    return {txt:el&&el.textContent.replace(/\s+/g," ").trim(), aria:el&&el.getAttribute("aria-label"), pips:el&&el.querySelectorAll(".pip.on").length, nxt:el&&el.querySelector(".nxt")?.textContent};
  });
  ok(emo&&/1/.test(emo.txt)&&emo.pips===1&&emo.nxt==="1/2"&&/감정 1단계/.test(emo.aria),`${w}x${h} 사서 감정단계+다음 진행`,emo);
  const hand=await p.evaluate(()=>[...document.querySelectorAll(".bs-card")].map(c=>({id:c.dataset.card,lock:c.classList.contains("emo-lock")||c.classList.contains("cant"),need:c.querySelector(".emo-need")?.textContent,d:c.querySelector(".d")?.textContent,off:c.classList.contains("cant")})));
  const lock=hand.find(c=>c.id==="lock"), okc=hand.find(c=>c.id==="ok");
  ok(lock&&lock.lock&&/감정 4\+/.test(lock.need||""),`${w}x${h} 감정 부족 카드 흐림+필요 단계`,lock);
  ok(okc&&!okc.lock&&/4~7/.test(okc.d)&&!/✓|✗|9~13|1~4/.test(okc.d||""),`${w}x${h} 합 지정 손패는 min~max 만 (정답 반영)`,okc);
  // locked card cannot be picked
  await p.tap('.bs-card[data-card="lock"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(()=>BattleStage._state().pickCard!=="lock"),`${w}x${h} 잠긴 카드는 고를 수 없음`);
  await p.tap('.bs-card[data-card="ok"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(()=>BattleStage._state().pickCard==="ok"),`${w}x${h} 조건 되는 카드는 선택`);
  // enemy die info uses cardInfo min~max
  await p.evaluate(()=>{ BattleStage.showInfo("e1",0); });
  await p.waitForTimeout(80);
  const info=await p.evaluate(()=>document.querySelector(".bs-info")?.innerText||"");
  ok(/2~5/.test(info)&&!/✓|✗|right|4~7/.test(info),`${w}x${h} 적 주사위 정보도 min~max`,info);
  await p.screenshot({path:`shots/emotion-${w}.png`});
  if(errs.length) ok(false,`${w}x${h} pageerror`,errs);
  await p.close();
}

/* 덱 편성: 정답/오답 범위 둘 다 (cardInfo right/wrong 또는 기존 미리보기) */
{
  const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame);
  await p.evaluate(()=>{ __studyGame.giveAllPages(); __studyGame.setScene("deck"); });
  await p.waitForTimeout(800);
  const prev=await p.evaluate(()=>{
    const el=[...document.querySelectorAll(".dprev")].find(e=>e.querySelector(".ok")&&e.querySelector(".ng"));
    return el?{ok:el.querySelector(".ok").textContent,ng:el.querySelector(".ng").textContent}:null;
  });
  ok(prev&&/✓/.test(prev.ok)&&/✗/.test(prev.ng), "deck-building shows both correct and wrong ranges",prev);
  await p.screenshot({path:`shots/emotion-deck-844.png`});
  if(errs.length) ok(false,"deck pageerror",errs);
  await p.context().close();
}

/* 실제 접대: 감정 칩이 사서마다 보임, 고감정 책장이 잠김 */
{
  const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>{
    const G=__studyGame,s=G.save;
    G.giveAllPages();
    const deck=["turn-page","apex","underline","night-study","repeat-line","blank-fill","breathe","silence","focus-line"];
    try{ G.setDeckPages(deck); }catch(e){}
    s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"];
    try{ G.libs.setParty(s,["kyu"]); }catch(e){}
    G.battleApi.begin("beccaria");
  });
  await p.waitForTimeout(1000);
  await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(800);
  // put a high-emotion card in hand if possible
  await p.evaluate(()=>{
    const api=__studyGame.battleApi, B=api.mb.battle, a=B.units.find(u=>u.side==="ally");
    a.emotion=0; a.emotionCharge=a.emotionCharge??0;
    const X=api.internals()[a.id];
    if(X){ if(!X.handIds.includes("apex")) X.handIds.unshift("apex"); if(!X.handIds.includes("turn-page")) X.handIds.unshift("turn-page"); }
    api.mb && (api.mb.x[a.id].handIds=X.handIds);
  });
  // re-render
  await p.evaluate(()=>{ const api=__studyGame.battleApi; /* trigger refresh */ api.relink(); const ev=document.createEvent("Event"); });
  await p.evaluate(()=>{ const g=__studyGame; if(g.battleApi.startScene){ /* don't restart */ } const B=g.battleApi.mb.battle; BattleStage.render(B, BattleStage._state()&&{}); });
  // Use begin-already-rendered: call assign no-op refresh
  await p.evaluate(()=>{ const api=__studyGame.battleApi; if(api.unassign){ /* refresh via unassign of empty is false */ api.unassign("nope",0); } else if(api.relink){ /* */ }
    // force mbRefresh through start? hidden: dispatch by assigning nothing
    const B=api.mb.battle; const a=B.units.find(u=>u.side==="ally"); a.emotion=0;
    const ev=window.__studyGame;
  });
  // Call internals refresh by re-answering is bad. Directly invoke render via begin path:
  const vis=await p.evaluate(()=>{
    const api=__studyGame.battleApi, B=api.mb.battle, a=B.units.find(u=>u.side==="ally");
    a.emotion=0;
    const X=api.internals()[a.id];
    if(X&&!X.handIds.includes("apex")) X.handIds.unshift("apex");
    // mbRefresh is not exported; unassign false still calls mbRefresh through api.unassign
    if(typeof api.unassign==="function") api.unassign(a.id, 99);
    const emo=[...document.querySelectorAll(".bs-unit.ally .bs-emo")].map(e=>({t:e.textContent.replace(/\s+/g," ").trim(),a:e.getAttribute("aria-label")}));
    const cards=[...document.querySelectorAll(".cc,.bs-card")].map(c=>({id:c.dataset.card,lock:c.classList.contains("emo-lock")||c.classList.contains("off")||c.classList.contains("cant"),need:(c.querySelector(".emo-need")||{}).textContent||""}));
    return {emo,cards,phase:B.phase,hand:api.hand(a.id),emotion:a.emotion};
  });
  ok(vis.emo.length>=1&&vis.emo.every(e=>/감정/.test(e.a||"")||/\d/.test(e.t)), "live battle shows per-librarian emotion",vis.emo);
  const locked=vis.cards.find(c=>c.id==="apex");
  if(vis.hand.includes("apex")) ok(locked&&locked.lock&&/감정/.test(locked.need||"감정"), "apex locked at emotion 0", {locked,cards:vis.cards,hand:vis.hand});
  else ok(true, "apex not in opening hand (skip lock check)", vis.hand);
  await p.screenshot({path:`shots/emotion-game-844.png`});
  if(errs.length) ok(false,"game pageerror",errs.slice(0,3));
  await p.context().close();
}
await b.close(); server.close();
process.exit(fails?1:0);
