import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(+(process.env.PORT||0),"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o).slice(0,600));};
const GUEST="beccaria";

async function open(vp,multi=true){
  const p=await (await b.newContext({viewport:vp})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
  await p.goto(BASE+(multi?"":"?multi=0")); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>{ localStorage.clear(); });
  await p.goto(BASE+(multi?"":"?multi=0")); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  return {p,errs};
}
/* 2인 파티 준비 + 접대 시작 */
const setup=async(p,g=GUEST)=>{ await p.evaluate(g=>{ const G=__studyGame, s=G.save;
  s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]);
  G.battleApi.begin(g); },g); await p.waitForTimeout(900); };
/* 손패·빛·속도·대상을 정해 두는 도우미 (page 쪽) */
const prep=`(()=>{ window.__mbt={
  A:__studyGame.battleApi, B:()=>__studyGame.battle, U:id=>__studyGame.battle.units.find(u=>u.id===id),
  hand(id,ids){ const X=this.A.internals()[id]; X.handIds.length=0; X.handIds.push(...ids); },
  hp(id,hp,st){ const X=this.A.internals()[id], u=this.U(id); if(hp!=null){ X.cu.hp=hp; u.hp=hp; } if(st!=null){ X.cu.st=st; u.stagger=st; } },
  speed(id,i,v){ this.U(id).dice[i].speed=v; this.A.relink(); }
}; })()`;

/* ---------- 1) 기본은 다대다, ?multi=0 이면 1:1 ---------- */
{ const {p,errs}=await open({width:844,height:390},false);
  const r=await p.evaluate(()=>{ __studyGame.beginReception("beccaria"); return {multi:!!(__studyGame.reception&&__studyGame.reception.multi),en:__studyGame.battleApi.enabled(),g:!!(__studyGame.reception&&__studyGame.reception.g)}; });
  ok(!r.multi&&!r.en&&r.g,"?multi=0 still starts the old 1v1 reception",r);
  ok(errs.length===0,"no errors (1v1 default)",errs); await p.context().close(); }

{ const {p,errs}=await open({width:844,height:390});
  const r=await p.evaluate(()=>{ __studyGame.beginReception("beccaria"); return {multi:!!(__studyGame.reception&&__studyGame.reception.multi),en:__studyGame.battleApi.enabled()}; });
  ok(r.multi&&r.en,"default (no flag) starts the multi reception",r);
  const off=await p.evaluate(()=>{ __studyGame.battleApi.enable(false); const a=__studyGame.battleApi.enabled(); __studyGame.battleApi.enable(true); return a; });
  ok(off===false,"save.multiBattle=false switches back to 1v1",off);
  ok(errs.length===0,"no errors (multi default)",errs); await p.context().close(); }

/* ---------- 2) 셋업: 사서 2 vs 손님 무리 ---------- */
{ const {p,errs}=await open({width:844,height:390});
  await setup(p); await p.evaluate(prep);
  const s=await p.evaluate(()=>{ const B=__studyGame.battle, G=__studyGame, g=G.data.WEAK_POINTS.find(x=>x.id==="beccaria"), kit=G.engine.guestCombat(g);
    return {keys:Object.keys(B).sort(), qkeys:Object.keys(B.question).sort(), scene:B.scene, phase:B.phase,
      allies:B.units.filter(u=>u.side==="ally").map(u=>({id:u.id,slot:u.slot,libId:u.libId,hp:u.hp,dice:u.dice.length,keys:Object.keys(u).sort().join()})),
      enemies:B.units.filter(u=>u.side==="enemy").map(u=>({id:u.id,slot:u.slot,key:u.key,topic:u.topic,hp:u.maxHp,st:u.maxStagger,dice:u.dice.length,card:!!u.dice[0].card,tgt:u.dice[0].target})),
      gEnemies:g.enemies.map(e=>({key:e.key,leader:!!e.leader})), kit:{hp:kit.hp,st:kit.st},
      /* 다대다 체력은 MB.HP: 무리 전체(enemyHpTotal) 를 적마다 맡은 문제 수로 나누고 MB.SCALE_ENEMY[사서 수] 배 */
      share:(()=>{ const A=G.battleApi, X=A.internals(), S=A.enemyScale(B.units.filter(u=>u.side==="ally").length), en=B.units.filter(u=>u.side==="enemy"), qn=u=>Math.max(1,(X[u.id].e.q||[]).length), sq=en.reduce((t,u)=>t+qn(u),0), tot=A.enemyHpTotal("beccaria",B.units.filter(u=>u.side==="ally").length);
        return en.map(u=>({id:u.id,hp:u.maxHp,exp:Math.max(A.MB.HP.minHp,Math.round(tot*qn(u)/sq))*S})); })(),
      hand:G.battleApi.hand("a1").length, hand2:G.battleApi.hand("a2").length, q:B.question,
      qFromOk:(()=>{ const u=B.units.find(x=>x.id===B.question.fromUnit); const e=g.enemies.find(x=>x.key===u.key); return e.q.includes(B.question.id); })() }; });
  ok(s.keys.join()==="phase,question,scene,units"&&s.qkeys.join()==="answered,correct,fromUnit,id","battle shape = {scene,phase,question{fromUnit,id,answered,correct},units}",s);
  ok(s.allies.length===2&&s.allies[0].libId==="kyu"&&s.allies[1].libId==="lib2"&&s.allies[0].slot===0&&s.allies[1].slot===1,"2 allies from save.party in slot order",s.allies);
  ok(s.allies.every(a=>a.keys==="chargesPerEmotion,dice,emotion,emotionCharge,emotionMax,expr,hp,id,libId,light,maxHp,maxLight,maxStagger,name,side,slot,stagger,staggered,status"),"ally unit fields exact",s.allies[0].keys);
  ok(s.enemies.length===s.gEnemies.length&&s.enemies.every((e,i)=>e.key===s.gEnemies[i].key&&e.slot===i)&&s.gEnemies[0].leader,"enemies from guest.enemies, leader slot 0",s.enemies);
  ok(s.share.length===s.enemies.length&&s.share.every(x=>x.hp===x.exp),"enemy HP = MB.HP group total split by each enemy's question count (× MB.SCALE_ENEMY[사서 수])",s.share);
  ok(s.enemies.every(e=>e.dice>=1&&e.card&&e.tgt&&e.tgt.unit.startsWith("a")),"enemy dice have cards and target an ally (arrows)",s.enemies);
  ok(s.scene===1&&s.phase==="question"&&s.hand===4&&s.hand2===4,"scene 1 starts at question, each librarian holds 4 cards",s);
  ok(s.qFromOk,"막 question comes from the q list of the chosen enemy",s.q);
  const qp=await p.evaluate(()=>document.querySelector("#qpanel.on #qinner")?.innerText.length>0);
  ok(qp,"question shown in the panel (no blocking popup)");

  /* ---------- 2b) cardInfo · 적 카드는 문제 단계부터 채워져 있고 배치 중 바뀌지 않음 ---------- */
  const ci=await p.evaluate(()=>{ const A=__studyGame.battleApi, B=__studyGame.battle, G=__studyGame;
    const en=B.units.filter(u=>u.side==="enemy"), before=en.map(u=>u.dice.map(d=>d.card));
    const ally=A.cardInfo("turn-page"), e1=A.cardInfo(en[0].dice[0].card), e2=A.cardInfo(en[1].dice[0].card,en[1].id);
    const g=G.data.WEAK_POINTS.find(x=>x.id==="beccaria"), kit=G.engine.guestCombat(g);
    const raw=A.internals()[en[0].id].S.pages.find(p=>p.name===e2.name)||kit.pages.find(p=>p.name===e2.name), byName=A.cardInfo(e2.name,en[1].id);
    return {phase:B.phase,before,allFilled:before.every(a=>a.length&&a.every(Boolean)),ally,e1,e2,raw,byName,none:A.cardInfo("nope")}; });
  ok(ci.phase==="question"&&ci.allFilled,"enemy dice have their card already in the question phase",ci.before);
  ok(ci.ally&&ci.ally.id==="turn-page"&&ci.ally.cost===1&&ci.ally.dice[0].type==="slash"&&ci.ally.dice[0].min===2&&typeof ci.ally.text==="string","cardInfo(ally card) = {id,name,cost,dice,text}",ci.ally);
  ok(ci.e1&&ci.e1.cost===0&&ci.e1.dice.length>0&&ci.e1.side==="enemy","cardInfo(enemy die card)",ci.e1);
  ok(ci.e2&&ci.raw&&ci.e2.dice.every((d,i)=>d.min===Math.max(1,ci.raw.dice[i].min-1)&&d.max===Math.max(d.min,ci.raw.dice[i].max-1))&&JSON.stringify(ci.byName.dice)===JSON.stringify(ci.e2.dice),"follower card dice reflect −1 (by card id and by name+unit)",{e2:ci.e2,raw:ci.raw});
  ok(ci.none===null,"unknown card → null");
  /* ---------- 3) 정답: 1:1 규칙(빛 보너스 없음, playerDieRange/guestDieRange, 감정 충전) ---------- */
  const pre=await p.evaluate(()=>{ const t=__mbt; return {ci:t.A.cardInfo("turn-page","a1"),e:t.A.cardInfo(t.U("e1").dice[0].card)}; });
  ok(pre.ci.dice.every(d=>d.min===d.baseMin&&d.max===d.baseMax)&&pre.e.dice.every(d=>d.min===d.baseMin),"before the answer cardInfo shows base ranges",pre);
  const qa=await p.evaluate(()=>{ const t=__mbt; t.U("a1").light=1; const ch0=t.A.internals().a1.charge; const r=t.A.answer(true); return {r,l1:t.U("a1").light,ch0,ch1:t.A.internals().a1.charge,phase:t.B().phase,q:t.B().question}; });
  ok(qa.r&&qa.l1===1&&qa.ch1===qa.ch0+1&&qa.phase==="assign"&&qa.q.answered&&qa.q.correct===true,"correct: no light bonus, emotion charge +1, phase → assign",qa);
  const rng=await p.evaluate(()=>{ const t=__mbt, E=__studyGame.engine, ci=t.A.cardInfo("turn-page","a1"), d=E.PAGE_BY["turn-page"].dice[0], u=t.U("a1"), X=t.A.internals().a1;
    const isKey=!!t.A.mb.cur.isKey, exp=E.playerDieRange(d,true,isKey,u.emotion,X.mods.dieMin||0), ec=t.A.cardInfo(t.U("e1").dice[0].card), ed=t.A.mb.cards[t.U("e1").dice[0].card].dice[0], eexp=E.guestDieRange(ed,true,isKey);
    return {ci:ci.dice[0],exp,ec:ec.dice[0],eexp,keys:Object.keys(ci).sort().join()}; });
  ok(rng.ci.min===rng.exp[0]&&rng.ci.max===rng.exp[1]&&rng.ci.rightMin===rng.exp[0]&&rng.ec.min===rng.eexp[0]&&rng.ec.max===rng.eexp[1],"after a correct answer cardInfo min/max = playerDieRange/guestDieRange(correct)",rng);
  ok(["baseMin","baseMax","rightMin","rightMax","wrongMin","wrongMax"].every(k=>typeof rng.ci[k]==="number")&&/cost,dice,emotion,emotionReq,id,name,reason,side,text,unit,usable/.test(rng.keys),"cardInfo shape {id,name,cost,emotionReq,usable,reason,dice[{min,max,base*,right*,wrong*}],text}",rng.keys);
  /* 주사위: rng=0이면 최솟값 = playerDieRange(correct) 최솟값. 내 공격 주사위가 일방 공격하도록 */
  const bonus=await p.evaluate(()=>{ const t=__mbt; t.A.setRng(()=>0);
    t.hand("a1",["turn-page","cover-slam","focus-line","margin-guard"]); t.U("a1").light=3;
    t.U("e1").dice.forEach((d,k)=>t.A.setEnemyTarget("e1",k,{unit:"a2",die:0}));
    t.U("a1").dice[0].speed=1; t.A.relink();
    const r=t.A.assign("a1",0,"turn-page",{unit:"e1",die:0});
    const ev=t.A.resolveOnly(); const mine=ev.find(e=>e.by.unit==="a1"&&e.by.die===0);
    const ci=t.A.cardInfo("turn-page","a1");
    return {r,kind:mine&&mine.kind,roll:mine&&mine.steps[0].pd.roll,min:ci.dice[0].min,base:ci.dice[0].baseMin}; });
  ok(bonus.r.ok&&bonus.kind==="one-sided"&&bonus.roll===bonus.min&&bonus.min>bonus.base,"correct answer: my dice roll in the playerDieRange(correct) range",bonus);
  const all=await p.evaluate(()=>{ const G=__studyGame, bad=[];
    for(const g of G.data.WEAK_POINTS){ const B=G.battleApi.create(g.id); const pool=new Set([...(g.questions||[]).map(q=>q.id),...G.engine.keyQsOf(g).map(q=>q.id)]);
      const en=B.units.filter(u=>u.side==="enemy");
      if(en.length<1||en.length>5) bad.push(g.id+":count"); 
      (g.enemies||[]).forEach(e=>e.q.forEach(id=>{ if(!pool.has(id)) bad.push(g.id+":"+id); }));
      if(!B.question.id||!pool.has(B.question.id)) bad.push(g.id+":firstq");
      if(en.some(u=>!(u.maxHp>0&&u.maxStagger>0&&u.dice.length>=1&&u.dice.length<=3))) bad.push(g.id+":stats"); }
    return {n:G.data.WEAK_POINTS.length,bad}; });
  ok(all.bad.length===0,"every guest builds a multi battle; all enemy question ids resolve",all);
  ok(errs.length===0,"no errors (setup/bonus)",errs); await p.context().close(); }

/* ---------- 4) 오답: 1:1 규칙(내 주사위 −, 감정 충전 0) ---------- */
{ const {p,errs}=await open({width:844,height:390}); await setup(p); await p.evaluate(prep);
  const w=await p.evaluate(()=>{ const t=__mbt; t.A.setRng(()=>0); const l0=[t.U("a1").light,t.U("a2").light]; t.A.answer(false);
    const l1=[t.U("a1").light,t.U("a2").light];
    t.hand("a1",["turn-page"]); t.U("a1").light=3; t.U("e1").dice.forEach((d,k)=>t.A.setEnemyTarget("e1",k,{unit:"a2",die:0})); t.U("a1").dice[0].speed=1; t.A.relink();
    const ci=t.A.cardInfo("turn-page","a1"), ch=t.A.internals().a1.charge;
    t.A.assign("a1",0,"turn-page",{unit:"e1",die:0}); const ev=t.A.resolveOnly(); const m=ev.find(e=>e.by.unit==="a1");
    return {l0,l1,ch,roll:m.steps[0].pd.roll,min:ci.dice[0].min,wrongMin:ci.dice[0].wrongMin,q:t.B().question}; });
  ok(w.l0.join()===w.l1.join()&&w.roll===w.min&&w.min===w.wrongMin&&w.ch===0&&w.q.correct===false,"wrong: no light change, dice use playerDieRange(wrong), charge reset",w);
  ok(errs.length===0,"no errors (wrong)",errs); await p.context().close(); }

/* ---------- 5) 합 vs 일방 공격 규칙 + 속도 순서 ---------- */
{ const {p,errs}=await open({width:844,height:390}); await setup(p); await p.evaluate(prep);
  const c=await p.evaluate(()=>{ const t=__mbt, A=t.A; A.setRng(()=>0.5); A.answer(true);
    t.hand("a1",["turn-page","cover-slam","focus-line"]); t.hand("a2",["turn-page","cover-slam","focus-line"]); t.U("a1").light=3; t.U("a2").light=3;
    const e1=t.U("e1"), e2=t.U("e2");
    /* e1 die0 → a2:0, e2 die0 → a1:1 */
    A.setEnemyTarget("e1",0,{unit:"a2",die:0}); A.setEnemyTarget("e2",0,{unit:"a1",die:1});
    e1.dice[0].speed=3; e2.dice[0].speed=4;
    t.U("a1").dice[0].speed=5; t.U("a1").dice[1].speed=2; t.U("a2").dice[0].speed=1; t.U("a2").dice[1].speed=6; A.relink();
    const out={};
    /* faster (5>3) → redirect e1 to a1:0 → clash */
    const c0=e1.dice[0].card;
    out.fast=A.assign("a1",0,"turn-page",{unit:"e1",die:0}); out.e1t={...e1.dice[0].target}; out.keepCard=e1.dice[0].card===c0&&!!c0;
    /* slower (2<4) but e2 already targets a1:1 → clash */
    out.already=A.assign("a1",1,"cover-slam",{unit:"e2",die:0});
    /* slower (1<3), e1 now targets a1:0 → one-sided */
    out.slow=A.assign("a2",0,"focus-line",{unit:"e1",die:0});
    out.e1after={...e1.dice[0].target};
    /* unassign returns the card and light */
    const l=t.U("a2").light; A.unassign("a2",0); out.refund=t.U("a2").light-l; out.back=A.hand("a2").includes("focus-line");
    A.assign("a2",0,"focus-line",{unit:"e1",die:0});
    out.badLight=(t.U("a2").light=0, A.assign("a2",1,"turn-page",{unit:"e2",die:0}));
    t.U("a2").light=3;
    const ev=A.resolveOnly();
    out.order=ev.filter(e=>e.kind!=="skip").map(e=>e.speed);
    out.kinds=ev.map(e=>[e.by.unit+":"+e.by.die,e.kind,e.speed]);
    return out; });
  ok(c.fast.ok&&c.fast.clash&&c.e1t.unit==="a1"&&c.e1t.die===0,"my faster die pulls the enemy die → clash (redirected to me)",c);
  ok(c.keepCard,"redirected enemy die keeps its card",c.keepCard);
  ok(c.already.ok&&c.already.clash,"enemy die already aimed at my die → clash even if I'm slower",c.already);
  ok(c.slow.ok&&!c.slow.clash&&c.e1after.unit==="a1","slower die on an enemy die aimed elsewhere → one-sided",c);
  ok(c.refund===1&&c.back,"unassign refunds light and returns the card",c);
  ok(!c.badLight.ok&&c.badLight.reason==="light","not enough light → refused",c.badLight);
  ok(c.order.every((v,i,a)=>i===0||a[i-1]>=v),"resolution runs fastest → slowest",c.kinds);
  const kinds=Object.fromEntries(c.kinds.map(k=>[k[0],k[1]]));
  ok(kinds["a1:0"]==="clash"&&kinds["a2:1"]===undefined&&kinds["a2:0"]==="one-sided","clash pairs resolve once; unassigned dice do nothing",c.kinds);
  ok(errs.length===0,"no errors (clash)",errs); await p.context().close(); }

/* ---------- 6) 흐트러짐: 이번 막 나머지와 다음 막 행동 불가, 그 뒤 회복 ---------- */
{ const {p,errs}=await open({width:844,height:390}); await setup(p); await p.evaluate(prep);
  const s=await p.evaluate(()=>{ const t=__mbt, A=t.A; window.__ss=0; A.hooks.onSceneStart.push(()=>window.__ss++); A.setRng(()=>0.99); A.answer(true);
    t.hand("a1",["cover-slam"]); t.U("a1").light=3; t.hp("e1",null,1);
    A.setEnemyTarget("e1",0,{unit:"a2",die:0}); t.U("a1").dice[0].speed=1; t.U("e1").dice.forEach(d=>d.speed=Math.min(d.speed,1)); A.relink();
    /* make e1 slower than my die? one-sided hit at speed 1 vs e1 also 1: ally first on ties */
    A.assign("a1",0,"cover-slam",{unit:"e1",die:0});
    const ev=A.resolve(); const e1ev=ev.filter(e=>e.by.unit==="e1").map(e=>e.kind);
    const after={staggered:t.U("e1").staggered,hp:t.U("e1").hp};
    const s2={scene:t.B().scene,dice:t.U("e1").dice.length,staggered:t.U("e1").staggered};
    A.answer(false); A.resolve();
    const s3={scene:t.B().scene,dice:t.U("e1").dice.length,staggered:t.U("e1").staggered,st:t.U("e1").stagger,max:t.U("e1").maxStagger};
    return {e1ev,after,s2,s3,ss:window.__ss}; });
  ok(s.after.staggered&&s.e1ev.every(k=>k==="skip"),"staggered enemy's remaining dice this 막 are skipped",s);
  ok(s.s2.scene===2&&s.s2.dice===0&&s.s2.staggered,"next 막: staggered unit gets no dice",s.s2);
  ok(s.s3.scene===3&&s.s3.dice>0&&!s.s3.staggered&&s.s3.st===s.s3.max,"막 after: stagger recovered to max, dice back",s.s3);
  ok(s.ss===2,"onSceneStart hook fires each new 막",s.ss);
  ok(errs.length===0,"no errors (stagger)",errs); await p.context().close(); }

/* ---------- 7) 승리 → 보상 (책·첫 접대 기록·사서별 에고 기프트 굴림) ---------- */
{ const {p,errs}=await open({width:844,height:390}); await setup(p); await p.evaluate(prep);
  const hooks=await p.evaluate(()=>{ const H=__studyGame.battleApi.hooks, c={s:0,e:0,a:0,c:0}; window.__hc=c; H.onSceneStart.push(()=>c.s++); H.onSceneEnd.push(()=>c.e++); H.onAnswer.push(()=>c.a++); H.onClash.push(()=>c.c++); return true; });
  const w=await p.evaluate(()=>{ const t=__mbt, A=t.A, G=__studyGame; A.setRng(()=>0.99); A.answer(true);
    const en=t.B().units.filter(u=>u.side==="enemy"); en.forEach(e=>t.hp(e.id,1));
    t.hand("a1",["turn-page","cover-slam"]); t.hand("a2",["turn-page","focus-line"]); t.U("a1").light=3; t.U("a2").light=3;
    const slots=[["a1",0],["a1",1],["a2",0],["a2",1]];
    const cards={a1:["turn-page","cover-slam"],a2:["turn-page","focus-line"]};
    en.forEach((e,k)=>{ const [u,i]=slots[k]; t.U(u).dice[i].speed=9; A.assign(u,i,cards[u][i],{unit:e.id,die:e.dice.length?0:null}); });
    const before={books:G.save.bookCounts.beccaria||0,conq:G.save.conqueredIds.includes("beccaria"),wins:G.save.receptionsWon};
    const pace=A.MB.PACE.hold; A.MB.PACE.hold=false;   /* 1막에 다 쓰러뜨리는 시험: 판 길이 보정(우두머리 버팀, 기본 꺼짐)이 켜져 있어도 끔 */
    A.resolve(); A.MB.PACE.hold=pace;
    return {before,outcome:A.outcome,phase:t.B().phase,conq:G.save.conqueredIds.includes("beccaria"),books:G.save.bookCounts.beccaria||0,wins:G.save.receptionsWon,
      drops:Array.isArray(G.reception.droppedGift)?G.reception.droppedGift.length:-1,libIds:G.reception.librarianIds,banner:document.querySelector("#rbanner.on")?.innerText||"",hc:{...window.__hc}}; });
  ok(w.outcome==="win"&&w.phase==="end","all enemies out → win",w);
  ok(!w.before.conq&&w.conq&&w.books>w.before.books&&w.wins===w.before.wins+1,"rewards: first clear recorded, book granted",w);
  ok(w.drops===2&&w.libIds.join()==="kyu,lib2"&&/접대 완료/.test(w.banner),"showWin: ego gift rolled per librarian, result banner",w);
  ok(w.hc.a===1&&w.hc.e===1&&w.hc.c>=0,"hooks fire: onAnswer/onSceneEnd (onClash per clash)",w.hc);
  /* 끝난 전투 상태엔 주사위 대상이 남지 않는다 (화면 쪽 화살표는 resultarrows.test.mjs) */
  const tg=await p.evaluate(()=>__studyGame.battle.units.flatMap(u=>u.dice.map(d=>d.target)).filter(Boolean).length);
  ok(tg===0,"after a win: all dice targets cleared in battle state",tg);
  /* 다음 접대는 무대를 새로 깔끔하게 붙인다 */
  await p.evaluate(()=>__studyGame.battleApi.begin("beccaria")); await p.waitForTimeout(900);
  const re=await p.evaluate(()=>({bs:document.querySelectorAll(".bs").length,units:document.querySelectorAll(".bs-unit").length,phase:__studyGame.battle.phase,banner:!!document.querySelector("#rbanner.on")}));
  ok(re.bs===1&&re.units>=3&&re.phase==="question"&&!re.banner,"new reception remounts one clean stage",re);
  ok(errs.length===0,"no errors (win)",errs); await p.context().close(); }

/* ---------- 8) 패배 ---------- */
{ const {p,errs}=await open({width:844,height:390}); await setup(p); await p.evaluate(prep);
  const l=await p.evaluate(()=>{ const t=__mbt, A=t.A, G=__studyGame; A.setRng(()=>0.99); A.answer(false);
    t.hp("a1",1); t.hp("a2",1);
    const en=t.B().units.filter(u=>u.side==="enemy"&&u.dice.length);
    en.forEach(e=>e.dice.forEach((d,k)=>A.setEnemyTarget(e.id,k,{unit:k%2?"a2":"a1",die:null})));
    /* both allies get hit one-sided (no cards) */
    A.setEnemyTarget(en[0].id,0,{unit:"a1",die:null}); A.setEnemyTarget(en[1].id,0,{unit:"a2",die:null});
    A.resolve();
    return {outcome:A.outcome,phase:t.B().phase,banner:document.querySelector("#rbanner.on")?.innerText||"",conq:G.save.conqueredIds.includes("beccaria")}; });
  ok(l.outcome==="lose"&&l.phase==="end"&&/접대 실패/.test(l.banner)&&!l.conq,"all librarians out → lose banner, no rewards",l);
  ok(errs.length===0,"no errors (lose)",errs); await p.context().close(); }

/* ---------- 9) 화면: 가로 844x390·세로 390x844 — 겹침 없음, 화면 안 ---------- */
for(const vp of [{width:844,height:390},{width:390,height:844},{width:915,height:412}]){
  const {p,errs}=await open(vp); await setup(p,"pomodoro"); await p.evaluate(prep);
  await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(400);
  const r=await p.evaluate(()=>{
    const R=e=>e.getBoundingClientRect(), W=innerWidth, H=innerHeight;
    const units=[...document.querySelectorAll(".bs-unit:not(.dead)")].map(e=>({id:e.dataset.unit,r:R(e),plate:R(e.querySelector(".bs-plate")),fig:R(e.querySelector(".bs-fig")),dice:R(e.querySelector(".bs-dice"))}));
    const inter=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    const out=units.filter(u=>u.r.left<0||u.r.right>W||u.r.top<0||u.r.bottom>H).map(u=>u.id);
    const clashes=[]; for(let i=0;i<units.length;i++) for(let j=i+1;j<units.length;j++){ const a=units[i],b=units[j];
      for(const k of ["plate","dice"]) for(const k2 of ["plate","dice","fig"]){ if(inter(a[k],b[k2])>4||inter(b[k],a[k2])>4) clashes.push(a.id+"."+k+"~"+b.id+"."+k2); } }
    const go=document.querySelector("#btn-mb-go"), gr=go&&R(go);
    const goHit=gr?units.filter(u=>inter(gr,u.plate)>0||inter(gr,u.dice)>0||inter(gr,u.fig)>0).map(u=>u.id):["no-button"];
    const goVis=!!(gr&&gr.width>0&&getComputedStyle(go).display!=="none"&&gr.top>=0&&gr.bottom<=H);
    return {n:units.length,out,clashes:[...new Set(clashes)],goHit,goVis,phase:__studyGame.battle.phase};
  });
  const tag=vp.width+"x"+vp.height;
  ok(r.n>=4&&r.out.length===0,"all units on screen "+tag,r);
  ok(r.clashes.length===0,"unit plates/dice don't overlap other units "+tag,r.clashes);
  ok(r.phase==="assign"&&r.goVis&&r.goHit.length===0,"'개막' visible and clear of units "+tag,r);
  /* 탭으로 배치 (무대 모듈 경유) */
  const tap=await p.evaluate(async()=>{ const A=__studyGame.battleApi, u=__studyGame.battle.units.find(x=>x.id==="a1"); const X=A.internals().a1; X.handIds.splice(0,X.handIds.length,"turn-page","cover-slam"); u.light=3; A.unassign("a1",0);
    const die=document.querySelector('.bs-die[data-u="a1"][data-d="0"]'); die.click(); await new Promise(r=>setTimeout(r,50));
    const card=document.querySelector('#hand .cc[data-card="turn-page"], .bs-card[data-card="turn-page"]'); card&&card.click(); await new Promise(r=>setTimeout(r,50));
    const ed=document.querySelector('.bs-unit.enemy:not(.dead) .bs-die:not(.off)'); ed&&ed.click(); await new Promise(r=>setTimeout(r,50));
    return {card:!!card,ed:!!ed,assigned:u.dice[0].card}; });
  ok(tap.assigned==="turn-page","tap die → card → enemy die assigns via BattleStage.onAssign "+tag,tap);
  await p.screenshot({path:`${ROOT}/shots/multibattle-${tag}.png`});
  /* 애니메이션 경로로 한 막 진행 */
  await p.evaluate(()=>__studyGame.battleApi.resolve({animate:true})); await p.waitForFunction(()=>__studyGame.battle.phase!=="resolve",null,{timeout:20000});
  const n=await p.evaluate(()=>({scene:__studyGame.battle.scene,phase:__studyGame.battle.phase}));
  ok(n.scene===2&&n.phase==="question"||n.phase==="end","animated resolve moves to the next 막 "+tag,n);
  ok(errs.length===0,"no errors "+tag,errs); await p.context().close();
}
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
