/* 개념의 서고 — 다대다 전투 엔진(화면 없음). 화면은 이 파일의 함수·Game.battle 만 부른다. */
/* ===================== 다대다 접대 (Library of Ruina식) — 전투/시스템 담당 =====================
   켜기: URL ?multi=1 또는 save.multiBattle=true (__studyGame.battleApi.enable(true)). 꺼져 있으면 기존 1:1 접대 그대로.
   막 순서: question → assign → resolve → (다음 막 question | end)
   공개 상태 모양(방에 알린 그대로): window.__studyGame.battle
     {scene, phase, question:{fromUnit,id,answered,correct},
      units:[{id, side, slot, libId?, key?, topic?, name, hp, maxHp, stagger, maxStagger, staggered, light, maxLight, emotion,
              status:[{id,stacks,turns}], dice:[{speed, card, target:{unit,die}|null}]}]}
   무대 그리기·조작은 assets/ui/battle-stage.js (UI/UX 담당). 기믹 훅: MB_HOOKS.onSceneStart/onSceneEnd/onAnswer/onClash */
const MB={ allyDice:2, allySpeed:[2,6], leaderSpeed:[2,6], followerSpeed:[1,5], followerHp:.5, followerSt:.6, followerDie:-1,
  maxEnemies:5, ENEMY_MAX:3, stepMs:520,
  /* 다대다 전용 체력·흐트러짐 (1:1 COMBAT.playerStartHp/guestHp 등과 별개).
     기준(2026-11-19 A안): 숫자는 모두 주사위 단위. 적 하나는 평균 3~4방(사서 한 방 중앙 ≈ 그 적 최대 체력 25~30%, 꽉 찬 적 한 방 사망 ≤5%),
       판 길이는 대략 문제 수만큼의 막(한 막 문제 1개). 사서 혼자는 손에 공격 카드가 적어 막당 맞히는 방 수가 적어 판이 조금 길다(≈1.5×).
     사서(레벨 없음): allyHp × 문제 수 배율 × allyParty[사서 수−1] (+ 기프트·장서복 hp), 흐트러짐 allySt × allyParty.
       문제 수 배율 = clamp(문제 수 / qRef, qMin, qMax) — 문제가 많은 손님은 막이 길어 사서도 그만큼 버틴다.
     적 무리 전체 체력 = enemyHpPerQ[weakness] × 문제 수 × party[사서 수−1] × (1 + floorStep×층 순서) → 적마다 맡은 문제 수(e.q) 비율로 나눔 (고정값 없음).
     흐트러짐 = 체력 × leaderSt / followerSt (우두머리는 한 판에 한 번쯤 흐트러지게). */
  HP:{ allyHp:100, allySt:24, allyParty:[1,1.25,1.55], qRef:7, qMin:0.85, qMax:2,
       enemyHpPerQ:{1:4,2:4,3:4.4}, party:[1,1.2,1.25], floorStep:0.05,
       leaderSt:1.1, followerSt:0.7, minHp:6, minSt:4 },
  /* 다대다 적 속도 주사위 수: 우두머리 기본 leaderDice[weakness], 사서가 늘면 partyLeader/partyFollower[사서 수−1] 만큼 더 (최대 3).
     사서 1명(주사위 2) vs 적 3명이 한쪽으로 몰리지 않고, 사서 3명이면 적 주사위도 그만큼 늘어 판 길이가 문제 수에 맞게 유지된다 */
  /* 값은 시뮬레이션(npm run sim: 전 손님 × 정답률 30/70/100%, 사서 1·2·3명, 기프트 0·4, 각 200판, PACE 끔)으로 맞춤. 결과표는 docs/battle.md */
  DICE:{ leaderDice:{1:1,2:1,3:2}, partyLeader:[0,1,2], partyFollower:[0,1,2],
    /* 적 책장 주사위 크기: 1:1 은 GUEST_SCALE[weakness] (1·1.2·1.45). 다대다는 적이 여럿이라 scale[weakness] 로 덜 키운다 */
    scale:{1:1.15,2:1.15,3:1.32}, bigScale:0.9,
    /* 사서 수에 따라 적 책장 주사위 크기 (사서 1·2·3명). 혼자일 때 작게 → 사서 체력을 주사위 단위로 줄일 수 있다 */
    partyScale:[0.55,0.9,1.25] },
  /* 판 길이 보정 (문제 수 Q 기준, 한 막 = 문제 1개). 기본 둘 다 끔 — hold / drain 을 따로 켤 수 있다.
     ① 우두머리는 minRatio×Q 막(올림) 전에는 체력 1에서 버틴다 — 문제가 남았는데 무리가 다 녹지 않게.
     ② Q+grace 막째부터 막이 끝날 때마다 양쪽 모두(사서·적) 최대 체력의 drain×(넘긴 막 수) 를 잃는다 — 문제를 다 냈는데 질질 끌지 않게.
        양쪽에 똑같이 걸어 잘 푼 쪽(체력이 남은 쪽)이 이긴다. 적이 먼저 다 쓰러지면 승리 */
  PACE:{ hold:false, drain:false, minRatio:0.8, grace:0, drainPct:0.15 },
  /* 피해량 = 주사위 값 그대로 (2026-11-19). 숨은 배율 없음: 적·사서 모두 이름 있는 보정(상성 TIER·정답/오답 주사위 범위·
     흐트러짐 중 ×2(치명)·기프트/장서복 dmgPct·staggerPct·정답 흐트러짐 배율·오답 벌점 WRONG)만 곱한다. 체력·흐트러짐도 주사위 단위 */
  /* 오답 막 벌점(다대다 전용, COMBAT.pct 는 그대로): 그 막에 사서가 받는 체력/흐트러짐 피해 × hp / st */
  WRONG:{ hp:2.3, st:2 } };
/* 적 key별 덮어쓰기: {maxHp, maxStagger, speedDice, speed:[lo,hi], resist, pages:[{name,dice}], big, bigEvery} — 비어 있으면 공식대로 */
const ENEMY_STATS={};
const MB_TYPE_EN={참격:"slash",관통:"pierce",타격:"blunt",방어:"guard",회피:"evade"};
const MB_HOOKS={onSceneStart:[],onSceneEnd:[],onAnswer:[],onClash:[],onAssign:[],onUnassign:[]};
/* ---------- 기믹(2026-11-23 큐 양: 라오루·림버스처럼 숫자놀이만이 아닌 책장) ----------
   상태 u.status=[{id,stacks,pending}]. pending 은 "다음 막부터"(막이 시작할 때 켜지고 그 막이 끝나면 사라짐). now 인 상태(출혈)는 바로 켜지고 남는다.
   책장(사서 COMBAT_PAGES·적 GUEST_COMBAT pages/big) 필드:
     fx:[{on:"use"|"win"|"lose"|"hit", give:상태id, n, to:"foe"|"self"} | {on, light:n}]  — 교환 하나가 끝난 뒤 발동
        use=이 책장 주사위를 굴림 · win/lose=합에서 이김/짐 · hit=상대에게 체력 피해를 줌
     power:{when:"emotion"(n 이상)|"lastFoe"(살아 있는 상대가 하나)|"foeBleed"(상대에게 출혈), n, add}  — 조건이 맞으면 이 책장 주사위 모두 +add
     counter:true  — 반격 책장(사서만): 대상을 정하지 않는다. 이 사서를 일방 공격하는 상대가 있을 때만 맞선다(남은 회피처럼, 회피 주사위면 이기는 동안 계속) */
const MB_STATUS={
  bleed:{name:"출혈",now:true,bad:true,text:"공격 주사위를 굴릴 때마다 그 수만큼 체력을 잃고, 수가 1/3 줄어든다"},
  para:{name:"마비",bad:true,text:"이번 막, 그 수만큼의 주사위가 최솟값으로 굴러간다"},
  str:{name:"힘",text:"이번 막, 공격 주사위 값 +"},
  feeble:{name:"허약",bad:true,text:"이번 막, 공격 주사위 값 −"},
  prot:{name:"보호",text:"이번 막, 맞을 때마다 받는 체력 피해 −"},
  frag:{name:"무방비",bad:true,text:"이번 막, 맞을 때마다 받는 체력 피해 +"},
  haste:{name:"신속",text:"이번 막, 속도 주사위 +"},
  bind:{name:"속박",bad:true,text:"이번 막, 속도 주사위 −"}
};
const MB_STATUS_CAP=10;
function mbSt(u,id){ let n=0; for(const s of (u&&u.status)||[]) if(s.id===id&&!s.pending) n+=s.stacks; return n; }
function mbGive(u,id,n){
  if(!u||u.hp<=0||!MB_STATUS[id]||!(n>0)) return 0; u.status=u.status||[];
  const pending=!MB_STATUS[id].now, e=u.status.find(s=>s.id===id&&!!s.pending===pending);
  if(e) e.stacks=Math.min(MB_STATUS_CAP,e.stacks+n); else u.status.push({id,stacks:Math.min(MB_STATUS_CAP,n),pending});
  return n;
}
/* 막 시작: 지난 막에 켜져 있던 것(출혈 말고)은 끝나고, 기다리던 것이 켜진다 */
function mbStatusStart(u){ const out=[];
  for(const s of u.status||[]){ if(s.pending){ const e=out.find(x=>x.id===s.id); if(e) e.stacks=Math.min(MB_STATUS_CAP,e.stacks+s.stacks); else out.push({id:s.id,stacks:s.stacks,pending:false}); }
    else if(MB_STATUS[s.id]&&MB_STATUS[s.id].now&&s.stacks>0){ const e=out.find(x=>x.id===s.id); if(e) e.stacks+=s.stacks; else out.push({...s}); } }
  u.status=out; if(mb&&mb.x[u.id]) mb.x[u.id].paraLeft=mbSt(u,"para"); }
/* 막 끝: 출혈은 1/3 줄어든다(공격하지 않아도 저절로 아물지 않게, 하지만 끝없이 남지는 않게) */
function mbStatusEnd(u){ for(const s of u.status||[]) if(s.id==="bleed"&&!s.pending) s.stacks=Math.floor(s.stacks*2/3); u.status=(u.status||[]).filter(s=>s.stacks>0); }
function mbPageOf(u,i){ const d=u&&u.dice[i]; if(!d||!d.card) return null; return u.side==="ally"?PAGE_BY[d.card]:(mb.x[u.id].diePages||[])[i]||null; }
const mbIsCounter=(u,i)=>{ const P=u&&u.side==="ally"&&mbPageOf(u,i); return !!(P&&P.counter); };
function mbPowerOn(pw,u,foe){
  if(!pw) return false;
  if(pw.when==="emotion") return (u.emotion||0)>=(pw.n||1);
  if(pw.when==="lastFoe") return mbLive(u.side==="ally"?"enemy":"ally").length===1;
  if(pw.when==="foeBleed") return !!foe&&mbSt(foe,"bleed")>0;
  return false;
}
let mb=null;
/* 다대다가 기본. ?multi=0 또는 save.multiBattle===false 면 기존 1:1 접대 (?multi=1 은 저장값보다 우선해 다대다) */
function multiEnabled(){ try{ if(/[?&]multi=0(&|$)/.test(location.search)) return false; if(/[?&]multi=1(&|$)/.test(location.search)) return true; }catch(e){} return save.multiBattle!==false; }
function mbEmit(name,payload){ for(const f of MB_HOOKS[name]||[]){ try{ f(mb,payload); }catch(e){ console.warn("[mb hook]",name,e); } } }
/* 사서별 장서복(핵심 책장)·기프트 효과 — keyPerk(활성 사서) 대신 그 사서의 것 */
function libPerk(libId){ return (libsKeyOf(save,libId)||KEY_PAGES[0]).perk; }
function libMods(libId){
  const t=Object.assign({},giftTotals(save,libId)), p=libPerk(libId);
  if(p==="hp10") t.hp=(t.hp||0)+10;
  if(p==="stagger10") t.staggerPct=Math.round(((t.staggerPct||0)+0.10)*1000)/1000;
  return t;
}
function libStartLight(id){ return Math.min(COMBAT.maxLightCap, COMBAT.baseLight+(libPerk(id)==="light"?1:0)+giftTotals(save,id).startLight); }
function libStartEmotion(id){ return Math.min(COMBAT.emotionMax,(libPerk(id)==="emotion"?1:0)+giftTotals(save,id).startEmotion); }
function libLightRegen(id){ return COMBAT.lightPerTurn+(libPerk(id)==="recover"?1:0)+giftTotals(save,id).lightRegen; }
/* 사서의 덱: deckId가 가리키는 덱(6장 이상), 없으면 큐 양의 현재 덱을 복사해서 쓴다 (저장은 바꾸지 않음) */
function libDeckIds(id){
  const L=libOf(save,id), d=(save.decks||[]).find(x=>x.id===L.deckId);
  if(d&&d.pageIds.length>=DECK_MIN) return d.pageIds.slice();
  return activeDeck(save).pageIds.slice();
}
/* 적 능력치: 리더 = 1:1 손님의 책장·속성·큰 일격, 부하 = 주사위 1개·책장 주사위 −1. 체력·흐트러짐은 다대다 전용 MB.HP (문제 수 비례, mbEnemyCtx). ENEMY_STATS[key]로 덮어쓰기 */
/* 다대다 적 체력 묶음: 손님 문제 수(Q)·사서 수·weakness·층에 비례. ctx 없으면 손님 데이터로 (사서 1명) */
function mbQuestionCount(guest){ return Math.max(1,Object.keys(mbQuestionPool(guest)).length); }
function mbFloorIdx(guest){ const i=FLOORS.findIndex(f=>f.id===guest.floorId); return i<0?0:i; }
function mbEnemyHpTotal(guest,nParty){
  const H=MB.HP, w=guest.weakness||1, n=Math.max(1,Math.min(H.party.length,nParty||1));
  return Math.round((H.enemyHpPerQ[w]||H.enemyHpPerQ[1])*mbQuestionCount(guest)*H.party[n-1]*(1+H.floorStep*mbFloorIdx(guest)));
}
/* 적 한 명의 몫 = 그 적이 맡은 문제 수(e.q, 최소 1). ordered 가 없으면 손님 데이터(상한 전) 기준 */
function mbEnemyQ(e){ return Math.max(1,((e&&e.q)||[]).length); }
function mbEnemyCtx(guest,nParty,ordered){
  const list=ordered||(guest.enemies&&guest.enemies.length?guest.enemies:[{leader:true,q:(guest.questions||[]).map(q=>q.id)}]);
  return {total:mbEnemyHpTotal(guest,nParty),sumW:list.reduce((t,e)=>t+mbEnemyQ(e),0),nParty:nParty||1};
}
function mbAllyStats(mods,guest,nParty){
  const H=MB.HP, qs=guest?Math.max(H.qMin,Math.min(H.qMax,mbQuestionCount(guest)/H.qRef)):1;
  const n=Math.max(1,Math.min((H.allyParty||[1]).length,nParty||1)), ap=(H.allyParty||[1])[n-1]||1;
  return {hp:Math.round(H.allyHp*qs*ap)+((mods&&mods.hp)||0), st:Math.round(H.allySt*ap)};
}
function enemyStats(guest,e,idx,ctx){
  const kit=guestCombat(guest), w=guest.weakness||1, lead=!!e.leader||(idx===0&&!(guest.enemies||[]).some(x=>x.leader));
  ctx=ctx||mbEnemyCtx(guest,1);
  const H=MB.HP, hp=Math.max(H.minHp,Math.round(ctx.total*mbEnemyQ(e)/Math.max(1,ctx.sumW))), st=Math.max(H.minSt,Math.round(hp*(lead?H.leaderSt:H.followerSt)));
  const rs=(MB.DICE.scale[w]||1)*(MB.DICE.partyScale[(ctx&&ctx.nParty||1)-1]||1)/(GUEST_SCALE[w]||1), sc=d=>Math.abs(rs-1)<1e-9?d:{type:d.type,min:Math.max(1,Math.round(d.min*rs)),max:Math.max(2,Math.round(d.max*rs))};
  kit.pages=kit.pages.map(p=>({name:p.name,dice:p.dice.map(sc)})); if(kit.big){ const bs=MB.DICE.bigScale||1; kit.big={...kit.big,dice:kit.big.dice.map(sc).map(d=>bs===1?d:{type:d.type,min:Math.max(1,Math.round(d.min*bs)),max:Math.max(2,Math.round(d.max*bs))})}; }
  const sh=d=>{ const lo=Math.max(1,d.min+MB.followerDie); return {type:d.type,min:lo,max:Math.max(lo,d.max+MB.followerDie)}; };
  const base=lead
    ? {leader:true,maxHp:hp,maxStagger:st,speedDice:(MB.DICE.leaderDice[w]||1)+(MB.DICE.partyLeader[ctx.nParty-1]||0),speed:MB.leaderSpeed.slice(),resist:kit.resist,pages:kit.pages,big:kit.big,bigEvery:kit.bigEvery}
    : {leader:false,maxHp:hp,maxStagger:st,speedDice:1+(MB.DICE.partyFollower[ctx.nParty-1]||0),speed:MB.followerSpeed.slice(),resist:kit.resist,
       pages:kit.pages.map(p=>({name:p.name,dice:p.dice.map(sh)})),big:null,bigEvery:0};
  const o=Object.assign(base,ENEMY_STATS[e.key]||{});
  o.speedDice=Math.max(1,Math.min(3,o.speedDice|0));
  return o;
}
/* 적 외형 분류 (UI 가 몸·표정 그림을 고를 때). guest.enemies[i].body/form 이 있으면 그대로.
   body: 1) e.body  1b) ENEMY_BODY[e.key] (적 key 별 기본표, ENEMY_STATS 와 별도)  2) 손님 archetype "puppet" → "puppet"  3) 손님 floorId: crime·criminal-law → "human", cognition → "machine", memory → "puppet"
         4) 그 밖은 손님 id 해시 % 3 → human/machine/puppet (같은 손님의 무리는 같은 몸)
   form: 1) e.form  2) 우두머리이고 weakness ≥ 3(어려운 손님) → "chaos"
         3) 책장의 절반 이상에 effect/text(효과) 가 있으면 → "knowledge"
         4) 주사위 중 공격(참격·관통·타격) 비율 ≥ 0.9 → "basic"  5) 방어·회피 비율 ≥ 0.5 → "ritual"
         6) 섞인 손(기본 키트는 공격 0.8)이면 손님 archetype 으로: fixer·knight·beast → basic, scholar·mage → knowledge, puppet → ritual
         7) 그래도 없으면 공격 ≥ 0.75 → basic, 아니면 knowledge */
const ENEMY_BODY={};
for(const [b,ks] of Object.entries({
  human:["beccaria-author","beccaria-no-revenge","tc-scale-knight","bentham-preacher","bentham-warden","legality-gatekeeper","legality-whim-judge","deterrence-brakeman","limits-article-ten","meta-scribe","defamation-advocate","defamation-accuser","insult-curser","insult-megaphone"],
  machine:["tc-fine-collector","bentham-accountant","deterrence-tracker","limits-dim-lobe","pomodoro-clockwork","pomodoro-intruder","recall-echo","spaced-sentinel","meta-mirror"],
  puppet:["beccaria-rack-ghost","tc-harshness","deterrence-same-price","limits-shadow","recall-reread","spaced-cram-night","defamation-rumormonger","insult-crowd"]})) for(const k of ks) ENEMY_BODY[k]=b;
const MB_ARCH_FORM={fixer:"basic",knight:"basic",beast:"basic",scholar:"knowledge",mage:"knowledge",puppet:"ritual"};
const MB_BODIES=["human","machine","puppet"], MB_FLOOR_BODY={crime:"human","criminal-law":"human",cognition:"machine",memory:"puppet"};
function mbHash(str){ let h=0; for(const ch of String(str)) h=(h*31+ch.charCodeAt(0))>>>0; return h; }
function enemyBody(guest,e){
  if(e&&MB_BODIES.includes(e.body)) return e.body;
  if(e&&MB_BODIES.includes(ENEMY_BODY[e.key])) return ENEMY_BODY[e.key];
  if(guest.archetype==="puppet") return "puppet";
  if(MB_FLOOR_BODY[guest.floorId]) return MB_FLOOR_BODY[guest.floorId];
  return MB_BODIES[mbHash(guest.id)%3];
}
function enemyForm(guest,e,S){
  if(e&&["basic","ritual","knowledge","chaos"].includes(e.form)) return e.form;
  if(S.leader&&(guest.weakness||1)>=3) return "chaos";
  const pages=[...(S.pages||[]),...(S.big?[S.big]:[])];
  if(pages.length&&pages.filter(p=>p.effect||p.text).length*2>=pages.length) return "knowledge";
  const dice=pages.flatMap(p=>p.dice||[]); if(!dice.length) return "basic";
  const atk=dice.filter(d=>isAttack(d.type)).length/dice.length;
  if(atk>=0.9) return "basic"; if(1-atk>=0.5) return "ritual";
  return MB_ARCH_FORM[guest.archetype]||(atk>=0.75?"basic":"knowledge");
}
function mbQuestionPool(guest){
  const m={};
  (guest.questions||[]).forEach(q=>{ if(q&&q.id) m[q.id]={q,isKey:false}; });
  keyQsOf(guest).forEach(q=>{ if(q&&q.id) m[q.id]={q,isKey:true}; });
  return m;
}
const mbUnit=id=>mb&&mb.battle.units.find(u=>u.id===id);
const mbSide=side=>mb.battle.units.filter(u=>u.side===side);
const mbLive=side=>mbSide(side).filter(u=>u.hp>0);
/* expr(표정): "shock" 흐트러진 동안 · "hurt" 방금 교환에서 피해(체력·흐트러짐)를 입음 · "win" 방금 합에서 이김(피해 없이) · 그 밖 "idle".
   교환마다 그 교환에 나온 둘만 바뀌고, 다음 막 시작에 idle(흐트러졌으면 shock)로 돌아간다 */
function mbSync(u){ const c=mb.x[u.id].cu; u.hp=c.hp; u.stagger=c.st; u.staggered=c.stag>0; if(u.staggered) u.expr="shock"; else if(u.expr==="shock") u.expr="idle"; }
/* 한 접대에 나오는 적 수 상한: 기본 MB.ENEMY_MAX(3). guest.enemyMax(1~5)가 있으면 그 값,
   guest.manyEnemies===true(다수 적 기믹)면 MB.maxEnemies(5). 넘치면 우두머리는 반드시 남기고 나머지는 enemies[] 앞에서부터 */
function mbEnemyCap(guest){
  if(guest&&Number.isFinite(+guest.enemyMax)&&+guest.enemyMax>0) return Math.max(1,Math.min(MB.maxEnemies,Math.floor(+guest.enemyMax)));
  if(guest&&guest.manyEnemies===true) return MB.maxEnemies;
  return MB.ENEMY_MAX;
}
function mbCreate(guestId,o){
  o=o||{};
  const guest=GUEST_BY[guestId]; if(!guest) return null;
  syncLibs(save);
  const party=(o.party||save.party||[LIB_DEFAULT_ID]).filter(id=>save.librarians[id]).slice(0,PARTY_MAX);
  if(!party.length) party.push(LIB_DEFAULT_ID);
  const rng=o.rng||Math.random, units=[], x={};
  party.forEach((libId,i)=>{
    const L=libOf(save,libId), t=libMods(libId), id="a"+(i+1);
    const AS=mbAllyStats(t,guest,party.length), hpMax=AS.hp, stMax=AS.st, emo=libStartEmotion(libId), sl=libStartLight(libId);
    units.push({id,side:"ally",slot:i,libId,name:L.name,hp:hpMax,maxHp:hpMax,stagger:stMax,maxStagger:stMax,staggered:false,
      light:sl,maxLight:Math.min(COMBAT.maxLightCap,Math.max(sl,COMBAT.baseLight+emo)),emotion:emo,emotionCharge:0,emotionMax:COMBAT.emotionMax,chargesPerEmotion:COMBAT.chargesPerEmotion,status:[],dice:[],expr:"idle"});
    x[id]={cu:mkUnit(hpMax,stMax,FLAT_RESIST),mods:t,charge:0,deckIds:shuffle(libDeckIds(libId)),handIds:[],discardIds:[],
      seq:[],pendingDraw:0,pendingLight:0,breathe:0,nDice:MB.allyDice,speed:MB.allySpeed.slice(),log:null};
  });
  const all=(guest.enemies&&guest.enemies.length?guest.enemies:[{key:guest.id,name:guest.concept,topic:guest.concept,leader:true,q:(guest.questions||[]).map(q=>q.id)}]);
  const cap=mbEnemyCap(guest), lead=all.filter(e=>e.leader).slice(0,cap), keep=[...lead,...all.filter(e=>!e.leader).slice(0,Math.max(0,cap-lead.length))];
  /* 임시 안전장치: 상한으로 빠진 적의 문제(q id)는 남은 적에게 차례로 골고루 넘겨 문제 풀에서 사라지지 않게 한다 */
  const ordered=keep.map(e=>({...e,q:(e.q||[]).slice()})), dropped=[];
  all.filter(e=>!keep.includes(e)).forEach((e,j)=>{ const moved=[]; (e.q||[]).forEach((qid,k)=>{ const t=ordered[(j+k)%ordered.length]; if(!t.q.includes(qid)) t.q.push(qid); moved.push({q:qid,to:t.key}); }); dropped.push({key:e.key,moved}); });
  const ectx=mbEnemyCtx(guest,party.length,ordered);
  ordered.forEach((e,i)=>{
    const S=enemyStats(guest,e,i,ectx), id="e"+(i+1);
    units.push({id,side:"enemy",slot:i,key:e.key,topic:e.topic,name:e.name,hp:S.maxHp,maxHp:S.maxHp,stagger:S.maxStagger,maxStagger:S.maxStagger,staggered:false,
      light:0,maxLight:0,emotion:0,status:[],dice:[],leader:!!S.leader,body:enemyBody(guest,e),form:enemyForm(guest,e,S),model:(e&&typeof e.model==="string")?e.model:null,expr:"idle"});   /* model: 겉모습만(무대 js/stage/monsters.js), 규칙은 안 씀 */
    x[id]={cu:mkUnit(S.maxHp,S.maxStagger,S.resist),S,e,pageIdx:0,qIdx:Math.floor(rng()*Math.max(1,(e.q||[]).length)),diePages:[],orig:[]};
  });
  const m={pace:{Q:mbQuestionCount(guest),minScene:Math.ceil(MB.PACE.minRatio*mbQuestionCount(guest)),held:0,drains:0,last:null},droppedEnemies:dropped,guestId,guest,isRecall:save.conqueredIds.includes(guest.id),rng,x,qpool:mbQuestionPool(guest),bonus:0,cur:null,log:[],events:[],
    seq:0,outcome:null,cards:{},battle:{scene:0,phase:"question",question:{fromUnit:null,id:null,answered:false,correct:null},units}};
  for(const u of units) if(u.side==="ally"){ x[u.id].log=m.log; }
  return m;
}
function mbRollDice(u){
  const X=mb.x[u.id], n=u.side==="ally"?X.nDice:X.S.speedDice, sp=u.side==="ally"?X.speed:X.S.speed;
  const sh=mbSt(u,"haste")-mbSt(u,"bind");   /* 신속·속박 */
  u.dice=(u.hp<=0||X.cu.stag>0)?[]:Array.from({length:n},()=>({speed:Math.max(1,randInt(mb.rng,sp[0],sp[1])+sh),card:null,target:null}));
}
/* 판 길이 보정 ②: Q+grace 막째부터 막 끝마다 양쪽 모두 최대 체력의 drain×n 감소 (n = 1,2,3…). 결과는 mb.pace.last = [{unit,hp}] */
function mbPaceDrain(){
  const P=MB.PACE, B=mb.battle, n=B.scene-(mb.pace.Q+P.grace)+1; mb.pace.last=null;
  if(!P.drain||n<1) return;
  const out=[];
  for(const side of ["enemy","ally"]) for(const u of mbLive(side)){ const X=mb.x[u.id], d=Math.max(1,Math.ceil(u.maxHp*P.drainPct*n)); X.cu.hp=Math.max(0,X.cu.hp-d); mbSync(u); out.push({unit:u.id,hp:d}); }
  mb.pace.last=out; mb.pace.drains++;
  mb.log.push("문제가 다 넘어갔다 — 서고가 흔들려 모두 체력을 잃는다.");
  if(!mbLive("enemy").length) mb.outcome="win"; else if(!mbLive("ally").length) mb.outcome="lose";
}
/* 판 길이 보정 ①: minScene 막 전에는 우두머리가 체력 1에서 버틴다 */
function mbPaceHold(u){ if(!MB.PACE.hold||!u||u.side!=="enemy"||!u.leader) return; const X=mb.x[u.id];
  if(X.cu.hp<=0&&mb.battle.scene<mb.pace.minScene){ X.cu.hp=1; mb.pace.held++; mb.log.push(`${u.name}이(가) 아직 버틴다.`); } }
function mbStartScene(){
  const B=mb.battle; B.scene++; mb.events=[];

  for(const u of B.units) u.expr="idle";
  for(const u of B.units){
    const X=mb.x[u.id], cu=X.cu;
    if(u.hp<=0){ u.dice=[]; continue; }
    if(B.scene>1){ if(cu.stag===2) cu.stag=1; else if(cu.stag===1){ cu.stag=0; cu.st=cu.stMax; } }
    mbStatusStart(u);
    mbSync(u);
    if(u.side==="ally"){
      if(B.scene>1) u.light=Math.min(u.maxLight,u.light+libLightRegen(u.libId)+X.breathe+X.pendingLight);
      X.breathe=0; X.pendingLight=0;
      drawPages(X,(B.scene===1?STARTING_HAND-X.handIds.length:1)+X.pendingDraw); X.pendingDraw=0;
      X.seq=[];
    }
    mbRollDice(u);
  }
  /* 적: 주사위마다 책장을 고르고, 살아 있는 사서의 주사위를 하나씩 노린다 (먼저 정해서 화살표로 보인다) */
  mb.cards={};
  for(const u of mbLive("enemy")){
    const X=mb.x[u.id]; X.diePages=[]; X.orig=[];
    u.dice.forEach((d,k)=>{
      const big=X.S.big&&X.S.bigEvery&&k===0&&B.scene%X.S.bigEvery===0;
      const pg=big?X.S.big:X.S.pages[(X.pageIdx++)%X.S.pages.length];
      const cid=`${u.id}@${B.scene}.${k}`; mb.cards[cid]={name:pg.name,dice:pg.dice.map(dd=>({...dd})),big:!!big,fx:pg.fx||null,power:pg.power||null,text:pg.text||""};
      X.diePages[k]=mb.cards[cid]; d.card=cid;
      const al=mbLive("ally"); if(!al.length) return;
      const t=al[Math.floor(mb.rng()*al.length)];
      X.orig[k]={unit:t.id,die:t.dice.length?Math.floor(mb.rng()*t.dice.length):null};
    });
  }
  mbRelink();
  mbPickQuestion();
  B.phase="question";
  mbEmit("onSceneStart",{scene:B.scene});
}
function mbPrepQ(q){
  if(!mb.isRecall||q.type!=="mc") return {...q,options:q.options?q.options.slice():undefined};
  const sh=shuffle(q.options.map((o,i)=>({o,i})));
  return {...q,options:sh.map(v=>v.o),correctIndex:sh.findIndex(v=>v.i===q.correctIndex)};
}
/* 막 문제 순서 (반복 없음):
   1) 손님의 모든 문제(qpool)를 한 번씩 — 살아 있는 적이 맡은 안 낸 문제를 우선(그 적이 출제),
      살아 있는 적의 몫이 다 떨어지면 쓰러진 적·주인 없는 문제를 살아 있는 적이 대신 출제.
   2) 다 낸 뒤에는 한 바퀴씩: 마지막 답이 틀린 문제부터(틀린 순서대로), 그다음 나머지(처음 낸 순서대로).
      바퀴가 바뀔 때 방금 낸 문제가 바로 다시 나오지 않게 한 칸 미룬다.
   mb.qs = {asked:[처음 낸 순서], last:{qid:정답여부}, wrongAt:{qid:순번}, round:[이번 바퀴 남은 qid], n} */
function mbQOwner(qid,live){ return live.find(u=>((mb.x[u.id].e.q)||[]).includes(qid))||null; }
function mbNextQid(live){
  const Q=mb.qs, all=Object.keys(mb.qpool);
  const unasked=all.filter(id=>!Q.asked.includes(id));
  if(unasked.length){
    const own=[]; for(const u of live) for(const id of (mb.x[u.id].e.q||[])) if(unasked.includes(id)&&!own.some(o=>o.id===id)) own.push({id,u});
    if(own.length){ const o=own[Math.floor(mb.rng()*own.length)]; const mine=(mb.x[o.u.id].e.q||[]).filter(id=>unasked.includes(id)); return {qid:mine[0],u:o.u}; }
    return {qid:unasked[0],u:null};
  }
  if(!Q.round.length){
    const wrong=Q.asked.filter(id=>Q.last[id]===false).sort((a,b)=>(Q.wrongAt[a]||0)-(Q.wrongAt[b]||0));
    Q.round=[...wrong,...Q.asked.filter(id=>!wrong.includes(id))];
    if(Q.round.length>1&&Q.round[0]===Q.prev) Q.round.push(Q.round.shift());
  }
  return {qid:Q.round.shift(),u:null};
}
function mbPickQuestion(){
  const B=mb.battle, live=mbLive("enemy"); if(!live.length) return;
  mb.qs=mb.qs||{asked:[],last:{},wrongAt:{},round:[],n:0,prev:null};
  let entry, qid=null, u=null;
  if(Object.keys(mb.qpool).length){
    const nx=mbNextQid(live); qid=nx.qid; entry=mb.qpool[qid];
    u=nx.u||mbQOwner(qid,live)||live[Math.floor(mb.rng()*live.length)];
    if(!mb.qs.asked.includes(qid)) mb.qs.asked.push(qid);
    mb.qs.prev=qid; mb.qs.n++;
  } else { u=live[Math.floor(mb.rng()*live.length)]; const qs=mb.guest.questions||[]; mb.qFallback=((mb.qFallback||0)+1); const q=qs[mb.qFallback%qs.length]; entry={q,isKey:false}; qid=q&&q.id||null; }
  mb.cur={q:mbPrepQ(entry.q),isKey:!!entry.isKey};
  B.question={fromUnit:u.id,id:qid,answered:false,correct:null};
}
function mbCharge(u,n){
  const X=mb.x[u.id]; X.charge+=n; u.emotionCharge=X.charge;
  while(X.charge>=COMBAT.chargesPerEmotion&&u.emotion<COMBAT.emotionMax){
    X.charge-=COMBAT.chargesPerEmotion; u.emotion++; u.emotionCharge=X.charge;
    u.maxLight=Math.min(COMBAT.maxLightCap,Math.max(u.maxLight,COMBAT.baseLight+u.emotion));
    X.pendingDraw++; X.pendingLight++;
    mb.log.push(`${u.name}의 감정이 ${u.emotion}단계가 되었다.`);
  }
}
/* 막 문제 답: 1:1 과 같은 규칙. 이 막의 주사위 범위는 battle.question.correct 로 정해진다
   (사서 playerDieRange(d,correct,isKey,emotion,dieMin), 적 guestDieRange(d,correct,isKey)).
   감정: 정답이면 사서마다 충전 +1 (chargesPerEmotion 마다 감정 +1), 오답이면 충전 0 */
function mbAnswer(correct){
  const B=mb&&mb.battle; if(!B||B.phase!=="question") return false;
  correct=!!correct; const rec=reception, guest=mb.guest;
  B.question.answered=true; B.question.correct=correct;
  if(mb.qs&&B.question.id!=null){ mb.qs.last[B.question.id]=correct; if(!correct) mb.qs.wrongAt[B.question.id]=mb.qs.n; }
  if(rec){ rec.sessionTotal=(rec.sessionTotal||0)+1; if(correct) rec.sessionCorrect=(rec.sessionCorrect||0)+1; }
  const rst=ensureRecall(guest.id); rst.total++; if(correct) rst.correct++;
  const ps=save.conceptStats[guest.id]||{correct:0,total:0};
  save.conceptStats={...save.conceptStats,[guest.id]:{correct:ps.correct+(correct?1:0),total:ps.total+1}};
  save.questionsAnswered++;
  for(const u of mbLive("ally")){ if(correct) mbCharge(u,1); else { mb.x[u.id].charge=0; if(u.emotionCharge!=null) u.emotionCharge=0; } }
  mb.log.push(correct?`${B.scene}막 문제 정답 — 이번 막 내 주사위가 커지고 손님 주사위가 작아진다`:`${B.scene}막 문제 오답 — 해설 · ${guest.explanation}`);
  B.phase="assign";
  mbEmit("onAnswer",{correct,id:B.question.id,isKey:!!(mb.cur&&mb.cur.isKey),fromUnit:B.question.fromUnit});
  persist();
  return true;
}
/* 적 주사위 대상 다시 잇기: 원래 노린 대상으로 되돌린 뒤, 배치한 순서대로 "내 주사위가 더 빠르면 그 적 주사위를 나에게 끌어온다" */
function mbRelink(){
  for(const u of mbSide("enemy")){ const X=mb.x[u.id]; u.dice.forEach((d,k)=>{ const o=X.orig[k]; d.target=o?{unit:o.unit,die:o.die}:null; }); }
  const acts=[];
  for(const u of mbSide("ally")) u.dice.forEach((d,i)=>{ if(d.card&&d.target) acts.push({u,i,d,seq:mb.x[u.id].seq[i]||0}); });
  acts.sort((a,b)=>a.seq-b.seq);
  for(const a of acts){
    const t=a.d.target; if(t.die==null) continue;
    const tu=mbUnit(t.unit), td=tu&&tu.dice[t.die]; if(!td) continue;
    const already=td.target&&td.target.unit===a.u.id&&td.target.die===a.i;
    if(!already&&a.d.speed>td.speed) td.target={unit:a.u.id,die:a.i};
  }
  /* 몸을 노린 주사위(die:null)(2026-11-23 큐 양, 라오루 규칙): 그 적에게 합이 안 잡힌 주사위 중 나보다 느린 게 있으면
     일방 공격이 아니라 그 주사위를 끌어와 합이 된다(대상을 그 주사위로 바꿈). 나를 노리던 것 → 가장 빠른 것 순으로 고른다.
     합 안 잡힌 주사위가 없거나 모두 나보다 빠르면(또는 흐트러져 주사위가 없으면) 몸에 일방 공격 */
  for(const a of acts){
    const t=a.d.target; if(t.die!=null) continue;
    const tu=mbUnit(t.unit); if(!tu||tu.hp<=0) continue;
    const free=tu.dice.map((td,k)=>({td,k})).filter(({td,k})=>td.speed<a.d.speed&&!mbIsClash(tu.id,k));
    if(!free.length) continue;
    free.sort((x,y)=>((y.td.target&&y.td.target.unit===a.u.id)-(x.td.target&&x.td.target.unit===a.u.id))||y.td.speed-x.td.speed||x.k-y.k);
    const k=free[0].k; t.die=k; tu.dice[k].target={unit:a.u.id,die:a.i};
  }
}
function mbIsClash(uid,i){
  const u=mbUnit(uid), d=u&&u.dice[i]; if(!d||!d.target||d.target.die==null) return false;
  const tu=mbUnit(d.target.unit), td=tu&&tu.dice[d.target.die];
  return !!(td&&td.target&&td.target.unit===uid&&td.target.die===i);
}
function mbAssign(unitId,dieIdx,cardId,target){
  const B=mb&&mb.battle; if(!B||B.phase!=="assign") return {ok:false,reason:"phase"};
  const u=mbUnit(unitId); if(!u||u.side!=="ally"||u.hp<=0) return {ok:false,reason:"unit"};
  const d=u.dice[dieIdx]; if(!d) return {ok:false,reason:"die"};
  const X=mb.x[u.id], page=PAGE_BY[cardId]; if(!page) return {ok:false,reason:"card"};
  const prev=d.card;
  if(!X.handIds.includes(cardId)&&prev!==cardId) return {ok:false,reason:"not-in-hand"};
  const refund=prev?(PAGE_BY[prev].cost||0):0;
  if(pageEmotionReq(page)>(u.emotion||0)) return {ok:false,reason:"emotion"};   /* 감정 단계 부족이 먼저 (cardInfo.reason 과 같은 순서) */
  if((page.cost||0)>u.light+refund) return {ok:false,reason:"light"};
  /* target 없이(null) 놓으면 책장만 끼운다(대상은 나중에 mbTarget). 그런 주사위가 남아 있으면 mbReady() 가 false */
  const tu=target?mbUnit(target.unit):null;
  if(target&&(!tu||tu.side!=="enemy"||tu.hp<=0)) return {ok:false,reason:"target"};
  const tdie=!target||target.die==null?null:+target.die;
  if(tdie!=null&&!tu.dice[tdie]) return {ok:false,reason:"target-die"};
  if(prev){ X.handIds.push(prev); u.light+=refund; }
  removeOne(X.handIds,cardId); u.light-=(page.cost||0);
  const ctr=!!page.counter;   /* 반격 책장은 대상을 두지 않는다 */
  d.card=cardId; d.target=tu&&!ctr?{unit:tu.id,die:tdie}:null; X.seq[dieIdx]=tu&&!ctr?++mb.seq:0;
  mbRelink();
  const res={ok:true,clash:mbIsClash(u.id,dieIdx)};
  mbEmit("onAssign",{unit:u.id,die:dieIdx,card:cardId,target:d.target?{...d.target}:null,prev:prev||null,clash:res.clash});
  return res;
}
/* 책장은 그대로 두고 대상만 정하거나(target) 지운다(null). 책장이 없는 주사위는 안 됨 */
function mbTarget(unitId,dieIdx,target){
  const B=mb&&mb.battle; if(!B||B.phase!=="assign") return {ok:false,reason:"phase"};
  const u=mbUnit(unitId), d=u&&u.dice[dieIdx]; if(!d||u.side!=="ally"||u.hp<=0) return {ok:false,reason:"die"};
  if(!d.card) return {ok:false,reason:"card"};
  if(target&&PAGE_BY[d.card]&&PAGE_BY[d.card].counter) return {ok:false,reason:"counter"};   /* 반격 책장은 대상을 정하지 않는다 */
  if(!target){ d.target=null; mb.x[u.id].seq[dieIdx]=0; mbRelink(); mbEmit("onAssign",{unit:u.id,die:dieIdx,card:d.card,target:null,prev:d.card,clash:false}); return {ok:true,clash:false}; }
  const tu=mbUnit(target.unit); if(!tu||tu.side!=="enemy"||tu.hp<=0) return {ok:false,reason:"target"};
  const tdie=target.die==null?null:+target.die; if(tdie!=null&&!tu.dice[tdie]) return {ok:false,reason:"target-die"};
  d.target={unit:tu.id,die:tdie}; mb.x[u.id].seq[dieIdx]=++mb.seq; mbRelink();
  const res={ok:true,clash:mbIsClash(u.id,dieIdx)};
  mbEmit("onAssign",{unit:u.id,die:dieIdx,card:d.card,target:{...d.target},prev:d.card,clash:res.clash});
  return res;
}
/* 개막해도 되나: 책장을 끼운 내 주사위는 모두 대상이 있어야 한다 */
function mbUntargeted(){ const B=mb&&mb.battle; if(!B) return []; const out=[];
  for(const u of B.units) if(u.side==="ally"&&u.hp>0) u.dice.forEach((d,i)=>{ if(d.card&&!d.target&&!mbIsCounter(u,i)) out.push({unit:u.id,die:i}); }); return out; }
const mbReady=()=>mbUntargeted().length===0;
/* 이번 막 진행 순서 미리 보기(바닥 주사위 더미): mbResolveBegin 과 같은 정렬·합 짝으로
   [{a:{unit,die,side}, b:{unit,die,side}|null, target:유닛id}] (a 가 먼저 발동, 합이면 b 가 짝). 대상 없는 주사위는 빠진다 */
function mbPlan(){
  const B=mb&&mb.battle; if(!B) return [];
  const acts=[];
  for(const u of B.units){ if(u.hp<=0||mb.x[u.id].cu.stag>0) continue; u.dice.forEach((d,i)=>{ if(d.card&&d.target) acts.push({u,i,d}); }); }
  acts.sort((a,b)=>b.d.speed-a.d.speed||(a.u.side===b.u.side?0:a.u.side==="ally"?-1:1)||a.u.slot-b.u.slot||a.i-b.i);
  const done=new Set(), K=(id,i)=>id+":"+i, rows=[];
  for(const a of acts){ if(done.has(K(a.u.id,a.i))) continue; done.add(K(a.u.id,a.i));
    const t=a.d.target, tu=mbUnit(t.unit); let b=null;
    if(tu&&tu.hp>0&&t.die!=null&&!done.has(K(tu.id,t.die))&&mbIsClash(a.u.id,a.i)&&mb.x[tu.id].cu.stag===0){ b={unit:tu.id,die:t.die,side:tu.side}; done.add(K(tu.id,t.die)); }
    rows.push({a:{unit:a.u.id,die:a.i,side:a.u.side},b,target:t.unit}); }
  return rows;
}
function mbUnassign(unitId,dieIdx){
  const B=mb&&mb.battle; if(!B||B.phase!=="assign") return false;
  const u=mbUnit(unitId), d=u&&u.dice[dieIdx]; if(!d||!d.card||u.side!=="ally") return false;
  /* 배치 단계 동안은 언제든 되돌림: 카드는 손패로, 빛 환불 (합 진행 전까지 자동 진행 없음) */
  const X=mb.x[u.id], card=d.card, refund=PAGE_BY[card].cost||0; X.handIds.push(card); u.light+=refund;
  d.card=null; d.target=null; X.seq[dieIdx]=0; mbRelink();
  mbEmit("onUnassign",{unit:u.id,die:dieIdx,card,refund});
  return true;
}
/* 이번 막 문제 상태: answered 전이면 correct=null (범위는 base) */
function mbQState(){ const q=mb&&mb.battle&&mb.battle.question; return {answered:!!(q&&q.answered),correct:!!(q&&q.answered&&q.correct),isKey:!!(mb&&mb.cur&&mb.cur.isKey)}; }
/* 사서가 이 책장을 지금 쓸 수 있나 (1:1 과 같은 규칙: 빛 비용, 감정 단계). 이미 이 사서 주사위에 놓인 카드는 그 빛을 돌려받는 셈으로 본다 */
function mbUsable(u,P){
  if(!u||!P) return {usable:false,reason:"card"};
  if(u.hp<=0||(mb.x[u.id]&&mb.x[u.id].cu.stag>0)) return {usable:false,reason:"unit"};
  const placed=u.dice.some(d=>d.card===P.id);
  if(pageEmotionReq(P)>(u.emotion||0)) return {usable:false,reason:"emotion"};
  if(!placed&&(P.cost||0)>u.light) return {usable:false,reason:"light"};
  return {usable:true,reason:null};
}
/* 카드 정보. 사서 책장 id, 적 주사위 카드 id(e1@막.주사위), 또는 적 책장 이름+unitId.
   {id,name,cost,emotionReq,usable,reason,dice:[{type,min,max,baseMin,baseMax,rightMin,rightMax,wrongMin,wrongMax,ko}],text,side,...}
   min/max = 이번 막 실제 범위(문제 답 전이면 base). rightMin~Max·wrongMin~Max = 정답/오답일 때 범위(덱 편성 표시용). base = 카드 값 그대로
   사서 범위는 unitId 의 감정·dieMin 반영(없으면 0). 적 부하의 책장은 주사위 −1 이 이미 반영된 값. type 은 무대와 같은 영어, ko 는 한국어 */
function mbCardInfo(cid,uid){
  const qs=mb?mbQState():{answered:false,correct:false,isKey:false};
  const P=PAGE_BY[cid];
  if(P){
    const u=mb&&uid?mbUnit(uid):null, X=u&&mb.x[u.id], emo=u?(u.emotion||0):0, dm=X&&X.mods?(X.mods.dieMin||0):0;
    const dice=(P.dice||[]).map(d=>{ const r=playerDieRange(d,true,qs.isKey,emo,dm), w=playerDieRange(d,false,qs.isKey,emo,dm), cur=qs.answered?(qs.correct?r:w):[d.min,d.max];
      return {type:MB_TYPE_EN[d.type]||d.type,min:cur[0],max:cur[1],baseMin:d.min,baseMax:d.max,rightMin:r[0],rightMax:r[1],wrongMin:w[0],wrongMax:w[1],ko:d.type}; });
    const us=u?mbUsable(u,P):{usable:null,reason:null};
    return {id:P.id,name:P.name,cost:P.cost||0,emotionReq:pageEmotionReq(P),usable:us.usable,reason:us.reason,dice,text:P.text||"",side:"ally",emotion:pageEmotionReq(P),unit:u?u.id:null,counter:!!P.counter,gimmick:!!(P.fx||P.power||P.counter)};
  }
  if(!mb) return null;
  const edice=ds=>(ds||[]).map(d=>{ const r=guestDieRange(d,true,qs.isKey), w=guestDieRange(d,false,qs.isKey), cur=qs.answered?(qs.correct?r:w):[d.min,d.max];
    return {type:MB_TYPE_EN[d.type]||d.type,min:cur[0],max:cur[1],baseMin:d.min,baseMax:d.max,rightMin:r[0],rightMax:r[1],wrongMin:w[0],wrongMax:w[1],ko:d.type}; });
  const C=mb.cards[cid];
  if(C) return {id:cid,name:C.name,cost:0,emotionReq:0,usable:null,reason:null,dice:edice(C.dice),text:C.text||(C.big?"이 손님의 큰 일격":""),side:"enemy",big:!!C.big,unit:cid.split("@")[0]};
  const X=uid&&mb.x[uid];
  if(X&&X.S){ const pg=[...X.S.pages,...(X.S.big?[X.S.big]:[])].find(p=>p.name===cid);
    if(pg) return {id:cid,name:pg.name,cost:0,emotionReq:0,usable:null,reason:null,dice:edice(pg.dice),text:pg===X.S.big?"이 손님의 큰 일격":"",side:"enemy",big:pg===X.S.big,unit:uid}; }
  return null;
}
function mbDiceOf(u,i){ return u.side==="ally"?PAGE_BY[u.dice[i].card].dice:mb.x[u.id].diePages[i].dice; }
/* 막 풀기: 모든 주사위를 속도 순(빠른 것부터)으로. 서로 노린 두 주사위는 합(기존 resolveScene), 아니면 일방 공격.
   한 번에 하나씩: mbResolveBegin() → mbResolveNext(R) (교환 하나를 풀어 상태에 반영하고 그 이벤트를 돌려줌, 끝이면 null) → mbResolveEnd(R).
   mbResolve() 는 이것을 한 번에 다 도는 동기 경로(테스트·즉시 진행).
   교환 이벤트 ev (kind "clash"|"one-sided"):
     a:{unit,die,card,values:[굴린 값…]}  — 먼저 움직인(더 빠른) 주사위
     b:{unit,die,card,values,reused?}|null — 합 상대. 일방 공격이면 null (맞는 쪽은 ev.target)
     reused:true                          — 맞는 쪽이 이 막에 남겨 둔 회피 주사위(b)가 다시 맞선 교환 (kind "clash", steps 의 그쪽 주사위도 reused)
     target: 맞는 유닛 id (합이면 b.unit)
     steps:[{aVal,bVal,winner:"a"|"b"|"tie",dmg:{unit,hp,stagger}|null, …resolveScene 원래 필드(pd,gd,outcome,events,newStag)}]
     result:{staggered:[이번 교환에서 새로 흐트러진 id], dead:[이번 교환에서 쓰러진 id]}
     + 기존 필드 by,speed,ally,allyDie,enemy,enemyDie,allyCard,enemyCard,win("ally"|"enemy"|"tie"|null),snap  */
function mbResolveBegin(){
  const B=mb&&mb.battle; if(!B||B.phase!=="assign") return null;
  B.phase="resolve";
  const acts=[];
  for(const u of B.units){ if(u.hp<=0||mb.x[u.id].cu.stag>0) continue; u.dice.forEach((d,i)=>{ if(d.card&&!mbIsCounter(u,i)) acts.push({u,i,d}); }); }
  acts.sort((a,b)=>b.d.speed-a.d.speed||(a.u.side===b.u.side?0:a.u.side==="ally"?-1:1)||a.u.slot-b.u.slot||a.i-b.i);
  for(const u of B.units) mb.x[u.id].heldEvade=[];
  /* 반격 책장: 처음부터 "남은 회피" 자리에 둔다 → 이 사서를 일방 공격하는 교환에만 맞선다 */
  for(const u of mbLive("ally")){ if(mb.x[u.id].cu.stag>0) continue; u.dice.forEach((d,i)=>{ if(d.card&&mbIsCounter(u,i)) mb.x[u.id].heldEvade.push({die:i,idx:0,counter:true}); }); }
  return {acts,k:0,done:new Set(),events:[],ended:false};
}
function mbResolveNext(R){
  const B=mb.battle, K=(id,i)=>id+":"+i, done=R.done, events=R.events;
  const snap=()=>Object.fromEntries(B.units.map(u=>[u.id,{hp:u.hp,stagger:u.stagger,staggered:u.staggered}]));
  while(R.k<R.acts.length){
    if(mb.outcome){ R.k=R.acts.length; break; }
    const a=R.acts[R.k++];
    if(done.has(K(a.u.id,a.i))) continue;
    done.add(K(a.u.id,a.i));
    if(a.u.hp<=0||mb.x[a.u.id].cu.stag>0){ const sk={kind:"skip",by:{unit:a.u.id,die:a.i},speed:a.d.speed}; events.push(sk); return sk; }
    const t=a.d.target; let tu=t&&mbUnit(t.unit), partner=null;
    if(tu&&tu.hp>0&&t.die!=null&&tu.dice[t.die]&&!done.has(K(tu.id,t.die))&&mbIsClash(a.u.id,a.i)&&mb.x[tu.id].cu.stag===0) partner={u:tu,i:t.die};
    if(!tu||tu.hp<=0){ const pool=mbLive(a.u.side==="ally"?"enemy":"ally"); if(!pool.length) continue; tu=pool[Math.floor(mb.rng()*pool.length)]; partner=null; }
    if(partner) done.add(K(partner.u.id,partner.i));
    /* 회피 재사용 (2026-11-19): 합 상대가 없는 공격이면, 맞는 쪽이 이 막에 남겨 둔 회피 주사위가 다시 맞선다 */
    let held=null;
    if(!partner&&tu&&tu.hp>0&&mb.x[tu.id].cu.stag===0&&(mb.x[tu.id].heldEvade||[]).length){ held=mb.x[tu.id].heldEvade[0]; partner={u:tu,i:held.die}; }
    const before=Object.fromEntries(B.units.map(u=>[u.id,{alive:u.hp>0,stag:mb.x[u.id].cu.stag>0}]));
    const ally=a.u.side==="ally"?a.u:tu, enemy=a.u.side==="ally"?tu:a.u;
    const allyDie=a.u.side==="ally"?a.i:(partner?partner.i:null), enemyDie=a.u.side==="enemy"?a.i:(partner?partner.i:null);
    const pDice=allyDie!=null?mbDiceOf(ally,allyDie):null, gDice=enemyDie!=null?mbDiceOf(enemy,enemyDie):null;
    const AX=mb.x[ally.id], EX=mb.x[enemy.id];
    const qc=mbQState();
    const pPage=allyDie!=null?mbPageOf(ally,allyDie):null, gPage=enemyDie!=null?mbPageOf(enemy,enemyDie):null;
    /* 굴림 범위 + 기믹: 힘·허약(공격 주사위), 조건부 위력(power), 마비(이번 막 남은 수만큼 최솟값) */
    const wrap=(u,page,foe,base)=>d=>{ let [lo,hi]=base(d); const X=mb.x[u.id];
      if(isAttack(d.type)){ const k=mbSt(u,"str")-mbSt(u,"feeble"); if(k){ lo=Math.max(1,lo+k); hi=Math.max(lo,hi+k); } }
      if(page&&page.power&&mbPowerOn(page.power,u,foe)){ lo+=page.power.add||0; hi+=page.power.add||0; }
      if((X.paraLeft||0)>0){ X.paraLeft--; hi=lo; }
      return [lo,hi]; };
    /* 흐트러짐 배율은 1:1 과 같다: 정답이면 사서→적 흐트러짐 피해만 ×correctStagger(핵심 ×keyCorrectStagger), 적→사서 는 ×1 (resolveScene 기본값) */
    const steps=resolveScene({P:AX.cu,G:EX.cu,pDice,gDice,correct:qc.correct,isKey:qc.isKey,emotion:ally.emotion||0,rng:mb.rng,mods:AX.mods,
      pTaken:qc.correct?null:MB.WRONG,pHeld:held&&tu===ally?held.idx:null,gHeld:held&&tu===enemy?held.idx:null,
      pRangeFn:wrap(ally,pPage,enemy,d=>playerDieRange(d,qc.correct,qc.isKey,ally.emotion||0,AX.mods&&AX.mods.dieMin)),
      gRangeFn:wrap(enemy,gPage,ally,d=>guestDieRange(d,qc.correct,qc.isKey)),
      pFlat:mbSt(ally,"frag")-mbSt(ally,"prot"), gFlat:mbSt(enemy,"frag")-mbSt(enemy,"prot")});
    /* 기믹 발동: 출혈(굴린 공격 주사위 수만큼) → 책장 효과(fx). 결과는 res.fx=[{unit,kind:"bleed",hp}|{unit,kind:"give",status,n}|{unit,kind:"light",n}] */
    const fxOut=[];
    for(const [u,key] of [[ally,"pd"],[enemy,"gd"]]){ const n=steps.filter(st=>st[key]&&isAttack(st[key].type)).length, cu=mb.x[u.id].cu; let lost=0;
      for(let k=0;k<n&&cu.hp>0;k++){ const e=(u.status||[]).find(x=>x.id==="bleed"&&!x.pending); if(!e||e.stacks<=0) break;
        const b=e.stacks; cu.hp=Math.max(0,cu.hp-b); lost+=b; e.stacks-=Math.ceil(b/3); }
      u.status=(u.status||[]).filter(x=>x.stacks>0); if(lost) fxOut.push({unit:u.id,kind:"bleed",hp:lost}); }
    { const clashNow=!!(pDice&&gDice), wins=steps.filter(st=>st.outcome==="P").length, loss=steps.filter(st=>st.outcome==="G").length;
      const winSide=clashNow?(wins>loss?"ally":steps.some(st=>st.outcome!=="tie"&&st.outcome!=="none")?"enemy":"tie"):null;
      for(const [u,foe,page,key,tgt,side] of [[ally,enemy,pPage,"pd","G","ally"],[enemy,ally,gPage,"gd","P","enemy"]]){
        if(!page||!page.fx||u.hp<=0) continue;
        const used=steps.some(st=>st[key]), hit=steps.some(st=>st.events.some(e=>e.target===tgt&&e.kind==="hit"&&e.hp>0));
        for(const f of page.fx){
          const on=f.on==="use"?used:f.on==="hit"?hit:f.on==="win"?winSide===side:f.on==="lose"?(winSide&&winSide!==side&&winSide!=="tie"):false;
          if(!on) continue;
          if(f.give){ const who=f.to==="self"?u:foe, n=mbGive(who,f.give,f.n||1); if(n) fxOut.push({unit:who.id,kind:"give",status:f.give,n}); }
          if(f.light&&u.side==="ally"){ const b=u.light; u.light=Math.min(u.maxLight,u.light+f.light); if(u.light>b) fxOut.push({unit:u.id,kind:"light",n:u.light-b}); }
        } } }
    /* 남은 회피 갱신: 이번에 다시 쓴 회피는 지면 빠지고, 새로 남은 회피는 그 유닛 목록에 더한다 */
    for(const [u,die,h] of [[ally,allyDie,steps.heldP],[enemy,enemyDie,steps.heldG]]){ if(die==null) continue; const L=mb.x[u.id].heldEvade=mb.x[u.id].heldEvade||[];
      const at=L.findIndex(e=>e.die===die); if(h==null){ if(at>=0) L.splice(at,1); } else if(at<0) L.push({die,idx:h}); else L[at].idx=h; }
    mbPaceHold(enemy);
    mbSync(ally); mbSync(enemy);
    const clash=!!(pDice&&gDice);
    const res={kind:clash?"clash":"one-sided",by:{unit:a.u.id,die:a.i},speed:a.d.speed,ally:ally.id,allyDie,enemy:enemy.id,enemyDie,
      allyCard:allyDie!=null?ally.dice[allyDie].card:null,enemyCard:enemyDie!=null?enemy.dice[enemyDie].card:null,
      win:clash?(steps.filter(s=>s.outcome==="P").length>steps.filter(s=>s.outcome==="G").length?"ally":steps.some(s=>s.outcome!=="tie"&&s.outcome!=="none")?"enemy":"tie"):null,
      steps,snap:snap()};
    if(held) res.reused=true;   /* 남아 있던 회피가 다시 맞선 교환 (b 가 그 회피) */
    if(held&&held.counter) res.counter=true;   /* 반격 책장이 맞선 교환 */
    res.fx=fxOut;
    /* 카메라·연출용 a/b 모양 */
    const aAlly=a.u.side==="ally", aKey=aAlly?"pd":"gd", bKey=aAlly?"gd":"pd", sideOf=w=>w==="P"?(aAlly?"a":"b"):w==="G"?(aAlly?"b":"a"):"tie";
    const vals=k=>steps.map(s=>s[k]&&s[k].roll).filter(v=>v!=null);
    const look=u=>u.side==="enemy"?{side:"enemy",body:u.body,form:u.form,leader:!!u.leader}:{side:"ally"};
    res.a={unit:a.u.id,die:a.i,card:a.d.card,values:vals(aKey),...look(a.u)};
    res.b=clash?{unit:partner.u.id,die:partner.i,card:partner.u.dice[partner.i].card,values:vals(bKey),...look(partner.u),...(held?{reused:true}:{})}:null;
    res.target=tu.id;
    /* 흐트러진 적을 상대로 방어·회피만 남은 교환: 합도 피해도 없어 연출할 게 없다 → idle(화면은 연출 없이 넘김, 책장 효과는 위에서 이미 적용).
       2026-11-25 큐 양: 막 진행 중 이런 교환이 시간을 잡아먹지 않게 */
    res.idle=!clash&&!!before[tu.id]&&before[tu.id].stag&&steps.every(st=>!st.events.length&&!(st.pd&&isAttack(st.pd.type))&&!(st.gd&&isAttack(st.gd.type)));
    steps.forEach(s=>{ s.aVal=s[aKey]?s[aKey].roll:null; s.bVal=s[bKey]?s[bKey].roll:null; s.winner=sideOf(s.outcome);
      let dmg=null; for(const e of s.events){ if(e.kind!=="hit"&&e.kind!=="stag") continue; const uid=e.target==="P"?ally.id:enemy.id; dmg=dmg||{unit:uid,hp:0,stagger:0}; if(dmg.unit===uid){ dmg.hp+=e.hp||0; dmg.stagger+=e.st||0; } }
      s.dmg=dmg; });
    /* 합 연출용 단계 필드: aDie/bDie {type,min,max(이번에 적용된 범위),value,idx,reused}, aResult/bResult, blocked(방어로 줄어든 체력 피해, 배율 반영), recovered(회피 성공 시 회복한 흐트러짐) */
    { const mulP=1+((AX.mods&&AX.mods.dmgPct)||0), mulG=(!qc.correct&&MB.WRONG&&MB.WRONG.hp)||1;
      const tierHp=(cu,type)=>TIER[(cu.resist&&cu.resist.hp&&cu.resist.hp[type])||"보통"];
      const dmgOf=(k,type,v)=>{ const def=k==="pd"?EX.cu:AX.cu, rh=tierHp(def,type); return v>0&&rh>0?Math.max(1,Math.floor(v*rh*(k==="pd"?mulP:mulG))):0; };
      const dieOf=(s,k)=>{ const d=s[k]; if(!d) return null; const r=k==="pd"?s.pRange:s.gRange; return {type:d.type,min:r?r[0]:d.roll,max:r?r[1]:d.roll,value:d.roll,idx:k==="pd"?s.pIdx:s.gIdx,reused:!!d.reused,retry:!!s.retry}; };   /* retry: 비겨서 다시 굴린 줄 */
      steps.forEach(s=>{
        const res={pd:"none",gd:"none"}; let blocked=0, recovered=0;
        const pd=s.pd, gd=s.gd;
        if(pd&&gd){
          const pa=isAttack(pd.type), ga=isAttack(gd.type);
          if(s.outcome==="tie"){ res.pd=res.gd="draw"; }
          else if(s.outcome==="P"||s.outcome==="G"){
            const wk=s.outcome==="P"?"pd":"gd", lk=wk==="pd"?"gd":"pd", w=s[wk], l=s[lk];
            res[wk]=(!isAttack(w.type)&&isAttack(l.type))?(w.type==="방어"?"block":"evade"):"win"; res[lk]="lose"; }
          /* 방어 주사위가 공격을 상대: 이기거나 비기면 공격 값 전부, 지면 방어 값만큼 줄어든 체력 피해 */
          if(pa!==ga){ const ak=pa?"pd":"gd", dk=pa?"gd":"pd", A=s[ak], D=s[dk];
            if(D.type==="방어"){ blocked=A.roll>D.roll?dmgOf(ak,A.type,A.roll)-dmgOf(ak,A.type,A.roll-D.roll):dmgOf(ak,A.type,A.roll); }
            else if(D.type==="회피"&&res[dk]==="evade"){ for(const e of s.events) if(e.kind==="recover") recovered+=e.st||0; } }
        } else if(pd||gd){ const k=pd?"pd":"gd"; res[k]=(s.outcome==="P"||s.outcome==="G")?"win":"none"; res[k==="pd"?"gd":"pd"]=null; }
        s.aDie=dieOf(s,aKey); s.bDie=dieOf(s,bKey); s.aResult=res[aKey]; s.bResult=res[bKey]; s.blocked=blocked; s.recovered=recovered;
      }); }
    { const hit=new Set(), aSide=a.u.id, other=tu.id;
      steps.forEach(s=>{ const ex={}; ex[ally.id]="idle"; ex[enemy.id]="idle";
        if(s.outcome==="P") ex[ally.id]="win"; else if(s.outcome==="G") ex[enemy.id]="win";
        if(s.dmg){ ex[s.dmg.unit]="hurt"; hit.add(s.dmg.unit); }
        s.newStag.forEach(w=>{ ex[w==="P"?ally.id:enemy.id]="shock"; });
        s.expr=ex; });
      for(const u of [ally,enemy]){ if(u.staggered) u.expr="shock"; else if(hit.has(u.id)) u.expr="hurt";
        else u.expr=(clash&&((res.win==="ally"&&u===ally)||(res.win==="enemy"&&u===enemy)))||(!clash&&u.id===aSide&&steps.some(s=>s.dmg))?"win":"idle"; }
      res.a.expr=mbUnit(aSide).expr; if(res.b) res.b.expr=mbUnit(res.b.unit).expr;
      res.expr={[ally.id]:ally.expr,[enemy.id]:enemy.expr}; }
    res.result={staggered:B.units.filter(u=>!before[u.id].stag&&mb.x[u.id].cu.stag>0).map(u=>u.id),dead:B.units.filter(u=>before[u.id].alive&&u.hp<=0).map(u=>u.id)};
    steps.forEach(s=>s.newStag.forEach(w=>mb.log.push(`${(w==="P"?ally:enemy).name}이(가) 흐트러졌다!`)));
    events.push(res);
    if(clash) mbEmit("onClash",res);
    if(!mbLive("enemy").length) mb.outcome="win"; else if(!mbLive("ally").length) mb.outcome="lose";
    return res;
  }
  return null;
}
function mbResolveEnd(R){
  if(R.ended) return R.events; R.ended=true;
  const B=mb.battle, events=R.events;
  for(const u of B.units) mb.x[u.id].heldEvade=[];   /* 남은 회피는 그 막에서만 */
  for(const u of mbSide("ally")){ const X=mb.x[u.id]; u.dice.forEach(d=>{ if(d.card){ X.discardIds.push(d.card); if(d.card==="breathe") X.breathe++; } }); }
  for(const u of B.units) mbStatusEnd(u);
  mb.events=events;
  if(!mb.outcome) mbPaceDrain(); else mb.pace.last=null;
  mbEmit("onSceneEnd",{scene:B.scene,events,pace:mb.pace.last});
  if(mb.outcome){ B.phase="end"; mbFinish(); }
  return events;
}
function mbResolve(){
  const R=mbResolveBegin(); if(!R) return null;
  while(mbResolveNext(R));
  return mbResolveEnd(R);
}
function mbFinish(){
  const rec=reception, guest=mb.guest; if(!rec) return;
  if(mb.outcome==="win"){
    const firstClear=!save.conqueredIds.includes(guest.id);
    save.hp=effectiveMaxHp(save); /* 사서 레벨 제거: 경험치·레벨업 없음 */
    if(firstClear) save.receptionsWon++;
    const bookGain=firstClear?BOOK_RULES.firstClear:rollRecallBooks(); addBooks(save,guest.id,bookGain);
    if(firstClear) save.conqueredIds=[...save.conqueredIds,guest.id];
    rec.bookGain=bookGain; rec.levelUpMessage=""; rec.phase="win";
    mb.log.push(firstClear?`${guest.concept} 손님 무리가 책이 되었다.`:"재접대를 마쳤다.");
  } else { rec.phase="lose"; }
  persist();
}


/* 계시와 같은 날짜(서울 오전 6시에 바뀜) — MoonCore 가 없을 때만 직접 계산 */
function todaySeoul(){ if(typeof MoonCore!=="undefined") return MoonCore.today(); return new Date(Date.now()-6*3600e3).toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"}); }
function moonBonus(s, todayStr){
  const m=s&&s.moon;
  if(!m||typeof m!=="object"||m.used===true) return {ratio:0,active:false};
  if(m.date!==todayStr) return {ratio:0,active:false};
  const reveal=Number(m.reveal), replay=Number(m.replay);
  const a=Number.isFinite(reveal)?Math.max(0,reveal):0;
  const b=Number.isFinite(replay)?Math.max(0,replay):0;
  return {ratio:Math.min(30,a+0.5*b)/30, active:true};
}
function moonAdjustedRate(isRecall, moon){
  const R=EGO_GIFT_RULES;
  let rate=isRecall?R.dropRateRecall:R.dropRateFirstClear;
  if(moon&&moon.active) rate=Math.min(isRecall?R.moonRecallCap:R.moonFirstCap, rate+R.moonBonusMax*moon.ratio);
  return rate;
}
/* 기프트는 그 접대에 나선 사서에게만 떨어진다. 이미 가진 기프트는 능력이 쌓이지 않는다. */
function rollEgoGift(guest, isRecall, libId, moon){
  const L=libOf(save,libId), owned=new Set(L.gifts.owned);
  const pool=EGO_GIFTS.filter(g=>g.guestId===guest.id);
  if(!pool.length) return null;
  const applied=moon!==undefined?moon:moonBonus(save, todaySeoul());
  if(applied.active&&save.moon&&save.moon.used!==true){ save.moon.used=true; persist(); }
  L.pity[guest.id]=(L.pity[guest.id]||0)+1;
  const rate=moonAdjustedRate(!!isRecall, applied);
  const pity=EGO_GIFT_RULES.pityEvery && L.pity[guest.id]>=EGO_GIFT_RULES.pityEvery;
  if(!(Math.random()<rate || pity)) return null;
  const w=pool.map(g=>owned.has(g.id)?1:EGO_GIFT_RULES.newWeight), sum=w.reduce((a,b)=>a+b,0);
  let r=Math.random()*sum, item=pool[0]; for(let i=0;i<pool.length;i++){ if(r<w[i]){ item=pool[i]; break; } r-=w[i]; }
  L.pity[guest.id]=0;
  const dup=owned.has(item.id);
  if(dup){ const out={item,dup:true,libId:L.id,libName:L.name}; if(applied.active) out.moon=applied.ratio; return out; }
  L.gifts.owned=[...L.gifts.owned,item.id];
  if(!L.gifts.equipped[item.slot]) L.gifts.equipped[item.slot]=item.id;
  const out={item,dup:false,libId:L.id,libName:L.name};
  if(applied.active) out.moon=applied.ratio;
  return out;
}
function finishReceptionStats(guest, won){
  const st=ensureRecall(guest.id);
  const rec=reception;
  if(rec&&rec.isRecall){ st.recalls++; if(won) st.wins++; }
  else if(won){ st.wins++; }
  const tot=rec&&rec.sessionTotal||0, ok=rec&&rec.sessionCorrect||0;
  if(tot){ st.history=[...(st.history||[]), ok/tot].slice(-5); }
  save.recallStats={...save.recallStats, [guest.id]:st};
}
/* 다대다 접대가 끝나면(승·패) 전투 상태의 주사위 대상을 모두 비운다 → 마지막 렌더에 화살표가 남지 않게 (화면 쪽 숨김은 UI 담당이 openResult 에서) */
