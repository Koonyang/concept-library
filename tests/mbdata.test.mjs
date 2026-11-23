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
/* ---------- 4) 정답 흐트러짐 배율 (1:1 과 같음: 사서→적 만 ×1.25 / 핵심 ×1.75, 적→사서 ×1) ---------- */
const stg=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, E=G.engine, out={c:E.COMBAT.correctStagger,k:E.COMBAT.keyCorrectStagger};
  const run=(correct,isKey)=>{ A.begin("beccaria"); const B=G.battle, U=id=>B.units.find(u=>u.id===id), X=A.internals();
    A.setRng(()=>0.5); if(A.mb.cur) A.mb.cur.isKey=isKey; A.answer(correct);
    X.a1.handIds.splice(0,X.a1.handIds.length,"turn-page"); U("a1").light=3; U("a1").emotion=0; X.a1.mods={...X.a1.mods,staggerPct:0,dmgPct:0};
    B.units.filter(u=>u.side==="enemy").forEach(e=>e.dice.forEach((d,k)=>A.setEnemyTarget(e.id,k,{unit:"a2",die:null})));
    A.setEnemyTarget("e1",0,{unit:"a1",die:null});
    U("e1").dice.forEach(d=>{ d.speed=99; }); U("a1").dice[0].speed=9; A.assign("a1",0,"turn-page",{unit:"e1",die:null});   /* 적 주사위가 더 빨라 몸에 일방 공격(느린 적 주사위가 있으면 끌어와 합이 됨) */
    const pre=JSON.parse(JSON.stringify(X.e1.cu)), preA=JSON.parse(JSON.stringify(X.a1.cu));
    const ev=A.resolveOnly(); const mine=ev.find(e=>e.by&&e.by.unit==="a1"&&e.by.die===0), theirs=ev.find(e=>e.kind==="one-sided"&&e.by&&e.by.unit==="e1"&&e.target==="a1");
    /* 피해 = 주사위 값 × 이름 있는 보정만(숨은 배율 없음, 2026-11-19). 사서가 받는 피해는 오답 막만 MB.WRONG 배 (다대다 전용) */
    const S=1, W=correct?{hp:1,st:1}:A.MB.WRONG;
    const st=mine.steps[0], exp=E.hitUnit({...pre},st.pd.type,st.pd.roll,{hp:S,st:S*(correct?(isKey?E.COMBAT.keyCorrectStagger:E.COMBAT.correctStagger):1)}).st;
    let expA=null, gotA=null; if(theirs){ const s2=theirs.steps.find(s=>s.dmg&&s.dmg.unit==="a1"); if(s2){ gotA=s2.dmg.stagger; expA=E.hitUnit({...preA},s2.gd.type,s2.gd.roll,{hp:W.hp,st:W.st}).st; } }
    return {got:st.dmg&&st.dmg.stagger,exp,expNoMul:E.hitUnit({...pre},st.pd.type,st.pd.roll,{hp:S,st:S}).st,gotA,expA}; };
  out.right=run(true,false); out.key=run(true,true); out.wrong=run(false,false); return out; });
ok(stg.c===1.25&&stg.k===1.75,"COMBAT.correctStagger 1.25 / keyCorrectStagger 1.75",{c:stg.c,k:stg.k});
ok(stg.right.got===stg.right.exp&&stg.right.exp>stg.right.expNoMul,"correct: librarian→enemy stagger ×1.25",stg.right);
ok(stg.key.got===stg.key.exp&&stg.key.exp>stg.key.expNoMul&&stg.key.exp>=stg.right.exp,"key correct: librarian→enemy stagger ×1.75",stg.key);
ok(stg.wrong.got===stg.wrong.exp&&stg.wrong.exp===stg.wrong.expNoMul,"wrong: no stagger multiplier",stg.wrong);
ok([stg.right,stg.key].every(r=>r.gotA!=null&&r.gotA===r.expA),"enemy→librarian stagger is never multiplied (1:1 와 같음)",{r:[stg.right.gotA,stg.right.expA],k:[stg.key.gotA,stg.key.expA]});
/* ---------- 4b) 회피 재사용 (2026-11-19): 한 번 시전한 회피는 합에서 질 때까지 그 막 동안 남아, 그 유닛을 노린 다음 공격 교환에 다시 맞선다.
   이기거나 비기면 남고(reused), 지면 깨진다. 사서·적 모두. 시드·주사위 범위·속도·대상은 시험용으로 고정 ---------- */
const ev4=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, E=G.engine;
  E.PAGE_BY["t-evade"]={id:"t-evade",name:"시험 회피",cost:0,dice:[{type:"회피",min:10,max:10}]};   /* 정답 막 → 12 */
  E.PAGE_BY["t-hit"]={id:"t-hit",name:"시험 일격",cost:0,dice:[{type:"참격",min:1,max:1},{type:"참격",min:1,max:1}]};
  /* 시험 판: a1 의 주사위(카드·속도·대상)와 e1 의 주사위(책장·속도·대상)를 직접 정하고, 나머지 유닛 주사위는 비운다 */
  const setup=(allyDice,enemyDice)=>{ A.begin("beccaria"); const B=G.battle, X=A.internals(), U=id=>B.units.find(u=>u.id===id);
    A.setRng(()=>0.5); if(A.mb.cur) A.mb.cur.isKey=false; A.answer(true);
    for(const u of B.units) if(u.id!=="a1"&&u.id!=="e1") u.dice=[];
    const a1=U("a1"), e1=U("e1"), XA=X.a1, XE=X.e1; U("a1").emotion=0; a1.light=9; XA.mods={...XA.mods,dmgPct:0,staggerPct:0,dieMin:0};
    XE.cu.resist=E.FLAT_RESIST; XE.cu.hp=XE.cu.hpMax=999; XE.cu.st=XE.cu.stMax=999; XA.cu.hp=XA.cu.hpMax=999; XA.cu.st=XA.cu.stMax=999;
    XE.diePages=enemyDice.map(d=>({name:"시험",dice:d.dice})); e1.dice=enemyDice.map((d,k)=>{ const cid="e1@t."+k; A.mb.cards[cid]=XE.diePages[k]; return {speed:d.speed,card:cid,target:null}; }); XE.orig=enemyDice.map(d=>d.target);
    a1.dice=allyDice.map(d=>({speed:d.speed,card:null,target:null})); XA.handIds.splice(0,XA.handIds.length,...allyDice.map(d=>d.card));
    allyDice.forEach((d,i)=>A.assign("a1",i,d.card,d.target));
    const hp0={a1:XA.cu.hp,e1:XE.cu.hp}; const ev=A.resolveOnly();
    const sh=e=>({kind:e.kind,by:e.by,a:e.a&&{unit:e.a.unit,die:e.a.die},b:e.b&&{unit:e.b.unit,die:e.b.die},reused:!!e.reused,
      steps:(e.steps||[]).map(s=>({pd:s.pd&&{t:s.pd.type,v:s.pd.roll,r:!!s.pd.reused},gd:s.gd&&{t:s.gd.type,v:s.gd.roll,r:!!s.gd.reused},o:s.outcome,aR:s.aDie&&s.aDie.reused,bR:s.bDie&&s.bDie.reused}))});
    return {ev:ev.filter(e=>e.kind!=="skip").map(sh),hpA:hp0.a1-XA.cu.hp,hpE:hp0.e1-XE.cu.hp,heldA:(XA.heldEvade||[]).length,heldE:(XE.heldEvade||[]).length}; };
  const atk=v=>[{type:"참격",min:v,max:v}];
  /* ① 사서 회피 하나가 같은 막 e1 의 공격 교환 3개(그중 하나는 주사위 2개)를 연달아 막는다 */
  const s1=setup([{speed:99,card:"t-evade",target:{unit:"e1",die:0}}],
    [{speed:5,dice:atk(1),target:{unit:"a1",die:0}},{speed:4,dice:[...atk(1),...atk(1)],target:{unit:"a1",die:null}},{speed:3,dice:atk(1),target:{unit:"a1",die:null}},{speed:2,dice:atk(1),target:{unit:"a1",die:null}}]);
  /* ② 회피 12 : 첫 합 1(이김) → 다음 15→12(비김, 남음) → 30→24(짐, 깨짐) → 1 은 그냥 맞는다 */
  const s2=setup([{speed:99,card:"t-evade",target:{unit:"e1",die:0}}],
    [{speed:5,dice:atk(1),target:{unit:"a1",die:0}},{speed:4,dice:atk(15),target:{unit:"a1",die:null}},{speed:3,dice:atk(30),target:{unit:"a1",die:null}},{speed:2,dice:atk(1),target:{unit:"a1",die:null}}]);
  /* ③ 적 회피(50→정답 막 40)가 사서의 다음 일방 공격 두 교환(주사위 2개씩)을 막는다 */
  const s3=setup([{speed:9,card:"t-hit",target:{unit:"e1",die:0}},{speed:8,card:"t-hit",target:{unit:"e1",die:null}},{speed:7,card:"t-hit",target:{unit:"e1",die:null}}],
    [{speed:1,dice:[{type:"회피",min:50,max:50}],target:{unit:"a1",die:0}}]);
  delete E.PAGE_BY["t-evade"]; delete E.PAGE_BY["t-hit"]; A.begin("beccaria");
  return {s1,s2,s3}; });
{ const {s1,s2,s3}=ev4, wonBy=(e,side)=>e.steps.every(s=>side==="P"?s.o==="P":s.o==="G");
  const r1=s1.ev.slice(1);
  ok(s1.ev.length===4&&s1.ev[0].kind==="clash"&&s1.ev[0].steps[0].pd.r===false&&wonBy(s1.ev[0],"P"),"evade reuse ①: first clash — librarian evade wins, not reused yet",s1);
  ok(r1.every(e=>e.kind==="clash"&&e.reused&&e.b&&e.b.unit==="a1"&&e.b.die===0&&e.steps.every(s=>s.pd&&s.pd.t==="회피"&&s.pd.r&&s.bR===true)&&wonBy(e,"P"))&&r1.reduce((t,e)=>t+e.steps.length,0)===4,
    "evade reuse ①: the same evade meets the next 3 attack exchanges on that librarian (4 dice), reused:true on ev and steps",r1);
  ok(s1.hpA===0&&s1.heldA===0,"evade reuse ①: librarian takes no damage; held evades cleared at scene end",{hp:s1.hpA,held:s1.heldA});
  const [c0,c1,c2,c3]=s2.ev;
  ok(s2.ev.length===4&&c1&&c1.reused&&c1.steps[0].o==="tie"&&c1.steps[0].pd.v===c1.steps[0].gd.v,"evade reuse ②: a tie keeps the evade (both values equal)",s2.ev);
  ok(c2&&c2.reused&&c2.steps[0].o==="G"&&c2.steps[0].pd.r,"evade reuse ②: reused evade that loses breaks",c2);
  ok(c3&&c3.kind==="one-sided"&&!c3.reused&&!c3.b&&c3.steps[0].pd===null&&s2.hpA===c2.steps[0].gd.v+c3.steps[0].gd.v,"evade reuse ②: after breaking, the next attack is one-sided and hits",{c3,hp:s2.hpA});
  const e1r=s3.ev.slice(1);
  ok(s3.ev.length===3&&s3.ev[0].kind==="clash"&&wonBy(s3.ev[0],"G")&&e1r.every(e=>e.kind==="clash"&&e.reused&&e.b&&e.b.unit==="e1"&&e.b.die===0&&e.steps.length===2&&e.steps.every(s=>s.gd&&s.gd.t==="회피"&&s.gd.r&&s.bR===true)&&wonBy(e,"G"))&&s3.hpE===0,
    "evade reuse ③: enemy evade follows the same rule (blocks the librarian's next one-sided pages)",s3); }

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
  const H=A.MB.HP; out.noOld=A.MB.SCALE===undefined&&A.MB.SCALE_ENEMY===undefined&&A.enemyScale===undefined; out.pace={hold:A.MB.PACE.hold,drain:A.MB.PACE.drain};
  for(const g of G.data.WEAK_POINTS){ A.create(g.id); const B=A.mb.battle, en=B.units.filter(u=>u.side==="enemy"), al=B.units.filter(u=>u.side==="ally"), Q=A.questionCount(g.id), S=1;
    const sum=en.reduce((t,u)=>t+u.maxHp,0), tot=A.enemyHpTotal(g.id,al.length), per=tot/Q/(H.enemyHpPerQ[g.weakness]*H.party[al.length-1]);
    if(Math.abs(sum-tot*S)>(en.length+H.minHp)*S) out.bad.push(g.id+":sum "+sum+"/"+tot*S);
    if(per<0.95||per>1+H.floorStep*3+0.05) out.bad.push(g.id+":perQ "+per);
    const X=A.internals(), qn=u=>Math.max(1,(X[u.id].e.q||[]).length), sq=en.reduce((t,u)=>t+qn(u),0);
    for(const u of en){ const exp=Math.max(H.minHp,Math.round(tot*qn(u)/sq))*S; if(u.maxHp!==exp) out.bad.push(g.id+":"+u.key+" hp "+u.maxHp+"≠"+exp+" (q "+qn(u)+"/"+sq+")"); }
    if(g.id==="defamation-truth") out.dt=en.map(u=>({key:u.key,q:qn(u),hp:u.maxHp,st:u.maxStagger,leader:u.leader}));
    if(al.some(u=>u.maxHp!==A.allyStats(A.libMods(u.libId),g.id).hp)) out.bad.push(g.id+":allyHp");
    if(A.mb.pace.Q!==Q||A.mb.pace.minScene!==Math.ceil(A.MB.PACE.minRatio*Q)) out.bad.push(g.id+":pace"); }
  const g7=G.data.WEAK_POINTS.find(g=>A.questionCount(g.id)>=6&&A.questionCount(g.id)<=8)||G.data.WEAK_POINTS[0], g14=G.data.WEAK_POINTS.slice().sort((a,b)=>A.questionCount(b.id)-A.questionCount(a.id))[0];
  s.level=12; out.lv={h7:A.allyStats({},g7.id).hp,s7:A.allyStats({},g7.id).st,base:{hp:H.allyHp,st:H.allySt,perLv:H.allyHpPerLv,stPerLv:H.allyStPerLv},long:A.allyStats({},g14.id).hp,q7:A.questionCount(g7.id),q14:A.questionCount(g14.id)}; A.create(g7.id); out.lv.unitIgnoresLevel=A.mb.battle.units.filter(u=>u.side==="ally").every(u=>u.maxStagger===A.allyStats({},g7.id).st); delete s.level;
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
  /* 오답 벌점 WRONG: 같은 시드로 resolveScene 을 벌점 없음/있음으로 (숨은 배율 dmgScale 은 다대다에서 안 씀) */
  { const E=G.engine, mk=()=>({P:E.mkUnit(100000,100000),G:E.mkUnit(100000,100000)}), dice=[{type:"참격",min:3,max:8},{type:"관통",min:2,max:6}];
    const run=(o)=>{ const u=mk(); let a=12345; const rng=()=>{a=(a*16807)%2147483647; return a/2147483647;}; const st=E.resolveScene({P:u.P,G:u.G,pDice:dice,gDice:dice,correct:false,isKey:false,rng,...o});
      return {pHp:100000-u.P.hp,pSt:100000-u.P.st,gHp:100000-u.G.hp,gSt:100000-u.G.st,evHp:st.reduce((t,x)=>t+x.events.reduce((q,e)=>q+(e.hp||0),0),0)}; };
    const r1=run({}), rW=run({pTaken:A.MB.WRONG});
    out.dmg={r1,rW,wrong:A.MB.WRONG}; }
  /* 피해 = 주사위 값 그대로: ① 보정 없는 한 방(보통 상성·dmgPct 0·흐트러지지 않은 적, 일방 공격)은 dmg.hp === 굴린 값
     ② 실제 다대다 판의 모든 체력 피해 = max(1, floor(값 × TIER[상성] × 이름 있는 보정)) — 사서→적: (1+dmgPct), 적→사서: 오답 막이면 WRONG.hp */
  { const E=G.engine; A.begin("beccaria"); const B=G.battle, U=id=>B.units.find(u=>u.id===id), X=A.internals();
    A.setRng(()=>0.5); A.answer(true);
    X.a1.handIds.splice(0,X.a1.handIds.length,"turn-page"); U("a1").light=3; X.a1.mods={...X.a1.mods,dmgPct:0,staggerPct:0}; X.e1.cu.resist=E.FLAT_RESIST;
    B.units.filter(u=>u.side==="enemy").forEach(e=>e.dice.forEach((d,k)=>A.setEnemyTarget(e.id,k,{unit:"a2",die:null})));
    U("e1").dice.forEach(d=>{ d.speed=99; }); U("a1").dice[0].speed=9; A.assign("a1",0,"turn-page",{unit:"e1",die:null});   /* 적 주사위가 더 빨라 몸에 일방 공격(느린 적 주사위가 있으면 끌어와 합이 됨) */
    const ev=A.resolveOnly(), mine=ev.find(e=>e.by&&e.by.unit==="a1"&&e.by.die===0), st=mine&&mine.steps[0];
    out.plain={kind:mine&&mine.kind,roll:st&&st.pd&&st.pd.roll,hp:st&&st.dmg&&st.dmg.hp,unit:st&&st.dmg&&st.dmg.unit,maxHp:U("e1").maxHp}; }
  { const E=G.engine, T=E.TIER, rngX=(a=>()=>{a=(a*16807)%2147483647; return a/2147483647;})(4242), bad=[]; let n=0, plainN=0, plainEq=0;
    const score=cid=>{ const P=A.cardOf(cid); return P&&P.dice?P.dice.reduce((t,d)=>t+((d.min+d.max)/2),0):0; };
    for(const g of G.data.WEAK_POINTS) for(let i=0;i<3;i++){ A.create(g.id,{rng:rngX}); const m=A.mb; let k=0;
      while(!m.outcome&&k<30){ k++; const correct=rngX()<0.6; A.answer(correct); const Bt=m.battle, en=Bt.units.filter(u=>u.side==="enemy"&&u.hp>0);
        for(const u of Bt.units.filter(u=>u.side==="ally"&&u.hp>0)) u.dice.forEach((d,j)=>{ const h=A.hand(u.id).filter(c=>A.usable(u.id,c).usable).sort((x,y)=>score(y)-score(x)); const e=en[j%Math.max(1,en.length)]; if(h.length&&e) A.assign(u.id,j,h[0],{unit:e.id,die:e.dice.length?0:null}); });
        const dmgPct=Object.fromEntries(Bt.units.filter(u=>u.side==="ally").map(u=>[u.id,(m.x[u.id].mods&&m.x[u.id].mods.dmgPct)||0]));
        for(const e of A.resolveOnly()||[]) for(const s2 of e.steps||[]) for(const x of s2.events){ if(x.kind!=="hit") continue;
          const toEnemy=x.target==="G", atk=toEnemy?s2.pd:s2.gd, def=toEnemy?s2.gd:s2.pd; if(!atk) continue;
          const v=def&&def.type==="방어"?atk.roll-def.roll:atk.roll;   /* 방어에 막히면 차이만큼 */
          const mul=toEnemy?(1+dmgPct[e.ally]):(correct?1:A.MB.WRONG.hp), exp=v>0&&T[x.tagHp]>0?Math.max(1,Math.floor(v*T[x.tagHp]*mul)):0;
          n++; if(x.hp!==exp) bad.push({g:g.id,toEnemy,v,tag:x.tagHp,mul,hp:x.hp,exp});
          if(x.tagHp==="보통"&&mul===1){ plainN++; if(x.hp===v) plainEq++; } }
        if(!m.outcome) A.nextScene(); } }
    out.rule={n,bad:bad.slice(0,5),nBad:bad.length,plainN,plainEq}; }
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
  /* 한 방 기록: 사서가 적을 때린 체력 피해 하나 ÷ 그 적 최대 체력, 체력이 가득한 적이 그 한 방에 쓰러졌는지 (A안: 중앙 25~30%, 한 방 사망 ≤5%) */
  const HIT={r:[],fullN:0,fullK:0}, resolveTrack=(m,H)=>{ const cur=Object.fromEntries(m.battle.units.map(u=>[u.id,u.hp])), mx=Object.fromEntries(m.battle.units.map(u=>[u.id,u.maxHp]));
    for(const e of A.resolveOnly()||[]) for(const st of e.steps||[]){ const d=st.dmg; if(!d||!(d.hp>0)) continue; const b=cur[d.unit]; cur[d.unit]=Math.max(0,b-d.hp);
      if(d.unit[0]!=="e"||!H) continue; H.r.push(d.hp/mx[d.unit]); if(b>=mx[d.unit]){ H.fullN++; if(d.hp>=mx[d.unit]) H.fullK++; } } };
  const party0=(s.party||[]).slice(); G.libs.setParty(s,["kyu"]);
  function run(acc,seed,H){ const rng=mul(seed), R=[];
    for(const g of G.data.WEAK_POINTS) for(let i=0;i<20;i++){ A.create(g.id,{rng}); const m=A.mb; let n=0;
      while(!m.outcome&&n<40){ n++; A.answer(rng()<acc); const B=m.battle, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
        for(const u of B.units.filter(u=>u.side==="ally"&&u.hp>0)) u.dice.forEach((d,k)=>{ const h=A.hand(u.id).filter(c=>A.usable(u.id,c).usable).sort((x,y)=>score(y)-score(x)); if(!h.length) return;
          let t=null; for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id&&ed.target.die===k) t={unit:e.id,die:j}; }); for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id) t={unit:e.id,die:j}; });
          if(!t){ const e=en.slice().sort((x,y)=>x.hp-y.hp)[0]; if(!e) return; t={unit:e.id,die:e.dice.length?0:null}; } A.assign(u.id,k,h[0],t); });
        resolveTrack(m,H); if(!m.outcome) A.nextScene(); }
      R.push({win:m.outcome==="win",r:n/m.pace.Q}); }
    const rs=R.map(x=>x.r).sort((a,b)=>a-b); return {n:R.length,win:+(R.filter(x=>x.win).length/R.length).toFixed(2),med:+rs[rs.length>>1].toFixed(2),band:+(rs.filter(x=>x>=0.8&&x<=1.2).length/R.length).toFixed(2)}; }
  out.sim70=run(0.7,7,HIT); out.sim30=run(0.3,3); out.simParty=A.mb.battle.units.filter(u=>u.side==="ally").length;
  /* 사서 3명(레벨 없음), 기프트 보통 수준(사서마다 4부위 착용)·핵심 책장 장착, 정답률 30% — 오답 벌점으로 대부분 진다 */
  s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"]; G.libs.sync(s); G.libs.equipKey(s,"lib2","archivist"); G.libs.equipKey(s,"lib3","classical-robe");
  const GS={머리:"fading-ribbon",눈:"recall-lens",손:"sand-heart",발:"blind-spot-pin"}, gift0={};
  for(const id of ["kyu","lib2","lib3"]){ const L=G.gifts.libOf(s,id); gift0[id]=JSON.stringify(L.gifts); L.gifts.owned=Object.values(GS); L.gifts.equipped={...GS}; }
  out.giftHp=A.libMods("kyu").hp;
  G.libs.setParty(s,["kyu","lib2","lib3"]); { const runL=(acc,seed,H)=>{ const rng=mul(seed), R=[];
    for(const g of G.data.WEAK_POINTS) for(let i=0;i<12;i++){ A.create(g.id,{rng}); const m=A.mb; let n=0;
      while(!m.outcome&&n<40){ n++; A.answer(rng()<acc); const B=m.battle, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
        for(const u of B.units.filter(u=>u.side==="ally"&&u.hp>0)) u.dice.forEach((d,k)=>{ const h=A.hand(u.id).filter(c=>A.usable(u.id,c).usable).sort((x,y)=>score(y)-score(x)); if(!h.length) return;
          let t=null; for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id&&ed.target.die===k) t={unit:e.id,die:j}; }); for(const e of en) e.dice.forEach((ed,j)=>{ if(!t&&ed.target&&ed.target.unit===u.id) t={unit:e.id,die:j}; });
          if(!t){ const e=en.slice().sort((x,y)=>x.hp-y.hp)[0]; if(!e) return; t={unit:e.id,die:e.dice.length?0:null}; } A.assign(u.id,k,h[0],t); });
        resolveTrack(m,H); if(!m.outcome) A.nextScene(); }
      R.push(m.outcome==="win"); }
    return {n:R.length,win:+(R.filter(Boolean).length/R.length).toFixed(2)}; };
    out.sim30x3=runL(0.3,31); out.sim70x3=runL(0.7,71,HIT); }
  { const r=HIT.r.slice().sort((a,b)=>a-b); out.hit={n:r.length,med:+r[r.length>>1].toFixed(3),q1:+r[r.length>>2].toFixed(3),q3:+r[(r.length*3)>>2].toFixed(3),fullN:HIT.fullN,fullK:HIT.fullK,oneShot:+(HIT.fullK/Math.max(1,HIT.fullN)).toFixed(3)}; }
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
ok(bal.noOld&&D.r1.gHp>0&&D.r1.pHp>0&&D.r1.evHp===D.r1.pHp+D.r1.gHp,"no hidden damage multiplier (MB.SCALE_ENEMY / enemyScale gone); event hp = applied hp",{noOld:bal.noOld,D});
ok(D.rW.gHp===D.r1.gHp&&D.rW.pHp>D.r1.pHp&&D.rW.pSt>D.r1.pSt,"MB.WRONG raises damage taken by librarians only (hp & stagger)",D);
ok(bal.plain.kind==="one-sided"&&bal.plain.unit==="e1"&&bal.plain.roll>0&&bal.plain.hp===bal.plain.roll,"no modifiers (보통 resist, dmgPct 0, enemy not staggered): enemy takes exactly the die value (dmg.hp === roll)",bal.plain);
ok(bal.rule.n>200&&bal.rule.nBad===0&&bal.rule.plainN>50&&bal.rule.plainEq===bal.rule.plainN,"every hit in real multi battles = floor(die value × TIER × named modifiers only) (dmgPct for librarians, WRONG for wrong scenes)",bal.rule);
const QO=bal.qorder;
ok(QO.Q===QO.pool&&QO.uniq===QO.Q,"first Q scenes ask every question exactly once (no repeats)",QO);
ok(QO.deadQs.length>0&&QO.deadQs.every(q=>QO.first.includes(q))&&QO.deadAskedBy.every(u=>u!==QO.dead),"a downed enemy's questions are still asked, by a living enemy",QO);
ok(QO.next.length>0&&JSON.stringify(QO.next)===JSON.stringify(QO.wrong.slice(0,QO.next.length))&&QO.noAdjRepeat,"after all questions: wrong ones first (in the order missed), no back-to-back repeat",{next:QO.next,wrong:QO.wrong});
/* 사서 혼자는 덱 절반이 방어·회피라 막당 맞히는 방 수가 적다 → A안(3~4방)을 지키면 막 수/문제 수 ≈ 1.5 (2026-11-19) */
ok(bal.simParty===1&&bal.sim70.win>=0.7&&bal.sim70.win<=0.92&&bal.sim70.med>=0.8&&bal.sim70.med<=1.75,"sim solo (no gifts) 70%: wins ~75-90%, scenes/questions ≈ 1~1.5",bal.sim70);
ok(bal.sim30.win<=0.35,"sim solo 30%: win ≤ 35%",bal.sim30);
ok(bal.hit.n>500&&bal.hit.med>=0.25&&bal.hit.med<=0.30,"A안: one librarian hit ≈ 25~30% of that enemy's max HP (median, 70% solo + party of 3)",bal.hit);
ok(bal.hit.fullN>100&&bal.hit.oneShot<=0.05,"A안: a full-HP enemy is one-shot by a single hit ≤ 5% of the time",bal.hit);
ok(bal.giftHp>0&&bal.sim30x3.win<=0.35&&bal.sim70x3.win>=0.75,"sim three librarians with normal gifts: 30% → mostly loses (≤35% target), 70% → wins",{giftHp:bal.giftHp,s30:bal.sim30x3,s70:bal.sim70x3});

/* ---------- 7) 저장 v2: 사서 레벨 제거 — 예전 저장(level/xp/maxHp)을 불러도 문제없고 필드는 사라진다 ---------- */
await p.evaluate(()=>{ const G=__studyGame, K=G.gifts.SAVE_KEY, cur=JSON.parse(localStorage.getItem(K)||"{}");
  localStorage.setItem(K,JSON.stringify({...cur,hp:150,maxHp:188,level:12,xp:77,exp:5,receptionsWon:3,conqueredIds:["pomodoro"]})); });
await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
const mig=await p.evaluate(()=>{ const G=__studyGame, s=G.save, K=G.gifts.SAVE_KEY; const o={};
  o.fields=["level","xp","exp","maxHp"].filter(k=>k in s); o.saveV=s.saveV; o.kept={won:s.receptionsWon,conq:s.conqueredIds};
  o.eff=G.gifts.effectiveMaxHp(s); o.base=G.engine.COMBAT.playerStartHp+G.gifts.withKeyMods(G.gifts.giftTotals(s),s).hp;
  
  try{ localStorage.setItem(K,JSON.stringify(s)); }catch(e){} const st=JSON.parse(localStorage.getItem(K)); o.stored=["level","xp","exp","maxHp"].filter(k=>k in st);
  const fresh=G.gifts.loadSave(); o.freshFields=["level","xp","exp","maxHp"].filter(k=>k in fresh); o.freshV=fresh.saveV;
  { const A=G.battleApi; A.create("pomodoro"); o.ally=A.mb.battle.units.filter(u=>u.side==="ally").map(u=>[u.maxHp,u.maxStagger]); o.allyExp=[A.allyStats(A.libMods("kyu"),"pomodoro").hp,A.allyStats(A.libMods("kyu"),"pomodoro").st]; }
  return o; });
ok(mig.fields.length===0&&mig.saveV===2&&mig.stored.length===0&&mig.freshFields.length===0&&mig.freshV===2,"old save with level/xp/maxHp loads; those fields are dropped, saveV=2",mig);
ok(mig.kept.won===3&&JSON.stringify(mig.kept.conq)==='["pomodoro"]'&&mig.eff===mig.base&&!mig.lobbyUndef,"other progress kept; 1:1 max HP = fixed base + gifts/key page (no level)",mig);
ok(mig.ally.length>0&&mig.ally[0][0]===mig.allyExp[0]&&mig.ally[0][1]===mig.allyExp[1],"multi librarian stats after migration = fixed allyStats",mig);
/* 몸 노리기(die:null) — 라오루 규칙(2026-11-23): 그 적에게 합이 안 잡힌 나보다 느린 주사위가 있으면 끌어와 합, 없으면 몸에 일방 공격 */
const body=await p.evaluate(()=>{ const G=Game.battle, out={};
  const prep=(mySpeed,enemySpeeds)=>{ G.leave(); G.begin("beccaria"); const q=G.question(); G.answer(q.type==="short"?String(q.answer):q.correctIndex);
    const B=G.state, a=B.units.find(u=>u.side==="ally"), e=B.units.find(u=>u.side==="enemy"&&u.dice.length>=1);
    a.dice[0].speed=mySpeed; e.dice.forEach((d,k)=>{ d.speed=enemySpeeds[k%enemySpeeds.length]; });
    const c=G.hand(a.id).find(c=>G.usable(a.id,c).usable); return {B,a,e,c}; };
  { const {a,e,c}=prep(9,[1]); const r=G.assign(a.id,0,c,{unit:e.id,die:null}); out.slower={r,t:{...a.dice[0].target},clash:G.isClash(a.id,0)}; }
  { const {a,e,c}=prep(2,[99]); const r=G.assign(a.id,0,c,{unit:e.id,die:null}); out.faster={r,t:{...a.dice[0].target},clash:G.isClash(a.id,0)}; }
  G.leave(); return out; });
ok(body.slower.r.ok&&body.slower.clash&&body.slower.t.die!=null,"몸 노리기: 합 안 잡힌 적 주사위가 나보다 느리면 끌어와 합",body.slower);
ok(body.faster.r.ok&&!body.faster.clash&&body.faster.t.die==null,"몸 노리기: 적 주사위가 모두 나보다 빠르면 몸에 일방 공격",body.faster);
/* ---------- 기믹(2026-11-23): 상태·책장 효과 ---------- */
const gm=await p.evaluate(()=>{ const G=__studyGame, A=G.battleApi, out={};
  /* 준비: insult 손님, 사서 하나, 정답, 손패를 원하는 책장으로 */
  const prep=(hand,gid="insult")=>{ A.begin(gid); const B=G.battle, X=A.internals(), U=id=>B.units.find(u=>u.id===id); A.setRng(()=>0.5); A.answer(true);
    X.a1.handIds.splice(0,X.a1.handIds.length,...hand); U("a1").light=9; U("a1").maxLight=9; U("a1").emotion=3; return {B,X,U}; };
  /* ① 출혈: 공격 주사위를 굴릴 때마다 그만큼 잃고 1/3 줄어듦 */
  { const {B,X,U}=prep(["turn-page"]); const e=B.units.find(u=>u.side==="enemy"&&u.dice.length&&mbDiceAtk(u));
    function mbDiceAtk(u){ return true; }
    Game.battle.give(e.id,"bleed",6); const st0=Game.battle.status(e.id); B.units.filter(u=>u.side==="enemy").forEach(x=>x.dice.forEach((d,k)=>A.setEnemyTarget(x.id,k,{unit:"a1",die:null})));
    const hp0=X[e.id].cu.hp; const ev=A.resolveOnly(); const mine=ev.filter(v=>v.fx&&v.fx.some(f=>f.kind==="bleed"&&f.unit===e.id));
    out.bleed={st0,hp0,events:mine.length,lost:mine.reduce((t,v)=>t+v.fx.filter(f=>f.kind==="bleed"&&f.unit===e.id).reduce((a,f)=>a+f.hp,0),0),left:Game.battle.status(e.id).map(s=>s.id+s.stacks)}; }
  /* ② 다음 막 상태: 주면 대기 → 다음 막에 켜짐 → 그다음 막엔 사라짐. 신속은 속도 주사위 + */
  { const {B,U}=prep(["turn-page"]); Game.battle.give("a1","haste",4); const s0=Game.battle.status("a1").map(s=>s.id+(s.pending?"?":"")+s.stacks);
    A.resolveOnly(); A.nextScene(); const s1=Game.battle.status("a1").map(s=>s.id+(s.pending?"?":"")+s.stacks), sp1=U("a1").dice.map(d=>d.speed);
    A.answer(true); A.resolveOnly(); A.nextScene(); const s2=Game.battle.status("a1").length;
    out.pend={s0,s1,sp1,s2,minSpeed:G.battleApi.MB?G.battleApi.MB.allySpeed[0]:2}; }
  /* ③ 조건부 위력: 특정된 한 사람 — 살아 있는 적이 하나면 +4 */
  { const {B,X,U}=prep(["singled-out"]); const foes=B.units.filter(u=>u.side==="enemy"); foes.slice(1).forEach(f=>{ X[f.id].cu.hp=0; f.hp=0; });
    const e=foes[0]; A.assign("a1",0,"singled-out",{unit:e.id,die:null}); const ev=A.resolveOnly(), mine=ev.find(v=>v.by&&v.by.unit==="a1");
    const base=G.engine.playerDieRange({type:"참격",min:3,max:6},true,false,3,0); out.power={range:mine&&mine.steps[0].pRange,base}; }
  /* ④ [적중] 출혈 3: 출판물의 확성기 */
  { const {B,X}=prep(["press-megaphone"]); const e=B.units.find(u=>u.side==="enemy"); B.units.filter(u=>u.side==="enemy").forEach(x=>x.dice.forEach((d,k)=>A.setEnemyTarget(x.id,k,{unit:"a1",die:null})));
    e.dice.forEach(d=>d.speed=1); A.assign("a1",0,"press-megaphone",{unit:e.id,die:null}); const ev=A.resolveOnly(), mine=ev.find(v=>v.by&&v.by.unit==="a1"&&v.by.die===0);
    out.hitFx={hit:!!(mine&&mine.steps.some(s=>s.dmg&&s.dmg.unit===e.id&&s.dmg.hp>0)),fx:mine&&mine.fx}; }
  /* ⑤ 반격(친고죄): 대상 없이 놓아도 개막 가능, 나를 일방 공격하는 교환에만 맞선다 */
  { const {B,X}=prep(["complaint-only"]); const r=A.assign("a1",0,"complaint-only",{unit:B.units.find(u=>u.side==="enemy").id,die:null});
    const tgt=B.units.find(u=>u.id==="a1").dice[0].target, ready=Game.battle.ready();
    B.units.filter(u=>u.side==="enemy").forEach(x=>x.dice.forEach((d,k)=>A.setEnemyTarget(x.id,k,{unit:"a1",die:null})));
    const ev=A.resolveOnly(); out.counter={ok:r.ok,tgt,ready,counterEv:ev.filter(v=>v.counter).length,firstCounter:(ev.find(v=>v.counter)||{}).kind}; }
  /* ⑥ 마비: 이번 막 그 수만큼 주사위가 최솟값 */
  { const {B,X,U}=prep(["turn-page"]); const e=B.units.find(u=>u.side==="enemy"&&u.dice.length); Game.battle.give(e.id,"para",9); A.resolveOnly(); A.nextScene(); A.answer(true);
    const e2=B.units.find(u=>u.id===e.id); B.units.filter(u=>u.side==="enemy").forEach(x=>x.dice.forEach((d,k)=>A.setEnemyTarget(x.id,k,{unit:"a1",die:null})));
    const ev=A.resolveOnly(), rs=ev.filter(v=>v.by&&v.by.unit===e.id).flatMap(v=>v.steps.map(s=>s.gRange)).filter(Boolean); out.para={n:rs.length,flat:rs.every(r=>r[0]===r[1])}; }
  /* ⑦ 보호: 맞을 때마다 체력 피해 −(엔진 hitUnit) */
  { const E=G.engine, u1=E.mkUnit(100,50), u2=E.mkUnit(100,50); const a=E.hitUnit(u1,"참격",6,{}), b=E.hitUnit(u2,"참격",6,{flat:-2}); out.prot={a:a.hp,b:b.hp}; }
  A.begin("beccaria"); return out; });
ok(gm.bleed.st0.some(s=>s.id==="bleed"&&s.stacks===6&&!s.pending)&&gm.bleed.events>=1&&gm.bleed.lost>=6,"기믹 출혈: 바로 켜지고, 공격 주사위를 굴리면 그만큼 체력을 잃고 줄어듦",gm.bleed);
ok(gm.pend.s0.join()==="haste?4"&&gm.pend.s1.join()==="haste4"&&gm.pend.sp1.every(v=>v>=5)&&gm.pend.s2===0,"기믹 다음 막 상태: 대기 → 다음 막 켜짐(신속 +4) → 그다음 막 사라짐",gm.pend);
ok(gm.power.range&&gm.power.range[0]===gm.power.base[0]+4&&gm.power.range[1]===gm.power.base[1]+4,"기믹 조건부 위력: 특정된 한 사람 — 적이 하나면 +4",gm.power);
ok(!gm.hitFx.hit||(gm.hitFx.fx||[]).some(f=>f.kind==="give"&&f.status==="bleed"&&f.n===3),"기믹 [적중] 출혈 3",gm.hitFx);
ok(gm.counter.ok&&gm.counter.tgt===null&&gm.counter.ready&&gm.counter.counterEv>=1&&gm.counter.firstCounter==="clash","기믹 반격: 대상 없이 개막 가능, 나를 일방 공격하면 맞섬",gm.counter);
ok(gm.para.n>=1&&gm.para.flat,"기믹 마비: 그 막 주사위가 최솟값",gm.para);
ok(gm.prot.a-gm.prot.b===2,"기믹 보호: 맞을 때 체력 피해 −2",gm.prot);
ok(errs.length===0,"no errors",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
