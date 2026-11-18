/* 다대다 합 진행: 교환마다 차례로(상태 반영 → BattleStage.clash Promise 기다림 → render), 교환 이벤트 모양, 두 번 누르기 방지, 동기 경로 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o).slice(0,700));};
async function open(vp){
  const p=await (await b.newContext({viewport:vp})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
  await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>localStorage.clear()); await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>{ const G=__studyGame, s=G.save; s.unlockedKeyIds=["novice","reading-room","archivist"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
  await p.waitForTimeout(900);
  return {p,errs};
}
/* a1 주사위 0 은 적 주사위와 합, 나머지는 적의 일방 공격 */
const arrange=`(()=>{ const G=__studyGame, A=G.battleApi, B=G.battle, U=id=>B.units.find(u=>u.id===id);
  A.setRng(()=>0.5); if(B.phase==="question") A.answer(true);
  const X=A.internals().a1; X.handIds.splice(0,X.handIds.length,"turn-page","cover-slam"); U("a1").light=3;
  const e1=U("e1"); U("a1").dice[0].speed=9;
  const r=A.assign("a1",0,"turn-page",{unit:"e1",die:0});
  return {clash:r.clash}; })()`;

/* ---------- 1) 동기 경로: 이벤트 모양 ---------- */
{ const {p,errs}=await open({width:844,height:390});
  const r=await p.evaluate(`(()=>{ ${arrange}; const ev=__studyGame.battleApi.resolveOnly(); return ev.filter(e=>e.kind!=="skip"); })()`);
  const c=r.find(e=>e.kind==="clash"), o=r.find(e=>e.kind==="one-sided");
  ok(!!c&&c.a.unit==="a1"&&c.a.die===0&&c.a.card==="turn-page"&&c.b&&c.b.unit==="e1"&&c.b.die===0&&/^e1@/.test(c.b.card)&&c.target==="e1","clash ev: a = faster die {unit,die,card}, b = partner, target",c&&{a:c.a,b:c.b,target:c.target});
  ok(!!c&&c.a.values.length>=1&&c.steps.every(s=>"aVal" in s&&"bVal" in s&&["a","b","tie"].includes(s.winner)&&(s.dmg===null||typeof s.dmg.unit==="string"&&typeof s.dmg.hp==="number"&&typeof s.dmg.stagger==="number")),"clash steps: aVal/bVal/winner/dmg",c&&c.steps.map(s=>({aVal:s.aVal,bVal:s.bVal,winner:s.winner,dmg:s.dmg})));
  ok(!!c&&c.steps.filter(s=>s.aVal!=null).map(s=>s.aVal).join()===c.a.values.join(),"a.values = rolled values per step",c&&{v:c.a.values});
  ok(!!o&&o.a.side==="enemy"&&["human","machine","puppet"].includes(o.a.body)&&o.a.form&&typeof o.a.leader==="boolean","ev.a/ev.b carry enemy body/form/leader",o&&o.a);
  ok(!!o&&o.b===null&&o.a.unit.startsWith("e")&&typeof o.target==="string"&&o.steps.every(s=>s.bVal===null),"one-sided ev: b null, target set",o&&{a:o.a,target:o.target,steps:o.steps.map(s=>({aVal:s.aVal,winner:s.winner,dmg:s.dmg}))});
  ok(r.every(e=>e.result&&Array.isArray(e.result.staggered)&&Array.isArray(e.result.dead)),"every exchange has result{staggered,dead}",r.map(e=>e.result));
  ok(r.every(e=>e.ally&&e.enemy&&e.by&&"win" in e&&e.snap),"old fields kept (ally, enemy, by, win, snap)",Object.keys(r[0]||{}));
  ok(r.every(e=>e.expr&&Object.values(e.expr).every(x=>["idle","win","hurt","shock"].includes(x))&&e.a.expr&&(e.b===null||e.b.expr)&&e.steps.every(s=>s.expr&&Object.keys(s.expr).length===2)),"expr on ev (ev.expr, a.expr, b.expr, steps[].expr)",r.map(e=>({ex:e.expr,a:e.a.expr,b:e.b&&e.b.expr,st:e.steps.map(s=>s.expr)})));
  ok(!!c&&(c.win==="ally"?c.expr.a1==="win"||c.expr.a1==="hurt":true)&&c.steps.every(s=>s.dmg?["hurt","shock"].includes(s.expr[s.dmg.unit]):true),"expr follows the exchange (winner smiles, damaged hurt)",c&&{win:c.win,expr:c.expr,steps:c.steps.map(s=>({o:s.outcome,dmg:s.dmg,ex:s.expr}))});
  const ex=await p.evaluate(()=>__studyGame.battle.units.map(u=>({id:u.id,expr:u.expr,st:u.staggered,hp:u.hp,body:u.body,form:u.form,leader:u.leader})));
  ok(ex.every(u=>["idle","win","hurt","shock"].includes(u.expr)&&(!u.st||u.expr==="shock")),"every unit has expr; staggered → shock",ex);
  ok(ex.filter(u=>u.id[0]==="e").every(u=>["human","machine","puppet"].includes(u.body)&&["basic","ritual","knowledge","chaos"].includes(u.form)&&typeof u.leader==="boolean")&&ex.find(u=>u.id==="e1").leader===true,"enemy units carry body/form/leader",ex);
  const eb=await p.evaluate(()=>{ const T=__studyGame.battleApi.ENEMY_BODY; return {n:Object.keys(T||{}).length,bad:__studyGame.battle.units.filter(u=>u.side==="enemy"&&T[u.key]&&T[u.key]!==u.body).map(u=>[u.key,u.body]),
    keys:__studyGame.battle.units.filter(u=>u.side==="enemy").map(u=>u.key+":"+u.body),vals:[...new Set(Object.values(T||{}))].sort().join()}; });
  /* 판례집의 망령은 데이터에서 빠져 표에서도 제거(29→28) */
  ok(eb.n===28&&eb.vals==="human,machine,puppet"&&eb.bad.length===0,"ENEMY_BODY default table applied by enemy key",eb);
  const ph=await p.evaluate(()=>__studyGame.battle.phase);
  ok(ph==="end"||ph==="resolve","resolveOnly runs the whole 막 synchronously",ph);
  /* resolve() (즉시) 도 기다림 없이 다음 막으로 */
  await p.evaluate(()=>{ __studyGame.battleApi.begin("beccaria"); }); await p.waitForTimeout(900);
  const s=await p.evaluate(`(()=>{ ${arrange}; const t0=performance.now(); const ev=__studyGame.battleApi.resolve(); return {n:ev.length,ms:performance.now()-t0,phase:__studyGame.battle.phase,scene:__studyGame.battle.scene}; })()`);
  ok(s.n>0&&s.ms<500&&(s.phase==="question"&&s.scene===2||s.phase==="end"),"battleApi.resolve() is synchronous (no animation wait)",s);
  ok(errs.length===0,"no errors (sync)",errs); await p.context().close(); }

/* ---------- 2) 애니메이션 경로: 교환마다 clash Promise 를 기다린다 ---------- */
for(const vp of [{width:390,height:844},{width:844,height:390}]){ const tag=vp.width+"x"+vp.height;
  const {p,errs}=await open(vp);
  await p.evaluate(arrange); await p.evaluate(()=>__studyGame.renderBattle());
  await p.evaluate(()=>{ const BS=window.BattleStage; BS.clashMs=40; BS.hitAt=10; const L=window.__cl={calls:[],focus:[],release:[],auto:false,stateAt:[]};
    const orig=BS.clash, of=BS.focus;
    BS.clash=(ev,o)=>{ L.opts=(L.opts||[]).concat([o&&typeof o==="object"&&"fast" in o]); L.fasts=(L.fasts||[]).concat([!!(o&&o.fast)]); const B=__studyGame.battle; L.calls.push({kind:ev.kind,a:ev.a&&ev.a.unit,b:ev.b&&ev.b.unit,target:ev.target});
      L.stateAt.push(B.units.every(u=>u.hp===ev.snap[u.id].hp));
      if(L.auto) return Promise.resolve(); return new Promise(r=>L.release.push(r)); };
    __studyGame.battleApi.hooks.onSceneEnd.push(e=>{ L.endEvents=e.events.filter(x=>x.kind!=="skip").length; }); BS.focus=(ev,fast)=>{ L.focus.push(ev?ev.kind:null); return of&&of.call(BS,ev,fast); }; });
  await p.evaluate(()=>__studyGame.battleApi.resolve({animate:true}));
  await p.waitForFunction(()=>window.__cl.calls.length>=1,null,{timeout:5000});
  await p.waitForTimeout(400);
  const s1=await p.evaluate(()=>({n:__cl.calls.length,phase:__studyGame.battle.phase,ev:__studyGame.battleApi.mb.events?null:null,stateAt:__cl.stateAt[0],evn:(__studyGame.battleApi.resolving&&__studyGame.battleApi.resolving())?1:0}));
  ok(s1.n===1&&s1.phase==="resolve","waits on the first clash Promise before the next exchange "+tag,s1);
  ok(s1.stateAt===true,"state of that exchange already applied when clash(ev) is called "+tag,s1);
  ok(s1.evn===1,"battleApi.resolving() returns the running Promise "+tag,s1);
  /* 두 번 누르기 방지 */
  const dbl=await p.evaluate(()=>{ const r0=__studyGame.battleApi.resolve({animate:true}); const r=__studyGame.battleApi.resolve({animate:true}); return {r0,r,calls:__cl.calls.length,resolving:!!__studyGame.battleApi.resolving()}; });
  ok(dbl.r0===null&&dbl.r===null&&dbl.resolving&&dbl.calls===1,"'합 진행' can't double-trigger while resolving "+tag,dbl);
  await p.evaluate(()=>{ BattleStage.onSkip&&BattleStage.onSkip(); __cl.release.shift()(); });
  await p.waitForFunction(()=>window.__cl.calls.length>=2||__studyGame.battle.phase!=="resolve",null,{timeout:5000});
  await p.evaluate(()=>{ __cl.auto=true; __cl.release.splice(0).forEach(r=>r()); });
  await p.waitForFunction(()=>__studyGame.battle.phase!=="resolve",null,{timeout:20000});
  const s2=await p.evaluate(()=>({calls:__cl.calls,opts:__cl.opts,fasts:__cl.fasts,stateAt:__cl.stateAt,phase:__studyGame.battle.phase,scene:__studyGame.battle.scene,events:__cl.endEvents}));
  ok(s2.calls.length===s2.events&&s2.calls.some(c=>c.kind==="clash")&&s2.calls.some(c=>c.kind==="one-sided"),"every exchange (clash and one-sided) goes through BattleStage.clash in order "+tag,{calls:s2.calls,events:s2.events});
  ok(s2.stateAt.every(Boolean),"state applied per exchange before each clash call "+tag,s2.stateAt);
  ok(s2.fasts[0]===false&&s2.fasts.slice(1).every(Boolean),"after onSkip (tap/hold) the remaining exchanges run fast "+tag,s2.fasts);
  ok(s2.opts.length===s2.events&&s2.opts.every(Boolean),"clash(ev,{fast}) called with the fast option "+tag,s2.opts);
  ok(s2.phase==="question"&&s2.scene===2||s2.phase==="end","moves on to the next 막 "+tag,s2);
  ok(errs.length===0,"no errors "+tag,errs); await p.context().close();
}
/* ---------- 3) clash 가 Promise 를 안 돌려줘도(또는 무대 없음) 그냥 진행 ---------- */
{ const {p,errs}=await open({width:390,height:844});
  await p.evaluate(arrange); await p.evaluate(()=>{ __studyGame.renderBattle(); BattleStage.clashMs=30; BattleStage.hitAt=10; BattleStage.clash=()=>undefined; });
  await p.evaluate(()=>__studyGame.battleApi.resolve({animate:true})); await p.waitForFunction(()=>__studyGame.battle.phase!=="resolve",null,{timeout:20000});
  ok(true,"non-promise clash: resolve completes");
  ok(errs.length===0,"no errors (non-promise)",errs); await p.context().close(); }
/* ---------- 4) 실제 무대 clash Promise 로 끝까지 ---------- */
{ const {p,errs}=await open({width:390,height:844});
  await p.evaluate(arrange); await p.evaluate(()=>{ __studyGame.renderBattle(); Object.assign(BattleStage,{clashMs:200,hitAt:60,stepMs:40,maxClashMs:300,camOutMs:40}); });
  const t0=Date.now(); await p.evaluate(()=>__studyGame.battleApi.resolve({animate:true})); await p.waitForFunction(()=>__studyGame.battle.phase!=="resolve",null,{timeout:20000});
  const r=await p.evaluate(()=>({phase:__studyGame.battle.phase,scene:__studyGame.battle.scene}));
  ok(r.phase==="question"&&r.scene===2||r.phase==="end","real BattleStage.clash Promise flow completes the 막",{...r,ms:Date.now()-t0});
  ok(errs.length===0,"no errors (real stage)",errs); await p.context().close(); }
/* ---------- 5) 합 단계 필드 (UI 합 연출용): aDie/bDie, aResult/bResult, blocked, recovered ---------- */
{ const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  const R=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, s=G.save, card=G.engine.PAGE_BY["turn-page"], keep=JSON.stringify(card.dice);
    G.libs.setParty(s,["kyu"]);
    /* aDice: 사서 '첫 장 넘기기' 주사위(최소=최대로 고정), eDice: 적 e1 주사위 0 의 책장 주사위, oneSided: 사서는 주사위를 안 쓰고 적만 공격 */
    function run(aDice,eDice,o){ o=o||{}; card.dice=aDice; A.create("pomodoro",{rng:()=>0.5}); const m=A.mb, B=m.battle, X=A.internals(), U=id=>B.units.find(u=>u.id===id);
      A.answer(true); const a1=U("a1"), e1=U("e1");
      for(const u of B.units.filter(u=>u.side==="enemy")) if(u!==e1) u.dice=[];
      e1.dice=e1.dice.slice(0,1); e1.dice[0].target={unit:"a1",die:0}; X.e1.diePages[0]={...X.e1.diePages[0],dice:eDice};
      if(o.eSt!=null){ X.e1.cu.st=o.eSt; e1.stagger=o.eSt; }
      if(o.aSt!=null){ X.a1.cu.st=o.aSt; a1.stagger=o.aSt; }
      a1.dice=a1.dice.slice(0,1);
      if(!o.oneSided){ const H=X.a1.handIds; H.splice(0,H.length,"turn-page"); a1.light=3; a1.dice[0].speed=9; e1.dice[0].speed=1; A.assign("a1",0,"turn-page",{unit:"e1",die:0}); }
      else a1.dice=[];
      const ev=(A.resolveOnly()||[]).find(e=>e.kind==="clash"||e.kind==="one-sided"); card.dice=JSON.parse(keep);
      return ev?{kind:ev.kind,a:ev.a.unit,steps:ev.steps.map(s=>({aDie:s.aDie,bDie:s.bDie,aResult:s.aResult,bResult:s.bResult,blocked:s.blocked,recovered:s.recovered,dmg:s.dmg,pd:s.pd,gd:s.gd,pRange:s.pRange,gRange:s.gRange,ev:s.events}))}:null; }
    const out={};
    out.win  =run([{type:"참격",min:9,max:9}],[{type:"참격",min:1,max:1}]);
    out.lose =run([{type:"참격",min:1,max:1}],[{type:"참격",min:60,max:60}]);
    /* 비김: 먼저 한 번 굴려 사서 값을 알아낸 뒤, 적 값을 그 값이 되게(적 범위 보정까지) 찾는다 */
    { const probe=run([{type:"참격",min:8,max:8}],[{type:"참격",min:1,max:1}]); const want=probe.steps[0].aDie.value; let hit=null;
      for(let v=1;v<=80&&!hit;v++){ const r=run([{type:"참격",min:8,max:8}],[{type:"참격",min:v,max:v}]); if(r.steps[0].bDie&&r.steps[0].bDie.value===want) hit=r; }
      out.draw=hit; }
    out.blockWin =run([{type:"참격",min:6,max:6}],[{type:"방어",min:60,max:60}]);
    out.blockLose=run([{type:"참격",min:20,max:20}],[{type:"방어",min:3,max:3}]);
    out.evade    =run([{type:"참격",min:4,max:4}],[{type:"회피",min:60,max:60},{type:"참격",min:1,max:1}],{eSt:20});
    out.one      =run([{type:"참격",min:4,max:4}],[{type:"참격",min:5,max:5}],{oneSided:true});
    out.allyBlock=run([{type:"방어",min:60,max:60}],[{type:"참격",min:5,max:5}]);
    out.allyEvade=run([{type:"회피",min:60,max:60}],[{type:"참격",min:5,max:5}],{aSt:10});
    out.sE=A.enemyScale(1); out.allyStMax=A.MB.HP.allySt;
    out.ally0=G.engine.PAGE_BY["turn-page"].dice;
    return out; });
  const s0=k=>R[k]&&R[k].steps[0]||{}; const sideA=k=>R[k]&&R[k].a==="a1";
  /* 먼저 움직인 쪽(a)이 사서인지 적인지에 따라 a/b 를 사서/적으로 읽는다 */
  const AL=k=>sideA(k)?{die:s0(k).aDie,res:s0(k).aResult}:{die:s0(k).bDie,res:s0(k).bResult}, EN=k=>sideA(k)?{die:s0(k).bDie,res:s0(k).bResult}:{die:s0(k).aDie,res:s0(k).aResult};
  const dieOk=(d,raw,rng)=>!!d&&d.type===raw.type&&d.value===raw.roll&&d.min===rng[0]&&d.max===rng[1]&&d.value>=d.min&&d.value<=d.max&&d.idx===0&&d.reused===false;
  { const w=s0("win"); ok(R.win&&R.win.kind==="clash"&&dieOk(AL("win").die,w.pd,w.pRange)&&dieOk(EN("win").die,w.gd,w.gRange)&&AL("win").die.type==="참격","aDie/bDie = {type (engine value), min/max (applied range), value, idx, reused}",{a:w.aDie,b:w.bDie,pr:w.pRange,gr:w.gRange}); }
  ok(AL("win").res==="win"&&EN("win").res==="lose"&&s0("win").blocked===0&&s0("win").recovered===0,"attack beats attack: win / lose, blocked 0",s0("win"));
  ok(AL("lose").res==="lose"&&EN("lose").res==="win","attack loses: lose / win",s0("lose"));
  ok(!!R.draw&&s0("draw").aResult==="draw"&&s0("draw").bResult==="draw"&&s0("draw").blocked===0,"tie: both draw",R.draw&&s0("draw"));
  { const st=s0("blockWin"), full=Math.max(1,Math.floor(AL("blockWin").die.value*1*R.sE));
    ok(EN("blockWin").res==="block"&&AL("blockWin").res==="lose"&&st.blocked>0&&st.blocked>=AL("blockWin").die.value*R.sE*0.5,"defense beats attack: block / lose, blocked = whole attack (× enemy scale)",{st,full}); }
  { const st=s0("blockLose"), a=AL("blockLose").die.value, d=EN("blockLose").die.value;
    ok(AL("blockLose").res==="win"&&EN("blockLose").res==="lose"&&st.blocked>0&&st.dmg&&st.dmg.hp>0&&Math.abs(st.blocked/(st.dmg.hp+st.blocked)-d/a)<0.1,"defense loses: blocked = defense value's share of the hit (scaled), damage still lands",{st,a,d}); }
  { const st=s0("evade"), rec=(st.ev||[]).filter(e=>e.kind==="recover").reduce((t,e)=>t+e.st,0);
    ok(EN("evade").res==="evade"&&AL("evade").res==="lose"&&st.recovered>0&&st.recovered===rec&&st.blocked===0,"evade beats attack: evade / lose, recovered = stagger regained",{st,rec}); }
  { const r=R.one, st=s0("one"); ok(r&&r.kind==="one-sided"&&st.aResult==="win"&&st.bResult===null&&st.bDie===null&&st.aDie&&st.aDie.type==="참격"&&st.blocked===0,"one-sided attack: attacker win, receiver null",r); }
  { const st=s0("allyBlock"), e=EN("allyBlock").die; ok(AL("allyBlock").res==="block"&&EN("allyBlock").res==="lose"&&e&&st.blocked===e.value&&(!st.dmg||st.dmg.hp===0),"librarian defense beats enemy attack: blocked = enemy value ×1 (no scale on librarian side)",{st,e}); }
  { const st=s0("allyEvade"), rec=(st.ev||[]).filter(e=>e.kind==="recover").reduce((t,e)=>t+e.st,0);
    ok(AL("allyEvade").res==="evade"&&st.recovered>0&&st.recovered===rec&&st.recovered<=R.allyStMax-10&&st.recovered<=AL("allyEvade").die.value,"librarian evade: recovered ×1 (no scale), capped by max stagger",{st,rec}); }
  ok(JSON.stringify(R.ally0)==='[{"type":"참격","min":2,"max":5}]',"test restored the card dice",R.ally0);
  ok(errs.length===0,"no errors (step fields)",errs); await p.context().close(); }
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
