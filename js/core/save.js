/* 개념의 서고 — 저장·책 소각·덱 (화면 없음) */
function ownedCount(s,id){
  const p=PAGE_BY[id]; if(!p) return 0;
  if(p.starter) return DECK_MAX_COPIES;
  return Math.min(DECK_MAX_COPIES,Math.max((s.pageCounts||{})[id]||0,(s.unlockedPageIds||[]).includes(id)?1:0));
}
function deckLimit(s,id){ return Math.min(DECK_MAX_COPIES,ownedCount(s,id)); }
function bookCount(s,gid){ return Math.max(0,(s.bookCounts||{})[gid]||0); }
/* 책장을 전부 모은 손님의 책은 소각해도 새로 얻을 것이 없으므로 보유 수·목록에서 제외한다 */
function bookMaxed(s,gid){ const l=BOOK_POOLS[gid]; return !!l&&l.every(e=>{ const o=entryOwned(s,e); return o.count>=o.cap; }); }
function shownBookCount(s,gid){ return bookMaxed(s,gid)?0:bookCount(s,gid); }
function totalBooks(s){ return Object.keys(s.bookCounts||{}).reduce((a,g)=>a+shownBookCount(s,g),0); }
function addBooks(s,gid,n){ if(n>0) s.bookCounts={...(s.bookCounts||{}),[gid]:bookCount(s,gid)+n}; return n; }
function rollRecallBooks(rng){ return (rng||Math.random)()<BOOK_RULES.recallOne?1:2; }
function entryName(e){ return e.k==="page"?(PAGE_BY[e.id]||{}).name:(KEY_BY[e.id]||{}).name; }
function entryOwned(s,e){
  return e.k==="page"?{count:ownedCount(s,e.id),cap:DECK_MAX_COPIES}:{count:(s.unlockedKeyIds||[]).includes(e.id)?1:0,cap:1};
}
/* 가중치: 미보유 ×3 (연속으로 새 책장을 못 얻을수록 추가 가산), 보유 1장이면 ×0.5, 상한이면 제외.
   pityGuarantee번 연속 중복이면 미보유 책장만 나온다. */
function poolEntries(s,gid){
  const pity=((s.bookPity||{})[gid])||0;
  const list=(BOOK_POOLS[gid]||[]).map(e=>{
    const o=entryOwned(s,e); let w=0;
    if(o.count<o.cap) w=e.w*(o.count===0?BOOK_RULES.newMul*(1+pity*.8):BOOK_RULES.dupMul);
    return {...e,count:o.count,cap:o.cap,w};
  });
  if(pity>=BOOK_RULES.pityGuarantee && list.some(e=>e.count===0)) list.forEach(e=>{ if(e.count>0) e.w=0; });
  const sum=list.reduce((a,e)=>a+e.w,0);
  list.forEach(e=>{ e.rate=sum?e.w/sum:0; });
  return list;
}
function grantEntry(s,e){
  if(e.k==="page"){
    s.pageCounts={...(s.pageCounts||{}),[e.id]:Math.min(DECK_MAX_COPIES,ownedCount(s,e.id)+1)};
    if(!s.unlockedPageIds.includes(e.id)) s.unlockedPageIds=[...s.unlockedPageIds,e.id];
  } else if(!s.unlockedKeyIds.includes(e.id)) s.unlockedKeyIds=[...s.unlockedKeyIds,e.id];
}
function burnBookOnce(s,gid,rng){
  if(bookCount(s,gid)<1) return {ok:false,why:"책이 없다"};
  const list=poolEntries(s,gid);
  if(!list.some(e=>e.w>0)) return {ok:false,why:"이 책의 책장을 모두 모았다"};
  let r=(rng||Math.random)()*list.reduce((a,e)=>a+e.w,0), pick=list.find(e=>e.w>0);
  for(const e of list){ if(e.w<=0) continue; if(r<e.w){ pick=e; break; } r-=e.w; }
  const isNew=pick.count===0;
  grantEntry(s,pick);
  s.bookCounts={...s.bookCounts,[gid]:bookCount(s,gid)-1};
  s.bookPity={...(s.bookPity||{}),[gid]:isNew?0:(((s.bookPity||{})[gid])||0)+1};
  return {ok:true,entry:pick,isNew,name:entryName(pick)};
}
/* 어느 손님의 책에서 나오는가 */
function sourcesOf(kind,id){
  return Object.keys(BOOK_POOLS).filter(gid=>GUEST_BY[gid]&&BOOK_POOLS[gid].some(e=>e.k===kind&&e.id===id));
}
function acqAudit(){
  const orphans=[];
  COMBAT_PAGES.forEach(p=>{ if(!p.starter&&!sourcesOf("page",p.id).length) orphans.push("page:"+p.id); });
  KEY_PAGES.forEach(k=>{ if(k.id!=="novice"&&!sourcesOf("key",k.id).length) orphans.push("key:"+k.id); });
  const bad=[];
  Object.entries(BOOK_POOLS).forEach(([gid,l])=>{ if(!GUEST_BY[gid]) bad.push("guest:"+gid); l.forEach(e=>{ if(!(e.k==="page"?PAGE_BY[e.id]:KEY_BY[e.id])) bad.push(gid+":"+e.id); }); });
  return {orphans,bad,ok:!orphans.length&&!bad.length};
}
/* 구버전 저장 이전: 책 상태(shelved/read/burned)는 모두 책 1권으로 환산 → 아무것도 잃지 않는다 */
function migrateAcq(s,r){
  s.bookCounts={};
  WEAK_POINTS.forEach(g=>{
    const st=(r.books||{})[g.id];
    if(st||(r.conqueredIds||[]).includes(g.id)) s.bookCounts[g.id]=1;
  });
  s.pageCounts={};
  (s.unlockedPageIds||[]).forEach(id=>{ if(PAGE_BY[id]&&!PAGE_BY[id].starter) s.pageCounts[id]=1; });
  s.bookPity={};
  s.books={};
  s.acqV=2;
  return s;
}
/* ---------- state ---------- */
function defaultSave(){
  return {
    hp:COMBAT.playerStartHp, saveV:2,
    questionsAnswered:0, ownedIds:[],
    equipped:{책갈피:null,장식:null,깃펜:null,동반자:null,서고:null,호칭:null},
    conqueredIds:[], conceptStats:{}, receptionsWon:0,
    books:{}, bookCounts:{}, pageCounts:{}, bookPity:{}, acqV:2,
    unlockedPageIds:[...STARTER_PAGES], unlockedKeyIds:["novice"], equippedKeyId:"novice",
    muted:false, sfxMuted:false, bgmMuted:true,
    decks:[], activeDeckId:"deck-1",
    librarians:{[LIB_DEFAULT_ID]:mkLibrarian(LIB_DEFAULT_ID,"큐 양")}, activeLibrarianId:LIB_DEFAULT_ID, libV:2, party:[LIB_DEFAULT_ID],
    recallStats:{},
    moon:null, moonChunk:0, moonShards:[]
  };
}
function loadSave(){
  try{
    const r=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(r&&typeof r==="object"){
      const d=defaultSave();
      const s={...d,...r};
      s.equipped={...d.equipped,...(r.equipped||{})};
      /* 뽑기 제거 — 뽑기권/천장 필드만 조용히 버린다. 핵심 책장·장서복·장신구 데이터는 그대로 유지. */
      ["ticketsSpent","pullsSinceSr","pullsSinceSsr"].forEach(k=>{ delete s[k]; });
      /* 저장 v2: 사서 레벨 제거 — 예전 level/xp(와 레벨로 늘던 maxHp)는 보상 변환 없이 그냥 버린다 */
      ["level","xp","exp","maxHp"].forEach(k=>{ delete s[k]; }); s.saveV=2;
      if(!r.libV||!r.librarians) migrateLibrarians(s,r);
      sanitizeLibrarians(s);
      s.recallStats=r.recallStats&&typeof r.recallStats==="object"?r.recallStats:{};
      s.sfxMuted = r.sfxMuted!=null ? !!r.sfxMuted : !!r.muted;
      s.bgmMuted = r.bgmMuted!=null ? !!r.bgmMuted : true;
      s.bookCounts=r.bookCounts&&typeof r.bookCounts==="object"?r.bookCounts:{};
      s.pageCounts=r.pageCounts&&typeof r.pageCounts==="object"?r.pageCounts:{};
      s.bookPity=r.bookPity&&typeof r.bookPity==="object"?r.bookPity:{};
      s.unlockedPageIds=Array.isArray(r.unlockedPageIds)?r.unlockedPageIds:[...STARTER_PAGES];
      s.unlockedKeyIds=Array.isArray(r.unlockedKeyIds)?r.unlockedKeyIds.filter(id=>KEY_BY[id]):["novice"];
      if(!s.unlockedKeyIds.includes("novice")) s.unlockedKeyIds.unshift("novice");
      if(!KEY_BY[s.equippedKeyId]||!s.unlockedKeyIds.includes(s.equippedKeyId)) s.equippedKeyId="novice";
      s.ownedIds=Array.isArray(r.ownedIds)?r.ownedIds.filter(id=>ITEM_BY[id]):[];
      Object.keys(s.equipped).forEach(sl=>{ if(s.equipped[sl]&&!s.ownedIds.includes(s.equipped[sl])) s.equipped[sl]=null; });
      if(!r.acqV) migrateAcq(s,r);
      s.decks=Array.isArray(r.decks)?r.decks:[];
      s.activeDeckId=r.activeDeckId||"deck-1";
      /* 달의 계시: 없거나 깨진 값은 조용히 초기화 */
      const mo=r.moon;
      s.moon=(mo&&typeof mo==="object"&&/^\d{4}-\d{2}-\d{2}$/.test(mo.date||""))?{date:mo.date,reveal:Math.max(0,mo.reveal|0),replay:Math.max(0,mo.replay|0),used:!!mo.used}:null;
      s.moonChunk=Number.isFinite(r.moonChunk)&&r.moonChunk>=0?Math.floor(r.moonChunk):0;
      if(!(s.moonLast&&typeof s.moonLast==="object")) delete s.moonLast;
      /* 서고의 편린: 단어 열쇠(문자열) 목록, 중복 없이 */
      s.moonShards=Array.isArray(r.moonShards)?[...new Set(r.moonShards.filter(x=>typeof x==="string"&&x))]:[];
      return syncLibs(ensureDecks(s));
    }
  }catch(e){}
  return syncLibs(ensureDecks(defaultSave()));
}
/* 구버전(전역 egoOwned/egoEquipped) → 사서별 기프트. 보유는 모두 유지, 같은 부위에 겹치면 먼저 장착된 것만 착용. */
function migrateLibrarians(s,r){
  const lib=mkLibrarian(LIB_DEFAULT_ID,"큐 양");
  lib.gifts.owned=[...new Set((Array.isArray(r.egoOwned)?r.egoOwned:[]).filter(id=>EGO_BY[id]))];
  Object.values(r.egoEquipped||{}).forEach(id=>{ const g=EGO_BY[id]; if(g&&lib.gifts.owned.includes(id)&&!lib.gifts.equipped[g.slot]) lib.gifts.equipped[g.slot]=id; });
  lib.pity=r.egoPity&&typeof r.egoPity==="object"?{...r.egoPity}:{};
  s.librarians={[LIB_DEFAULT_ID]:lib}; s.activeLibrarianId=LIB_DEFAULT_ID; s.libV=2;
  delete s.egoOwned; delete s.egoEquipped; delete s.egoPity;
  return s;
}
function sanitizeLibrarians(s){
  s.librarians=s.librarians&&typeof s.librarians==="object"?s.librarians:{};
  if(!s.librarians[LIB_DEFAULT_ID]) s.librarians[LIB_DEFAULT_ID]=mkLibrarian(LIB_DEFAULT_ID,"큐 양");
  for(const [k,L] of Object.entries(s.librarians)){
    L.id=L.id||k; L.name=L.name||k; if(L.keyPage===undefined) L.keyPage=null; if(L.deckId===undefined) L.deckId=null; L.pity=L.pity&&typeof L.pity==="object"?L.pity:{};
    L.gifts=L.gifts||{owned:[],equipped:{}};
    L.gifts.owned=[...new Set((L.gifts.owned||[]).filter(id=>EGO_BY[id]))];
    const e=emptyEgoEquip(); for(const sl of EGO_GIFT_RULES.slots){ const id=(L.gifts.equipped||{})[sl]; if(id&&EGO_BY[id]&&EGO_BY[id].slot===sl&&L.gifts.owned.includes(id)) e[sl]=id; }
    L.gifts.equipped=e;
  }
  if(!s.librarians[s.activeLibrarianId]) s.activeLibrarianId=LIB_DEFAULT_ID;
  return s;
}
function persist(){ try{ syncLibs(save); }catch(e){} try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }

const DECK_MIN=6, DECK_MAX=20;   /* 덱은 6~20장 (기존 6장 덱도 그대로 유효) */
const DECK_SIZE=DECK_MIN;
const STARTING_HAND=4;
const HAND_MAX=8;
const MAX_DECK_PRESETS=8;

function ownedPageIds(s){
  return [...new Set([...(s.unlockedPageIds||[]),...Object.keys(s.pageCounts||{}).filter(id=>(s.pageCounts[id]||0)>0),...STARTER_PAGES])].filter(id=>PAGE_BY[id]);
}
function defaultDeckIds(s){
  const owned=ownedPageIds(s);
  const pref=["turn-page","focus-line","cover-slam","margin-guard","silence","breathe"].filter(id=>owned.includes(id));
  if(pref.length===DECK_MIN) return pref;
  const score=id=>{
    const p=PAGE_BY[id];
    return (p.starter?0:10)+(p.cost||0);
  };
  return owned.slice().sort((a,b)=>score(a)-score(b)||PAGE_BY[a].name.localeCompare(PAGE_BY[b].name,"ko")).slice(0,DECK_MIN);
}
function ensureDecks(s){
  const owned=new Set(ownedPageIds(s));
  if(!Array.isArray(s.decks)||!s.decks.length){
    s.decks=[{id:"deck-1",name:"제1 덱",pageIds:defaultDeckIds(s)}];
  }
  s.decks.forEach((d,i)=>{
    d.id=d.id||("deck-"+(i+1));
    d.name=d.name||("제"+(i+1)+" 덱");
    const used={};
    d.pageIds=(d.pageIds||[]).filter(id=>{
      if(!owned.has(id)) return false;
      used[id]=(used[id]||0)+1;
      return used[id]<=deckLimit(s,id);
    }).slice(0,DECK_MAX);
  });
  if(!s.decks.some(d=>d.id===s.activeDeckId)) s.activeDeckId=s.decks[0].id;
  return s;
}
function activeDeck(s){
  ensureDecks(s);
  return s.decks.find(d=>d.id===s.activeDeckId)||s.decks[0];
}
function isDeckReady(s){
  const d=activeDeck(s);
  return !!(d&&d.pageIds.length>=DECK_MIN&&d.pageIds.length<=DECK_MAX&&d.pageIds.every(id=>PAGE_BY[id]));
}
function pageFloorName(p){
  if(!p||!p.floorId) return "기본";
  return (FLOORS.find(f=>f.id===p.floorId)||{}).name||p.floorId;
}
function pagePrimaryType(p){ return (p.dice&&p.dice[0]&&p.dice[0].type)||""; }
function removeOne(arr,id){
  const i=arr.indexOf(id);
  if(i>=0) arr.splice(i,1);
  return arr;
}
function drawPages(rec,n){
  const got=[];
  for(let i=0;i<n;i++){
    if(rec.handIds.length>=HAND_MAX) break;
    if(!rec.deckIds.length){
      if(!rec.discardIds.length) break;
      rec.deckIds=shuffle(rec.discardIds);
      rec.discardIds=[];
      rec.log.push("사용한 책장을 다시 섞었다.");
    }
    if(!rec.deckIds.length) break;
    const id=rec.deckIds.shift();
    rec.handIds.push(id);
    got.push(id);
  }
  return got;
}

let save=loadSave();
let reception=null;   /* 진행 중인 접대(다대다 엔진이 정답 수 등을 적는다) */

function shuffle(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function buildQuiz(guest, recall){
  let qs=guest.questions.map(q=>{
    if(!recall || q.type==="ox") return {...q, options:q.options.slice()};
    const pairs=q.options.map((o,i)=>({o,i}));
    const sh=shuffle(pairs);
    return {...q, options:sh.map(p=>p.o), correctIndex:sh.findIndex(p=>p.i===q.correctIndex)};
  });
  return recall?shuffle(qs):qs;
}
function ensureRecall(id){
  if(!save.recallStats[id]) save.recallStats[id]={recalls:0,wins:0,correct:0,total:0,history:[]};
  return save.recallStats[id];
}
