/* 개념의 서고 — 1:1 전투 엔진(순수 함수), 문제 채점, 핵심 문제 (화면 없음) */
/* ===== Library-of-Ruina-style combat engine (pure functions, no DOM) =====
   · HP + 흐트러짐 저항 gauge on BOTH sides; the gauge DEPLETES, 0 => staggered
   · 3 attack types 참격/관통/타격, per-type HP resist and stagger resist (tiers below)
   · clash = both roll real page dice; higher wins; tie = nothing; loser takes the winner's die
   · the quiz result is only a modifier on dice (correct: me +, guest -; wrong: me -)            */
const TIER={치명:2,취약:1.5,보통:1,견딤:.5,내성:.25,면역:0};
const TIER_ORDER=["치명","취약","보통","견딤","내성","면역"];
const ATK_TYPES=["참격","관통","타격"];
const isAttack=t=>ATK_TYPES.includes(t);
const FLAT_RESIST={hp:{참격:"보통",관통:"보통",타격:"보통"},st:{참격:"보통",관통:"보통",타격:"보통"}};
function mkUnit(hp,st,resist){ return {hp,hpMax:hp,st,stMax:st,stag:0,resist:resist||FLAT_RESIST}; }
/* stag: 0 normal · 2 staggered mid-scene (rest of this scene) · 1 staggered for the whole next scene; all resists = 치명 while >0 */
function resTier(u,kind,type){ return u.stag>0?"치명":((u.resist&&u.resist[kind]&&u.resist[kind][type])||"보통"); }
function hitUnit(u,type,value,m){
  m=m||{};
  const th=resTier(u,"hp",type), ts=resTier(u,"st",type), rh=TIER[th], rs=TIER[ts];
  const hp=value>0&&rh>0?Math.max(1,Math.floor(value*rh*(m.hp||1))):0;
  let st=value>0&&rs>0?Math.max(1,Math.floor(value*rs*(m.st||1))):0;
  if(u.stag>0) st=0;
  u.hp=Math.max(0,u.hp-hp);
  let newStag=false;
  if(u.stag===0&&st>0){ u.st=Math.max(0,u.st-st); if(u.st===0){ u.stag=2; newStag=true; } }
  return {kind:"hit",type,hp,st,tagHp:th,tagSt:ts,newStag};
}
function stagOnly(u,v,mul){
  if(v<=0||u.stag>0) return {kind:"stag",hp:0,st:0,newStag:false,tagHp:"보통",tagSt:"보통"};
  const st=Math.max(1,Math.floor(v*(mul||1))); u.st=Math.max(0,u.st-st);
  let newStag=false; if(u.st===0){ u.stag=2; newStag=true; }
  return {kind:"stag",hp:0,st,newStag,tagHp:"보통",tagSt:"보통"};
}
function recoverSt(u,v){ if(u.stag>0) return {kind:"recover",st:0}; const b=u.st; u.st=Math.min(u.stMax,u.st+v); return {kind:"recover",st:u.st-b}; }
const randInt=(rng,a,b)=>a+Math.floor(rng()*(b-a+1));
/* dice modifiers from the quiz */
/* 한 끝 값 v 를 비율 p 만큼 (p>0 늘림, p<0 줄임). 반올림, 변동 최소 1, 하한 1 */
function pctEnd(v,p){ if(!p) return v; let n=Math.round(v*(1+p)); if(n===v) n=v+(p>0?1:-1); return Math.max(1,n); }
function pctRange(d,p,add){ const lo=Math.max(1,pctEnd(d.min,p)+(add||0)), hi=Math.max(lo,pctEnd(d.max,p)); return [lo,hi]; }
/* 1:1·다대다·미리보기·cardInfo 가 모두 이 두 함수를 쓴다. dieMin 보정은 비율 뒤 하한(min)에만 더한다 (예전과 같음) */
function playerDieRange(d,correct,isKey,emotion,dieMin){
  const P=COMBAT.pct, p=correct?(isKey?P.keyRight:P.right)+P.emotionPer*(emotion||0):-(isKey?P.keyWrong:P.wrong);
  return pctRange(d,p,dieMin||0);
}
function guestDieRange(d,correct,isKey){
  const P=COMBAT.pct, p=correct?-P.guestRight:(isKey?P.guestKeyWrong:0);
  return pctRange(d,p,0);
}
function resolveScene(o){
  const P=o.P,G=o.G,pDice=o.pDice,gDice=o.gDice,correct=!!o.correct,isKey=!!o.isKey,rng=o.rng||Math.random,mods=o.mods||{};
  /* o.dmgScale: 상대(G)가 받는 피해·G 의 흐트러짐 회복에 곱하는 배율 (지금은 1:1·다대다 모두 안 씀=1. 2026-11-19 숨은 배율 없앰).
     o.pScale: 사서(P)가 받는 피해·P 의 회복 배율 (없으면 dmgScale 과 같음 — 1:1 은 둘 다 1, 다대다는 1).
     o.pTaken {hp,st}: 사서(P)가 받는 피해에만 더 곱하는 배율 (다대다 오답 막 벌점, 1:1 은 없음=1) */
  const sc=o.dmgScale||1, ps=o.pScale!=null?o.pScale:sc, pt=o.pTaken||{};
  const m={hp:(1+(mods.dmgPct||0))*sc, st:(1+(mods.staggerPct||0))*(o.stMul!=null?o.stMul:(correct?(isKey?COMBAT.keyCorrectStagger:COMBAT.correctStagger):1))*sc};
  const one={hp:ps*(pt.hp||1),st:ps*(pt.st||1)};
  const steps=[], pn=pDice?pDice.length:0, gn=gDice?gDice.length:0;
  /* 두 쪽의 주사위를 포인터로 맞붙인다. 회피 주사위가 합에서 이기면 소모되지 않고
     (매번 다시 굴려) 상대의 다음 주사위와 다시 맞붙는다 — 지거나 비기거나 상대 주사위가 떨어질 때까지. */
  let i=0, j=0, heldP=false, heldG=false, guard=0;
  while((i<pn||j<gn)&&guard++<64){
    if(P.hp<=0||G.hp<=0) break;
    const pd=(pDice&&i<pn&&P.stag===0)?pDice[i]:null, gd=(gDice&&j<gn&&G.stag===0)?gDice[j]:null;
    if(!pd&&!gd){ i++; j++; heldP=heldG=false; continue; }
    if(pd&&!gd&&heldP){ i++; heldP=false; continue; }   /* 남은 상대 주사위가 없으면 재사용 중이던 회피는 그냥 끝난다 */
    if(gd&&!pd&&heldG){ j++; heldG=false; continue; }
    let pr=0,gr=0,pRange=null,gRange=null;
    if(pd){ pRange=o.pRangeFn?o.pRangeFn(pd):playerDieRange(pd,correct,isKey,o.emotion,mods.dieMin); pr=randInt(rng,pRange[0],pRange[1]); }
    if(gd){ gRange=o.gRangeFn?o.gRangeFn(gd):guestDieRange(gd,correct,isKey); gr=randInt(rng,gRange[0],gRange[1]); }
    const st={pd:pd?{type:pd.type,roll:pr,reused:!!(pd&&heldP)}:null, gd:gd?{type:gd.type,roll:gr,reused:!!(gd&&heldG)}:null, outcome:"none", events:[], newStag:[]};
    const ev=(t,e)=>{ e.target=t; st.events.push(e); if(e.newStag) st.newStag.push(t); };
    if(pd&&gd){
      const pa=isAttack(pd.type), ga=isAttack(gd.type);
      const cmp=pr>gr?"P":pr<gr?"G":"tie";
      if(pa&&ga){
        if(cmp==="P"){ st.outcome="P"; ev("G",hitUnit(G,pd.type,pr,m)); }
        else if(cmp==="G"){ st.outcome="G"; ev("P",hitUnit(P,gd.type,gr,one)); } else st.outcome="tie";
      } else if(pa){
        if(gd.type==="방어"){
          if(cmp==="P"){ st.outcome="P"; ev("G",hitUnit(G,pd.type,pr-gr,m)); }
          else if(cmp==="G"){ st.outcome="G"; ev("P",stagOnly(P,gr-pr,one.st)); } else st.outcome="tie";
        } else {
          if(cmp==="G"){ st.outcome="G"; ev("G",recoverSt(G,Math.round(gr*sc))); }
          else if(cmp==="P"){ st.outcome="P"; ev("G",hitUnit(G,pd.type,pr,m)); } else st.outcome="tie";
        }
      } else if(ga){
        if(pd.type==="방어"){
          if(cmp==="P"){ st.outcome="P"; ev("G",stagOnly(G,pr-gr,m.st)); }
          else if(cmp==="G"){ st.outcome="G"; ev("P",hitUnit(P,gd.type,gr-pr,one)); } else st.outcome="tie";
        } else {
          if(cmp==="P"){ st.outcome="P"; ev("P",recoverSt(P,Math.round(pr*ps))); }
          else if(cmp==="G"){ st.outcome="G"; ev("P",hitUnit(P,gd.type,gr,one)); } else st.outcome="tie";
        }
      }
    } else if(pd){ if(isAttack(pd.type)){ st.outcome="P"; ev("G",hitUnit(G,pd.type,pr,m)); } }
    else if(gd){ if(isAttack(gd.type)){ st.outcome="G"; ev("P",hitUnit(P,gd.type,gr,one)); } }
    /* 회피 주사위 재사용: 공격 주사위를 상대로 이긴 회피는 남는다 */
    const keepP=!!(pd&&gd&&pd.type==="회피"&&isAttack(gd.type)&&st.outcome==="P");
    const keepG=!!(pd&&gd&&gd.type==="회피"&&isAttack(pd.type)&&st.outcome==="G");
    if(st.pd) st.pd.keeps=keepP; if(st.gd) st.gd.keeps=keepG;
    st.pRange=pRange; st.gRange=gRange; st.pIdx=pd?i:null; st.gIdx=gd?j:null;   /* 책장 안 몇 번째 주사위(0부터) — 읽기 전용, 결과에 영향 없음 */
    st.snap={pHp:P.hp,pSt:P.st,pStag:P.stag,gHp:G.hp,gSt:G.st,gStag:G.stag};
    steps.push(st);
    if(keepP) heldP=true; else { heldP=false; i++; }
    if(keepG) heldG=true; else { heldG=false; j++; }
    if(keepP&&keepG){ heldP=heldG=false; i++; j++; }
    /* 재사용 중인 쪽의 상대가 이미 한 칸 넘어갔다면 j/i는 위에서 증가했다 */
  }
  return steps;
}
/* ---- guest combat kits (derived from archetype + weakness, overridable per guest) ---- */
const ARCH_COMBAT={
  fixer:{atk:"참격",alt:"관통",names:["규칙적인 일격","쪼개기 연타","경계 태세"],bigName:"규율의 철퇴",
    resist:{hp:{참격:"보통",관통:"취약",타격:"견딤"},st:{참격:"견딤",관통:"보통",타격:"취약"}}},
  scholar:{atk:"관통",alt:"참격",names:["날 선 지적","형광펜 난사","방어적 해설"],bigName:"유창성의 착각",
    resist:{hp:{참격:"취약",관통:"견딤",타격:"보통"},st:{참격:"보통",관통:"내성",타격:"취약"}}},
  beast:{atk:"타격",alt:"참격",names:["앞발 내려치기","물어뜯기","웅크린 방어"],bigName:"광포한 돌진",
    resist:{hp:{참격:"보통",관통:"취약",타격:"견딤"},st:{참격:"취약",관통:"보통",타격:"내성"}}},
  puppet:{atk:"타격",alt:"참격",names:["줄 당기기","흔들리는 팔","굳은 자세"],bigName:"끊어진 줄의 난타",
    resist:{hp:{참격:"취약",관통:"보통",타격:"견딤"},st:{참격:"보통",관통:"견딤",타격:"치명"}}},
  knight:{atk:"참격",alt:"타격",names:["정직한 베기","방패 밀치기","방패 올리기"],bigName:"일격 필살",
    resist:{hp:{참격:"견딤",관통:"취약",타격:"보통"},st:{참격:"보통",관통:"보통",타격:"취약"}}},
  mage:{atk:"관통",alt:"참격",names:["마력의 화살","빛의 칼날","마나 장막"],bigName:"무한 사고의 소용돌이",
    resist:{hp:{참격:"견딤",관통:"내성",타격:"취약"},st:{참격:"취약",관통:"면역",타격:"치명"}}}
};
const GUEST_COMBAT={
  beccaria:{names:["판사의 재량","신분별 처벌","잔혹한 고문"],bigName:"고문대의 그림자",atk:"관통",alt:"참격"},
  "three-conditions":{names:["느려터진 재판","엄벌의 허상","단속 없는 과태료"],bigName:"일억 원의 허풍",atk:"참격",alt:"타격"},
  bentham:{names:["쾌락의 저울질","불균형한 계산","원형의 시선"],bigName:"감시탑의 외눈",atk:"관통",alt:"참격"},
  legality:{names:["법정의 망치","빈 조항 찌르기","재량의 칼날"],bigName:"선고의 철퇴",atk:"참격",alt:"타격"},
  deterrence:{names:["폭행의 일격","벌 없는 질주","더 큰 범죄로의 도약"],bigName:"확산의 포효",atk:"관통",alt:"참격"},
  limits:{names:["똑같다는 가정","흐려진 판단","전전두엽의 균열"],bigName:"1848년의 충격",atk:"참격",alt:"타격",big:{name:"1848년의 충격",dice:[{type:"참격",min:5,max:8},{type:"타격",min:2,max:4}]},pages:[{name:"똑같다는 가정",dice:[{type:"참격",min:2,max:4}]},{name:"흐려진 판단",dice:[{type:"타격",min:1,max:3},{type:"참격",min:2,max:4}]},{name:"전전두엽의 균열",dice:[{type:"방어",min:3,max:6},{type:"참격",min:2,max:4}]}]},
  pomodoro:{names:["알람 울리기","쪼개기 연타","휴식 거부"],bigName:"과집중의 늪",atk:"참격",alt:"관통",bigType:"타격"},
  "active-recall":{names:["다시 읽기의 유혹","형광펜 난사","익숙함의 착각"],bigName:"유창성의 착각",atk:"관통",alt:"참격"},
  "spaced-repetition":{names:["벼락치기 타작","줄 당기기","굳은 자세"],bigName:"몰아치기의 난타",atk:"타격",alt:"참격"},
  metacognition:{names:["흐릿한 확신","빗나간 점검","마나 장막"],bigName:"아는 척의 소용돌이",atk:"관통",alt:"참격"},
  "defamation-truth":{names:["허위의 소문","가벼운 전력 들추기","진실이라 우기기"],bigName:"입증 책임 떠넘기기",atk:"타격",alt:"참격"}
};
const GUEST_SCALE=[0,1,1.2,1.45];
function guestCombat(g){
  const w=g.weakness||1, A=ARCH_COMBAT[g.archetype]||ARCH_COMBAT.fixer;
  const o=Object.assign({},A,GUEST_COMBAT[g.id]||{},g.combat||{});
  const sc=GUEST_SCALE[w]||1;
  const S=d=>({type:d.type,min:Math.max(1,Math.round(d.min*sc)),max:Math.max(2,Math.round(d.max*sc))});
  const atk=o.atk, alt=o.alt||o.atk;
  const pages=(o.pages||[
    {name:o.names[0],dice:[{type:atk,min:2,max:5}]},
    {name:o.names[1],dice:[{type:alt,min:2,max:4},{type:atk,min:2,max:4}]},
    {name:o.names[2],dice:[{type:"방어",min:3,max:6},{type:atk,min:2,max:5}]}
  ]).map(p=>({name:p.name,dice:p.dice.map(S)}));
  const bigDice=o.big&&o.big.dice?o.big.dice:[{type:o.bigType||atk,min:7,max:11}].concat(w>=2?[{type:alt,min:3,max:6}]:[]);
  return {hp:COMBAT.guestHp[w], st:COMBAT.guestStagger[w], resist:o.resist||A.resist, pages,
    big:{name:(o.big&&o.big.name)||o.bigName,dice:bigDice.map(S)}, bigEvery:COMBAT.bigEvery[w]||3};
}
function planIntent(kit,rec){
  if(rec.g.stag>0) return null;
  const big=rec.turn%kit.bigEvery===0;
  const page=big?kit.big:kit.pages[(rec.normalIdx||0)%kit.pages.length];
  if(!big) rec.normalIdx=(rec.normalIdx||0)+1;
  return {name:page.name,dice:page.dice.map(d=>({...d})),big};
}
/* expected damage if the intent connects (after the target's resists) */
function expectedDamage(dice,u){
  const r={hpLo:0,hpHi:0,stLo:0,stHi:0};
  for(const d of dice){
    if(!isAttack(d.type)) continue;
    const rh=TIER[resTier(u,"hp",d.type)], rs=TIER[resTier(u,"st",d.type)];
    const f=(v,k)=>v>0&&k>0?Math.max(1,Math.floor(v*k)):0;
    r.hpLo+=f(d.min,rh); r.hpHi+=f(d.max,rh); r.stLo+=u.stag>0?0:f(d.min,rs); r.stHi+=u.stag>0?0:f(d.max,rs);
  }
  return r;
}
/* short-answer checking: whitespace / punctuation / case insensitive, synonym list */
function normAns(s){ return String(s==null?"":s).normalize("NFKC").toLowerCase().replace(/[\s\-_.,!?'"“”‘’·~()\[\]{}「」『』:;\/\\]/g,""); }
function checkShort(input,q){
  const n=normAns(input); if(!n) return false;
  const list=[q.answer].concat(q.accept||[]).map(normAns).filter(Boolean);
  return list.some(a=>{
    if(n===a) return true;
    if(a.length<2) return false;
    const i=n.indexOf(a); if(i<0||n.length>a.length*2+2) return false;
    if(/\d/.test(a[0])&&i>0&&/\d/.test(n[i-1])) return false;
    if(/\d/.test(a[a.length-1])&&/\d/.test(n[i+a.length]||"")) return false;
    return true;
  });
}
/*ENGINE-END*/

/* 핵심/고난도 문항 (예시 데이터) — 손님의 큰 공격 책장과 묶여 있다.
   type:"mc" 는 헷갈리는 보기의 4지선다, type:"short" 는 주관식(answer + accept 동의어, 띄어쓰기/대소문자 무시). */
const KEY_QUESTIONS={
  beccaria:[
    {id:"beccaria-k0",type:"mc",hard:true,prompt:"다음 중 베카리아의 입장과 가장 거리가 먼 것은?",
      options:["형벌의 목적은 예방이다","고문과 사형에 반대한다","형벌의 목적은 복수(응보)다","인간은 비용과 이익을 따져 행동한다"],correctIndex:2},
    {id:"beccaria-k1",type:"short",hard:true,prompt:"1764년 『범죄와 형벌』을 쓴 고전주의 학파의 학자 이름은?",
      answer:"베카리아",accept:["체사레 베카리아","체사레베카리아","베까리아","beccaria","cesare beccaria"]}
  ],
  "three-conditions":[
    {id:"three-conditions-k0",type:"mc",hard:true,prompt:"억제 효과를 높이려는 방안으로 베카리아의 주장에 가장 잘 맞는 것은?",
      options:["형량을 두 배로 올린다","적발과 처벌이 확실하고 신속하게 이뤄지게 한다","판사의 재량을 넓힌다","공개적으로 고문한다"],correctIndex:1},
    {id:"three-conditions-k1",type:"short",hard:true,prompt:"형벌이 범죄의 무게에 맞아야 한다는 조건을 무엇이라 하는가? (○○성)",
      answer:"비례성",accept:["비례","비례의 원칙","비례원칙","proportionality"]}
  ],
  bentham:[
    {id:"bentham-k0",type:"mc",hard:true,prompt:"벤담의 쾌락 계산에 따라 범죄를 막으려면?",
      options:["형벌의 고통이 범죄의 쾌락을 조금 넘게 한다","형벌의 고통을 범죄 쾌락의 몇 배로 키운다","형벌을 없앤다","범죄자를 신분별로 나눈다"],correctIndex:0},
    {id:"bentham-k1",type:"short",hard:true,prompt:"벤담이 구상한, 한 명의 감시자가 모든 수감자를 볼 수 있는 원형 감옥의 이름은?",
      answer:"파놉티콘",accept:["판옵티콘","팬옵티콘","panopticon"]}
  ],
  legality:[
    {id:"legality-k0",type:"mc",hard:true,prompt:"다음 중 죄형법정주의에 가장 잘 맞는 판단은?",
      options:["법에 정해지지 않은 행위는 판사가 나쁘게 보더라도 처벌할 수 없다","판사가 사건마다 상황을 보고 형벌을 정한다","범죄가 일어난 뒤에 만든 법으로 형벌을 정한다","신분이 높은 사람은 형을 줄여 준다"],correctIndex:0},
    {id:"legality-k1",type:"short",hard:true,prompt:"범죄와 형벌은 미리 법률로 정해져 있어야 한다는 원칙의 이름은?",
      answer:"죄형법정주의",accept:["죄형법정","죄형 법정주의"]}
  ],
  deterrence:[
    {id:"deterrence-k0",type:"mc",hard:true,prompt:"억제 연구가 일관되게 더 효과적이라고 본 방법은?",
      options:["잡힐 확률(확실성)을 높인다","형량을 높인다","재판을 늦춘다","판사의 재량을 넓힌다"],correctIndex:0},
    {id:"deterrence-k1",type:"short",hard:true,prompt:"폭행에서 살인으로 나아가지 않도록 범죄의 무게에 비례해 처벌한다는 원리는?",
      answer:"한계 억제",accept:["한계억제","marginal deterrence"]}
  ],
  limits:[
    {id:"limits-k0",type:"mc",hard:true,prompt:"형법 제10조의 내용을 바르게 짝지은 것은?",
      options:["심신상실은 벌하지 않고, 심신미약은 형을 감경할 수 있다","심신상실은 형을 감경하고, 심신미약은 벌하지 않는다","심신상실과 심신미약 모두 벌하지 않는다","심신상실과 심신미약 모두 감경할 수 없다"],correctIndex:0},
    {id:"limits-k1",type:"short",hard:true,prompt:"1848년 전전두엽 손상 사례로 언급된 인물의 이름은?",
      answer:"피니어스 게이지",accept:["피니어스게이지","게이지","phineas gage","gage","피니아스 게이지"]}
  ],
  pomodoro:[
    {id:"pomodoro-k0",type:"mc",hard:true,prompt:"포모도로 집중 세트 도중 급한 메시지가 왔다. 기법에 가장 충실한 행동은?",
      options:["세트를 끝낸 뒤 쉬는 시간에 확인한다","타이머를 멈추고 1분만 답한 뒤 이어서 센다","급하면 세트를 유지한 채 틈틈이 답한다","세트를 버리고 처음부터 다시 센다"],correctIndex:0},
    {id:"pomodoro-k1",type:"short",hard:true,prompt:"포모도로에서 집중 세트 하나가 끝날 때마다 갖는 짧은 휴식은 보통 몇 분? (숫자+분)",
      answer:"5분",accept:["5","오분","5min","5분간","5분정도"]}
  ],
  "active-recall":[
    {id:"active-recall-k0",type:"mc",hard:true,prompt:"다음 중 '능동적 회상'에 해당하지 않는 것은?",
      options:["백지에 아는 것을 써 보기","스스로 문제를 만들어 풀기","형광펜으로 핵심 문장을 표시하기","책을 덮고 핵심 개념을 설명해 보기"],correctIndex:2},
    {id:"active-recall-k1",type:"short",hard:true,prompt:"자료를 덮고 기억에서 꺼내 보는 연습으로 기억을 강화하는 학습법의 이름은?",
      answer:"능동적 회상",accept:["능동회상","능동적회상","인출연습","인출 연습","active recall","retrieval practice"]}
  ],
  "spaced-repetition":[
    {id:"spaced-repetition-k0",type:"mc",hard:true,prompt:"간격 반복에서 효과적인 복습 간격으로 가장 알맞은 것은?",
      options:["처음에는 짧게, 점점 길게 늘린다","매일 똑같은 간격으로 유지한다","점점 짧게 줄여 나간다","시험 전날에 몰아서 한다"],correctIndex:0},
    {id:"spaced-repetition-k1",type:"short",hard:true,prompt:"1일 후, 3일 후, 1주일 후처럼 시간을 두고 다시 복습하는 학습법의 이름은?",
      answer:"간격 반복",accept:["간격반복","분산학습","분산 학습","분산복습","spaced repetition","spacedrepetition"]}
  ],
  metacognition:[
    {id:"metacognition-k0",type:"mc",hard:true,prompt:"메타인지가 높은 학습자의 행동으로 가장 알맞은 것은?",
      options:["다 읽었으니 안다고 느끼고 넘어간다","모르는 부분을 스스로 점검해 계획을 고친다","맞힌 문제만 다시 풀어 본다","어려운 부분은 건너뛰고 쉬운 곳만 반복한다"],correctIndex:1},
    {id:"metacognition-k1",type:"short",hard:true,prompt:"자신이 무엇을 알고 모르는지 스스로 점검하고 조절하는 사고를 한 단어로 하면?",
      answer:"메타인지",accept:["메타 인지","상위인지","metacognition","메타인지능력"]}
  ],
  "defamation-truth":[
    {id:"defamation-truth-k0",type:"mc",hard:true,prompt:"형법 제310조의 진실성·공익성 입증에 관한 설명으로 옳은 것은?",
      options:["검사가 엄격한 증명으로 입증해야 한다","피고인이 입증해야 하고, 자유로운 증명으로 족하다","피고인이 입증해야 하고, 엄격한 증명이 필요하다","검사가 입증하되, 자유로운 증명으로 족하다"],correctIndex:1},
    {id:"defamation-truth-k1",type:"short",hard:true,prompt:"형법 제310조가 상관 명예훼손(제64조 제3항)에 유추적용되는 법률의 이름은?",
      answer:"군형법",accept:["군 형법","군형법 제64조 제3항","군형법64조3항","군형법 제64조"]}
  ]
};
function keyQsOf(g){
  const list=g.keyQuestions||KEY_QUESTIONS[g.id];
  if(list&&list.length) return list;
  const q=(g.questions||[]).filter(x=>x.type==="mc").slice(-1)[0]||g.questions[0];
  return [{...q,hard:true}];
}




/* ---------- Web Audio ---------- */

const BOOK_COVER_N=8; /* book-9 watermark could not be removed cleanly */
function bookCoverHash(id){
  const s=String(id||"");
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0)%BOOK_COVER_N;
}
function bookCoverIndex(guest){
  const g=(guest&&typeof guest==="object")?guest:{id:guest};
  const n=Number(g.book);
  if(Number.isInteger(n)&&n>=1&&n<=BOOK_COVER_N) return n;
  return bookCoverHash(g.id||"")+1;
}
function bookCoverSrc(guest){
  return "assets/books/book-"+bookCoverIndex(guest)+".webp";
}
