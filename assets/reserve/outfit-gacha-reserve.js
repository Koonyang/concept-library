/* RESERVE — 뽑기(가챠) 전용 코드 보관. 게임에서 로드되지 않음. (장서복·핵심 책장은 게임에 그대로 있다.) */

/* ---------- 뽑기 규칙 (TICKET_RULES / GACHA_RULES) ---------- */
/*RESERVE_BEGIN
const TICKET_RULES = {
  questionsPerLecture: 4,
  ticketsPerLecture: 1,
  bonusTicketEveryNLectures: 5,
  ticketsPerMonsterDefeat: 0
};

const GACHA_RULES = {
  rates:{ N:55, R:30, SR:12, SSR:3 },
  srPity:10, ssrPity:25, preferUnowned:true
};
RESERVE_END*/

/* ---------- 뽑기 공개 문구 REVEAL_TEXT ---------- */
/*RESERVE_BEGIN
const REVEAL_TEXT = {
  N:["서가 사이에서 책갈피 하나가 빠졌다.","검소하지만, 매일 손에 담을 만한 장서다."],
  R:["금박이 약간 반짝인다.","이 정도면 열람실에서도 눈이 머무른다."],
  SR:["서고 창으로 달빛이 들었다. 희귀한 장서다!","장서의 봉랍이 딱 식는다."],
  SSR:["서고 전체가 잠시 숨을 죽였다. 전설이다!","SSR! 이 책갈피는, 오늘의 접대를 기록할 만하다."]
};
RESERVE_END*/

/* ---------- 뽑기권 계산 ticketsGranted/ticketsHeld ---------- */
/*RESERVE_BEGIN
function ticketsGranted(q, wins){
  const lectures = Math.floor(q / TICKET_RULES.questionsPerLecture);
  const bonus = TICKET_RULES.bonusTicketEveryNLectures>0 ? Math.floor(lectures/TICKET_RULES.bonusTicketEveryNLectures) : 0;
  return lectures*TICKET_RULES.ticketsPerLecture + bonus + wins*TICKET_RULES.ticketsPerMonsterDefeat;
}
const ticketsHeld = s => Math.max(0, ticketsGranted(s.questionsAnswered,s.receptionsWon)-s.ticketsSpent);
RESERVE_END*/

/* ---------- 뽑기 확률 rollRarity ---------- */
/*RESERVE_BEGIN
function rollRarity(pitySr,pitySsr){
  if(pitySsr+1>=GACHA_RULES.ssrPity) return "SSR";
  if(pitySr+1>=GACHA_RULES.srPity) return Math.random()<0.2?"SSR":"SR";
  const roll=Math.random()*100;
  const n=GACHA_RULES.rates.N, r=n+GACHA_RULES.rates.R, sr=r+GACHA_RULES.rates.SR;
  return roll<n?"N":roll<r?"R":roll<sr?"SR":"SSR";
}
RESERVE_END*/

/* ---------- 뽑기 pickGachaItem ---------- */
/*RESERVE_BEGIN
function pickGachaItem(rarity, ownedIds){
  const owned=new Set(ownedIds);
  const unowned=COSMETIC_ITEMS.filter(i=>!owned.has(i.id));
  const of=(rar,only)=>COSMETIC_ITEMS.filter(i=>i.rarity===rar&&(!only||!owned.has(i.id)));
  if(!GACHA_RULES.preferUnowned||!unowned.length){ const p=of(rarity,false); return pick(p.length?p:COSMETIC_ITEMS); }
  let pool=of(rarity,true);
  if(!pool.length){
    const start=RARITY_ORDER.indexOf(rarity);
    for(let i=start+1;i<RARITY_ORDER.length;i++){ pool=of(RARITY_ORDER[i],true); if(pool.length) break; }
    if(!pool.length) for(let i=start-1;i>=0;i--){ pool=of(RARITY_ORDER[i],true); if(pool.length) break; }
    if(!pool.length) pool=unowned;
  }
  return pick(pool);
}
RESERVE_END*/

/* ---------- 뽑기 효과음 SFX.gacha ---------- */
/*RESERVE_BEGIN
    gacha(r){
      noise(.15,.05,900);
      if(r==="SSR"){ [261,329,392,523,784].forEach((f,i)=>setTimeout(()=>tone(f,"sine",.4,.07),i*90)); }
      else if(r==="SR"){ [329,415,523].forEach((f,i)=>setTimeout(()=>tone(f,"triangle",.28,.06),i*100)); }
      else tone(330,"sine",.2,.05);
    },
RESERVE_END*/

/* ---------- 가챠 연출 CSS ---------- */
/*RESERVE_BEGIN
/* gacha stage *\/
.gacha-stage{position:relative;min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  overflow:hidden;background:radial-gradient(ellipse at 50% 80%,rgba(236,186,104,.16),transparent 55%),#07080d}
.pillar{position:absolute;bottom:0;left:50%;width:90px;height:0;transform:translateX(-50%);
  background:linear-gradient(180deg,transparent 0%,currentColor 55%,#fff6c8 100%);opacity:0;filter:blur(10px);pointer-events:none}
.pillar.p-wide{width:220px;filter:blur(22px);opacity:0}
.pillar.p-mid{width:70px;filter:blur(8px)}
.pillar.p-core{width:14px;filter:blur(2px);background:linear-gradient(180deg,transparent,#fff)}
.pillar.on{height:100%;opacity:.7;animation:pillar .85s ease forwards}
.flare{position:absolute;left:50%;bottom:8%;width:20px;height:20px;border-radius:50%;transform:translate(-50%,0) scale(0);
  background:radial-gradient(circle,#fff,#e6d3a3 40%,transparent 70%);pointer-events:none;opacity:0}
.flare.on{animation:flare .9s ease forwards}
@keyframes flare{0%{transform:translate(-50%,0) scale(.2);opacity:0}30%{opacity:1;transform:translate(-50%,-20px) scale(6)}100%{opacity:0;transform:translate(-50%,-40px) scale(10)}}
.gcard{width:210px;height:300px;transform-style:preserve-3d;transition:transform 1s cubic-bezier(.2,.8,.2,1);z-index:2}
.gcard.flip{transform:rotateY(180deg)}
.gface{position:absolute;inset:0;backface-visibility:hidden;border:1px solid var(--gold);
  display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;
  background:linear-gradient(180deg,#1a140c,#0b0e16)}
.gface.back{background:
  repeating-linear-gradient(45deg,rgba(236,186,104,.08) 0 8px,transparent 8px 16px),
  radial-gradient(circle at 50% 40%,#2a2214,#0b0e16)}
.gface.front{transform:rotateY(180deg);text-align:center}
.gface .rar{letter-spacing:.048em;color:var(--gold);margin-top:8px}
RESERVE_END*/

/* ---------- 가챠 CSS 잔여 ---------- */
/*RESERVE_BEGIN
.gacha-stage{border-radius:var(--r-lg);background:radial-gradient(ellipse at 50% 85%,rgba(var(--accent-rgb),.18),transparent 58%),radial-gradient(ellipse at 20% 0%,rgba(142,139,255,.16),transparent 55%),#080a12}
RESERVE_END*/

/* ---------- 가챠 CSS 잔여 ---------- */
/*RESERVE_BEGIN
.gface{border:1px solid rgba(var(--accent-rgb),.6);border-radius:16px}
RESERVE_END*/

/* ---------- 가챠 CSS 잔여 ---------- */
/*RESERVE_BEGIN
.gface .rar{font-family:var(--display);font-weight:700;letter-spacing:.2em}
RESERVE_END*/

/* ---------- 가챠 CSS 잔여 ---------- */
/*RESERVE_BEGIN
.ticket-chip{display:flex;align-items:center;justify-content:center;gap:6px;margin:12px auto 0;width:max-content;padding:5px 14px;border-radius:999px;background:rgba(8,10,18,.55);border:1px solid rgba(var(--accent-rgb),.4);color:var(--gold2);font-size:12px}
RESERVE_END*/

/* ---------- 가챠 CSS 잔여 ---------- */
/*RESERVE_BEGIN
.ticket-chip b{font-family:var(--display);font-size:15px;color:var(--parch)}
RESERVE_END*/

/* ---------- 가챠 CSS 잔여 ---------- */
/*RESERVE_BEGIN
#greveal{display:flex;flex-direction:column;align-items:center;text-align:center}
RESERVE_END*/

/* ---------- 가챠 CSS 잔여 ---------- */
/*RESERVE_BEGIN
  .gacha-stage{min-height:min(380px,52vh)}
RESERVE_END*/

/* ---------- 디버그 훅 demoGacha/forceTickets ---------- */
/*RESERVE_BEGIN
    setTab(tab){ collectTab=tab; if(scene==="collection") renderCollection(); },
    demoGacha(rarity){
      collectTab="gacha";
      const item=COSMETIC_ITEMS.find(i=>i.rarity===rarity)||COSMETIC_ITEMS[0];
      reveals=[{item,isNew:true,flavor:(REVEAL_TEXT[item.rarity]&&REVEAL_TEXT[item.rarity][0])||""}];
      showScene("collection"); renderCollection(); paintReveal();
    },
    forceTickets(n){ save.questionsAnswered = n * TICKET_RULES.questionsPerLecture; persist(); },
RESERVE_END*/
