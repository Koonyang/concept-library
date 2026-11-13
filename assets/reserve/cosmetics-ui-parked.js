/* PARKED — 옛 '장서' 화면(덱 요약 · 뽑기 · 도감 · 코디) 원본. 뽑기 외 부분(도감/코디: 장신구 보유·착장 UI)은 얻을 방법이 뽑기뿐이라 화면만 보류. 장신구 데이터·그리기·저장은 게임에 남아 있다. */

/* ---------- 장서 화면 원본: 덱 요약 + 뽑기/도감/코디 (renderCollection/equipItem/pullGacha/paintReveal) ---------- */
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
