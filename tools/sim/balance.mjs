/* 다대다 밸런스 시뮬레이션: node tools/sim/balance.mjs
   간이 AI(사서 주사위마다 쓸 수 있는 가장 센 카드, 그 주사위를 노린 적 주사위와 합 → 사서를 노린 아무 적 주사위 → 체력 낮은 적)로
   손님마다 N판씩, 정답률 30/70/100% 를 돌려 표로 낸다. 결과는 시드 고정(mulberry32)이라 같은 코드면 같은 숫자.
   환경변수:
     LIB_ROOT  저장소 위치 (기본: 이 파일 기준 맨 위)
     N         손님·조건마다 판 수 (기본 200)
     CFG       [[기프트 수, 사서 수], ...] (기본 [[0,1],[0,2],[0,3],[4,3]]). 기프트 0=없음, 4=사서마다 4부위(보통), 8=8부위+세트 1개
     HPO       MB 덮어쓰기 JSON. MB.HP 키 + DICE / PACE / WRONG. 예) HPO='{"enemyHpPerQ":{"1":4.2,"2":4.2,"3":4.6},"allyParty":[1,1.3,1.6]}'
     GUESTS    손님 id 쉼표 목록 (기본 전부)
     OUT       원자료 JSON 저장 경로 (선택)
   표: 승률 / 평균 막 / 막÷문제 수 중앙값 / 막÷문제 수가 0.8~1.2 인 판 비율 / 60막 넘어 미결 비율 /
       한 방 중앙(사서가 적을 때린 체력 피해 하나 ÷ 그 적 최대 체력의 중앙값) / 꽉 찬 적 한 방 사망%(체력이 가득한 적을 때린 한 방 중 그 한 방에 쓰러진 비율),
       그리고 정답률 70% 손님별 막 수·승률 */
import { chromium } from "playwright-core";
import { createServer } from "http"; import { readFileSync, existsSync, writeFileSync } from "fs"; import { extname, join, normalize } from "path";
import { LIB_ROOT, launchBrowser } from "../../tests/lib/browser.mjs";
const ROOT=LIB_ROOT, N=+(process.env.N||200);
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":extname(a)===".html"?"text/html; charset=utf-8":extname(a)===".js"?"text/javascript":"application/octet-stream"});r.end(readFileSync(a))});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"],headless:true});
const p=await b.newPage(); p.on("pageerror",e=>console.log("ERR",String(e)));
await p.goto("http://127.0.0.1:"+server.address().port+"/?multi=1");await p.waitForFunction(()=>window.__studyGame&&__studyGame.battleApi);
const res=await p.evaluate(({N,HPO,CFG,GUESTS})=>{
  const G=__studyGame, A=G.battleApi, s=G.save; if(HPO&&A.MB.HP) for(const k in HPO){ if(k==="DICE") Object.assign(A.MB.DICE,HPO[k]); else if(k==="PACE") Object.assign(A.MB.PACE,HPO[k]); else if(k==="WRONG") Object.assign(A.MB.WRONG,HPO[k]); else A.MB.HP[k]=HPO[k]; }
  function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const KEYS=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"];
  const persistOrig=null;
  const score=cid=>{ const P=A.cardOf(cid); if(!P||!P.dice) return 0; return P.dice.reduce((t,d)=>t+((d.min+d.max)/2)*(d.type==="방어"||d.type==="회피"?0.6:1),0); };
  function battle(gid,acc,lv,party,rng){
    const GS={0:{},4:{머리:"fading-ribbon",눈:"recall-lens",손:"sand-heart",발:"blind-spot-pin"},8:{손:"sand-heart",가슴:"cycle-crest",목:"short-rest-charm",눈:"recall-lens",얼굴:"underlined-mark",등:"interval-gear",머리:"fading-ribbon",발:"blind-spot-pin"}}[lv]||{};
    s.unlockedKeyIds=KEYS.slice(0,party===1?1:party===2?5:10); G.libs.sync(s);
    if(party>=2) G.libs.equipKey(s,"lib2","archivist"); if(party>=3) G.libs.equipKey(s,"lib3","classical-robe");
    for(const id of ["kyu","lib2","lib3"]){ const L=G.gifts.libOf(s,id); L.gifts.owned=Object.values(GS); L.gifts.equipped={...GS}; }
    const spr=G.libs.setParty(s,["kyu","lib2","lib3"].slice(0,party)); 
    A.create(gid,{rng}); const m=A.mb; if(m.battle.units.filter(u=>u.side==="ally").length!==party) throw new Error("party "+party+" got "+m.battle.units.filter(u=>u.side==="ally").length); const qn=Object.keys(m.qpool).length;
    let stag=0, lstag=0, scenes=0; const hits=[]; let fullN=0, fullK=0;
    while(!m.outcome && scenes<60){
      scenes++;
      A.answer(rng()<acc);
      const B=m.battle, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
      for(const u of B.units.filter(u=>u.side==="ally"&&u.hp>0)){
        u.dice.forEach((d,i)=>{
          const hand=A.hand(u.id).filter(c=>A.usable(u.id,c).usable).sort((x,y)=>score(y)-score(x));
          if(!hand.length) return;
          let t=null;
          for(const e of en) e.dice.forEach((ed,k)=>{ if(!t&&ed.target&&ed.target.unit===u.id&&ed.target.die===i) t={unit:e.id,die:k}; });
          if(!t) for(const e of en) e.dice.forEach((ed,k)=>{ if(!t&&ed.target&&ed.target.unit===u.id) t={unit:e.id,die:k}; });
          if(!t){ const e=en.slice().sort((x,y)=>x.hp-y.hp)[0]; if(!e) return; t={unit:e.id,die:e.dice.length?0:null}; }
          A.assign(u.id,i,hand[0],t);
        });
      }
      const cur=Object.fromEntries(m.battle.units.map(u=>[u.id,u.hp])), mx=Object.fromEntries(m.battle.units.map(u=>[u.id,u.maxHp]));
      const ev=A.resolveOnly()||[];
      /* 사서가 적을 때린 한 방(체력 피해 > 0): 한 방/그 적 최대 체력, 꽉 찬 적이 한 방에 쓰러졌는지 */
      for(const e of ev) for(const st of (e.steps||[])){ const d=st.dmg; if(!d||!(d.hp>0)) continue; const before=cur[d.unit]; cur[d.unit]=Math.max(0,before-d.hp);
        if(d.unit[0]!=="e") continue; hits.push(d.hp/mx[d.unit]); if(before>=mx[d.unit]){ fullN++; if(d.hp>=mx[d.unit]) fullK++; } }
      for(const e of ev) for(const id of (e.result&&e.result.staggered)||[]) if(id[0]==="e"){ stag++; if(m.battle.units.find(u=>u.id===id).leader) lstag++; }
      if(!m.outcome) A.nextScene();
    }
    const al=m.battle.units.filter(u=>u.side==="ally"), leader=m.battle.units.find(u=>u.side==="enemy"&&u.leader);
    const en2=m.battle.units.filter(u=>u.side==="enemy");
    const dA=al.reduce((t,u)=>t+u.maxHp-Math.max(0,u.hp),0)/scenes, dE=en2.reduce((t,u)=>t+u.maxHp-Math.max(0,u.hp),0)/scenes;
    return {dA,dE,win:m.outcome==="win"?1:(m.outcome==="lose"?0:-1),scenes,qn,hp:al.reduce((t,u)=>t+Math.max(0,u.hp),0)/al.reduce((t,u)=>t+u.maxHp,0),stag,lstag,hits,fullN,fullK};
  }
  const m0w=gid=>G.data.WEAK_POINTS.find(g=>g.id===gid).weakness;
  const out=[]; const save0=JSON.stringify(s);
  const guests=GUESTS||G.data.WEAK_POINTS.map(g=>g.id);
  for(const [lv,party] of (CFG||[[0,1],[0,2],[0,3],[4,3]])) for(const acc of [.3,.7,1]) {
    for(const gid of guests){ const rng=mul(gid.length*7919+lv*31+Math.round(acc*100)); const R=[];
      for(let i=0;i<N;i++) R.push(battle(gid,acc,lv,party,rng));
      const H=R.flatMap(r=>r.hits).sort((a,b)=>a-b);
      out.push({gid,lv,acc,party,R:R.map(r=>[r.win,r.scenes,r.qn,Math.round(r.hp*100),r.stag,r.lstag,+r.dA.toFixed(1),+r.dE.toFixed(1),m0w(gid)]),
        hit:{n:H.length,sum:H.reduce((t,x)=>t+x,0),q:[.25,.5,.75].map(f=>H.length?+H[Math.floor(H.length*f)].toFixed(3):0),fullN:R.reduce((t,r)=>t+r.fullN,0),fullK:R.reduce((t,r)=>t+r.fullK,0)},
        hitsRaw:H.map(x=>+x.toFixed(3))}); }
  }
  Object.assign(s,JSON.parse(save0));
  return out;
},{N,HPO:process.env.HPO?JSON.parse(process.env.HPO):null,CFG:process.env.CFG?JSON.parse(process.env.CFG):null,GUESTS:process.env.GUESTS?process.env.GUESTS.split(","):null});
await b.close(); server.close();
if(process.env.OUT) writeFileSync(process.env.OUT,JSON.stringify(res));
const hitsRaw=res.map(x=>{ const h=x.hitsRaw; delete x.hitsRaw; return h; });
/* 행: R=[승(1)/패(0)/미결(-1), 막 수, 문제 수, 남은 HP%, 적 흐트러짐, 우두머리 흐트러짐, 사서 피해/막, 적 피해/막, 약점] */
const med=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?s[s.length>>1]:0; }, pct=x=>Math.round(x*100);
const keys=[...new Set(res.map(x=>JSON.stringify([x.lv,x.party,x.acc])))].map(k=>JSON.parse(k));
console.log("| 기프트(사서당) | 사서 | 정답률 | 승률% | 평균 막 | 막/문제 중앙 | 0.8~1.2% | 미결% | 한 방 중앙% | 꽉 찬 적 한 방 사망% | 방/막 |\n|---|---|---|---|---|---|---|---|---|---|---|");
let allHits=[], allFN=0, allFK=0;
for(const [g,n,acc] of keys){ const sel=res.map((x,i)=>[x,i]).filter(([x])=>x.lv===g&&x.party===n&&x.acc===acc), R=sel.flatMap(([x])=>x.R), r=R.map(x=>x[1]/x[2]);
  const H=sel.flatMap(([,i])=>hitsRaw[i]), fN=sel.reduce((t,[x])=>t+x.hit.fullN,0), fK=sel.reduce((t,[x])=>t+x.hit.fullK,0); allHits=allHits.concat(H); allFN+=fN; allFK+=fK;
  console.log(`| ${g} | ${n} | ${pct(acc)}% | ${pct(R.filter(x=>x[0]===1).length/R.length)} | ${(R.reduce((t,x)=>t+x[1],0)/R.length).toFixed(1)} | ${med(r).toFixed(2)} | ${pct(r.filter(x=>x>=.8&&x<=1.2).length/R.length)} | ${pct(R.filter(x=>x[0]===-1).length/R.length)} | ${pct(med(H))} | ${(fN?fK/fN*100:0).toFixed(1)} | ${(H.length/R.reduce((t,x)=>t+x[1],0)).toFixed(2)} |`); }
console.log(`\n전체 한 방 중앙 ${pct(med(allHits))}% (사분위 ${pct(allHits.slice().sort((a,b)=>a-b)[allHits.length>>2]||0)}~${pct(allHits.slice().sort((a,b)=>a-b)[(allHits.length*3)>>2]||0)}%, ${allHits.length}방) · 꽉 찬 적 한 방 사망 ${(allFN?allFK/allFN*100:0).toFixed(1)}% (${allFK}/${allFN})`);
console.log("\n정답률 70% 손님별 (중앙 막 / 문제 수 / 승률%)");
for(const [g,n] of [...new Set(keys.map(k=>k[0]+","+k[1]))].map(s=>s.split(",").map(Number))){
  console.log(`기프트 ${g} · 사서 ${n}: `+res.filter(x=>x.lv===g&&x.party===n&&x.acc===0.7).map(x=>`${x.gid} ${med(x.R.map(r=>r[1]))}/${x.R[0][2]} ${pct(x.R.filter(r=>r[0]===1).length/x.R.length)}%`).join(" · ")); }
