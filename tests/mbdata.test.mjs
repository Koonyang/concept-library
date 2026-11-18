/* 주사위 비율 변동(COMBAT.pct, 1:1·다대다 공통), 다대다 카드 데이터(cardInfo usable/reason/emotionReq), 감정 단계 거부, 배치 되돌리기(unassign 빛 환불·onUnassign·자동 진행 없음) */
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
const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
await p.evaluate(()=>localStorage.clear()); await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);

/* ---------- 1) 비율 변동 ---------- */
const r=await p.evaluate(()=>{ const E=__studyGame.engine, P=E.playerDieRange, G=E.guestDieRange, d={type:"참격",min:6,max:9};
  return {pct:E.COMBAT.pct, right:P(d,true,false,0,0), wrong:P(d,false,false,0,0), keyRight:P(d,true,true,0,0), keyWrong:P(d,false,true,0,0), emo2:P(d,true,false,2,0), emoWrong:P(d,false,false,4,0),
    dieMin:P(d,true,false,0,1), small:P({min:1,max:2},true,false,0,0), smallW:P({min:1,max:2},false,false,0,0),
    gRight:G(d,true,false), gWrong:G(d,false,false), gKeyWrong:G(d,false,true), gKeyRight:G(d,true,true)}; });
const eq=(a,b)=>a&&a[0]===b[0]&&a[1]===b[1];
ok(JSON.stringify(r.pct)===JSON.stringify({right:0.2,wrong:0.2,keyRight:0.3,keyWrong:0.3,emotionPer:0.05,guestRight:0.2,guestKeyWrong:0.2}),"COMBAT.pct constants",r.pct);
ok(eq(r.right,[7,11]),"6~9 normal correct (emotion 0) → 7~11",r.right);
ok(eq(r.wrong,[5,7]),"6~9 normal wrong → 5~7",r.wrong);
ok(eq(r.keyRight,[8,12])&&eq(r.keyWrong,[4,6]),"key: correct 8~12, wrong 4~6",{kr:r.keyRight,kw:r.keyWrong});
ok(eq(r.emo2,[8,12])&&eq(r.emoWrong,[5,7]),"emotion adds 5%/stage only when correct",{e2:r.emo2,ew:r.emoWrong});
ok(eq(r.dieMin,[8,11]),"dieMin still adds to the low end",r.dieMin);
ok(eq(r.small,[2,3])&&eq(r.smallW,[1,1]),"each end moves at least 1, floor 1, hi≥lo",{s:r.small,w:r.smallW});
ok(eq(r.gRight,[5,7])&&eq(r.gWrong,[6,9])&&eq(r.gKeyWrong,[7,11])&&eq(r.gKeyRight,[5,7]),"guest: correct −20%, normal wrong unchanged, key wrong +20%",{r:r.gRight,w:r.gWrong,kw:r.gKeyWrong});

/* ---------- 2) 다대다 카드 데이터 ---------- */
await p.evaluate(()=>{ const G=__studyGame, s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
await p.waitForTimeout(900);
const c=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, B=G.battle, U=id=>B.units.find(u=>u.id===id), X=A.internals().a1, E=G.engine;
  const emoCard=E.COMBAT_PAGES.find(x=>(x.emotion||0)>=2), cheap=E.COMBAT_PAGES.find(x=>!(x.emotion||0)&&(x.cost||0)>=2);
  A.answer(true); X.handIds.splice(0,X.handIds.length,"turn-page",emoCard.id,cheap.id); const u=U("a1"); u.emotion=0; u.light=1;
  const i1=A.cardInfo(emoCard.id,"a1"), i2=A.cardInfo(cheap.id,"a1"), i3=A.cardInfo("turn-page","a1");
  const rej=A.assign("a1",0,emoCard.id,{unit:"e1",die:0});
  u.emotion=2; u.light=9; const i4=A.cardInfo(emoCard.id,"a1"); const acc=A.assign("a1",0,emoCard.id,{unit:"e1",die:0}); if(acc.ok) A.unassign("a1",0);
  return {emo:{id:emoCard.id,req:emoCard.emotion},i1:{req:i1.emotionReq,u:i1.usable,r:i1.reason},i2:{u:i2.usable,r:i2.reason,cost:i2.cost},i3:{u:i3.usable,r:i3.reason},rej,i4:{u:i4.usable,r:i4.reason},acc,emotion:u.emotion}; });
ok(c.i1.req===c.emo.req&&c.i1.u===false&&c.i1.r==="emotion","emotion-locked card: emotionReq, usable:false, reason 'emotion'",c);
ok(c.i2.u===false&&c.i2.r==="light"&&c.i3.u===true&&c.i3.r===null,"light check: too expensive → 'light', affordable → usable",c);
ok(c.rej.ok===false&&c.rej.reason==="emotion"&&c.i4.u===true&&c.acc.ok===true,"assign refuses below the emotion stage; allowed once unit.emotion reaches it",c);

/* ---------- 3) 배치 되돌리기 ---------- */
const un=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, B=G.battle, U=id=>B.units.find(u=>u.id===id), X=A.internals().a1, X2=A.internals().a2;
  if(!A.internals().a2) return {noA2:Object.keys(A.internals()),party:G.save.party}; const got=[]; A.hooks.onUnassign.push((m,e)=>got.push(e)); const as=[]; A.hooks.onAssign.push((m,e)=>as.push(e));
  X.handIds.splice(0,X.handIds.length,"turn-page","cover-slam"); X2.handIds.splice(0,X2.handIds.length,"turn-page","focus-line");
  U("a1").emotion=0; U("a1").light=3; U("a2").light=3;
  const l0=U("a1").light;
  const r1=A.assign("a1",0,"cover-slam",{unit:"e1",die:0}), r2=A.assign("a1",1,"turn-page",{unit:"e1",die:null}), r3=A.assign("a2",0,"turn-page",{unit:"e1",die:null}), r4=A.assign("a2",1,"focus-line",{unit:"e1",die:null});
  const after=U("a1").light, phaseAll=B.phase;
  const u1=A.unassign("a1",0);
  return {r:[r1.ok,r2.ok,r3.ok,r4.ok],l0,after,back:U("a1").light,cost:G.engine.PAGE_BY["cover-slam"].cost,u1,inHand:X.handIds.includes("cover-slam"),die:U("a1").dice[0],got,as:as.length,phaseAll,phase:B.phase}; });
ok(un.r.every(Boolean)&&un.phaseAll==="assign","assigning every die does not auto-advance (phase stays 'assign')",un);
ok(un.u1===true&&un.back===un.after+un.cost&&un.inHand&&un.die.card===null&&un.die.target===null,"unassign: card back to hand, light refunded, die cleared",un);
ok(un.got.length===1&&un.got[0].unit==="a1"&&un.got[0].die===0&&un.got[0].card==="cover-slam"&&un.got[0].refund===un.cost&&un.as===4,"onUnassign hook {unit,die,card,refund}; onAssign per assign",{got:un.got,as:un.as});
const tap=await p.evaluate(async()=>{ const A=__studyGame.battleApi; __studyGame.renderBattle(); await new Promise(r=>setTimeout(r,200));
  /* 무대 쪽 onUnassign 경로(이미 놓인 주사위를 다시 누름)도 같은 엔진 함수를 쓴다 */
  const ok1=typeof BattleStage.onUnassign==="function"; if(ok1) BattleStage.onUnassign("a1",1);
  return {ok1,card:__studyGame.battle.units.find(u=>u.id==="a1").dice[1].card,phase:__studyGame.battle.phase}; });
ok(tap.ok1&&tap.card===null&&tap.phase==="assign","BattleStage.onUnassign → battleApi.unassign (still in assign)",tap);
/* ---------- 4) 정답 흐트러짐 배율 (1:1 과 같음: 사서→적 만 ×1.25 / 핵심 ×1.75, 적→사서 ×1) ---------- */
const stg=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, E=G.engine, out={c:E.COMBAT.correctStagger,k:E.COMBAT.keyCorrectStagger};
  const run=(correct,isKey)=>{ A.begin("beccaria"); const B=G.battle, U=id=>B.units.find(u=>u.id===id), X=A.internals();
    A.setRng(()=>0.5); if(A.mb.cur) A.mb.cur.isKey=isKey; A.answer(correct);
    X.a1.handIds.splice(0,X.a1.handIds.length,"turn-page"); U("a1").light=3; U("a1").emotion=0; X.a1.mods={...X.a1.mods,staggerPct:0,dmgPct:0};
    B.units.filter(u=>u.side==="enemy").forEach(e=>e.dice.forEach((d,k)=>A.setEnemyTarget(e.id,k,{unit:"a2",die:null})));
    A.setEnemyTarget("e1",0,{unit:"a1",die:null});
    U("a1").dice[0].speed=9; A.assign("a1",0,"turn-page",{unit:"e1",die:null});
    const pre=JSON.parse(JSON.stringify(X.e1.cu)), preA=JSON.parse(JSON.stringify(X.a1.cu));
    const ev=A.resolveOnly(); const mine=ev.find(e=>e.by&&e.by.unit==="a1"&&e.by.die===0), theirs=ev.find(e=>e.kind==="one-sided"&&e.by&&e.by.unit==="e1"&&e.target==="a1");
    /* 적이 받는 실제 피해는 MB.SCALE_ENEMY[사서 수] 배, 사서가 받는 피해는 배율 없음(오답 막만 MB.WRONG 배) (다대다 전용) */
    const S=A.enemyScale(B.units.filter(u=>u.side==="ally").length), W=correct?{hp:1,st:1}:A.MB.WRONG;
    const st=mine.steps[0], exp=E.hitUnit({...pre},st.pd.type,st.pd.roll,{hp:S,st:S*(correct?(isKey?E.COMBAT.keyCorrectStagger:E.COMBAT.correctStagger):1)}).st;
    let expA=null, gotA=null; if(theirs){ const s2=theirs.steps.find(s=>s.dmg&&s.dmg.unit==="a1"); if(s2){ gotA=s2.dmg.stagger; expA=E.hitUnit({...preA},s2.gd.type,s2.gd.roll,{hp:W.hp,st:W.st}).st; } }
    return {got:st.dmg&&st.dmg.stagger,exp,expNoMul:E.hitUnit({...pre},st.pd.type,st.pd.roll,{hp:S,st:S}).st,gotA,expA}; };
  out.right=run(true,false); out.key=run(true,true); out.wrong=run(false,false); return out; });
ok(stg.c===1.25&&stg.k===1.75,"COMBAT.correctStagger 1.25 / keyCorrectStagger 1.75",{c:stg.c,k:stg.k});
ok(stg.right.got===stg.right.exp&&stg.right.exp>stg.right.expNoMul,"correct: librarian→enemy stagger ×1.25",stg.right);
ok(stg.key.got===stg.key.exp&&stg.key.exp>stg.key.expNoMul&&stg.key.exp>=stg.right.exp,"key correct: librarian→enemy stagger ×1.75",stg.key);
ok(stg.wrong.got===stg.wrong.exp&&stg.wrong.exp===stg.wrong.expNoMul,"wrong: no stagger multiplier",stg.wrong);
ok([stg.right,stg.key].every(r=>r.gotA!=null&&r.gotA===r.expA),"enemy→librarian stagger is never multiplied (1:1 와 같음)",{r:[stg.right.gotA,stg.right.expA],k:[stg.key.gotA,stg.key.expA]});
/* ---------- 5) 적 수 상한 3 (manyEnemies / enemyMax 만 4~5), 우두머리 유지, 빠진 적의 문제는 남은 적에게 ---------- */
const cap=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, out={MB:A.MB.ENEMY_MAX,rows:[],bad:[]};
  for(const g of G.data.WEAK_POINTS){ A.begin(g.id); const m=A.mb, en=G.battle.units.filter(u=>u.side==="enemy"), X=A.internals();
    const orig=(g.enemies||[]), origQ=new Set(orig.flatMap(e=>e.q||[])), nowQ=new Set(en.flatMap(u=>X[u.id].e.q||[]));
    const leadKey=(orig.find(e=>e.leader)||{}).key;
    if(en.length>A.enemyCap(g.id)) out.bad.push(g.id+":count");
    if(orig.length&&leadKey&&!en.some(u=>u.key===leadKey)) out.bad.push(g.id+":leader");
    if(orig.length&&[...origQ].some(q=>!nowQ.has(q))) out.bad.push(g.id+":qlost");
    if(orig.length>3) out.rows.push({g:g.id,n:orig.length,shown:en.map(u=>u.key),dropped:m.droppedEnemies}); }
  /* 시험용 무리: 실제 데이터엔 이제 4명 이상 손님이 없으므로, 한 손님을 잠깐 6명(우두머리는 뒤쪽 5번째) + 적마다 q 를 나눠 단 가짜 무리로 바꿔 검사 후 되돌림 */
  const g=G.data.WEAK_POINTS.find(x=>(x.enemies||[]).some(e=>e.leader)&&new Set((x.enemies||[]).flatMap(e=>e.q||[])).size>=3), save={en:g.enemies,me:g.manyEnemies,em:g.enemyMax};
  const qs=[...new Set(save.en.flatMap(e=>e.q||[]))], base=save.en.find(e=>e.leader), oth=save.en.find(e=>!e.leader)||base;
  const fake=[0,1,2,3,4,5].map(i=>({...(i===4?base:oth),key:i===4?base.key:"fake-foe-"+i,leader:i===4,q:qs.filter((_,k)=>k%6===i)}));
  const allQ=new Set(fake.flatMap(e=>e.q)), run=()=>{ A.begin(g.id); const X=A.internals(), en=G.battle.units.filter(u=>u.side==="enemy"), now=new Set(en.flatMap(u=>X[u.id].e.q||[]));
    return {shown:en.length,keys:en.map(u=>u.key),lead:en.some(u=>u.key===base.key),qSame:now.size===allQ.size&&[...allQ].every(q=>now.has(q)),dropped:A.mb.droppedEnemies}; };
  g.enemies=fake; g.manyEnemies=undefined; g.enemyMax=undefined; out.def=run(); out.defCap=A.enemyCap(g.id);
  g.manyEnemies=true; out.many=run(); out.many.cap=A.enemyCap(g.id);
  g.manyEnemies=undefined; g.enemyMax=4; out.em4=run();
  g.enemies=save.en; g.manyEnemies=save.me; g.enemyMax=save.em; A.begin(g.id); out.back=G.battle.units.filter(u=>u.side==="enemy").length; out.backN=save.en.length;
  return out; });
ok(cap.MB===3&&cap.bad.length===0,"default cap 3: leader always kept, every original question id still reachable",cap);
ok(cap.defCap===3&&cap.def.shown===3&&cap.def.lead&&cap.def.qSame&&cap.def.dropped.length===3&&cap.def.dropped.every(d=>d.moved.every(m=>cap.def.keys.includes(m.to))),"fake 6-squad, default → 3 shown, leader (5th) kept, dropped questions moved to kept enemies, q-id set unchanged",cap.def);
ok(cap.many.cap===5&&cap.many.shown===5&&cap.many.lead&&cap.many.qSame,"manyEnemies → 5 shown, leader kept, q-id set unchanged",cap.many);
ok(cap.em4.shown===4&&cap.em4.lead&&cap.em4.qSame,"enemyMax:4 → 4 shown, q-id set unchanged",cap.em4);
ok(cap.back===Math.min(3,cap.backN),"restored guest back to its own count",{back:cap.back,n:cap.backN});
console.log("TRUNCATED",JSON.stringify(cap.rows));

/* ---------- 6) 다대다 체력 밸런스: MB.HP(문제 수 비례)·1:1 값 그대로·판 길이 보정(MB.PACE)·간이 시뮬레이션 ---------- */
await p.evaluate(()=>localStorage.clear()); await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);   /* 깨끗한 저장으로 */
const bal=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, C=G.engine.COMBAT, s=G.save, out={bad:[]};
  out.c11={hp:C.playerStartHp,ps:C.playerStagger,psMax:G.engine.playerStaggerMax?G.engine.playerStaggerMax(12):null,noLv:C.hpPerLevel===undefined&&C.playerStaggerPerLevel===undefined&&C.xpByWeakness===undefined,gh:C.guestHp,gs:C.guestStagger};
  out.hasHP=!!(A.MB.HP&&A.MB.PACE&&A.MB.DICE);
  const H=A.MB.HP; out.S=A.enemyScale(1); out.SE=A.MB.SCALE_ENEMY; out.noOld=A.MB.SCALE===undefined; out.pace={hold:A.MB.PACE.hold,drain:A.MB.PACE.drain};
  for(const g of G.data.WEAK_POINTS){ A.create(g.id); const B=A.mb.battle, en=B.units.filter(u=>u.side==="enemy"), al=B.units.filter(u=>u.side==="ally"), Q=A.questionCount(g.id), S=A.enemyScale(al.length);
    const sum=en.reduce((t,u)=>t+u.maxHp,0), tot=A.enemyHpTotal(g.id,al.length), per=tot/Q/(H.enemyHpPerQ[g.weakness]*H.party[al.length-1]);
    if(Math.abs(sum-tot*S)>(en.length+H.minHp)*S) out.bad.push(g.id+":sum "+sum+"/"+tot*S);
    if(per<0.95||per>1+H.floorStep*3+0.05) out.bad.push(g.id+":perQ "+per);
    const X=A.internals(), qn=u=>Math.max(1,(X[u.id].e.q||[]).length), sq=en.reduce((t,u)=>t+qn(u),0);
    for(const u of en){ const exp=Math.max(H.minHp,Math.round(tot*qn(u)/sq))*S; if(u.maxHp!==exp) out.bad.push(g.id+":"+u.key+" hp "+u.maxHp+"≠"+exp+" (q "+qn(u)+"/"+sq+")"); }
    if(g.id==="defamation-truth") out.dt=en.map(u=>({key:u.key,q:qn(u),hp:u.maxHp,st:u.maxStagger,leader:u.leader}));
    if(al.some(u=>u.maxHp!==A.allyStats(A.libMods(u.libId),g.id).hp)) out.bad.push(g.id+":allyHp");
    if(A.mb.pace.Q!==Q||A.mb.pace.minScene!==Math.ceil(A.MB.PACE.minRatio*Q)) out.bad.push(g.id+":pace"); }
  const g7=G.data.WEAK_POINTS.find(g=>A.questionCount(g.id)>=6&&A.questionCount(g.id)<=8)||G.data.WEAK_POINTS[0], g14=G.data.WEAK_POINTS.slice().sort((a,b)=>A.questionCount(b.id)-A.questionCount(a.id))[0];
  s.level=12; out.lv={h7:A.allyStats({},g7.id).hp,s7:A.allyStats({},g7.id).st,base:{hp:H.allyHp,st:H.allySt,perLv:H.allyHpPerLv,stPerLv:H.allyStPerLv},long:A.allyStats({},g14.id).hp,q7:A.questionCount(g7.id),q14:A.questionCount(g14.id)}; A.create(g7.id); out.lv.unitIgnoresLevel=A.mb.battle.units.filter(u=>u.side==="ally").every(u=>u.maxStagger===H.allySt); delete s.level;
  out.party=[1,2,3].map(n=>A.enemyHpTotal(g7.id,n));
  const pace0={...A.MB.PACE}; A.MB.PACE.hold=true; A.MB.PACE.drain=true;   /* 기본은 둘 다 꺼짐 — 켰을 때 동작만 확인 */
  /* 보정 ①: minScene 전 우두머리는 1에서 버팀 */
  A.create(g7.id); { const m=A.mb, L=m.battle.units.find(u=>u.side==="enemy"&&u.leader), X=m.x[L.id]; X.cu.hp=1; X.cu.st=99;
    A.answer(true); for(const u of m.battle.units.filter(u=>u.side==="enemy")) if(u!==L){ m.x[u.id].cu.hp=0; u.hp=0; u.dice=[]; }
    const a=m.battle.units.find(u=>u.side==="ally"); const c=A.hand(a.id).find(c=>A.usable(a.id,c).usable&&A.cardOf(c).dice.some(d=>d.type!=="방어"&&d.type!=="회피"));
    L.dice=[]; if(c) A.assign(a.id,0,c,{unit:L.id,die:null}); A.resolveOnly();
    out.hold={card:!!c,hp:L.hp,outcome:m.outcome,held:m.pace.held,scene:m.battle.scene,min:m.pace.minScene}; }
  /* 보정 ②: Q 막째 끝부터 양쪽 모두 drain×n */
  A.create(g7.id); { const m=A.mb; m.battle.scene=m.pace.Q-1; A.nextScene(); A.answer(true);
    const pre=Object.fromEntries(m.battle.units.map(u=>[u.id,u.hp])); for(const u of m.battle.units) u.dice.forEach(d=>{ d.target=null; });
    for(const u of m.battle.units.filter(u=>u.side==="enemy")) u.dice=[]; A.resolveOnly();
    out.drain={scene:m.battle.scene,Q:m.pace.Q,last:m.pace.last,pre,ok:(m.pace.last||[]).length===m.battle.units.length&&(m.pace.last||[]).every(d=>d.hp===Math.max(1,Math.ceil(m.battle.units.find(u=>u.id===d.unit).maxHp*A.MB.PACE.drainPct)))}; }
  Object.assign(A.MB.PACE,pace0);
  /* 피해 배율 SCALE_ENEMY(적만)·오답 벌점 WRONG: 같은 시드로 resolveScene 을 배율 없음/적만, 벌점 없음/있음으로 */
  { const S=out.S, E=G.engine, mk=()=>({P:E.mkUnit(100000,100000),G:E.mkUnit(100000,100000)}), dice=[{type:"참격",min:3,max:8},{type:"관통",min:2,max:6}];
    const run=(o)=>{ const u=mk(); let a=12345; const rng=()=>{a=(a*16807)%2147483647; return a/2147483647;}; const st=E.resolveScene({P:u.P,G:u.G,pDice:dice,gDice:dice,correct:false,isKey:false,rng,...o});
      return {pHp:100000-u.P.hp,pSt:100000-u.P.st,gHp:100000-u.G.hp,gSt:100000-u.G.st,evHp:st.reduce((t,x)=>t+x.events.reduce((q,e)=>q+(e.hp||0),0),0)}; };
    const r1=run({}), rS=run({dmgScale:S,pScale:1}), rW=run({pTaken:A.MB.WRONG}), rWS=run({dmgScale:S,pScale:1,pTaken:A.MB.WRONG});
    out.dmg={r1,rS,rW,rWS,wrong:A.MB.WRONG}; }
  const mul=a=>function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  /* 문제 순서: 처음 Q 막은 모든 문제를 한 번씩(죽은 적 문제는 산 적이 대신), 그다음 틀린 문제부터 */
  { const g=G.data.WEAK_POINTS.find(x=>x.id==="defamation-truth")||g14; A.create(g.id,{rng:mul(99)}); const m=A.mb, B=m.battle, X=A.internals();
    const en=B.units.filter(u=>u.side==="enemy"), dead=en[en.length-1]; X[dead.id].cu.hp=0; dead.hp=0; dead.dice=[];
    const Q=A.questionCount(g.id), seq=[], from=[], wrong=[];
    for(let i=0;i<Q+4&&!m.outcome;i++){ if(i) A.nextScene(); const qid=B.question.id; seq.push(qid); from.push(B.question.fromUnit); const c=!(i%3===1); if(!c&&i<Q) wrong.push(qid); A.answer(c);
      for(const u of B.units) u.dice.forEach(d=>{ d.target=null; }); for(const u of B.units.filter(u=>u.side==="enemy")) u.dice=[]; A.resolveOnly(); }
    const first=seq.slice(0,Q);
    out.qorder={Q,first,uniq:new Set(first).size,pool:Object.keys(m.qpool).length,deadQs:(X[dead.id].e.q||[]),deadAskedBy:first.map((q,i)=>(X[dead.id].e.q||[]).includes(q)?from[i]:null).filter(Boolean),dead:dead.id,
      next:seq.slice(Q,Q+wrong.length),wrong,noAdjRepeat:seq.every((q,i)=>!i||q!==seq[i-1])}; }
  /* 간이 시뮬레이션 (사서 1명 Lv1, 고정 시드, 손님마다 20판) */
  function mulX(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const score=cid=>{ const P=A.cardOf(cid); return P&&P.dice?P.dice.reduce((t,d)=>t+((d.min+d.max)/2)*(d.type==="방어"||d.type==="회피"?0.6:1),0):0; };
  const party0=(s.party||[]).slice(); G.libs.setParty(s,["kyu"]);
  function run(acc,seed){ const rng=mul(seed), R=[];
    for(const g of G.data.WEAK_POINTS) for(let i=0;i<20;i++){ A.create(g.id,{rng}); const m=A.mb; let n=0;
      while(!m.outcome&&n<40){ n++; A.answer(rng()<acc); const B=m.battle, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
        for(const u of B.units.filter(u=>u.side==="ally"&&u.hp>0)) u.dice.forEach((d,k)=>{ const h=A.hand(u.id).filter(c=>A.usable(u.id,c).usable).sort((x,y)=>score(y)-score(x)); if(!h.length) return;
          let t=null; for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id&&ed.target.die===k) t={unit:e.id,die:j}; }); for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id) t={unit:e.id,die:j}; });
          if(!t){ const e=en.slice().sort((x,y)=>x.hp-y.hp)[0]; if(!e) return; t={unit:e.id,die:e.dice.length?0:null}; } A.assign(u.id,k,h[0],t); });
        A.resolveOnly(); if(!m.outcome) A.nextScene(); }
      R.push({win:m.outcome==="win",r:n/m.pace.Q}); }
    const rs=R.map(x=>x.r).sort((a,b)=>a-b); return {n:R.length,win:+(R.filter(x=>x.win).length/R.length).toFixed(2),med:+rs[rs.length>>1].toFixed(2),band:+(rs.filter(x=>x>=0.8&&x<=1.2).length/R.length).toFixed(2)}; }
  out.sim70=run(0.7,7); out.sim30=run(0.3,3); out.simParty=A.mb.battle.units.filter(u=>u.side==="ally").length;
  /* 사서 3명(레벨 없음), 기프트 보통 수준(사서마다 4부위 착용)·핵심 책장 장착, 정답률 30% — 오답 벌점으로 대부분 진다 */
  s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"]; G.libs.sync(s); G.libs.equipKey(s,"lib2","archivist"); G.libs.equipKey(s,"lib3","classical-robe");
  const GS={머리:"fading-ribbon",눈:"recall-lens",손:"sand-heart",발:"blind-spot-pin"}, gift0={};
  for(const id of ["kyu","lib2","lib3"]){ const L=G.gifts.libOf(s,id); gift0[id]=JSON.stringify(L.gifts); L.gifts.owned=Object.values(GS); L.gifts.equipped={...GS}; }
  out.giftHp=A.libMods("kyu").hp;
  G.libs.setParty(s,["kyu","lib2","lib3"]); { const runL=(acc,seed)=>{ const rng=mul(seed), R=[];
    for(const g of G.data.WEAK_POINTS) for(let i=0;i<12;i++){ A.create(g.id,{rng}); const m=A.mb; let n=0;
      while(!m.outcome&&n<40){ n++; A.answer(rng()<acc); const B=m.battle, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
        for(const u of B.units.filter(u=>u.side==="ally"&&u.hp>0)) u.dice.forEach((d,k)=>{ const h=A.hand(u.id).filter(c=>A.usable(u.id,c).usable).sort((x,y)=>score(y)-score(x)); if(!h.length) return;
          let t=null; for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id&&ed.target.die===k) t={unit:e.id,die:j}; }); for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id) t={unit:e.id,die:j}; });
          if(!t){ const e=en.slice().sort((x,y)=>x.hp-y.hp)[0]; if(!e) return; t={unit:e.id,die:e.dice.length?0:null}; } A.assign(u.id,k,h[0],t); });
        A.resolveOnly(); if(!m.outcome) A.nextScene(); }
      R.push(m.outcome==="win"); }
    return {n:R.length,win:+(R.filter(Boolean).length/R.length).toFixed(2)}; };
    out.sim30x3=runL(0.3,31); out.sim70x3=runL(0.7,71); }
  for(const id in gift0) G.gifts.libOf(s,id).gifts=JSON.parse(gift0[id]);
  if(party0.length) G.libs.setParty(s,party0);
  return out; });
ok(bal.c11.hp===100&&bal.c11.ps===26&&bal.c11.psMax===26&&bal.c11.noLv&&JSON.stringify(bal.c11.gh)==='{"1":28,"2":44,"3":64}'&&JSON.stringify(bal.c11.gs)==='{"1":12,"2":16,"3":22}',"1:1 COMBAT: librarian HP 100 / stagger 26 fixed (no level terms), guest values untouched",bal.c11);
ok(bal.hasHP&&bal.bad.length===0,"multi enemy HP = MB.HP.enemyHpPerQ × question count × party (× floor), split by each enemy's own question count, ally HP = allyStats, pace Q/minScene",{bad:bal.bad,dt:bal.dt});
ok(bal.lv.base.perLv===undefined&&bal.lv.base.stPerLv===undefined&&bal.lv.s7===bal.lv.base.st&&bal.lv.unitIgnoresLevel&&bal.lv.long>bal.lv.h7,"librarian multi HP/stagger fixed (no level; save.level ignored); longer guests (more questions) give more HP",bal.lv);
ok(bal.party[0]<bal.party[1]&&bal.party[1]<bal.party[2],"enemy HP total grows with party size",bal.party);
ok(bal.hold.card&&bal.hold.hp===1&&bal.hold.outcome!=="win"&&bal.hold.held>=1&&bal.hold.scene<bal.hold.min,"pace ①: leader holds at 1 HP before minScene",bal.hold);
ok(bal.drain.scene===bal.drain.Q&&bal.drain.ok,"pace ②: from scene Q, both sides lose drain×n of max HP at scene end",bal.drain);
ok(bal.pace.hold===false&&bal.pace.drain===false,"PACE hold / drain are separate switches, both off by default",bal.pace);
const D=bal.dmg, near=(a,b)=>Math.abs(a-b)<=Math.max(2,b*0.08);
ok(bal.noOld&&bal.S>=10&&bal.SE[1]>=bal.SE[2]&&bal.SE[2]>=bal.SE[3]&&D.r1.gHp>0&&D.r1.pHp>0&&near(D.rS.gHp,D.r1.gHp*bal.S)&&D.rS.pHp===D.r1.pHp&&D.rS.evHp===D.rS.pHp+D.rS.gHp,"MB.SCALE_ENEMY multiplies damage enemies take only; librarians take ×1 (dice values unchanged); event hp = applied hp",{D,SE:bal.SE});
ok(D.rW.gHp===D.r1.gHp&&D.rW.pHp>D.r1.pHp&&D.rW.pSt>D.r1.pSt&&D.rWS.pHp===D.rW.pHp,"MB.WRONG raises damage taken by librarians only (hp & stagger)",D);
const QO=bal.qorder;
ok(QO.Q===QO.pool&&QO.uniq===QO.Q,"first Q scenes ask every question exactly once (no repeats)",QO);
ok(QO.deadQs.length>0&&QO.deadQs.every(q=>QO.first.includes(q))&&QO.deadAskedBy.every(u=>u!==QO.dead),"a downed enemy's questions are still asked, by a living enemy",QO);
ok(QO.next.length>0&&JSON.stringify(QO.next)===JSON.stringify(QO.wrong.slice(0,QO.next.length))&&QO.noAdjRepeat,"after all questions: wrong ones first (in the order missed), no back-to-back repeat",{next:QO.next,wrong:QO.wrong});
ok(bal.simParty===1&&bal.sim70.win>=0.7&&bal.sim70.med>=0.8&&bal.sim70.med<=1.35,"sim solo (no gifts) 70%: mostly wins, scenes/questions ≈ 1",bal.sim70);
ok(bal.sim30.win<=0.5,"sim solo 30%: loses more often than not",bal.sim30);
ok(bal.giftHp>0&&bal.sim30x3.win<=0.4&&bal.sim70x3.win>=0.75,"sim three librarians with normal gifts: 30% → mostly loses (≤35% target), 70% → wins",{giftHp:bal.giftHp,s30:bal.sim30x3,s70:bal.sim70x3});

/* ---------- 7) 저장 v2: 사서 레벨 제거 — 예전 저장(level/xp/maxHp)을 불러도 문제없고 필드는 사라진다 ---------- */
await p.evaluate(()=>{ const G=__studyGame, K=G.gifts.SAVE_KEY, cur=JSON.parse(localStorage.getItem(K)||"{}");
  localStorage.setItem(K,JSON.stringify({...cur,hp:150,maxHp:188,level:12,xp:77,exp:5,receptionsWon:3,conqueredIds:["pomodoro"]})); });
await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
const mig=await p.evaluate(()=>{ const G=__studyGame, s=G.save, K=G.gifts.SAVE_KEY; const o={};
  o.fields=["level","xp","exp","maxHp"].filter(k=>k in s); o.saveV=s.saveV; o.kept={won:s.receptionsWon,conq:s.conqueredIds};
  o.eff=G.gifts.effectiveMaxHp(s); o.base=G.engine.COMBAT.playerStartHp+G.gifts.withKeyMods(G.gifts.giftTotals(s),s).hp;
  G.setScene("lobby"); o.lobbyUndef=/undefined|NaN/.test(document.querySelector("#scene-lobby").innerText||"");
  try{ localStorage.setItem(K,JSON.stringify(s)); }catch(e){} const st=JSON.parse(localStorage.getItem(K)); o.stored=["level","xp","exp","maxHp"].filter(k=>k in st);
  const fresh=G.gifts.loadSave(); o.freshFields=["level","xp","exp","maxHp"].filter(k=>k in fresh); o.freshV=fresh.saveV;
  { const A=G.battleApi; A.create("pomodoro"); o.ally=A.mb.battle.units.filter(u=>u.side==="ally").map(u=>[u.maxHp,u.maxStagger]); o.allyExp=[A.allyStats(A.libMods("kyu"),"pomodoro").hp,A.MB.HP.allySt]; }
  return o; });
ok(mig.fields.length===0&&mig.saveV===2&&mig.stored.length===0&&mig.freshFields.length===0&&mig.freshV===2,"old save with level/xp/maxHp loads; those fields are dropped, saveV=2",mig);
ok(mig.kept.won===3&&JSON.stringify(mig.kept.conq)==='["pomodoro"]'&&mig.eff===mig.base&&!mig.lobbyUndef,"other progress kept; 1:1 max HP = fixed base + gifts/key page (no level); lobby shows no undefined",mig);
ok(mig.ally.length>0&&mig.ally[0][0]===mig.allyExp[0]&&mig.ally[0][1]===mig.allyExp[1],"multi librarian stats after migration = fixed allyStats",mig);
ok(errs.length===0,"no errors",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
