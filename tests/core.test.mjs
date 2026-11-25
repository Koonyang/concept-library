/* 규칙 코어(js/core) 흐름: 빈 새 화면이 오류 없이 뜨고, Game API 로 접대 시작→정답→배치→개막→승리 정산→책 소각→덱→사서→달의 계시가 돈다 */
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
await p.goto(BASE); await p.evaluate(()=>localStorage.clear()); await p.goto(BASE); await p.waitForFunction(()=>window.Game&&window.__studyGame);

const r=await p.evaluate(()=>{
  const G=Game, out={};
  { let z=3; Math.random=()=>{z|=0;z=z+0x6D2B79F5|0;let t=Math.imul(z^z>>>15,1|z);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}; }   /* 소각 결과(책장/장서복)가 매번 같게 */
  out.data=[G.data.FLOORS.length,G.data.WEAK_POINTS.length,G.data.COMBAT_PAGES.length,G.data.KEY_PAGES.length,G.data.EGO_GIFTS.length];
  out.cover=G.data.bookCoverSrc(G.data.GUEST_BY.beccaria);
  let s=7; const rng=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  out.begin=G.battle.begin("pomodoro",{rng}).ok; out.phase0=G.battle.state.phase; out.q=!!G.battle.question();
  out.early=G.battle.resolve();            /* 문제를 안 풀면 개막 안 됨 */
  let scenes=0;
  while(!G.battle.outcome&&scenes<60){
    scenes++; G.battle.answer(true);
    const B=G.battle.state, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
    for(const u of B.units.filter(u=>u.side==="ally"&&u.hp>0)) u.dice.forEach((d,i)=>{
      const c=G.battle.hand(u.id).find(c=>G.battle.usable(u.id,c).usable); if(!c||!en[0]) return;
      G.battle.assign(u.id,i,c,{unit:en[0].id,die:0});
    });
    G.battle.resolve();
  }
  out.outcome=G.battle.outcome; out.scenes=scenes;
  const st=G.battle.settle(); out.settle={won:st.won,bookGain:st.bookGain,books:st.books,total:st.total,correct:st.correct};
  out.settleTwice=G.battle.settle()===st;
  out.conq=G.save.conqueredIds.slice(); out.recall=G.save.recallStats.pomodoro;
  G.battle.leave(); out.left=G.battle.state===null;
  out.next=(G.battle.nextGuest("pomodoro")||{}).id;
  out.burn=G.books.burn("pomodoro",1); out.burnNone=G.books.burn("pomodoro",1);
  const pc=out.burn.cards.find(c=>c.k==="page"); const pid=pc&&pc.id; out.burnKind=out.burn.cards.map(c=>c.k); out.owned=G.deck.owned().includes(pid);
  const before=G.deck.active().pageIds.length; out.deckAdd=G.deck.toggle(pid).ok; out.deckLen=[before,G.deck.active().pageIds.length];
  out.party=G.libs.toggleParty(); out.libs=G.libs.list().length;
  G.moon.open(); const m=G.moon.start("reveal"); out.moonQ=m.qs.length;
  let k=0; while(G.moon.current()){ G.moon.answer(k++%2?G.moon.current().correctIndex:-1); }
  out.moonPhase=G.moon.state.phase; G.moon.skipReplay(); out.moonDone=G.moon.state.phase; out.moonSave=G.save.moon;
  return out;
});
ok(r.data.join()==="4,12,42,8,36","데이터 개수 (층 4·손님 12·책장 42·핵심 책장 8·기프트 36)",r.data);
ok(r.cover==="assets/books/book-7.webp","책 표지 경로 (guest.book)",r.cover);
ok(r.begin&&r.phase0==="question"&&r.q&&r.early===null,"접대 시작: 1막 문제 단계, 문제 전에는 개막 안 됨",r);
ok(r.outcome==="win"&&r.scenes>0,"정답만 내면 이긴다",{o:r.outcome,s:r.scenes});
ok(r.settle.won&&r.settle.bookGain===1&&r.settle.books===1&&r.settle.total===r.scenes&&r.settleTwice,"승리 정산: 첫 승리 책 1권, 정답 수 기록, 두 번 불러도 한 번만",r.settle);
ok(r.conq.includes("pomodoro")&&r.recall&&r.recall.wins===1&&r.left,"책이 된 손님·회상 기록 저장, 떠나면 전투 비움",{c:r.conq,rc:r.recall});
ok(r.next&&r.next!=="pomodoro","다음 손님",r.next);
ok(r.burn.ok&&r.burn.n===1&&r.burnNone.ok===false&&r.owned,"책 소각 → 책장 획득, 책이 없으면 소각 안 됨",r.burn);
ok(r.deckAdd&&r.deckLen[1]===r.deckLen[0]+1,"얻은 책장을 덱에 넣기",r.deckLen);
ok(r.party&&r.party.ok===false&&r.libs>=1,"사서 혼자면 명단에서 뺄 수 없음",r.party);
ok(r.moonQ===30&&r.moonPhase==="bridge"&&r.moonDone==="result"&&r.moonSave&&r.moonSave.used===false&&r.moonSave.reveal===15,"달의 계시: 30문제 → 재현시 다리 → 건너뛰기 → 오늘 기록",{q:r.moonQ,s:r.moonSave});

/* ---------- 층 무대 데이터 · 한 교환씩 진행 ---------- */
const fs=await p.evaluate(()=>{ const G=Game, D=G.data, o={};
  o.crime=D.floorStage("crime"); o.memory=D.floorStage("memory"); o.none=D.floorStage("없는층");
  const f0=D.FLOORS[0], keep=f0.stage; delete f0.stage; o.missing=D.floorStage(f0.id); f0.stage=keep;
  f0.stage={mood:"moon"}; o.partial=D.floorStage(f0.id); f0.stage=keep;
  return o; });
const DEF={mood:"lamp",accent:"#d9a35a",props:["candles","bookpile"]};
ok(JSON.stringify(fs.crime)===JSON.stringify({mood:"lamp",accent:"#d9a35a",props:["scales","candles"]}),"floorStage(crime) 처음 값",fs.crime);
ok(fs.memory.mood==="moon","memory 층은 달빛",fs.memory);
ok(JSON.stringify(fs.none)===JSON.stringify(DEF)&&JSON.stringify(fs.missing)===JSON.stringify(DEF),"없는 층·stage 없는 층은 기본값",fs);
ok(fs.partial.mood==="moon"&&fs.partial.accent===DEF.accent&&JSON.stringify(fs.partial.props)===JSON.stringify(DEF.props),"일부만 있으면 빈 칸만 기본값",fs.partial);
const st=await p.evaluate(()=>{ const G=Game, o={};
  const mk=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const MR=Math.random; const run=(useStep)=>{ Math.random=mk(5); G.battle.leave(); G.battle.begin("beccaria",{rng:mk(11)});
    o.qPhase=G.battle.stepBegin(); G.battle.answer(true);
    const B=G.battle.state, en=B.units.filter(u=>u.side==="enemy");
    for(const u of B.units.filter(u=>u.side==="ally")) u.dice.forEach((d,i)=>{ const c=G.battle.hand(u.id).find(c=>G.battle.usable(u.id,c).usable); if(c) G.battle.assign(u.id,i,c,{unit:en[0].id,die:0}); });
    if(useStep){ const R=G.battle.stepBegin(); let n=0; while(G.battle.stepNext(R)) n++; G.battle.stepEnd(R); o.n=n; } else G.battle.resolve();
    const r={hp:G.battle.state.units.map(u=>u.hp),scene:G.battle.state.scene,phase:G.battle.state.phase}; G.battle.leave(); return r; };
  o.a=run(false); o.b=run(true); Math.random=MR; return o; });
ok(st.qPhase===null,"문제 단계에서 stepBegin 은 null",st.qPhase);
ok(JSON.stringify(st.a)===JSON.stringify(st.b)&&st.n>0,"한 교환씩 진행한 결과 = resolve() 결과",st);

/* ---------- 주관식 채점 · 지금 문제 정보 · 빛/감정 ---------- */
const qi=await p.evaluate(()=>{ const G=Game, o={};
  const sq=G.data.KEY_QUESTIONS.beccaria.find(q=>q.type==="short");
  o.has=typeof G.checkShort==="function";
  if(o.has) o.short=[G.checkShort(sq.answer,sq),G.checkShort(sq.accept[0],sq),G.checkShort("  BECCARIA ",sq),G.checkShort("몽테스키외",sq),G.checkShort("",sq)];
  const mk=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  G.battle.leave(); o.none=G.battle.questionInfo?G.battle.questionInfo():"no-fn"; o.noLight=G.battle.lightOf?G.battle.lightOf("x"):"no-fn";
  G.battle.begin("beccaria",{rng:mk(3)});
  const B=G.battle.state; o.info=G.battle.questionInfo();
  o.infoOk=!!o.info&&o.info.q===G.battle.question()&&o.info.fromUnit===B.question.fromUnit&&B.units.some(u=>u.id===o.info.fromUnit&&u.side==="enemy")&&typeof o.info.isKey==="boolean";
  const ally=B.units.find(u=>u.side==="ally"); o.light=G.battle.lightOf(ally.id);
  o.lightOk=JSON.stringify(o.light)===JSON.stringify({light:ally.light,maxLight:ally.maxLight,emotion:ally.emotion});
  o.badUnit=G.battle.lightOf("없는유닛");
  G.battle.answer(true); o.afterAnswer=G.battle.questionInfo();
  /* 빛을 쓰면 lightOf 가 따라 바뀐다 */
  const en=B.units.find(u=>u.side==="enemy"); const c=G.battle.hand(ally.id).find(c=>G.battle.usable(ally.id,c).usable&&(G.data.PAGE_BY[c].cost||0)>0);
  if(c){ const before=G.battle.lightOf(ally.id).light; G.battle.assign(ally.id,0,c,{unit:en.id,die:0}); o.spent=before-G.battle.lightOf(ally.id).light===G.data.PAGE_BY[c].cost; } else o.spent=true;
  /* 핵심 문제가 나오면 isKey true */
  /* 전투가 일찍 끝나지 않게: 사서는 공격하지 않고 체력을 크게 → 문제를 다 돌면 핵심 문제가 나온다 */
  let tries=0; o.keySeen=false; const X=__studyGame.battleApi.internals();
  for(const u of B.units.filter(u=>u.side==="ally")){ X[u.id].cu.hp=99999; u.hp=99999; }
  while(!G.battle.outcome&&tries<60&&!o.keySeen){ tries++; G.battle.resolve(); if(G.battle.state&&G.battle.state.phase==="question"){ const I=G.battle.questionInfo(); if(I&&I.isKey) o.keySeen=true; G.battle.answer(true); } }
  G.battle.leave(); return o; });
ok(qi.has&&JSON.stringify(qi.short)===JSON.stringify([true,true,true,false,false]),"Game.checkShort: 정답·accept·대소문자/공백 허용, 오답·빈 답은 false",qi.short);
ok(qi.none===null&&qi.noLight===null,"전투 없을 때 questionInfo·lightOf 는 null",{q:qi.none,l:qi.noLight});
ok(qi.infoOk,"questionInfo: 지금 문제·낸 적 유닛·핵심 여부",qi.info&&{from:qi.info.fromUnit,isKey:qi.info.isKey});
ok(qi.afterAnswer===null,"문제 단계가 아니면 questionInfo 는 null",qi.afterAnswer);
ok(qi.lightOk&&qi.badUnit===null&&qi.spent,"lightOf: 사서 빛·최대 빛·감정, 없는 유닛 null, 배치하면 빛이 줄어듦",qi.light);
ok(qi.keySeen,"핵심 문제 막에서 questionInfo.isKey === true");
const bk=await p.evaluate(()=>{ const s=__studyGame.save; __studyGame.acq.addBooks(s,"active-recall",3); return {count:Game.books.count("active-recall"),shown:Game.books.shown("active-recall"),total:Game.books.total(),maxed:Game.books.maxed("active-recall")}; });
ok(bk.count===3&&bk.shown===3&&bk.total>=3&&bk.maxed===false,"Game.books.count/shown/total/maxed 가 저장을 읽음",bk);
/* 회피 재사용 (2026-11-19): resolveScene — 이기거나 비기면 남고 지면 깨짐, 상대가 떨어지면 남은 회피 번호를 heldP/heldG 로 돌려줌, pHeld 로 다시 시작 */
const evr=await p.evaluate(()=>{ const E=__studyGame.engine, mk=()=>({P:E.mkUnit(999,999),G:E.mkUnit(999,999)}), ev=[{type:"회피",min:5,max:5}], a=v=>({type:"참격",min:v,max:v}), R=d=>[d.min,d.max];
  const o={pRangeFn:R,gRangeFn:R,rng:()=>0.5};
  let u=mk(); const s1=E.resolveScene({...o,P:u.P,G:u.G,pDice:ev,gDice:[a(1),a(5),a(3)]});
  u=mk(); const s2=E.resolveScene({...o,P:u.P,G:u.G,pDice:ev,gDice:[a(9)]});
  u=mk(); const s3=E.resolveScene({...o,P:u.P,G:u.G,pDice:[a(2),...ev,a(2)],gDice:[a(1)],pHeld:1});
  u=mk(); const s4=E.resolveScene({...o,P:u.P,G:u.G,pDice:[a(2)],gDice:[{type:"회피",min:5,max:5}]});
  return {s1:{o:s1.map(s=>s.outcome),r:s1.map(s=>s.pd.reused),held:s1.heldP},s2:{o:s2.map(s=>s.outcome),held:s2.heldP},s3:{n:s3.length,t:s3[0].pd.type,r:s3[0].pd.reused,idx:s3[0].pIdx,held:s3.heldP},s4:{held:s4.heldG}}; });
ok(JSON.stringify(evr.s1)==='{"o":["P","tie","P"],"r":[false,true,true],"held":0}',"회피: 이기고·비겨도 남아 다음 주사위와 다시 합, 끝나면 heldP=0",evr.s1);
ok(evr.s2.o[0]==="G"&&evr.s2.held===null,"회피: 지면 깨짐(heldP null)",evr.s2);
ok(evr.s3.n===1&&evr.s3.t==="회피"&&evr.s3.r===true&&evr.s3.idx===1&&evr.s3.held===1,"pHeld: 남은 회피 하나만으로 reused 로 시작, 책장의 다른 주사위는 다시 안 굴림",evr.s3);
ok(evr.s4.held===0,"적 회피도 같은 규칙(heldG)",evr.s4);
ok(errs.length===0,"오류 없음",errs);
/* 적 모델 다양화: enemies[i].model 은 유닛에 실려 무대로 간다(규칙은 안 씀). 기존 적은 model=null */
{ const m=await p.evaluate(()=>{ const G=Game, g=Game.data.GUEST_BY["beccaria"], o={};
    G.battle.leave(); G.battle.begin("beccaria"); o.before=G.battle.state.units.filter(u=>u.side==="enemy").map(u=>u.model);
    const keep=g.enemies.map(e=>e.model); g.enemies[0].model="slime_pink";
    G.battle.leave(); G.battle.begin("beccaria"); const es=G.battle.state.units.filter(u=>u.side==="enemy"); o.first=es[0].model; o.rest=es.slice(1).map(u=>u.model);
    g.enemies.forEach((e,i)=>{ if(keep[i]===undefined) delete e.model; else e.model=keep[i]; }); G.battle.leave(); return o; });
  ok(m.before.length&&m.before.every(x=>x===null),"기존 손님 적은 model=null",m);
  ok(m.first==="slime_pink"&&m.rest.every(x=>x===null),"enemies[i].model 이 유닛에 실림",m); }
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
