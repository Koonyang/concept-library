/* ============================================================
 * RESERVE_FOR_EGO — 가챠(뽑기)·장서복(코디) 제거 시 보관한 원본 (게임에서 로드되지 않음)
 * 목적: 나중에 에고 기프트 외형(아이콘·미리보기)·연출에 재사용. 삭제하지 않고 이곳에 둔다.
 * 아래 항목은 index.html 에서 제거되었다. 필요하면 복사해서 쓰면 된다.
 * ============================================================ */

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

/* ---------- 장서복(핵심 책장) 데이터 KEY_PAGES ---------- */
/*RESERVE_BEGIN
const KEY_PAGES = [
  {id:"novice",name:"초보 사서의 장서복",text:"기본 착장. 특별한 효과는 없다.",perk:"none",coat:0},
  {id:"reading-room",name:"열람실의 장서복",text:"열람의 기율을 입는다. 접대 시작 빛 +1.",perk:"light",coat:1},
  {id:"midnight",name:"심야 사서",text:"밤을 허비하지 않는 자세. 감정 단계 1로 시작.",perk:"emotion",coat:2},
  {id:"archivist",name:"소장관의 망토",text:"서고를 지키는 자의 옷. 매 턴 빛 회복 +1.",perk:"recover",coat:3},
  {id:"classical-robe",name:"고전주의 재판관의 법복",text:"합리의 저울을 입는다. 최대 체력 +10.",perk:"hp10",coat:4},
  {id:"panopticon-coat",name:"파놉티콘 감시관의 외투",text:"모든 곳을 보는 눈. 흐트러짐 피해 +10%.",perk:"stagger10",coat:5}
];
RESERVE_END*/

/* ---------- 장신구 데이터 (SLOTS/THEMES/SLOT_NOUN/COSMETIC_ITEMS) ---------- */
/*RESERVE_BEGIN
const SLOTS = ["책갈피","장식","깃펜","동반자","서고","호칭"];
const RARITY_ORDER = ["N","R","SR","SSR"];
const THEMES = [
  ...["잉크","양피지","양초","먼지","창가","인덱스","제본","쪽수"].map(theme=>({theme,rarity:"N"})),
  ...["금박","심야","먹물","단풍","바다","서리"].map(theme=>({theme,rarity:"R"})),
  ...["달빛","벚꽃","석양","별빛"].map(theme=>({theme,rarity:"SR"})),
  ...["은하","황금"].map(theme=>({theme,rarity:"SSR"}))
];
const SLOT_NOUN = {
  N:{책갈피:"책갈피",장식:"단추",깃펜:"연필",동반자:"참새",서고:"열람실",호칭:"수강생"},
  R:{책갈피:"장식띠",장식:"견장",깃펜:"만년필",동반자:"고양이",서고:"창가 서고",호칭:"탐구가"},
  SR:{책갈피:"봉랍",장식:"장서복",깃펜:"장서 깃펜",동반자:"부엉이",서고:"옥상 서고",호칭:"정복자"},
  SSR:{책갈피:"금빛 책갈피",장식:"망토",깃펜:"성검필",동반자:"서고의 용",서고:"성역",호칭:"전설"}
};
const COSMETIC_ITEMS = [];
for (const slot of SLOTS) {
  THEMES.forEach((entry, index) => {
    const noun = SLOT_NOUN[entry.rarity][slot];
    const name = slot==="호칭" ? `「${entry.theme} ${noun}」` : `${entry.theme} ${noun}`;
    COSMETIC_ITEMS.push({ id:`${slot}-${entry.theme}`, name, slot, rarity:entry.rarity, seed:index + SLOTS.indexOf(slot)*20 });
  });
}
const COLLECTION_TOTAL = COSMETIC_ITEMS.length;
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

/* ---------- 뽑기권 계산 + keyPerk ---------- */
/*RESERVE_BEGIN
function ticketsGranted(q, wins){
  const lectures = Math.floor(q / TICKET_RULES.questionsPerLecture);
  const bonus = TICKET_RULES.bonusTicketEveryNLectures>0 ? Math.floor(lectures/TICKET_RULES.bonusTicketEveryNLectures) : 0;
  return lectures*TICKET_RULES.ticketsPerLecture + bonus + wins*TICKET_RULES.ticketsPerMonsterDefeat;
}
const ticketsHeld = s => Math.max(0, ticketsGranted(s.questionsAnswered,s.receptionsWon)-s.ticketsSpent);
function keyPerk(s){ return KEY_BY[s.equippedKeyId]||KEY_PAGES[0]; }
RESERVE_END*/

/* ---------- KEY_BY ---------- */
/*RESERVE_BEGIN
const KEY_BY = Object.fromEntries(KEY_PAGES.map(p=>[p.id,p]));
RESERVE_END*/

/* ---------- ITEM_BY ---------- */
/*RESERVE_BEGIN
const ITEM_BY = Object.fromEntries(COSMETIC_ITEMS.map(p=>[p.id,p]));
RESERVE_END*/

/* ---------- 장서복 능력치 withKeyMods/startLight/startEmotion/lightRegen ---------- */
/*RESERVE_BEGIN
function withKeyMods(t,s){
  const p=keyPerk(s).perk, o=Object.assign({},t);
  if(p==="hp10") o.hp=(o.hp||0)+10;
  if(p==="stagger10") o.staggerPct=Math.round(((o.staggerPct||0)+0.10)*1000)/1000;
  return o;
}
function effectiveMaxHp(s){ return s.maxHp+withKeyMods(giftTotals(s),s).hp; }
function startLight(s){ return Math.min(COMBAT.maxLightCap, COMBAT.baseLight+(keyPerk(s).perk==="light"?1:0)+giftTotals(s).startLight); }
function startEmotion(s){ return (keyPerk(s).perk==="emotion"?1:0)+giftTotals(s).startEmotion; }
function lightRegen(s){ return COMBAT.lightPerTurn+(keyPerk(s).perk==="recover"?1:0)+giftTotals(s).lightRegen; }
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

/* ---------- 장서복 외형 OUTFITS (전체 원본, 기본 외형 포함) ---------- */
/*RESERVE_BEGIN
const OUTFITS={
  novice:{coat:["#2a3144","#161b27","#0a0c12"],cape:["#2a3148","#0d1018"],trim:"#c4a35a",decor:()=>"",hat:()=>""},
  "reading-room":{coat:["#2b6a66","#14403f","#08201f"],cape:["#1d4a4a","#07191a"],trim:"#8fe0cc",
    decor:()=>`<path d="M104 172 L112 338 L128 338 L124 176 Z M176 172 L168 338 L152 338 L156 176 Z" fill="#8fe0cc" opacity=".28"/>
      <path d="M150 176 V252 L158 244 L166 252 V176 Z" fill="#e8c46a" stroke="#fff0b8" stroke-width=".6"/>
      <circle cx="112" cy="204" r="9" fill="#ffe9a8" opacity=".25"/><circle cx="112" cy="204" r="4.4" fill="#ffe9a8" stroke="#8f6b2a" stroke-width=".8"/>
      <path d="M100 292 H180" stroke="#8fe0cc" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>`,
    hat:()=>`<rect x="126" y="86" width="28" height="8" rx="2" fill="#e8d5b0" stroke="#8fe0cc" stroke-width=".8"/><path d="M131 90 H149" stroke="#8f6b2a" stroke-width="1"/>`},
  midnight:{coat:["#4a3a9a","#231a58","#0a0724"],cape:["#2e2470","#0a0828"],trim:"#c7b8ff",
    decor:u=>`<path d="M148 196 a17 17 0 1 0 0 34 a13 15 0 1 1 0 -34z" fill="#e3dcff" stroke="#c7b8ff" stroke-width=".8"/>
      <g fill="#fff6c8"><circle cx="112" cy="300" r="2"><animate attributeName="opacity" values="1;.3;1" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="168" cy="320" r="2.4"><animate attributeName="opacity" values="1;.3;1" dur="3s" repeatCount="indefinite"/></circle><circle cx="130" cy="332" r="1.6"/><circle cx="156" cy="282" r="1.6"/></g>
      <g fill="#c7b8ff" opacity=".8"><circle cx="70" cy="300" r="2"/><circle cx="214" cy="290" r="2"/><circle cx="84" cy="360" r="1.6"/><circle cx="200" cy="350" r="1.8"/></g>`,
    hat:()=>`<path d="M176 88 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3z" fill="#fff6c8" stroke="#c7b8ff" stroke-width=".6"/>`},
  archivist:{coat:["#8a2a3c","#4a1424","#1a0810"],cape:["#6a1a2a","#16070d"],trim:"#f3d27a",
    decor:()=>`<path d="M80 176 Q140 150 200 176 L204 196 Q140 172 76 196 Z" fill="#6a1a2a" stroke="#f3d27a" stroke-width="1.2"/>
      <ellipse cx="94" cy="176" rx="15" ry="7" fill="#f3d27a" stroke="#fff0b8" stroke-width=".7" transform="rotate(-16 94 176)"/>
      <ellipse cx="186" cy="176" rx="15" ry="7" fill="#f3d27a" stroke="#fff0b8" stroke-width=".7" transform="rotate(16 186 176)"/>
      <path d="M82 184 v14 M88 186 v14 M94 188 v14 M100 188 v12 M180 188 v12 M186 188 v14 M192 186 v14 M198 184 v14" stroke="#f3d27a" stroke-width="1.4"/>
      <path d="M104 206 Q140 236 176 206" fill="none" stroke="#f3d27a" stroke-width="1.6"/>
      <g transform="translate(140 258)"><circle r="8" fill="none" stroke="#f3d27a" stroke-width="2"/><path d="M0 8 V30 M0 20 H8 M0 28 H6" stroke="#f3d27a" stroke-width="2.4" stroke-linecap="round"/></g>`,
    hat:()=>`<path d="M172 90 Q198 62 192 30 Q180 56 168 80 Z" fill="#c43c52" stroke="#f3d27a" stroke-width=".8"/><circle cx="170" cy="92" r="3.4" fill="#f3d27a"/>`},
  "classical-robe":{coat:["#ddd5c0","#a79e84","#5a5440"],cape:["#6e6850","#26231a"],trim:"#e6c866",
    decor:()=>`<path d="M112 176 L140 232 L168 176 Z" fill="#f4efe2" stroke="#e6c866" stroke-width=".8"/>
      <path d="M128 182 l12 14 l12 -14" fill="none" stroke="#bdb49a" stroke-width="1.2"/>
      <g transform="translate(140 262)" stroke="#8f6b2a" stroke-width="1.6" fill="none"><path d="M-16 0H16M0 -8V16"/><path d="M-16 0l-6 12h12zM16 0l-6 12h12z" fill="#e6c866"/></g>
      <circle cx="140" cy="236" r="2.4" fill="#e6c866"/><circle cx="140" cy="300" r="2.4" fill="#e6c866"/>`,
    hat:()=>`<path d="M108 98 Q98 130 108 156 Q106 124 114 100 Z M172 98 Q182 130 172 156 Q174 124 166 100 Z" fill="#f4efe2" stroke="#bdb49a" stroke-width=".8"/>`},
  "panopticon-coat":{coat:["#7a5224","#43290e","#170d05"],cape:["#4a3216","#120b05"],trim:"#ffcf6a",
    decor:()=>`<path d="M96 176 L112 160 H168 L184 176 L176 198 H104 Z" fill="#2a1a08" stroke="#ffcf6a" stroke-width="1"/>
      <g transform="translate(140 246)"><path d="M-22 0 Q0 -18 22 0 Q0 18 -22 0Z" fill="#1a0f05" stroke="#ffcf6a" stroke-width="1.4"/><circle r="6" fill="#ffcf6a"/><circle r="2.4" fill="#1a0f05"/></g>
      <g stroke="#ffcf6a" stroke-width=".9" opacity=".6"><path d="M140 246 L96 300 M140 246 L184 300 M140 246 L140 310"/></g>`,
    hat:()=>`<circle cx="140" cy="76" r="8" fill="#ffe08a" stroke="#ffcf6a" stroke-width=".8"/><circle cx="140" cy="76" r="14" fill="#ffe08a" opacity=".18"/>`}
};
RESERVE_END*/

/* ---------- 장신구 글리프 glyphSvg ---------- */
/*RESERVE_BEGIN
function glyphSvg(item, muted=false, size=40){
  const col = muted?"#3a4150": item.rarity==="SSR"?"#e6d3a3":item.rarity==="SR"?"#c4a35a":item.rarity==="R"?"#8f6b2a":"#9aa3b2";
  const body = {
    "책갈피":`<path d="M16 6 H34 V38 L25 31 L16 38 Z" fill="${col}" stroke="#1a140c" stroke-width=".6"/>`,
    "장식":`<path d="M10 14 H38 L34 40 H14 Z M18 14 V8 H30 V14" fill="${col}"/><circle cx="24" cy="26" r="5" fill="#0b0e16"/>`,
    "깃펜":`<path d="M22 4 H26 L28 34 L24 46 L20 34 Z" fill="${col}"/><path d="M22 10 Q34 22 24 34" fill="none" stroke="#1a140c" stroke-width="1"/>`,
    "동반자":`<g fill="${col}"><ellipse cx="22" cy="30" rx="13" ry="8"/><circle cx="30" cy="22" r="7"/><path d="M36 22 L44 16" stroke="${col}" stroke-width="2"/></g>`,
    "서고":`<g fill="${col}"><rect x="8" y="20" width="8" height="20"/><rect x="18" y="12" width="8" height="28"/><rect x="28" y="16" width="8" height="24"/></g>`,
    "호칭":`<path d="M24 4 L28 16 H40 L30 24 L34 38 L24 30 L14 38 L18 24 L8 16 H20 Z" fill="${col}"/>`
  }[item.slot]||"";
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" style="opacity:${muted?.4:1}">${body}</svg>`;
}
RESERVE_END*/

/* ---------- librarianSvg 원본(장신구: 책갈피·장식·깃펜·동반자·호칭 + 장서복 선택) ---------- */
/*RESERVE_BEGIN
function librarianSvg(save, w=320, h=480, o={}){
  const key=(KEY_BY[o.keyId||save.equippedKeyId]||KEY_PAGES[0]);
  const u=o.uid||"lb", O=OUTFITS[key.id]||OUTFITS.novice;
  const title=ITEM_BY[save.equipped["호칭"]||""];
  const bird=ITEM_BY[save.equipped["동반자"]||""];
  const pen=ITEM_BY[save.equipped["깃펜"]||""];
  const mark=ITEM_BY[save.equipped["책갈피"]||""];
  const deco=ITEM_BY[save.equipped["장식"]||""];
  return `<svg viewBox="0 0 280 440" width="${w}" height="${h}" role="img" aria-label="사서 큐 양 · ${key.name}" data-outfit="${key.id}">
    <defs>
      <linearGradient id="lib-robe-${u}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3a445c"/><stop offset="45%" stop-color="#1a2130"/><stop offset="100%" stop-color="#0a0c12"/>
      </linearGradient>
      <linearGradient id="lib-coat-${u}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${O.coat[0]}"/><stop offset="50%" stop-color="${O.coat[1]}"/><stop offset="100%" stop-color="${O.coat[2]}"/>
      </linearGradient>
      <linearGradient id="lib-cape-${u}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${O.cape[0]}"/><stop offset="100%" stop-color="${O.cape[1]}"/>
      </linearGradient>
      <linearGradient id="lib-gold-${u}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f3e6c0"/><stop offset="50%" stop-color="#c4a35a"/><stop offset="100%" stop-color="#8f6b2a"/>
      </linearGradient>
      <linearGradient id="lib-lining-${u}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c4a35a"/><stop offset="100%" stop-color="#3a2a10"/>
      </linearGradient>
      <radialGradient id="lib-face-${u}" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#3a3644"/><stop offset="100%" stop-color="#16141c"/>
      </radialGradient>
    </defs>
    <ellipse cx="140" cy="424" rx="92" ry="12" fill="#000" opacity=".55"/>
    <path d="M78 178 Q42 270 62 408 Q140 430 218 408 Q236 270 202 178 Z" fill="url(#lib-cape-${u})" stroke="${O.trim}" stroke-width="1.1" opacity=".95"/>
    <path d="M86 200 Q70 300 84 400" fill="none" stroke="#8f6b2a" stroke-width="1" opacity=".35"/>
    <path d="M194 200 Q210 300 196 400" fill="none" stroke="#8f6b2a" stroke-width="1" opacity=".35"/>
    <path d="M118 348 L110 416 L132 418 L136 350 Z" fill="#121018" stroke="#8f6b2a" stroke-width=".9"/>
    <path d="M162 348 L170 416 L148 418 L144 350 Z" fill="#121018" stroke="#8f6b2a" stroke-width=".9"/>
    <path d="M108 408 L132 410 L134 418 L106 416 Z" fill="#1a140c" stroke="#c4a35a" stroke-width=".8"/>
    <path d="M172 408 L148 410 L146 418 L174 416 Z" fill="#1a140c" stroke="#c4a35a" stroke-width=".8"/>
    <path d="M94 168 Q140 146 186 168 L204 348 Q140 386 76 348 Z" fill="url(#lib-coat-${u})" stroke="${O.trim}" stroke-width="1.6"/>
    <path d="M76 348 Q140 386 204 348" fill="none" stroke="url(#lib-gold-${u})" stroke-width="2.4"/>
    <path d="M118 172 L140 312 L162 172" fill="url(#lib-lining-${u})" opacity=".55"/>
    <path d="M140 172 L140 348" stroke="#c4a35a" stroke-width=".5" opacity=".4"/>
    <path d="M104 246 H176" stroke="#8f6b2a" stroke-width="8" opacity=".95"/>
    <rect x="128" y="240" width="24" height="16" rx="2" fill="url(#lib-gold-${u})" stroke="#f3e6c0" stroke-width=".6"/>
    <circle cx="140" cy="198" r="2.6" fill="#e6d3a3"/><circle cx="140" cy="218" r="2.6" fill="#e6d3a3"/>
    ${O.decor(u)}
    ${mark?`<path d="M126 252 L140 300 L154 252 Z" fill="#e6d3a3" stroke="#8f6b2a" stroke-width=".6"/>`:""}
    ${deco?`<circle cx="140" cy="268" r="7" fill="none" stroke="#e6d3a3" stroke-width="1.4"/>`:""}
    <path d="M96 176 Q68 250 86 330" fill="none" stroke="#1a2130" stroke-width="16" stroke-linecap="round"/>
    <path d="M96 176 Q68 250 86 330" fill="none" stroke="#c4a35a" stroke-width="1.2" opacity=".7"/>
    <path d="M184 176 Q212 250 194 330" fill="none" stroke="#1a2130" stroke-width="16" stroke-linecap="round"/>
    <path d="M184 176 Q212 250 194 330" fill="none" stroke="#c4a35a" stroke-width="1.2" opacity=".7"/>
    <ellipse cx="84" cy="336" rx="9" ry="7" fill="#1c2230" stroke="#c4a35a" stroke-width=".9"/>
    <ellipse cx="196" cy="336" rx="9" ry="7" fill="#1c2230" stroke="#c4a35a" stroke-width=".9"/>
    ${pen?`<g transform="translate(200 248) rotate(16)"><rect x="0" y="0" width="5" height="62" rx="1.5" fill="url(#lib-gold-${u})"/><path d="M0 62 L2.5 78 L5 62 Z" fill="#e6d3a3"/><path d="M1 8 Q8 20 2 36" fill="none" stroke="#8f6b2a" stroke-width="1"/></g>`:
      `<g transform="translate(186 250)"><rect x="0" y="0" width="38" height="48" fill="#1a140c" stroke="#c4a35a" stroke-width="1.2"/>
       <rect x="0" y="0" width="7" height="48" fill="#8f6b2a"/>
       <path d="M12 12 H32 M12 20 H32 M12 28 H26" stroke="#e6d3a3" stroke-width="1.1"/></g>`}
    <path d="M108 166 Q140 192 172 166 Q176 148 140 142 Q104 148 108 166 Z" fill="#161b27" stroke="#e6d3a3" stroke-width="1.3"/>
    <rect x="128" y="128" width="24" height="22" rx="7" fill="#2a2432"/>
    <ellipse cx="140" cy="108" rx="30" ry="34" fill="url(#lib-face-${u})" stroke="#c4a35a" stroke-width="1.15"/>
    <path d="M112 96 Q140 128 168 96 Q168 118 140 132 Q112 118 112 96 Z" fill="#0e1016" opacity=".55"/>
    <path d="M104 98 Q140 62 176 98 L172 112 Q140 90 108 112 Z" fill="#121722" stroke="url(#lib-gold-${u})" stroke-width="1.4"/>
    <ellipse cx="140" cy="98" rx="40" ry="6" fill="#1a2130" stroke="#e6d3a3" stroke-width="1.15"/>
    <path d="M100 98 Q140 86 180 98" fill="none" stroke="#8f6b2a" stroke-width=".7" opacity=".7"/>
    ${O.hat(u)}
    <ellipse cx="127" cy="112" rx="3.4" ry="2.2" fill="#f3e6c0"><animate attributeName="opacity" values="1;.55;1" dur="2.8s" repeatCount="indefinite"/></ellipse>
    <ellipse cx="153" cy="112" rx="3.4" ry="2.2" fill="#f3e6c0"><animate attributeName="opacity" values="1;.55;1" dur="2.8s" begin="0.4s" repeatCount="indefinite"/></ellipse>
    <path d="M134 122 Q140 127 146 122" fill="none" stroke="#8f6b2a" stroke-width="1"/>
    <path d="M110 92 Q120 78 130 90" fill="none" stroke="#c4a35a" stroke-width="1" opacity=".5"/>
    ${bird?`<g transform="translate(52 348)">
      <ellipse cx="22" cy="14" rx="20" ry="10" fill="#1a140c" stroke="#c4a35a" stroke-width="1"/>
      <circle cx="34" cy="10" r="8" fill="#c4a35a"/>
      <circle cx="36" cy="8" r="1.6" fill="#1a140c"/>
      <path d="M40 10 L50 6" stroke="#e6d3a3" stroke-width="1.6"/>
      <path d="M6 16 Q0 8 10 4" fill="none" stroke="#8f6b2a" stroke-width="1.2"/>
    </g>`:""}
    ${giftSpriteLayers(save,o.freshGift)}
    <text x="140" y="28" text-anchor="middle" fill="#e6d3a3" font-size="13" letter-spacing="0.8" font-family="Pretendard Variable, Pretendard, Space Grotesk, sans-serif" font-weight="700">${title?title.name:"「초보 사서」"}</text>
  </svg>`;
RESERVE_END*/

/* ---------- 손님 시트 책장 수집 sheetCollHtml (미사용) ---------- */
/*RESERVE_BEGIN
function sheetCollHtml(g){
  const pool=poolEntries(save,g.id);
  const pages=pool.filter(e=>e.k==="page"), keys=pool.filter(e=>e.k==="key");
  const got=pages.filter(e=>e.count>0).length;
  const cell=e=>{ const pg=e.k==="page"?PAGE_BY[e.id]:null; const tag=e.k==="key"?"핵":(pg.rarity||"N"); return `<i class="cc-cell ${e.count>0?"on":""} ${e.k==="key"?"k":""}" title="${entryName(e)}">${tag}</i>`; };
  return `<div class="sheet-coll" aria-label="책장 수집 ${got}/${pages.length}${keys.length?`, 핵심 책장 ${keys.some(e=>e.count>0)?"보유":"미보유"}`:""}">
    <span class="sc-lab">책장 <b>${got}/${pages.length}</b></span>${keys.length?`<span class="sc-lab">핵심 <b class="${keys.some(e=>e.count>0)?"ok":""}">${keys.some(e=>e.count>0)?"✓":"—"}</b></span>`:""}
    <span class="sc-cells">${pool.map(cell).join("")}</span></div>`;
}
RESERVE_END*/

/* ---------- 장서 화면(뽑기·도감·코디) renderCollection/equipItem/pullGacha/paintReveal ---------- */
/*RESERVE_BEGIN
function renderCollection(){
  const held=ticketsHeld(save);
  const items=slotFilter==="전체"?COSMETIC_ITEMS:COSMETIC_ITEMS.filter(i=>i.slot===slotFilter);
  $("#scene-collection").innerHTML=`
    <div class="topbar">${hudStats()}</div>
    <div class="page-scroll">
    <h2 class="gold-title" style="font-size:22px">장서</h2>
    <p class="gmeta" style="margin:6px 0 10px">장신구는 외형 전용이며 전투 수치에 영향이 없습니다. 도감 ${save.ownedIds.length}/${COLLECTION_TOTAL} · 권 ${held}장 · SSR 천장 ${Math.max(0,GACHA_RULES.ssrPity-save.pullsSinceSsr)}회</p>
    <h3 class="gold-title sec-head" style="margin-top:4px">덱 편성</h3>
    <div class="deck-summary frame">${cornerHtml()}
      <div><div class="gold-title" style="font-size:15px">${activeDeck(save).name}</div>
      <div class="gmeta">${activeDeck(save).pageIds.length}/${DECK_MAX}장 ${isDeckReady(save)?"· 접대 가능":"· 최소 "+DECK_MIN+"장을 장착해야 합니다"} · 프리셋 ${save.decks.length}개</div></div>
      <button class="btn primary" id="btn-open-deck" type="button">덱 편성</button>
    </div>
    <div class="tabs">
      ${[["gacha","뽑기"],["album","도감"],["dress","코디"]].map(([id,lb])=>`<button class="btn ${collectTab===id?"primary":""}" data-ct="${id}">${lb}</button>`).join("")}
    </div>
    <div id="col-body"></div>
    </div>
    ${botNav("collection")}`;
  bindNav();
  { const od=$("#btn-open-deck"); if(od) od.onclick=()=>openDeckEditor({to:"collection"}); }
  $$("[data-ct]").forEach(b=>b.onclick=()=>{ collectTab=b.dataset.ct; renderCollection(); });
  const body=$("#col-body");
  if(collectTab==="gacha"){
    body.innerHTML=`
      <div class="gacha-stage frame" id="gstage">${cornerHtml()}
        <div class="pillar p-wide" id="pillar"></div>
        <div class="pillar p-mid" id="pillar2"></div>
        <div class="pillar p-core" id="pillar3"></div>
        <div class="flare" id="flare"></div>
        <div id="greveal"></div>
      </div>
      <div class="ticket-chip" id="ticket-chip" role="status" aria-label="뽑기권 ${held}장">${ico("ticket",14)} 뽑기권 <b>×${held}</b></div>
      <div style="display:flex;gap:8px;justify-content:center;margin:8px 0 14px">
        <button class="btn primary" id="pull1" ${held<1?"disabled":""}>1회 뽑기</button>
        <button class="btn" id="pull10" ${held<10?"disabled":""}>10회 뽑기</button>
      </div>
      <div class="gmeta" style="text-align:center">확률 N ${GACHA_RULES.rates.N}% · R ${GACHA_RULES.rates.R}% · SR ${GACHA_RULES.rates.SR}% · SSR ${GACHA_RULES.rates.SSR}% · 미보유 우선</div>`;
    $("#pull1").onclick=()=>pullGacha(1);
    $("#pull10").onclick=()=>pullGacha(10);
    if(reveals) paintReveal();
  } else if(collectTab==="album"){
    body.innerHTML=`<div class="tabs">${["전체",...SLOTS].map(s=>`<button class="btn ${slotFilter===s?"primary":""}" data-sf="${s}">${s}</button>`).join("")}</div>
      <div class="album">${items.map(it=>{
        const own=save.ownedIds.includes(it.id), eq=save.equipped[it.slot]===it.id;
        return `<div class="al-cell ${own?"own":""} ${eq?"eq":""}">
          ${glyphSvg(it,!own,42)}
          <div class="nm">${own?it.name:"????"}</div>
          <div class="gmeta">${it.rarity}${own?"":" · "+it.slot}</div>
          ${own?`<button class="btn" style="margin-top:6px;padding:4px 8px" data-eq="${it.id}">${eq?"해제":"착장"}</button>`:""}
        </div>`;
      }).join("")}</div>`;
    $$("[data-sf]").forEach(b=>b.onclick=()=>{ slotFilter=b.dataset.sf; renderCollection(); });
    $$("[data-eq]").forEach(b=>b.onclick=()=>equipItem(b.dataset.eq));
  } else {
    body.innerHTML=`<div class="dress-grid">
      <div class="frame" style="padding:18px 16px;text-align:center">${cornerHtml()}${librarianSvg(save,240,340)}
        <div class="pname">사서 큐 양</div><div class="gmeta">${keyPerk(save).name} · 장신구는 외형만 변경</div></div>
      <div>${SLOTS.map(slot=>{
        const eq=ITEM_BY[save.equipped[slot]||""];
        const owned=COSMETIC_ITEMS.filter(i=>i.slot===slot&&save.ownedIds.includes(i.id));
        return `<div class="frame" style="padding:16px 18px;margin-bottom:8px">${cornerHtml()}
          <div style="display:flex;justify-content:space-between"><b style="color:var(--gold2)">${slot}</b>
          ${eq?`<button class="btn" data-off="${slot}">해제</button>`:""}</div>
          <div class="gmeta">${eq?eq.name:"기본 모습"}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${owned.length?owned.map(i=>`<button data-eq="${i.id}" title="${i.name}">${glyphSvg(i,false,28)}</button>`).join(""):`<span class="gmeta">아직 모은 장서가 없습니다.</span>`}</div>
        </div>`;
      }).join("")}</div></div>`;
    $$("[data-eq]").forEach(b=>b.onclick=()=>equipItem(b.dataset.eq));
    $$("[data-off]").forEach(b=>b.onclick=()=>{ save.equipped[b.dataset.off]=null; persist(); renderCollection(); });
  }
}

function equipItem(id){
  const it=ITEM_BY[id]; if(!it) return;
  save.equipped[it.slot] = save.equipped[it.slot]===id ? null : id;
  persist(); SFX.click(); renderCollection();
}

function pullGacha(times){
  if(ticketsHeld(save)<times) return;
  SFX.click();
  const results=[];
  for(let i=0;i<times;i++){
    const rarity=rollRarity(save.pullsSinceSr,save.pullsSinceSsr);
    const item=pickGachaItem(rarity,save.ownedIds);
    const isNew=!save.ownedIds.includes(item.id);
    if(isNew) save.ownedIds=[...save.ownedIds,item.id];
    if(item.rarity==="SSR"){ save.pullsSinceSr=0; save.pullsSinceSsr=0; }
    else if(item.rarity==="SR"){ save.pullsSinceSr=0; save.pullsSinceSsr++; }
    else { save.pullsSinceSr++; save.pullsSinceSsr++; }
    save.ticketsSpent++;
    results.push({item,isNew,flavor:pick(REVEAL_TEXT[item.rarity])});
  }
  persist(); reveals=results; paintReveal();
}

function paintReveal(){
  const box=$("#greveal"); if(!box||!reveals) return;
  const best=reveals.reduce((a,b)=>RARITY_ORDER.indexOf(b.item.rarity)>RARITY_ORDER.indexOf(a.item.rarity)?b:a);
  const colors={N:"#9aa3b2",R:"#6ebd96",SR:"#7aa0c4",SSR:"#e6d3a3"};
  const col=colors[best.item.rarity];
  ["pillar","pillar2","pillar3"].forEach(id=>{
    const el=$("#"+id); if(!el) return;
    el.style.color=col; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
  });
  const fl=$("#flare"); if(fl){ fl.classList.remove("on"); void fl.offsetWidth; fl.classList.add("on"); }
  SFX.gacha(best.item.rarity);
  const {w,h}=FX.size();
  FX.burst(w/2,h*.58, best.item.rarity==="SSR"?110:best.item.rarity==="SR"?60:28, col);
  FX.burst(w/2,h*.58, 24, "#fff6c8");
  box.innerHTML=reveals.map((r,i)=>`
    <div class="gcard" id="gc${i}" style="display:${i===0?"block":"none"}">
      <div class="gface back"><div class="gold-title">개념의 서고</div><div class="gmeta" style="margin-top:8px">장서</div></div>
      <div class="gface front" style="box-shadow:0 0 28px ${colors[r.item.rarity]}">
        ${glyphSvg(r.item,false,64)}
        <div class="rar">${r.item.rarity}</div>
        <div class="gold-title" style="font-size:16px;margin-top:8px">${r.item.name}</div>
        <div class="gmeta">${r.item.slot} · ${r.isNew?"새로 등록":"중복"}</div>
        <div class="gmeta" style="margin-top:8px">${r.flavor}</div>
      </div>
    </div>`).join("") + (reveals.length>1?`<div class="gmeta" style="margin-top:10px" id="gidx">1 / ${reveals.length}</div><button class="btn" id="gnext" style="margin-top:8px">다음</button>`:"");
  let idx=0;
  const flip=()=>{ const c=$("#gc"+idx); if(c) setTimeout(()=>c.classList.add("flip"),80); };
  flip();
  const nxt=$("#gnext");
  if(nxt) nxt.onclick=()=>{
    $("#gc"+idx).style.display="none";
    idx=(idx+1)%reveals.length;
    $$(".gcard").forEach((c,i)=>c.style.display=i===idx?"block":"none");
    $("#gc"+idx).classList.remove("flip");
    if($("#gidx")) $("#gidx").textContent=`${idx+1} / ${reveals.length}`;
    SFX.gacha(reveals[idx].item.rarity); flip();
  };
}
RESERVE_END*/

/* ---------- 가챠 연출 CSS (gacha-stage / pillar / flare / gcard) ---------- */
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

/* ---------- 장서복 아이콘 KEY_ICON ---------- */
/*RESERVE_BEGIN
const KEY_ICON={
  novice:`<path d="M8 3 4 7v14h16V7l-4-4"/><path d="M8 3q4 5 8 0M12 8v13"/>`,
  "reading-room":`<path d="M3 5h7q2 0 2 2 0-2 2-2h7v14h-7q-2 0-2 2 0-2-2-2H3z"/><path d="M12 7v12"/>`,
  midnight:`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M18 3v4M16 5h4"/>`,
  archivist:`<path d="M3 18 5 7l5 5 2-7 2 7 5-5 2 11z"/><path d="M4 21h16"/>`,
  "classical-robe":`<path d="M12 4v16M6 20h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>`,
  "panopticon-coat":`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v4M12 17v4"/>`
};
RESERVE_END*/

/* ---------- 장서복 능력/외형 문구 KEY_PERK_TEXT / KEY_LOOK ---------- */
/*RESERVE_BEGIN
const KEY_PERK_TEXT={none:"특별한 효과 없음",light:"접대 시작 빛 +1",emotion:"감정 단계 1로 시작",recover:"매 턴 빛 회복 +1",hp10:"최대 체력 +10",stagger10:"흐트러짐 피해 +10%"};
const KEY_LOOK={novice:"기본 · 남색 외투","reading-room":"청록 외투 · 책갈피 띠 · 독서등",midnight:"남보라 외투 · 초승달 · 별무리 망토",archivist:"진홍 외투 · 금 견장 · 열쇠 문장 · 깃털 모자","classical-robe":"상아색 법복 · 흰 목장식 · 저울 문장 · 재판관 가발","panopticon-coat":"갈색 외투 · 높은 칼라 · 감시의 눈 문장 · 탐조등"};
RESERVE_END*/

/* ---------- 장서복 상세 패널 (dressDetailHtml outfit) ---------- */
/*RESERVE_BEGIN
  if(mode==="outfit"){
    const id=dressSel.outfit||save.equippedKeyId, k=KEY_BY[id]||KEY_PAGES[0];
    const un=save.unlockedKeyIds.includes(k.id), eq=save.equippedKeyId===k.id;
    return `<div class="dd-head"><div class="gold-title dd-name">${un?k.name:"????"}</div>
        <span class="pill">${eq?"착용 중":un?"보유":"잠김"}</span></div>
      <div class="dd-lines">
        <div><b>능력</b> ${KEY_PERK_TEXT[k.perk]||"—"}</div>
        <div><b>외형</b> ${KEY_LOOK[k.id]||""}</div>
        <div class="gmeta">${un?k.text:"아직 열리지 않은 장서복입니다."}</div>
        ${un?"":`<div class="src">획득처 · ${sourceLine("key",k.id)}</div>`}
      </div>
      <div class="dd-actions"><button class="btn ${eq?"":"primary"}" id="dd-equip" type="button" ${!un||eq?"disabled":""}>${eq?"착용 중":un?"이 장서복 착용":"미획득"}</button></div>`;
  }
RESERVE_END*/

/* ---------- 장서복 착용 equipKey ---------- */
/*RESERVE_BEGIN
function equipKey(id){
  const k=KEY_BY[id]; if(!k||!save.unlockedKeyIds.includes(id)||save.equippedKeyId===id) return;
  const old=oldPreviewHtml();
  save.equippedKeyId=id; dressSel.outfit=null; persist(); SFX.equip("outfit");
  dressFx={mode:"outfit",old,fresh:null};
  renderShelf();
}
RESERVE_END*/
