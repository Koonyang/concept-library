/* 다대다 전투 무대 (Ruina식) — UI/UX 담당
   전투 쪽 사용법:
     BattleStage.mount(hostEl)                  // 무대를 붙일 요소 (한 번)
     BattleStage.render(battle, {hands, cards, figure})
        battle  : 전투 담당의 battle 객체 (units, phase, scene ...)
        hands   : { [allyUnitId]: [cardId, ...] }  그 사서의 손패
        cards   : { [cardId]: {name, cost, dice:[{type:"slash|pierce|blunt|guard|evade", min, max}]} }
        figure  : (unit) => html  캐릭터 그림 (없으면 실루엣)
     BattleStage.onAssign = (unitId, dieIdx, cardId, target) => {}   // target = {unit, die} | null
     BattleStage.onUnassign = (unitId, dieIdx) => {}
   조작: 내 주사위 탭 → 손패에서 카드 탭 → 적 주사위 탭(또는 내 주사위를 적 주사위로 끌기).
   배치: 아군 slot 0 앞줄, 1·2 뒷줄 / 적 slot 0~2 앞줄, 3·4 뒷줄. 뒷줄은 작고 어둡게. */
(function(){
  const CSS=`
.bs{position:absolute;inset:0;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
.bs-floor{position:absolute;left:0;right:0;bottom:0;height:62%;pointer-events:none;
  background:radial-gradient(ellipse 70% 60% at 50% 70%,rgba(230,211,163,.07),transparent 70%)}
.bs-unit{position:absolute;transform:translate(-50%,-100%) scale(var(--sc,1));transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center;
  width:var(--uw,76px);filter:brightness(var(--br,1));transition:filter .2s,opacity .3s,left .3s,top .3s;z-index:var(--z,1)}
.bs-unit.dead{opacity:0;pointer-events:none}
.bs-unit.staggered .bs-fig{filter:grayscale(1) brightness(.7);transform:rotate(var(--tilt,-8deg))}
.bs-unit.enemy{--tilt:8deg}
.bs-dice{display:flex;gap:4px;margin-bottom:4px;min-height:26px}
.bs-die{position:relative;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font:700 13px/1 var(--display,system-ui);
  background:#1a1f2c;border:1.5px solid #5a6680;color:#e8d5b0;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.bs-die:before{content:"";position:absolute;inset:-9px}
.bs-unit.ally .bs-die{border-color:#c4a35a}
.bs-unit.enemy .bs-die{border-color:#c45c4a}
.bs-die.has-card{background:#2a2414}
.bs-unit.enemy .bs-die.has-card{background:#2a1614}
.bs-die.sel{outline:2px solid #ffe6a8;outline-offset:2px;transform:scale(1.12)}
.bs-die.can-target{animation:bsPulse 1s ease-in-out infinite;border-color:#ffe6a8}
.bs-die.off{opacity:.35;pointer-events:none}
@keyframes bsPulse{50%{box-shadow:0 0 0 3px rgba(255,230,168,.35),0 0 12px rgba(255,230,168,.6)}}
.bs-fig{width:100%;height:var(--fh,76px);display:flex;align-items:flex-end;justify-content:center;transition:transform .2s}
.bs-sil{width:46%;height:92%;border-radius:40% 40% 12% 12%/30% 30% 8% 8%;background:linear-gradient(180deg,#3a4256,#1c2130);border:1px solid rgba(255,255,255,.08)}
.bs-unit.enemy .bs-sil{background:linear-gradient(180deg,#563a3a,#2a1a1c)}
.bs-plate{margin-top:3px;width:100%;font-size:10px;line-height:1.2;text-align:center;color:#e8d5b0}
.bs-nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
.bs-bar{height:4px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:2px}
.bs-bar i{display:block;height:100%;background:#6ebd96}
.bs-bar.st i{background:#e0b43a}
.bs-light{display:flex;gap:2px;justify-content:center;margin-top:3px}
.bs-light b{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15)}
.bs-light b.on{background:#ffe6a8;box-shadow:0 0 5px rgba(255,230,168,.8)}
.bs-tag{position:absolute;top:-16px;font-size:10px;padding:1px 5px;border-radius:6px;background:#c45c4a;color:#fff;white-space:nowrap}
.bs-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:40;overflow:visible}
.bs-hand{position:absolute;left:50%;bottom:calc(6px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:6px;z-index:50;max-width:96%;overflow-x:auto;padding:2px}
.bs-hand:empty{display:none}
.bs-card{flex:0 0 auto;width:84px;min-height:58px;padding:6px 6px 5px;border-radius:9px;background:#14161f;border:1.5px solid #3a4054;color:#e8d5b0;font-size:11px;text-align:left;cursor:pointer;position:relative}
.bs-card .c{position:absolute;top:4px;right:6px;font-weight:800;color:#ffe6a8}
.bs-card .n{display:block;font-weight:700;padding-right:12px;line-height:1.25;margin-bottom:3px}
.bs-card .d{font-size:10px;opacity:.85}
.bs-card.pick{border-color:#ffe6a8;transform:translateY(-6px);box-shadow:0 6px 14px rgba(0,0,0,.5)}
.bs-card.cant{opacity:.4}
.bs-card.used{opacity:.3;pointer-events:none}
@media (orientation:landscape) and (max-height:500px){ .bs-unit{--fh:62px;--uw:70px} .bs-card{width:78px;min-height:50px;font-size:10px} .bs-hand{bottom:4px} }
`;
  const DT={slash:"참",pierce:"관",blunt:"타",guard:"방",evade:"회"};
  let host=null, root=null, last=null, opts={}, sel=null, pickCard=null, drag=null;
  const API={ onAssign:null, onUnassign:null };

  function injectCss(){ if(document.getElementById("bs-css")) return; const s=document.createElement("style"); s.id="bs-css"; s.textContent=CSS; document.head.appendChild(s); }

  /* slot → 무대 위 자리 (화면 비율 기준 %, 깊이). 앞줄이 아래·크게, 뒷줄이 위·작게 */
  function place(u, n){
    const ally=u.side==="ally";
    const back = ally ? u.slot>0 : u.slot>=3;
    const land = !root || root.clientWidth>=root.clientHeight;
    let x, y;
    if(land){
      if(ally){ if(u.slot===0){ x=27; y=80; } else { x = u.slot===1 ? 14 : 36; y=50; } }
      else { const row = back ? n.back : n.front, k=Math.max(0,row.indexOf(u.slot));
        const X = back ? {1:[78],2:[71,85]} : {1:[78],2:[70,86],3:[64,78,92]};
        x=(X[row.length]||X[1])[k]??78; y = back?50:80; }
    } else {
      /* 세로: 적은 위, 아군은 아래 — 같은 앞뒤 규칙 */
      if(ally){ if(u.slot===0){ x=50; y=84; } else { x = u.slot===1 ? 22 : 78; y=72; } }
      else { const row = back ? n.back : n.front, k=Math.max(0,row.indexOf(u.slot));
        const X = back ? {1:[50],2:[34,66]} : {1:[50],2:[30,70],3:[17,50,83]};
        x=(X[row.length]||X[1])[k]??50; y = back?30:48; }
    }
    return {x,y,sc:back?.82:1,br:back?.75:1,z:back?1:2};
  }


  function dieHtml(u,i,d){
    const off = u.staggered || u.hp<=0;
    const cls=["bs-die", d.card?"has-card":"", sel&&sel.unit===u.id&&sel.die===i?"sel":"", off?"off":""].join(" ");
    return `<button class="${cls}" type="button" data-u="${u.id}" data-d="${i}" aria-label="${u.side==="ally"?"내":"적"} 속도 주사위 ${d.speed}">${d.speed}</button>`;
  }
  function unitHtml(u, n){
    const p=place(u,n), fig = opts.figure ? opts.figure(u) : `<div class="bs-sil"></div>`;
    const pct=(a,b)=>Math.max(0,Math.min(100,Math.round(100*a/(b||1))));
    return `<div class="bs-unit ${u.side} ${u.staggered?"staggered":""} ${u.hp<=0?"dead":""}" data-unit="${u.id}"
      style="left:${p.x}%;top:${p.y}%;--sc:${p.sc};--br:${p.br};--z:${p.z}">
      ${u.staggered?`<span class="bs-tag">흐트러짐</span>`:""}
      <div class="bs-dice">${(u.dice||[]).map((d,i)=>dieHtml(u,i,d)).join("")}</div>
      <div class="bs-fig">${fig}</div>
      <div class="bs-plate"><div class="bs-nm">${u.name||u.topic||u.id}</div>
        <div class="bs-bar"><i style="width:${pct(u.hp,u.maxHp)}%"></i></div>
        <div class="bs-bar st"><i style="width:${pct(u.stagger,u.maxStagger)}%"></i></div>
        ${u.side==="ally"?`<div class="bs-light">${Array.from({length:u.maxLight||0},(_,k)=>`<b class="${k<u.light?"on":""}"></b>`).join("")}</div>`:""}
      </div></div>`;
  }
  function usedCards(unitId){ const u=unit(unitId); return new Set((u&&u.dice||[]).map(d=>d.card).filter(Boolean)); }
  function handHtml(){
    if(!sel||!last||last.phase!=="assign") return "";
    const u=unit(sel.unit); if(!u||u.side!=="ally") return "";
    const ids=(opts.hands&&opts.hands[u.id])||[]; const used=usedCards(u.id); const cur=u.dice[sel.die]&&u.dice[sel.die].card;
    return ids.map(id=>{ const c=(opts.cards&&opts.cards[id])||{name:id,cost:0,dice:[]};
      const cant=(c.cost||0)>u.light+(cur&&opts.cards[cur]?opts.cards[cur].cost||0:0);
      return `<button class="bs-card ${pickCard===id?"pick":""} ${cant?"cant":""} ${used.has(id)&&id!==cur?"used":""}" type="button" data-card="${id}">
        <span class="c">${c.cost||0}</span><span class="n">${c.name}</span><span class="d">${(c.dice||[]).map(d=>`${DT[d.type]||"?"}${d.min}-${d.max}`).join(" ")}</span></button>`; }).join("");
  }
  function unit(id){ return last&&last.units.find(u=>u.id===id); }

  function render(battle, o){
    if(!root) throw new Error("BattleStage.mount(host) 먼저");
    last=battle; if(o) opts=o;
    if(sel&&!unit(sel.unit)) sel=null;
    const live=battle.units.filter(u=>u.side==="enemy"); const n={front:live.filter(u=>u.slot<3).map(u=>u.slot).sort(),back:live.filter(u=>u.slot>=3).map(u=>u.slot).sort()};
    root.innerHTML=`<div class="bs-floor"></div>${battle.units.map(u=>unitHtml(u,n)).join("")}<svg class="bs-svg"></svg><div class="bs-hand">${handHtml()}</div>`;
    markTargets(); requestAnimationFrame(drawArrows);
  }
  function rel(el){ const r=el.getBoundingClientRect(), R=root.getBoundingClientRect(); return {x:r.left-R.left+r.width/2,y:r.top-R.top+r.height/2,top:r.top-R.top}; }
  function dieEl(uid,i){ return root.querySelector(`.bs-die[data-u="${uid}"][data-d="${i}"]`); }
  function drawArrows(){
    if(!root||!last) return; const svg=root.querySelector(".bs-svg"); if(!svg) return;
    let h=`<defs><marker id="bsA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>`;
    const seen=new Set();
    for(const u of last.units){ if(u.hp<=0) continue; (u.dice||[]).forEach((d,i)=>{ if(!d.target) return; const a=dieEl(u.id,i), b=dieEl(d.target.unit,d.target.die); if(!a||!b) return;
      const t=unit(d.target.unit), td=t&&t.dice&&t.dice[d.target.die];
      const clash = td&&td.target&&td.target.unit===u.id&&td.target.die===i;
      const key=[u.id+":"+i,d.target.unit+":"+d.target.die].sort().join("|"); if(clash&&seen.has(key)) return; seen.add(key);
      const p=rel(a), q=rel(b); const mx=(p.x+q.x)/2, my=Math.min(p.top,q.top)-36-Math.abs(p.x-q.x)*.08;
      const col= clash?"#ffe6a8": u.side==="ally"?"#c4a35a":"#e06a55";
      h+=`<path d="M${p.x} ${p.y-14} Q${mx} ${my} ${q.x} ${q.y-14}" fill="none" stroke="${col}" stroke-width="${clash?2.6:2}" ${clash?"":"stroke-dasharray=\"5 4\""} marker-end="url(#bsA)" ${clash?"marker-start=\"url(#bsA)\"":""} opacity=".92"/>`;
      if(clash) h+=`<circle cx="${mx}" cy="${(my+Math.min(p.y,q.y))/2-6}" r="9" fill="#1a1f2c" stroke="${col}" stroke-width="1.5"/><text x="${mx}" y="${(my+Math.min(p.y,q.y))/2-2}" font-size="10" font-weight="800" text-anchor="middle" fill="${col}">합</text>`;
    }); }
    if(drag&&drag.x!=null){ const a=dieEl(drag.unit,drag.die); if(a){ const p=rel(a); h+=`<path d="M${p.x} ${p.y-14} L${drag.x} ${drag.y}" stroke="#ffe6a8" stroke-width="2.4" fill="none" marker-end="url(#bsA)"/>`; } }
    svg.innerHTML=h;
  }
  function markTargets(){
    root.querySelectorAll(".bs-die.can-target").forEach(e=>e.classList.remove("can-target"));
    if(!sel||!pickCard) return;
    root.querySelectorAll(`.bs-unit.enemy:not(.dead) .bs-die:not(.off)`).forEach(e=>e.classList.add("can-target"));
  }
  function assign(target){
    if(!sel||!pickCard) return;
    const s=sel, c=pickCard; pickCard=null; sel=null;
    if(API.onAssign) API.onAssign(s.unit, s.die, c, target);
    if(last) render(last);
  }
  function onTap(e){
    if(!last||last.phase!=="assign") return;
    const card=e.target.closest(".bs-card"); if(card){ if(card.classList.contains("cant")) return; pickCard = pickCard===card.dataset.card?null:card.dataset.card; render(last); return; }
    const die=e.target.closest(".bs-die"); if(!die){ if(sel){ sel=null; pickCard=null; render(last); } return; }
    const u=unit(die.dataset.u), i=+die.dataset.d;
    if(u.side==="ally"){
      if(sel&&sel.unit===u.id&&sel.die===i){ if(u.dice[i].card&&API.onUnassign){ API.onUnassign(u.id,i); } sel=null; pickCard=null; }
      else { sel={unit:u.id,die:i}; pickCard=u.dice[i].card||null; }
      render(last); return;
    }
    if(sel&&pickCard) assign({unit:u.id,die:i});
  }
  /* 끌기: 카드를 고른 내 주사위를 적 주사위 위로 */
  function onDown(e){
    const die=e.target.closest(".bs-unit.ally .bs-die"); if(!die||!last||last.phase!=="assign") return;
    if(!(sel&&sel.unit===die.dataset.u&&sel.die===+die.dataset.d&&pickCard)) return;
    drag={unit:die.dataset.u,die:+die.dataset.d,x0:e.clientX,y0:e.clientY,x:null,y:null};
  }
  function onMove(e){ if(!drag) return; if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<8&&drag.x==null) return; const R=root.getBoundingClientRect(); drag.x=e.clientX-R.left; drag.y=e.clientY-R.top; drawArrows(); }
  function onUp(e){
    if(!drag) return; const moved=drag.x!=null; drag=null;
    if(!moved){ drawArrows(); return; }
    const el=document.elementFromPoint(e.clientX,e.clientY); const die=el&&el.closest(".bs-unit.enemy .bs-die:not(.off)");
    if(die) assign({unit:die.dataset.u,die:+die.dataset.d}); else drawArrows();
    e.stopPropagation(); root.__noTap=true; setTimeout(()=>root.__noTap=false,0);
  }
  function mount(el){
    injectCss(); host=el; root=document.createElement("div"); root.className="bs"; el.appendChild(root);
    root.addEventListener("click",e=>{ if(root.__noTap) return; onTap(e); });
    root.addEventListener("pointerdown",onDown); window.addEventListener("pointermove",onMove); window.addEventListener("pointerup",onUp,true);
    window.addEventListener("resize",()=>{ if(last) render(last); });
    return root;
  }
  function unmount(){ if(root){ root.remove(); root=null; last=null; sel=null; pickCard=null; } }
  Object.assign(API,{mount,unmount,render,place,redraw:drawArrows,_state:()=>({sel,pickCard})});
  window.BattleStage=API;
})();
