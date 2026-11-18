/* 개념의 서고 — 화면이 부를 수 있는 동작 모음 (화면 없음)
 * 새 UI는 여기 있는 함수만 부르고, 다 부른 다음 저장 상태(save)·전투 상태(Game.battle.state)를 읽어 그린다.
 * 예전 UI에서 화면 코드 안에 섞여 있던 규칙(승리 보상, 책 소각, 덱 편성, 사서·장서복·기프트 장착)을 그대로 옮겼다.
 * 옛 디버그 핸들 window.__studyGame 도 같은 이름으로 남긴다(테스트·시뮬레이션용).
 */

/* ---------- 접대(다대다 전투) ---------- */
/* 손님 하나와 접대를 시작한다. 덱이 모자라면 {ok:false, why} */
function beginBattle(guestId,o){
  o=o||{};
  ensureDecks(save);
  if(!isDeckReady(save)) return {ok:false,why:`책장을 ${DECK_MIN}장 이상 장착해야 접대할 수 있습니다`};
  mb=mbCreate(guestId,o); if(!mb) return {ok:false,why:"없는 손님"};
  if(o.rng) mb.rng=o.rng;
  reception={guestId,multi:true,isRecall:mb.isRecall,librarianIds:mbSide("ally").map(u=>u.libId),sessionCorrect:0,sessionTotal:0,
    droppedGift:null,phase:"multi",log:mb.log,bookGain:0,levelUpMessage:"",settled:false};
  mb.log.push(`${mb.guest.concept} 손님 무리(${mbSide("enemy").length})가 서고 문 앞에 서 있다.`);
  mbStartScene();
  persist();
  return {ok:true,battle:mb.battle};
}
/* 막 하나를 끝까지 처리: 이번 막의 합 결과 목록(ev)을 돌려준다. 연출은 화면이 ev 를 보고 한다. 끝나지 않았으면 다음 막을 연다. */
function battleResolve(o){
  if(!mb||mb.battle.phase!=="assign") return null;
  const events=mbResolve(); if(!events) return null;
  if(!mb.outcome&&!(o&&o.holdNextScene)) mbStartScene();
  return events;
}
/* 승패가 난 뒤 한 번: 회상 기록, 사서별 E.G.O 기프트 판정, 저장. 결과 화면에 쓸 값을 돌려준다. */
function battleSettle(){
  const rec=reception; if(!rec||!mb||!mb.outcome) return null;
  if(rec.settled) return rec.result;
  const guest=GUEST_BY[rec.guestId], won=mb.outcome==="win";
  finishReceptionStats(guest, won);
  let drops=[];
  if(won){
    const libIds=rec.librarianIds||[save.activeLibrarianId||LIB_DEFAULT_ID];
    const moon=moonBonus(save, todaySeoul());
    drops=libIds.map(id=>rollEgoGift(guest,!!rec.isRecall,id,moon));
    rec.droppedGift=drops;
  }
  save.hp=effectiveMaxHp(save);
  persist();
  rec.settled=true;
  rec.result={won,guestId:guest.id,isRecall:!!rec.isRecall,bookGain:won?(rec.bookGain||0):0,books:shownBookCount(save,guest.id),
    gifts:drops.filter(d=>d&&!d.dup&&d.item).map(d=>({libId:d.libId,libName:d.libName,item:d.item})),
    correct:rec.sessionCorrect||0,total:rec.sessionTotal||0,explanation:guest.explanation};
  return rec.result;
}
function battleLeave(){ mb=null; reception=null; }
/* 다음에 싸울 손님(같은 층에서 아직 책이 안 된 손님 → 아무 층) */
function nextGuestAfter(guestId){
  const cur=GUEST_BY[guestId], open=x=>!save.conqueredIds.includes(x.id);
  return WEAK_POINTS.find(x=>open(x)&&cur&&x.floorId===cur.floorId)||WEAK_POINTS.find(open)||null;
}

/* ---------- 층 무대(3D 겉모습) ---------- */
const FLOOR_STAGE_DEFAULT={mood:"lamp",accent:"#d9a35a",props:["candles","bookpile"]};
function floorStage(floorId){
  const f=FLOORS.find(x=>x.id===floorId), st=(f&&f.stage)||{}, D=FLOOR_STAGE_DEFAULT;
  return {mood:st.mood||D.mood,accent:st.accent||D.accent,props:(Array.isArray(st.props)?st.props:D.props).slice()};
}
/* ---------- 개막을 한 교환씩 (연출용) ---------- */
function battleStepEnd(R){ const ev=mbResolveEnd(R); if(mb&&!mb.outcome) mbStartScene(); return ev; }

/* ---------- 책 소각 ---------- */
/* 책을 times 권 태운다. {ok, n, cards:[{k,id,name,n,isNew}], why} */
function burnBooks(gid,times){
  if(!BOOK_POOLS[gid]||bookCount(save,gid)<1) return {ok:false,n:0,cards:[],why:"소각할 책이 없다"};
  const cards=[]; let n=0, fail="";
  while(n<(times||1)&&bookCount(save,gid)>0){
    const r=burnBookOnce(save,gid);
    if(!r.ok){ fail=r.why; break; }
    n++;
    const key=r.entry.k+":"+r.entry.id; let c=cards.find(x=>x.key===key);
    if(!c){ c={key,k:r.entry.k,id:r.entry.id,name:r.name,n:0,isNew:false}; cards.push(c); }
    c.n++; if(r.isNew) c.isNew=true;
  }
  if(!n) return {ok:false,n:0,cards,why:fail||"소각할 책이 없다"};
  persist();
  return {ok:true,n,cards};
}
function heldBooks(){ return WEAK_POINTS.filter(g=>shownBookCount(save,g.id)>0); }

/* ---------- 덱 편성 ---------- */
/* 책장 한 장 넣기/빼기. 한도에 닿으면 한 번 더 눌러 모두 해제. opts.slot 이면 한 장만 뺀다. {ok, why} */
function toggleDeckPage(id,opts){
  ensureDecks(save);
  const d=activeDeck(save);
  const have=d.pageIds.filter(x=>x===id).length, lim=deckLimit(save,id);
  if(opts&&opts.slot){ const k=d.pageIds.lastIndexOf(id); if(k>=0) d.pageIds.splice(k,1); }
  else if(have<lim&&d.pageIds.length<DECK_MAX){ d.pageIds.push(id); }
  else if(have>0){ d.pageIds=d.pageIds.filter(x=>x!==id); }
  else if(d.pageIds.length>=DECK_MAX){ return {ok:false,why:"덱은 "+DECK_MAX+"장까지입니다"}; }
  else return {ok:false,why:"가진 책장이 아니다"};
  persist();
  return {ok:true};
}

/* ---------- 사서·장서복(핵심 책장)·E.G.O 기프트 ---------- */
function pickLibrarian(id){
  syncLibs(save);
  if(id===save.activeLibrarianId||!libUnlockedIds(save).includes(id)) return false;
  const L=save.librarians[id];
  save.activeLibrarianId=id; save.equippedKeyId=L.keyPage; save.activeDeckId=L.deckId;
  syncLibs(save); persist(); return true;
}
/* 지금 사서를 접대 명단에 넣거나 뺀다. {ok, why} */
function toggleParty(){
  syncLibs(save);
  const id=save.activeLibrarianId, cur=save.party||[];
  const ids=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id].sort((a,b)=>LIB_ORDER.indexOf(a)-LIB_ORDER.indexOf(b));
  return libsSetParty(save,ids);
}
function equipKey(id){
  const k=KEY_BY[id]; if(!k||!save.unlockedKeyIds.includes(id)||save.equippedKeyId===id) return false;
  save.equippedKeyId=id; persist(); return true;
}
/* on: true 착용 / false 해제 / 생략하면 토글. {ok, msg} */
function equipGift(id,on){
  const g=EGO_BY[id]; if(!g||!egoOwned(save).includes(id)) return {ok:false};
  const E=egoEquip(save), cur=E[g.slot];
  let msg;
  if(on===false||(on==null&&cur===id)){ if(cur!==id) return {ok:false}; E[g.slot]=null; msg=`${g.name} 해제`; }
  else { if(cur===id) return {ok:false}; const swap=!!cur; E[g.slot]=id; msg=swap?`${EGO_BY[cur].name} → ${g.name} 교체 (${g.slot})`:`${g.name} 착용`; }
  if(save.hp>effectiveMaxHp(save)) save.hp=effectiveMaxHp(save);
  persist(); return {ok:true,msg};
}
function setAudio(o){ if("bgm" in o) save.bgmMuted=!o.bgm; if("sfx" in o) save.sfxMuted=!o.sfx; persist(); }

/* ---------- 바깥으로 여는 이름 ---------- */
const Game={
  get save(){ return save; },
  data:{FLOORS,WEAK_POINTS,GUEST_BY,COMBAT_PAGES,PAGE_BY,KEY_PAGES,KEY_BY,EGO_GIFTS,EGO_BY,KEY_QUESTIONS,BOOK_POOLS,COSMETIC_ITEMS,
    floorStage,DECK_MIN,DECK_MAX,DECK_MAX_COPIES,HAND_MAX,PARTY_MAX,TIER,TIER_ORDER,ATK_TYPES,BOOK_COVER_N,bookCoverIndex,bookCoverSrc},
  battle:{
    begin:beginBattle, answer:mbAnswer, assign:mbAssign, unassign:mbUnassign, resolve:battleResolve, stepBegin:()=>(mb?mbResolveBegin():null), stepNext:R=>mbResolveNext(R), stepEnd:battleStepEnd, settle:battleSettle, leave:battleLeave,
    cardInfo:mbCardInfo, usable:(uid,cid)=>mbUsable(mbUnit(uid),PAGE_BY[cid]||(mb&&mb.cards[cid])), hand:uid=>mb?mb.x[uid].handIds:[],
    question:()=>mb&&mb.cur?mb.cur.q:null, isClash:mbIsClash, unit:mbUnit, enemyBody:(gid,e)=>enemyBody(GUEST_BY[gid],e||{}),
    nextGuest:nextGuestAfter, hooks:MB_HOOKS,
    get state(){ return mb?mb.battle:null; }, get outcome(){ return mb&&mb.outcome; }, get log(){ return mb?mb.log:[]; }, get reception(){ return reception; }
  },
  books:{held:heldBooks,count:bookCount,shown:shownBookCount,total:totalBooks,maxed:bookMaxed,pool:gid=>poolEntries(save,gid),burn:burnBooks,sourcesOf},
  deck:{toggle:toggleDeckPage,active:()=>activeDeck(save),ready:()=>isDeckReady(save),owned:()=>ownedPageIds(save),ownedCount:id=>ownedCount(save,id),limit:id=>deckLimit(save,id)},
  libs:{list:()=>libsList(save),pick:pickLibrarian,toggleParty,equipKey,equipGift,unlockedCount:()=>libUnlockedCount(save),nextAt:()=>libNextAt(save),
    keyOf:id=>libsKeyOf(save,id),giftTotals:id=>giftTotals(save,id),activeSets:id=>activeSets(save,id),bonusLabel},
  moon:MoonCore, moonBonus:()=>moonBonus(save,todaySeoul()),
  setAudio, persist,
  reset(){ save=defaultSave(); ensureDecks(save); persist(); return save; }
};
window.Game=Game;

/* 옛 디버그 핸들(테스트·tools/sim 이 쓴다). 화면 함수는 없다. */
window.__studyGame={
  get save(){ return save; },
  engine:{pctEnd,pctRange,COMBAT,TIER,ATK_TYPES,mkUnit,resolveScene,guestCombat,planIntent,expectedDamage,checkShort,keyQsOf,WEAK_POINTS,COMBAT_PAGES,PAGE_BY,hitUnit,playerDieRange,guestDieRange,playerStaggerMax,FLAT_RESIST},
  data:{EGO_GIFTS,KEY_PAGES,COSMETIC_ITEMS,WEAK_POINTS,COMBAT_PAGES,FLOORS,KEY_QUESTIONS},
  BOOK_COVER_N, bookCoverSrc, bookCoverIndex,
  acq:{bookMaxed,shownBookCount,BOOK_POOLS,BOOK_RULES,poolEntries,burnBookOnce,addBooks,bookCount,totalBooks,ownedCount,deckLimit,DECK_MIN,DECK_MAX,sourcesOf,acqAudit,migrateAcq,rollRecallBooks,loadSave,defaultSave,SAVE_KEY},
  setGifts(owned,equipped){ const L=libOf(save); L.gifts.owned=[...owned]; L.gifts.equipped={...emptyEgoEquip(),...(equipped||{})}; persist(); },
  gifts:{withKeyMods,effectiveMaxHp,libOf,giftTotals,giftMaxTotals,activeSets,rollEgoGift,migrateLibrarians,sanitizeLibrarians,equipGift,egoOwned,egoEquip,EGO_GIFT_RULES,loadSave,SAVE_KEY,moonBonus,moonAdjustedRate,todaySeoul},
  toggleDeckPage, isDeckReady, activeDeck, ownedPageIds,
  moon:MoonCore,
  get battle(){ return mb?mb.battle:null; },
  get reception(){ return reception; },
  battleApi:{
    enable(on){ save.multiBattle=!!on; persist(); return save.multiBattle; }, enabled:()=>multiEnabled(),
    begin(guestId,o){ const r=beginBattle(guestId,o); return r.ok?mb.battle:null; },
    create(guestId,o){ mb=mbCreate(guestId,o); reception={guestId,multi:true,isRecall:mb.isRecall,librarianIds:mb.battle.units.filter(u=>u.side==="ally").map(u=>u.libId),sessionCorrect:0,sessionTotal:0,droppedGift:null,phase:"multi",log:mb.log,bookGain:0,levelUpMessage:""}; mbStartScene(); return mb.battle; },
    answer(correct){ return mbAnswer(correct); },
    assign(unitId,dieIdx,cardId,target){ return mbAssign(unitId,dieIdx,cardId,target); },
    unassign(unitId,dieIdx){ return mbUnassign(unitId,dieIdx); },
    resolve(){ const ev=battleResolve(); return ev; }, resolveOnly:()=>mbResolve(),
    enemyCap:(gid)=>mbEnemyCap(GUEST_BY[gid]), questionCount:(gid)=>mbQuestionCount(GUEST_BY[gid]), enemyHpTotal:(gid,n)=>mbEnemyHpTotal(GUEST_BY[gid],n),
    allyStats:(mods,gid)=>mbAllyStats(mods,gid?GUEST_BY[gid]:null), enemyScale:n=>mbEnemyScale(n),
    resolveBegin:()=>mbResolveBegin(), resolveNext:R=>mbResolveNext(R), resolveEnd:R=>mbResolveEnd(R),
    usable:(uid,cid)=>mbUsable(mbUnit(uid),PAGE_BY[cid]), ENEMY_BODY, enemyBody:(gid,e)=>enemyBody(GUEST_BY[gid],e||{}),
    startScene(){ mbStartScene(); return mb.battle; }, relink:()=>mbRelink(), isClash:(u,i)=>mbIsClash(u,i),
    setRng(fn){ if(mb) mb.rng=fn; }, nextScene(){ if(!mb||mb.outcome) return null; mbStartScene(); return mb.battle; },
    setEnemyTarget(eid,k,target){ const X=mb.x[eid]; X.orig[k]=target?{unit:target.unit,die:target.die}:null; mbRelink(); },
    hand:(uid)=>mb.x[uid].handIds, cardOf:(cid)=>mb.cards[cid]||PAGE_BY[cid]||null, internals:()=>mb.x, get mb(){ return mb; },
    get outcome(){ return mb&&mb.outcome; }, get current(){ return mb&&mb.cur; },
    cardInfo:(cid,uid)=>mbCardInfo(cid,uid), settle:()=>battleSettle(),
    enemyStats, hooks:MB_HOOKS, ENEMY_STATS, MB, libMods, libStartLight, libStartEmotion, libLightRegen, libDeckIds
  },
  libs:{unlockedCount:libUnlockedCount,nextAt:libNextAt,list:libsList,equipKey:libsEquipKey,setParty:libsSetParty,keyOf:libsKeyOf,sync:syncLibs,UNLOCK_AT:LIB_UNLOCK_AT,ORDER:LIB_ORDER,PARTY_MAX},
  giveAllPages(){ save.unlockedPageIds=COMBAT_PAGES.map(p=>p.id); ensureDecks(save); persist(); },
  setDeckPages(ids){ const d=activeDeck(save); d.pageIds=(ids||[]).slice(0,DECK_MAX); persist(); },
  giftTotals, bonusLabel
};
ensureDecks(save);
