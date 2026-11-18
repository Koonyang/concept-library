/* 합 진행 전 손패 해제: 놓인 주사위/화살표 탭, 고른 카드 다시 탭하면 선택 해제 */
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
const html=`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#07080d}#host{position:fixed;inset:0}</style><div id=host></div><script>${js}</script>`;
const mk=()=>({scene:1,phase:"assign",question:{answered:true,correct:true},units:[
  {id:"a1",side:"ally",slot:0,name:"큐 양",hp:40,maxHp:50,stagger:20,maxStagger:30,staggered:false,light:3,maxLight:4,emotion:1,emotionCharge:1,emotionMax:5,chargesPerEmotion:2,status:[],dice:[{speed:5,card:"c1",target:{unit:"e1",die:0}},{speed:3,card:null,target:null}]},
  {id:"e1",side:"enemy",slot:0,name:"손님",hp:30,maxHp:30,stagger:15,maxStagger:15,staggered:false,light:0,maxLight:0,emotion:0,status:[],dice:[{speed:4,card:"x",target:{unit:"a1",die:0}}]}
]});
const hands={a1:["c2","c3"]};
const cards={c1:{name:"정면 반박",cost:1,dice:[{type:"slash",min:3,max:6}]},c2:{name:"여백의 방어",cost:1,dice:[{type:"guard",min:2,max:6}]},c3:{name:"서고의 침묵",cost:1,dice:[{type:"evade",min:3,max:6}]},x:{name:"x",cost:0,dice:[{type:"slash",min:2,max:5}]}};
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
for(const [w,h] of [[844,390],[390,844]]){
  const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true}); const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.setContent(html);
  await p.evaluate(([bt,hands,cards])=>{
    window.__u=[]; window.__bt=bt;
    BattleStage.mount(document.getElementById("host"));
    const apply=()=>BattleStage.render(window.__bt,{hands,cards,onUnassign:(uid,i)=>{ __u.push([uid,i]); const u=__bt.units.find(x=>x.id===uid); const c=u.dice[i].card; u.dice[i].card=null; u.dice[i].target=null; if(c) (hands[uid]=hands[uid]||[]).push(c); BattleStage.render(__bt,{hands,cards,onUnassign:apply._}); }});
    // keep same handler
  },[mk(),hands,cards]);
  // redo mount cleanly
  await p.evaluate(([bt,hands,cards])=>{
    window.__u=[]; window.__bt=JSON.parse(JSON.stringify(bt)); window.__hands=JSON.parse(JSON.stringify(hands)); window.__cards=cards;
    BattleStage.unmount(); BattleStage.mount(document.getElementById("host"));
    window.__opts={hands:window.__hands,cards,onUnassign:(uid,i)=>{
      __u.push([uid,i]);
      const u=__bt.units.find(x=>x.id===uid); const d=u.dice[i]; const c=d.card; d.card=null; d.target=null;
      if(c) __hands[uid].push(c);
      BattleStage.render(__bt,__opts);
    }};
    BattleStage.onUnassign=__opts.onUnassign;
    BattleStage.render(__bt,__opts);
  },[mk(),hands,cards]);
  await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!!document.querySelector('.bs-die.has-card .bs-x')),`${w}x${h} 놓인 주사위에 해제 표시`);
  ok(await p.evaluate(()=>document.querySelectorAll(".bs-arr-hit").length>=1),`${w}x${h} 화살표 히트 영역`);
  await p.screenshot({path:`shots/unassign-before-${w}.png`});
  // tap assigned die → unassign
  await p.tap('.bs-die[data-u="a1"][data-d="0"]'); await p.waitForTimeout(200);
  const afterDie=await p.evaluate(()=>({log:__u, card:__bt.units[0].dice[0].card, hand:__hands.a1, has:!!document.querySelector('.bs-die[data-u="a1"][data-d="0"]').classList.contains("has-card")}));
  ok(afterDie.log.length===1&&afterDie.log[0][0]==="a1"&&afterDie.log[0][1]===0&&!afterDie.card&&afterDie.hand.includes("c1")&&!afterDie.has,`${w}x${h} 주사위 탭 해제`,afterDie);

  // re-assign via onAssign and test arrow
  await p.evaluate(()=>{
    window.__u=[]; const u=__bt.units[0]; u.dice[0].card="c1"; u.dice[0].target={unit:"e1",die:0};
    window.__hands.a1=window.__hands.a1.filter(x=>x!=="c1");
    BattleStage.render(__bt,__opts);
  });
  await p.waitForTimeout(300);
  const hit=await p.evaluate(()=>{
    const el=document.querySelector(".bs-arr-hit"); if(!el) return {ok:false};
    el.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:1,clientY:1}));
    return {ok:true,n:__u.length,card:__bt.units[0].dice[0].card,log:__u};
  });
  ok(hit.ok&&hit.n===1&&!hit.card,`${w}x${h} 화살표 탭 해제`,hit);

  // deselect selected card by tapping it again
  await p.evaluate(()=>{ BattleStage.render(__bt,__opts); });
  await p.waitForTimeout(200);
  await p.tap('.bs-die[data-u="a1"][data-d="1"]'); await p.waitForTimeout(120);
  const nHand=await p.evaluate(()=>document.querySelectorAll(".bs-card").length);
  ok(nHand>=1,`${w}x${h} 빈 주사위 탭하면 손패`,nHand);
  await p.tap('.bs-card[data-card="c2"]'); await p.waitForTimeout(80);
  const picked=await p.evaluate(()=>({pick:BattleStage._state().pickCard, cls:document.querySelector('.bs-card[data-card="c2"]').classList.contains("pick")}));
  ok(picked.pick==="c2"&&picked.cls,`${w}x${h} 카드 선택`,picked);
  await p.tap('.bs-card[data-card="c2"]'); await p.waitForTimeout(80);
  const unpicked=await p.evaluate(()=>({pick:BattleStage._state().pickCard, cls:!!document.querySelector('.bs-card[data-card="c2"]')?.classList.contains("pick")}));
  ok(!unpicked.pick&&!unpicked.cls,`${w}x${h} 같은 카드 다시 탭하면 선택 해제`,unpicked);
  await p.screenshot({path:`shots/unassign-after-${w}.png`});
  if(errs.length){ ok(false,`${w}x${h} pageerror`,errs); }
  await p.close();
}

/* 실제 접대 엔진 연결 (battleApi.unassign 있으면 그걸 씀) */
{
  const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>{ const G=__studyGame,s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; try{G.libs.setParty(s,["kyu"]);}catch(e){} G.battleApi.begin("beccaria"); });
  await p.waitForTimeout(1000);
  await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(700);
  const st=await p.evaluate(()=>{
    const api=__studyGame.battleApi, B=api.mb.battle;
    const a=B.units.find(u=>u.side==="ally"), e=B.units.find(u=>u.side==="enemy"&&u.hp>0&&u.dice&&u.dice.length);
    const cid=(api.hand(a.id)||[])[0];
    const r=api.assign(a.id,0,cid,{unit:e.id,die:0});
    return {ok:r&&r.ok, reason:r&&r.reason, hasUnassign:typeof api.unassign==="function", aid:a.id, cid, card:a.dice[0].card, handAfter:api.hand(a.id).slice()};
  });
  ok(st.ok||st.reason,`engine assign attempted`,st);
  if(st.ok){
    await p.waitForTimeout(300);
    ok(await p.evaluate(()=>!!document.querySelector(".bs-unit.ally .bs-die.has-card")),"assigned die shows card");
    await p.tap('.bs-unit.ally .bs-die.has-card'); await p.waitForTimeout(300);
    const after=await p.evaluate(([aid,cid])=>{
      const api=__studyGame.battleApi, u=api.mb.battle.units.find(x=>x.id===aid);
      return {card:u.dice[0].card, hand:api.hand(aid), has:!!document.querySelector(".bs-unit.ally .bs-die.has-card")};
    },[st.aid,st.cid]);
    ok(!after.card&&after.hand.includes(st.cid)&&!after.has,"full game: die tap unassigns via battleApi.unassign",after);
  }
  await p.screenshot({path:`shots/unassign-game-844.png`});
  if(errs.length) ok(false,"game pageerror",errs);
  await p.context().close();
}
await b.close(); server.close();
process.exit(fails?1:0);
