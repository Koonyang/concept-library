/* 다대다 전투 무대 (Ruina식) — UI/UX 담당
   전투 쪽 사용법:
     BattleStage.mount(hostEl)                  // 무대를 붙일 요소 (한 번)
     BattleStage.render(battle, {hands, cards, figure})
        battle  : 전투 담당의 battle 객체 (units, phase, scene ...)
        hands   : { [allyUnitId]: [cardId, ...] }  그 사서의 손패
        cards   : { [cardId]: {name, cost, dice:[{type:"slash|pierce|blunt|guard|evade", min, max}]} }
        figure  : (unit) => html  캐릭터 그림 (없으면 실루엣)
     BattleStage.onAssign = (unitId, dieIdx, cardId, target) => {}   // target = {unit, die} | null
     BattleStage.onUnassign = (unitId, dieIdx) => {}  // 또는 opts.onUnassign. 놓은 주사위/화살표를 탭하면 호출
        avoid   : (선택) 무대가 피해야 할 요소 선택자, 기본 "#qpanel.on". 보이면 그 위/아래 남는 칸에 유닛을 몰아 세운다.
     await BattleStage.clash(ev, {fast})  // 합 하나 연출 전부(카메라 다가감 → steps 마다 부딪침 → 빠짐). 끝나면 풀리는 Promise (기다리지 않아도 됨)
        ev = {kind:"clash"|"one-sided", a:{unit,die,card,values}, b:{...}|null, steps:[{aVal,bVal,winner:"a"|"b"|"tie",dmg}], result}
           또는 예전 모양 {kind, ally, allyDie, enemy, enemyDie, allyCard, enemyCard, win, by}
        시간: 합 하나 clashMs(900), 부딪침 hitAt(400), steps 하나 더할 때마다 stepMs(240), 최대 maxClashMs(1600). fast 면 fastMs(300).
        카메라가 들어가 있는 동안 .battle-stage 에 bs-cam-on → 손패·개막 버튼·상태판 숨김.
        연출 중 탭 = 이번 합 빨리 감기(+onSkip), 길게 누르기(holdMs 450) = 다음 배치 단계 render 전까지 모든 clash 즉시 끝남(+onSkip)
     BattleStage.focus(ev, fast) // (예전 흐름) 카메라만. 이걸로 맞춰 둔 뒤 clash(ev) 를 부르면 clash 는 카메라를 건드리지 않는다
     BattleStage.unitPoint(unitId) // 피해 숫자 띄울 화면 좌표 {x,y} (캐릭터 가슴께)
     BattleStage.relayout() // 바깥 요소(문제 칸 등)가 바뀐 뒤 자리만 다시 잡기
   조작: 배치 단계면 카드 안 놓은 첫 주사위가 자동으로 골라져 손패가 바로 뜬다.
     내 주사위 탭 → 손패에서 카드 탭 → 적 주사위 탭(또는 끌기). 흐트러져 주사위가 없는 적은 캐릭터를 탭하면 {unit, die:null}.
     개막 전까지는 언제든 다시 고를 수 있다. 카드가 놓인 내 주사위 또는 그 화살표를 탭하면 해제(opts.onUnassign || onUnassign).
     고른 카드를 다시 탭하면 선택만 해제. 감정 조건이 안 되는 카드(cardInfo.usable / emotionReq)는 흐리고 고를 수 없다.
   자리: 아래쪽 손패·개막 버튼 몫(가로 약 186px, 세로 손패+개막+상태판 약 360px)은 비워 둔다. 좌우 상태판은 손패 옆 여백.
   배치: 아군 slot 0 앞줄, 1·2 뒷줄 / 적 slot 0~2 앞줄, 3·4 뒷줄. 뒷줄은 작고 어둡게. */
(function(){
  const CSS=`
.bs{position:absolute;inset:0;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}
.bs-floor{position:absolute;left:0;right:0;bottom:0;height:62%;pointer-events:none;
  background:radial-gradient(ellipse 70% 60% at 50% 70%,rgba(230,211,163,.07),transparent 70%)}
.bs-unit{position:absolute;left:var(--x,50%);top:var(--y,80%);transform:translate(-50%,-100%) scale(var(--sc,1));transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center;
  width:var(--uw,76px);filter:brightness(var(--br,1));transition:filter .2s,opacity .3s,left .35s cubic-bezier(.2,.8,.2,1),top .35s cubic-bezier(.2,.8,.2,1);z-index:var(--z,1)}
.bs-unit.nofx{transition:none}
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
.bs-die .bs-x{position:absolute;top:-5px;right:-5px;width:12px;height:12px;border-radius:50%;background:#3a2a10;color:#ffe6a8;font:700 9px/12px system-ui,sans-serif;text-align:center;border:1px solid #c4a35a;pointer-events:none;z-index:1}
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
.bs-emo{display:flex;align-items:center;justify-content:center;gap:2px;margin-top:3px;pointer-events:none}
.bs-emo .pip{width:0;height:0;border-left:3.5px solid transparent;border-right:3.5px solid transparent;border-bottom:6px solid rgba(255,255,255,.18)}
.bs-emo .pip.on{border-bottom-color:#e6c86a;filter:drop-shadow(0 0 3px rgba(230,200,106,.7))}
.bs-emo small{font-size:9px;font-weight:700;color:#e8d5b0;margin-left:2px}
.bs-emo .nxt{font-size:8px;opacity:.8;margin-left:3px;color:#d7c59a;font-variant-numeric:tabular-nums}
.bs-tag{position:absolute;top:-16px;font-size:10px;padding:1px 5px;border-radius:6px;background:#c45c4a;color:#fff;white-space:nowrap}
.bs-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:40;overflow:visible}
.bs-svg .bs-arr-hit{pointer-events:stroke;cursor:pointer;stroke:transparent;fill:none}
.bs-hand{position:absolute;left:50%;bottom:calc(6px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:6px;z-index:50;max-width:calc(100% - 220px);overflow-x:auto;padding:8px 2px 2px;scrollbar-width:none}
.bs-hand::-webkit-scrollbar{display:none}
.bs.port .bs-hand{max-width:calc(100% - 12px)}
.bs-hand:empty{display:none}
.bs-card{flex:0 0 auto;width:84px;min-height:58px;padding:6px 6px 5px;border-radius:9px;background:#14161f;border:1.5px solid #3a4054;color:#e8d5b0;font-size:11px;text-align:left;cursor:pointer;position:relative}
.bs-card .c{position:absolute;top:4px;right:6px;font-weight:800;color:#ffe6a8}
.bs-card .n{display:block;font-weight:700;padding-right:12px;line-height:1.25;margin-bottom:3px}
.bs-card .d{font-size:10px;opacity:.85}
.bs-card.pick{border-color:#ffe6a8;transform:translateY(-6px);box-shadow:0 6px 14px rgba(0,0,0,.5)}
.bs-card.cant{opacity:.4}
.bs-card.used{opacity:.3;pointer-events:none}
.bs-card.emo-lock .emo-need,.bs .hand.bs-fan .cc.emo-lock .emo-need{display:block;position:absolute;left:50%;bottom:6px;transform:translateX(-50%);z-index:2;padding:2px 6px;border-radius:7px;background:rgba(20,14,10,.88);border:1px solid rgba(230,200,106,.55);color:#ffe6a8;font:700 9px/1.2 system-ui,sans-serif;white-space:nowrap;pointer-events:none}
.bs .hand.bs-fan .cc.emo-lock{filter:grayscale(.45) brightness(.78)}
.bs .hand.bs-fan .cc.emo-lock .card.paper{opacity:.72}
/* 흐트러진 적: 캐릭터를 직접 노림 */
.bs-unit.enemy.can-hit .bs-fig{cursor:pointer;border-radius:50%;animation:bsPulse 1s ease-in-out infinite}
.bs-unit.enemy .bs-fig{cursor:default}
/* 합 연출 */
.bs-unit .bs-fig{will-change:transform}
.bs-unit.lunge .bs-fig{animation:bsLunge .42s cubic-bezier(.2,.9,.3,1)}
.bs-unit.flinch .bs-fig{animation:bsFlinch .42s ease-out}
.bs-unit.lose .bs-fig{animation:bsKnock .42s ease-out}
.bs-unit.act .bs-plate .bs-nm{color:#ffe6a8}
.bs-die.act{outline:2px solid #fff3d0;outline-offset:2px;transform:scale(1.18);transition:transform .12s}
@keyframes bsLunge{35%{transform:translate(var(--lx,16px),var(--ly,0))}100%{transform:none}}
@keyframes bsFlinch{30%{transform:translate(calc(var(--lx,16px) * -.5),calc(var(--ly,0px) * -.5)) rotate(var(--tilt,-6deg))}100%{transform:none}}
@keyframes bsKnock{40%{transform:translate(calc(var(--lx,16px) * -.8),calc(var(--ly,0px) * -.8))}100%{transform:none}}
.bs-spark{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;pointer-events:none;z-index:45;border-radius:50%;
  background:radial-gradient(circle,#fff 0 10%,rgba(255,230,168,.9) 18%,rgba(255,170,90,.35) 42%,transparent 66%);animation:bsSpark .38s ease-out forwards}
.bs-spark.one{background:radial-gradient(circle,#fff 0 8%,rgba(255,120,100,.8) 20%,transparent 60%)}
.bs-spark b{position:absolute;left:50%;top:50%;width:70px;height:2px;margin:-1px 0 0 -35px;background:linear-gradient(90deg,transparent,#fff3d0,transparent)}
.bs-spark b:nth-child(2){transform:rotate(60deg)}.bs-spark b:nth-child(3){transform:rotate(-60deg)}
@keyframes bsSpark{0%{transform:scale(.3);opacity:1}70%{opacity:1}100%{transform:scale(1.5);opacity:0}}
@media (prefers-reduced-motion:reduce){.bs-unit.lunge .bs-fig,.bs-unit.flinch .bs-fig,.bs-unit.lose .bs-fig{animation:none}}
.bs .hand.bs-fan{left:calc(208px + env(safe-area-inset-left,0px));right:calc(208px + env(safe-area-inset-right,0px));bottom:calc(8px + env(safe-area-inset-bottom,0px));height:168px;z-index:50}
.bs .hand.bs-fan .cc{width:108px;height:156px;margin:0}
.bs .hand.bs-fan .cc.pick .card.paper{box-shadow:0 0 0 2px #ffe6a8,0 0 18px rgba(255,200,90,.55)}
.bs .hand.bs-fan .cc.used{opacity:.28;filter:grayscale(.6);pointer-events:none}
.bs.port .hand.bs-fan{left:6px;right:6px;height:176px}
.bs-info{position:absolute;z-index:70;pointer-events:none;min-width:120px;max-width:200px;padding:7px 9px 8px;border-radius:10px;background:rgba(14,16,24,.94);border:1px solid #c45c4a;box-shadow:0 8px 20px rgba(0,0,0,.55);color:#e8d5b0;font-size:11px;line-height:1.4;transform:translate(-50%,-100%);animation:bsInfo .12s ease-out}
.bs-info.below{transform:translate(-50%,0)}
.bs-info .i-nm{display:block;font-weight:800;font-size:12px;color:#ffd9cf;margin-bottom:4px}
.bs-info .i-big{font-size:10px;color:#ffb35c;margin-left:4px}
.bs-info .i-d{display:flex;align-items:center;gap:4px;margin:2px 0}
.bs-info .i-d b{color:#fff3d6}
.bs-info .i-t{margin-top:4px;opacity:.8;font-size:10px}
.bs-die.info{box-shadow:0 0 0 2px #ffe6a8}
@keyframes bsInfo{from{opacity:0;margin-top:4px}to{opacity:1;margin-top:0}}
.bs-unit.bg{opacity:.22;filter:brightness(.55)!important}
.bs.focus .bs-svg{opacity:0;transition:opacity .15s}
.result-on .bs-svg,.result-on .bs-info,.result-on .bs-fan,.result-on .bs-hand{display:none!important}
.bs-unit.mb-hl{filter:brightness(1.4) drop-shadow(0 0 14px rgba(255,230,168,.95));z-index:30!important}
.bs.focus .bs-unit.fo{transition:left .3s cubic-bezier(.2,.8,.2,1),top .3s cubic-bezier(.2,.8,.2,1)}
.bs-cam{transition:transform .32s cubic-bezier(.2,.8,.2,1);transform-origin:0 0;will-change:transform}
.bs-cam.fast{transition-duration:.16s}
/* 카메라가 들어가 있는 동안(다가감~빠짐 끝) 손패·개막 버튼·상태판 숨김 */
.bs-cam-on .bs-fan,.bs-cam-on .bs-hand,.bs-cam-on #btn-mb-go,.bs-cam-on .pass-btn,.bs-cam-on .mb-stat{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .12s,visibility 0s .12s}
@media (prefers-reduced-motion:reduce){ .bs-cam{transition:none} }
@media (orientation:landscape) and (max-height:500px){ .bs .hand.bs-fan{height:136px;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:calc(196px + env(safe-area-inset-left,0px));right:calc(196px + env(safe-area-inset-right,0px))} .bs .hand.bs-fan .cc{width:84px;height:122px} }
/* 몸 종류가 있는 적(인간형·기계인간형·꼭두각시형): 온몸 그림이라 조금 크게, 우두머리는 더 크게. 흐트러지면 기울이지 않고 그림이 무너진다 */
.bs-unit.nb{--fh:88px}
.bs-unit.nb.lead{--fh:112px;--uw:86px}
.bs-unit.nb.staggered .bs-fig{transform:none}
.bs-unit.dead.dying{opacity:1;animation:bsDie .35s ease-in 1s forwards}
@keyframes bsDie{to{opacity:0}}
@media (orientation:landscape) and (max-height:500px){ .bs-unit{--fh:62px;--uw:70px} .bs-unit.nb{--fh:72px} .bs-unit.nb.lead{--fh:92px;--uw:80px} .bs-card{width:78px;min-height:50px;font-size:10px} .bs-hand{bottom:4px;padding-top:6px} .bs-emo .pip{border-left-width:3px;border-right-width:3px;border-bottom-width:5px} .bs-card.emo-lock .emo-need,.bs .hand.bs-fan .cc.emo-lock .emo-need{font-size:8px;padding:1px 5px;bottom:4px} }
`;
  const DT={slash:"참",pierce:"관",blunt:"타",guard:"방",evade:"회"};
  let host=null, root=null, last=null, opts={}, sel=null, pickCard=null, drag=null, laidOut=false, info=null, holdT=0, holdT0=null, holdHit=false, focus=null, cam={z:1,x:0,y:0};
  const API={ onAssign:null, onUnassign:null, onSkip:null, clashMs:900, hitAt:400, fastMs:300, fastHitAt:110, stepMs:240, maxClashMs:1600, holdMs:450, camOutMs:320 };
  const runs=new Set(); const liveOwn=r=>[...runs].some(x=>x!==r&&!x.done&&!x.fast);
  const cur={ get done(){ return !runs.size; }, ff(){ runs.forEach(r=>r.ff()); }, skip(){ [...runs].forEach(r=>r.skip()); } };
  let skipAll=false, camOffT=0, holdSkipT=0, holdSkip0=null;

  function injectCss(){ if(document.getElementById("bs-css")) return; const s=document.createElement("style"); s.id="bs-css"; s.textContent=CSS; document.head.appendChild(s); }

  /* slot → 무대 위 자리. 남는 칸(band: 위 y0 ~ 아래 y1, px)을 재서 앞줄은 아래·크게, 뒷줄은 위·작게.
     가로: 아군 왼쪽 / 적 오른쪽. 세로: 적은 위 절반, 아군은 아래 절반. */
  function isLand(){ return !root || root.clientWidth>=root.clientHeight; }
  function band(){
    const H=root.clientHeight, land=isLand(), R=root.getBoundingClientRect();
    const fan=!!opts.cardHtml; const reserve = last&&last.phase==="question" ? 8 : fan ? (land?(H<=500?198:220):360) : (land?66:118);
    let y0=land?44:48, y1=H-reserve;
    const sel=opts.avoid===undefined?"#qpanel.on":opts.avoid, av=sel&&document.querySelector(sel);
    if(av){ const r=av.getBoundingClientRect();
      if(r.height>0&&r.width>R.width*.4){ const top=r.top-R.top, bot=r.bottom-R.top;
        if(top>H*.35) y1=Math.min(y1,top-6); else y0=Math.max(y0,bot+6); } }
    if(y1-y0<120) y1=y0+120;
    return {y0,y1,H,W:root.clientWidth,land};
  }
  function rows(y0,y1,uh){ const front=y1-2; let back=Math.max(y0+uh*.82+2, front-Math.max(uh*.42,(y1-y0)*.34)); if(back>front-uh*.3) back=front-uh*.3; return {front,back}; }
  /* 깊이 t (0=뒤 끝, 1=맨 앞). 모두 같은 바닥 위에 서고, 한 줄로 늘어서지 않게 앞뒤로 엇갈린다. */
  const DEPTH={
    ally:{0:1, 1:.18, 2:.58},
    front:{1:[1],2:[.72,1],3:[.66,1,.86]},
    back:{1:[.1],2:[.06,0]}
  };
  function place(u, n, B, uh){
    const ally=u.side==="ally";
    const back = ally ? u.slot>0 : u.slot>=3;
    let x, t;
    const row = ally?null:(back ? n.back : n.front), k=ally?0:Math.max(0,row.indexOf(u.slot));
    if(ally) t=DEPTH.ally[u.slot]??.6; else { const T=(back?DEPTH.back:DEPTH.front); t=((T[row.length]||T[1])[k]??(back?.15:1)); }
    let r;
    if(B.land){
      r=rows(B.y0,B.y1,uh);
      if(ally){ x = u.slot===0 ? 27 : u.slot===1 ? 15 : 37; }
      else { const X = back ? {1:[79],2:[70,86]} : {1:[78],2:[69,87],3:[63,78,92]}; x=(X[row.length]||X[1])[k]??78; }
    } else {
      const mid=B.y0+(B.y1-B.y0)*.5; r = ally ? rows(mid,B.y1,uh) : rows(B.y0,mid,uh);
      if(ally){ x = u.slot===0 ? 50 : u.slot===1 ? 23 : 77; }
      else { const X = back ? {1:[50],2:[34,66]} : {1:[50],2:[28,72],3:[16,50,84]}; x=(X[row.length]||X[1])[k]??50; }
    }
    const y=r.back+(r.front-r.back)*t;
    return {x:x*B.W/100,y,t,sc:+(.8+.2*t).toFixed(3),br:1,z:1+Math.round(t*10),r};
  }
  /* 바닥(사다리꼴) 위치: 가장 뒤·가장 앞 발 높이 (화면 좌표). 배경 그림이 여기에 맞춰 무대를 깐다. */
  function floorBand(){
    if(!root||!last) return null; const B=band(), n=enemyRows(); const any=root.querySelector(".bs-unit"); const uh=any?any.offsetHeight:120;
    const pl=any&&any.querySelector(".bs-plate"), ph=pl?pl.offsetHeight:26, R=root.getBoundingClientRect();
    if(B.land){ const r=rows(B.y0,B.y1,uh); return {land:true,yb:R.top+r.back-ph*.8-8,yf:R.top+r.front-ph+14,top:R.top,H:R.height}; }
    const mid=B.y0+(B.y1-B.y0)*.5, ra=rows(mid,B.y1,uh), re=rows(B.y0,mid,uh);
    return {land:false,yb:R.top+re.back-ph*.8-8,yf:R.top+ra.front-ph+14,top:R.top,H:R.height};
  }
  /* 합 클로즈업: 합을 치는 사서·적 둘만 무대 가운데로 모이고, 카메라(무대를 감싼 칸)가 그 둘에 다가간다 */
  function focusPos(u,B,uh,p){
    const W=B.W, gap=Math.max(56,Math.min(W*.085,110)), r=B.land?rows(B.y0,B.y1,uh):rows(B.y0+(B.y1-B.y0)*.25,B.y1-(B.y1-B.y0)*.12,uh);
    const cx=W*.5, y=r.front-(r.front-r.back)*.25, ally=u.side==="ally";
    const att=focus.by===u.id, push=focus.kind==="one-sided"&&!att?(ally?-14:14):0;
    return {...p,x:cx+(ally?-gap:gap)+push,y,sc:1,br:1,z:20+(att?2:1)};
  }
  function camEl(){ return opts.camera===undefined ? (host&&host.parentElement) : opts.camera; }
  function applyCam(B,uh){
    const el=camEl(); if(!el) return;
    el.classList.add("bs-cam");
    if(!focus){ cam={z:1,x:0,y:0}; el.style.transform=""; return; }
    const W=B.W, H=B.H, z=B.land?1.38:1.22;
    const r=B.land?rows(B.y0,B.y1,uh):rows(B.y0+(B.y1-B.y0)*.25,B.y1-(B.y1-B.y0)*.12,uh);
    const fy=r.front-(r.front-r.back)*.25-uh*.42, fx=W*.5;
    let tx=W*.5-z*fx, ty=H*.5-z*fy;
    tx=Math.min(0,Math.max(W-z*W,tx)); ty=Math.min(0,Math.max(H-z*H,ty));
    cam={z,x:tx,y:ty}; el.style.transform=`translate(${tx}px,${ty}px) scale(${z})`;
  }
  /* ev = 합/일방 이벤트 {ally, enemy, by, kind}. null 이면 원래 자리·카메라로. fast=true 면 빨리 감기. */
  function setFocus(ev,fast,own){
    ev=normEv(ev);
    const el=camEl(); if(el) el.classList.toggle("fast",!!fast);
    focus = ev&&ev.kind!=="skip"&&ev.ally&&ev.enemy ? {ids:[ev.ally,ev.enemy],by:ev.by&&ev.by.unit,kind:ev.kind,ext:!own} : null;
    if(fast&&focus) focus=null;
    camOn(!!focus,fast);
    if(root&&last) layout();
  }
  /* 손패·버튼 숨김 표시: .battle-stage(없으면 무대 바깥 칸)에 bs-cam-on. 끌 때는 카메라가 다 빠진 뒤 */
  function camHost(){ return host&&(host.closest(".battle-stage")||host.parentElement||host); }
  function camOn(on,fast){
    const h=camHost(); clearTimeout(camOffT); if(!h) return;
    if(on){ h.classList.add("bs-cam-on"); return; }
    if(!h.classList.contains("bs-cam-on")) return;
    camOffT=setTimeout(()=>{ if(!focus) h.classList.remove("bs-cam-on"); },fast?0:API.camOutMs);
  }
  function enemyRows(){ const en=last.units.filter(u=>u.side==="enemy"); return {front:en.filter(u=>u.slot<3).map(u=>u.slot).sort(),back:en.filter(u=>u.slot>=3).map(u=>u.slot).sort()}; }
  function layout(){
    if(!root||!last) return;
    const B=band(), n=enemyRows();
    const any=root.querySelector(".bs-unit"); const uh=any?any.offsetHeight:120;
    for(const u of last.units){ const el=root.querySelector(`.bs-unit[data-unit="${u.id}"]`); if(!el) continue;
      let p=place(u,n,B,uh);
      el.classList.toggle("bg",!!focus&&!focus.ids.includes(u.id)); el.classList.toggle("fo",!!focus&&focus.ids.includes(u.id));
      if(focus&&focus.ids.includes(u.id)) p=focusPos(u,B,uh,p);
      if(!laidOut) el.classList.add("nofx");
      el.style.visibility="";
      el.style.setProperty("--x",p.x+"px"); el.style.setProperty("--y",p.y+"px");
      el.style.setProperty("--sc",p.sc); el.style.setProperty("--br",p.br); el.style.setProperty("--z",p.z);
      el.style.setProperty("--lx",B.land?(u.side==="ally"?"18px":"-18px"):"0px");
      el.style.setProperty("--ly",B.land?"0px":(u.side==="ally"?"-16px":"16px"));
      prevPos[u.id]=p; }
    root.classList.toggle("port",!B.land); root.classList.toggle("focus",!!focus); applyCam(B,uh);
    if(!laidOut){ void root.offsetWidth; root.querySelectorAll(".bs-unit.nofx").forEach(e=>e.classList.remove("nofx")); laidOut=true; }
    drawArrows(); clearTimeout(arrowT); arrowT=setTimeout(drawArrows,380);
    if(opts.onFloor){ const f=floorBand(); if(f) opts.onFloor(f); }
  }
  const prevPos={}, seenHp={}, seenStag={}; let arrowT=0;

  function dieTxt(d){ if(!d) return ""; if(d.min!=null&&d.max!=null) return d.min+"~"+d.max; if(d.baseMin!=null&&d.baseMax!=null) return d.baseMin+"~"+d.baseMax; return ""; }
  function cardMeta(id,u){
    const c=(opts.cards&&opts.cards[id])||{name:id,cost:0,dice:[]};
    const info=opts.cardInfo&&u?opts.cardInfo(id,u.id):null;
    const req=info&&info.emotionReq!=null?info.emotionReq:(c.emotionReq!=null?c.emotionReq:c.emotion||0);
    const hasE=!!(info&&info.emotionReq!=null||c.emotionReq!=null||c.emotion!=null||(u&&u.emotion!=null));
    const usable=info&&typeof info.usable==="boolean"?info.usable:!hasE?true:req<=((u&&u.emotion)||0);
    const dice=info&&info.dice&&info.dice.length?info.dice:c.dice;
    return {c,info,req,usable,reason:info&&info.reason,dice};
  }
  function emoHtml(u){
    if(u.side!=="ally"||u.emotion==null) return "";
    const max=u.emotionMax||5, e=u.emotion||0;
    const ch=u.emotionCharge;
    const need=u.chargesPerEmotion||2;
    const pips=Array.from({length:max},(_,i)=>`<span class="pip${i<e?" on":""}"></span>`).join("");
    const nxt=ch!=null&&e<max?`<span class="nxt">${ch}/${need}</span>`:"";
    return `<div class="bs-emo" role="status" aria-label="감정 ${e}단계${ch!=null&&e<max?` · 다음 ${ch}/${need}`:""}">${pips}<small>${e}</small>${nxt?" "+nxt:""}</div>`;
  }
  function dieHtml(u,i,d){
    const off = u.staggered || u.hp<=0;
    const cls=["bs-die", d.card?"has-card":"", sel&&sel.unit===u.id&&sel.die===i?"sel":"", off?"off":""].join(" ");
    const x=d.card&&u.side==="ally"?`<i class="bs-x" aria-hidden="true">×</i>`:"";
    return `<button class="${cls}" type="button" data-u="${u.id}" data-d="${i}" aria-label="${u.side==="ally"?"내":"적"} 속도 주사위 ${d.speed}${d.card?" (해제)":""}">${d.speed}${x}</button>`;
  }
  function unitHtml(u, n){
    const p=prevPos[u.id], fig = opts.figure ? opts.figure(u) : `<div class="bs-sil"></div>`;
    const canHit = sel&&pickCard&&u.side==="enemy"&&u.hp>0&&!usableDice(u).length;
    const pct=(a,b)=>Math.max(0,Math.min(100,Math.round(100*a/(b||1))));
    const seen=u.id in seenHp, fall=u.staggered&&seen&&!seenStag[u.id], dying=u.hp<=0&&seen&&seenHp[u.id]>0;
    const nb=u.side==="enemy"&&u.body?` nb b-${u.body}${u.leader?" lead":""}`:"";
    return `<div class="bs-unit ${u.side}${nb} ${u.staggered?"staggered":""} ${u.hp<=0?"dead":""} ${fall?"falling":""} ${dying?"dying":""} ${canHit?"can-hit":""}" data-unit="${u.id}"${u.expr?` data-expr="${u.expr}"`:""}
      style="${p?`--x:${p.x}px;--y:${p.y}px;--sc:${p.sc};--br:${p.br};--z:${p.z}`:"visibility:hidden"}">
      ${u.staggered?`<span class="bs-tag">흐트러짐</span>`:""}
      <div class="bs-dice">${(u.dice||[]).map((d,i)=>dieHtml(u,i,d)).join("")}</div>
      <div class="bs-fig">${fig}</div>
      <div class="bs-plate"><div class="bs-nm">${u.name||u.topic||u.id}</div>
        <div class="bs-bar"><i style="width:${pct(u.hp,u.maxHp)}%"></i></div>
        <div class="bs-bar st"><i style="width:${pct(u.stagger,u.maxStagger)}%"></i></div>
        ${u.side==="ally"?`<div class="bs-light">${Array.from({length:u.maxLight||0},(_,k)=>`<b class="${k<u.light?"on":""}"></b>`).join("")}</div>${emoHtml(u)}`:""}
      </div></div>`;
  }
  function usableDice(u){ return (u.dice||[]).map((d,i)=>i).filter(i=>!(u.staggered||u.hp<=0)); }
  /* 같은 카드가 여러 장이면 놓인 장수만큼만 '사용됨' (현재 주사위 카드는 제외) */
  function usedCounts(u,exceptDie){ const m={}; (u.dice||[]).forEach((d,i)=>{ if(d.card&&i!==exceptDie) m[d.card]=(m[d.card]||0)+1; }); return m; }
  function handHtml(){
    if(opts.cardHtml) return fanHtml();
    if(!sel||!last||last.phase!=="assign") return "";
    const u=unit(sel.unit); if(!u||u.side!=="ally") return "";
    const ids=(opts.hands&&opts.hands[u.id])||[]; const used=usedCounts(u,sel.die); const cur=u.dice[sel.die]&&u.dice[sel.die].card;
    let picked=false;
    return ids.map((id,k)=>{ const m=cardMeta(id,u), c=m.c;
      const isUsed=used[id]>0; if(isUsed) used[id]--;
      const isPick=!isUsed&&!picked&&pickCard===id; if(isPick) picked=true;
      const refund=cur&&opts.cards[cur]?opts.cards[cur].cost||0:0;
      const cant=((c.cost||0)>u.light+refund)||!m.usable;
      const lock=(!m.usable)&&!isUsed;
      return `<button class="bs-card ${isPick?"pick":""} ${cant&&!isPick?"cant":""} ${isUsed?"used":""} ${lock?"emo-lock":""}" type="button" data-card="${id}" data-k="${k}">
        <span class="c">${c.cost||0}</span><span class="n">${c.name}</span><span class="d">${(m.dice||[]).map(d=>`${DT[d.type]||d.ko||"?"}${dieTxt(d)}`).join(" ")}</span>${lock?`<span class="emo-need">감정 ${m.req}+</span>`:""}</button>`; }).join("");
  }
  /* 양피지 손패(부채꼴): 그림은 opts.cardHtml(id), 펼치기·문지르기는 opts.onHand(handEl) 가 맡는다 */
  function fanHtml(){
    if(!sel||!last||last.phase!=="assign") return "";
    const u=unit(sel.unit); if(!u||u.side!=="ally") return "";
    const ids=(opts.hands&&opts.hands[u.id])||[]; const used=usedCounts(u,sel.die); const cur=u.dice[sel.die]&&u.dice[sel.die].card;
    let picked=false;
    return ids.map((id,k)=>{ const m=cardMeta(id,u), c=m.c;
      const isUsed=used[id]>0; if(isUsed) used[id]--;
      const isPick=!isUsed&&!picked&&pickCard===id; if(isPick) picked=true;
      const refund=cur&&opts.cards[cur]?opts.cards[cur].cost||0:0;
      const cant=((c.cost||0)>u.light+refund)||!m.usable;
      const lock=(!m.usable)&&!isUsed;
      return `<div class="cc ${isPick?"pick":""} ${(cant&&!isPick)||isUsed?"off":""} ${isUsed?"used":""} ${lock?"emo-lock":""}" data-card="${id}" data-page="${id}" data-k="${k}">${opts.cardHtml(id,u,m)}${lock?`<span class="emo-need">감정 ${m.req}+</span>`:""}</div>`; }).join("");
  }
  function pickCardId(id){
    if(!last||last.phase!=="assign"||!sel) return;
    const el=root&&root.querySelector(`.hand .cc[data-card="${id}"]:not(.used)`); if(el&&el.classList.contains("off")&&!el.classList.contains("pick")) return;
    pickCard = pickCard===id?null:id; render(last);
  }
  /* 적 주사위 정보: 누르면 그 주사위가 쓸 책장 (opts.dieInfo(unit,i) 가 있으면 그 HTML) */
  function infoHtml(u,i){
    const d=u.dice[i]; if(!d) return "";
    if(opts.dieInfo){ const h=opts.dieInfo(u,i,d); if(h) return h; }
    const m=d.card?cardMeta(d.card,u):null, c=m?m.c:null;
    const tg=d.target&&unit(d.target.unit);
    return `<span class="i-nm">${c?c.name:"책장 미정"}</span>${m?(m.dice||[]).map(x=>`<div class="i-d">${DT[x.type]||x.ko||"?"} <b>${dieTxt(x)}</b></div>`).join(""):""}
      <div class="i-t">속도 ${d.speed??"?"}${tg?` · 대상 ${tg.name||tg.id}`:""}</div>`;
  }
  function placeInfo(){
    if(!root) return; let el=root.querySelector(".bs-info");
    const u=info&&unit(info.unit), a=u&&u.hp>0&&dieEl(info.unit,info.die);
    root.querySelectorAll(".bs-die.info").forEach(e=>e.classList.remove("info"));
    if(!a){ if(el) el.remove(); info=null; return; }
    a.classList.add("info");
    if(!el){ el=document.createElement("div"); el.className="bs-info"; root.appendChild(el); }
    el.innerHTML=infoHtml(u,info.die);
    const p=rel(a), r=a.getBoundingClientRect(), w=el.offsetWidth||150, h=el.offsetHeight||70, W=root.clientWidth;
    const below=p.top-h-8<4; el.classList.toggle("below",below);
    el.style.left=Math.max(w/2+4,Math.min(W-w/2-4,p.x))+"px"; el.style.top=(below?p.top+r.height+6:p.top-6)+"px";
  }
  function showInfo(uid,i){ info = info&&info.unit===uid&&info.die===i ? null : {unit:uid,die:i}; placeInfo(); }
  function unit(id){ return last&&last.units.find(u=>u.id===id); }

  function render(battle, o){
    if(!root) throw new Error("BattleStage.mount(host) 먼저");
    last=battle; if(o) opts=o;
    if(battle.phase==="assign") skipAll=false;
    if(sel){ const su=unit(sel.unit); if(!su||su.hp<=0||su.staggered||!su.dice[sel.die]) { sel=null; pickCard=null; } }
    if(battle.phase!=="assign"){ sel=null; pickCard=null; }
    else if(!sel){ /* 빠른 진행: 카드 안 놓은 첫 주사위를 바로 고른다 */
      for(const u of battle.units){ if(u.side!=="ally"||u.hp<=0||u.staggered) continue; const i=(u.dice||[]).findIndex(d=>!d.card); if(i>=0){ sel={unit:u.id,die:i}; pickCard=null; break; } } }
    const n=enemyRows();
    root.innerHTML=`<div class="bs-floor"></div>${battle.units.map(u=>unitHtml(u,n)).join("")}<svg class="bs-svg"></svg>${opts.cardHtml?`<div class="hand bs-fan">${handHtml()}</div>`:`<div class="bs-hand">${handHtml()}</div>`}`;
    if(info&&battle.phase==="resolve") info=null;
    for(const u of battle.units){ seenHp[u.id]=u.hp; seenStag[u.id]=!!u.staggered; }
    markTargets(); layout(); requestAnimationFrame(layout);
    if(opts.cardHtml&&opts.onHand){ const hd=root.querySelector(".hand.bs-fan"); if(hd&&hd.children.length) opts.onHand(hd,API); }
  }
  function rel(el){ const r=el.getBoundingClientRect(), R=root.getBoundingClientRect(), z=cam.z||1; return {x:(r.left-R.left+r.width/2)/z,y:(r.top-R.top+r.height/2)/z,top:(r.top-R.top)/z}; }
  function figEl(uid){ return root.querySelector(`.bs-unit[data-unit="${uid}"] .bs-fig`); }
  function figPt(el){ const r=rel(el), h=el.getBoundingClientRect().height/(cam.z||1); return {x:r.x,y:r.y-h*.1+14,top:r.y-h*.4}; }
  function dieEl(uid,i){ return root.querySelector(`.bs-die[data-u="${uid}"][data-d="${i}"]`); }
  function drawArrows(){
    if(!root||!last) return; const svg=root.querySelector(".bs-svg"); if(!svg) return;
    if(root.closest(".result-on")){ svg.innerHTML=""; info=null; return; }
    let h=`<defs><marker id="bsA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>`;
    const seen=new Set();
    for(const u of last.units){ if(u.hp<=0) continue; (u.dice||[]).forEach((d,i)=>{ if(!d.target) return; const a=dieEl(u.id,i);
      const noDie=d.target.die==null, b=noDie?figEl(d.target.unit):dieEl(d.target.unit,d.target.die); if(!a||!b) return;
      const t=unit(d.target.unit), td=!noDie&&t&&t.dice&&t.dice[d.target.die];
      const clash = td&&td.target&&td.target.unit===u.id&&td.target.die===i;
      const key=[u.id+":"+i,d.target.unit+":"+d.target.die].sort().join("|"); if(clash&&seen.has(key)) return; seen.add(key);
      const p=rel(a), q=noDie?figPt(b):rel(b); const mx=(p.x+q.x)/2, my=Math.min(p.top,q.top)-36-Math.abs(p.x-q.x)*.08;
      const col= clash?"#ffe6a8": u.side==="ally"?"#c4a35a":"#e06a55";
      h+=`<path d="M${p.x} ${p.y-14} Q${mx} ${my} ${q.x} ${q.y-14}" fill="none" stroke="${col}" stroke-width="${clash?2.6:2}" ${clash?"":"stroke-dasharray=\"5 4\""} marker-end="url(#bsA)" ${clash?"marker-start=\"url(#bsA)\"":""} opacity=".92"/>`;
      if(clash) h+=`<circle cx="${mx}" cy="${(my+Math.min(p.y,q.y))/2-6}" r="9" fill="#1a1f2c" stroke="${col}" stroke-width="1.5"/><text x="${mx}" y="${(my+Math.min(p.y,q.y))/2-2}" font-size="10" font-weight="800" text-anchor="middle" fill="${col}">합</text>`;
    }); }
    if(last.phase==="assign"){
      for(const u of last.units){ if(u.side!=="ally"||u.hp<=0) continue; (u.dice||[]).forEach((d,i)=>{ if(!d.card||!d.target) return;
        const a=dieEl(u.id,i); const noDie=d.target.die==null, b=noDie?figEl(d.target.unit):dieEl(d.target.unit,d.target.die); if(!a||!b) return;
        const p=rel(a), q=noDie?figPt(b):rel(b); const mx=(p.x+q.x)/2, my=Math.min(p.top,q.top)-36-Math.abs(p.x-q.x)*.08;
        h+=`<path class="bs-arr-hit" data-u="${u.id}" data-d="${i}" d="M${p.x} ${p.y-14} Q${mx} ${my} ${q.x} ${q.y-14}" fill="none" stroke="transparent" stroke-width="18"/>`;
      }); }
    }
    if(drag&&drag.x!=null){ const a=dieEl(drag.unit,drag.die); if(a){ const p=rel(a); h+=`<path d="M${p.x} ${p.y-14} L${drag.x} ${drag.y}" stroke="#ffe6a8" stroke-width="2.4" fill="none" marker-end="url(#bsA)"/>`; } }
    svg.innerHTML=h;
    placeInfo();
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
  function fireUnassign(uid,i){
    const fn=opts&&typeof opts.onUnassign==="function"?opts.onUnassign:API.onUnassign;
    sel=null; pickCard=null;
    if(fn) fn(uid,i);
    if(last) render(last);
  }
  function onTap(e){
    if(holdHit){ holdHit=false; return; }
    if(cur&&!cur.done){ cur.ff(); if(API.onSkip) API.onSkip(); return; }
    if(last&&last.phase==="resolve"&&API.onSkip){ API.onSkip(); return; }
    if(!last) return;
    const arr=e.target.closest&&e.target.closest(".bs-arr-hit");
    if(arr&&last.phase==="assign"){ const u=unit(arr.dataset.u), i=+arr.dataset.d; if(u&&u.side==="ally"&&u.dice[i]&&u.dice[i].card) fireUnassign(u.id,i); return; }
    const ed=e.target.closest(".bs-unit.enemy .bs-die");
    if(ed&&!(last.phase==="assign"&&sel&&pickCard)){ showInfo(ed.dataset.u,+ed.dataset.d); return; }
    if(info){ info=null; placeInfo(); }
    if(last.phase!=="assign") return;
    const fc=e.target.closest(".hand .cc[data-card]"); if(fc){ pickCardId(fc.dataset.card); return; }
    const card=e.target.closest(".bs-card"); if(card){ if(card.classList.contains("cant")) return; pickCard = pickCard===card.dataset.card?null:card.dataset.card; render(last); return; }
    const die=e.target.closest(".bs-die");
    if(!die){ const eu=e.target.closest(".bs-unit.enemy"); if(eu&&sel&&pickCard){ const u=unit(eu.dataset.unit); if(u&&u.hp>0) assign(bodyTarget(u)); return; }
      if(sel&&pickCard){ pickCard=null; render(last); } return; }
    const u=unit(die.dataset.u), i=+die.dataset.d;
    if(u.side==="ally"){
      if(u.dice[i]&&u.dice[i].card){ fireUnassign(u.id,i); return; }
      sel={unit:u.id,die:i}; pickCard=null;
      render(last); return;
    }
    if(sel&&pickCard) assign({unit:u.id,die:i});
  }
  /* 적 캐릭터를 직접 노릴 때: 주사위가 없으면 die:null, 있으면 나를 노리는 주사위(없으면 첫 주사위) */
  function bodyTarget(u){
    if(!usableDice(u).length) return {unit:u.id,die:null};
    const mine=(u.dice||[]).findIndex(d=>d.target&&sel&&d.target.unit===sel.unit);
    return {unit:u.id,die:mine>=0?mine:0};
  }
  /* 끌기: 카드를 고른 내 주사위를 적 주사위 위로 */
  function onDown(e){
    clearTimeout(holdT);
    if((cur&&!cur.done)||(last&&last.phase==="resolve")) return; const ed=e.target.closest&&e.target.closest(".bs-unit.enemy .bs-die");
    if(ed){ holdT0=[e.clientX,e.clientY]; } if(ed) holdT=setTimeout(()=>{ holdHit=true; info=null; showInfo(ed.dataset.u,+ed.dataset.d); },380);
    const die=e.target.closest(".bs-unit.ally .bs-die"); if(!die||!last||last.phase!=="assign") return;
    if(!(sel&&sel.unit===die.dataset.u&&sel.die===+die.dataset.d&&pickCard)) return;
    drag={unit:die.dataset.u,die:+die.dataset.d,x0:e.clientX,y0:e.clientY,x:null,y:null};
  }
  function onMove(e){ if(holdSkipT&&holdSkip0&&Math.hypot(e.clientX-holdSkip0[0],e.clientY-holdSkip0[1])>24) clearTimeout(holdSkipT); if(holdT&&holdT0&&Math.hypot(e.clientX-holdT0[0],e.clientY-holdT0[1])>8) clearTimeout(holdT); if(!drag) return; if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<8&&drag.x==null) return; const R=root.getBoundingClientRect(); drag.x=e.clientX-R.left; drag.y=e.clientY-R.top; drawArrows(); }
  function onUp(e){
    clearTimeout(holdT); clearTimeout(holdSkipT);
    if(!drag) return; const moved=drag.x!=null; drag=null;
    if(!moved){ drawArrows(); return; }
    const el=document.elementFromPoint(e.clientX,e.clientY); const die=el&&el.closest(".bs-unit.enemy .bs-die:not(.off)");
    const body=!die&&el&&el.closest(".bs-unit.enemy:not(.dead)");
    if(die) assign({unit:die.dataset.u,die:+die.dataset.d}); else if(body){ const u=unit(body.dataset.unit); if(u) assign(bodyTarget(u)); } else drawArrows();
    e.stopPropagation(); root.__noTap=true; setTimeout(()=>root.__noTap=false,0);
  }
  /* 합 연출 중에는 화면 어디를 눌러도: 탭 = 이번 합 빨리 감기, 길게 누르기 = 남은 합 모두 건너뛰기 */
  const busyNow=()=>!!root&&((cur&&!cur.done)||(last&&last.phase==="resolve"));
  function onAnyDown(e){
    clearTimeout(holdSkipT); if(!busyNow()) return;
    holdSkip0=[e.clientX,e.clientY];
    holdSkipT=setTimeout(()=>{ holdSkipT=0; skipHeld=true; skipAll=true; if(cur&&!cur.done) cur.skip(); if(API.onSkip) API.onSkip(); },API.holdMs);
  }
  /* 탭은 pointerup 으로 판단 (터치에서 click 이 안 올 수도 있어서). 뒤따르는 click 은 삼킨다 */
  let eatClickT=0, skipHeld=false;
  function onAnyUp(e){
    const pending=!!holdSkipT&&holdSkip0; clearTimeout(holdSkipT); holdSkipT=0;
    if(skipHeld){ skipHeld=false; eatClickT=Date.now()+500; return; }
    if(!pending||!(cur&&!cur.done)) return;
    if(e&&Math.hypot(e.clientX-holdSkip0[0],e.clientY-holdSkip0[1])>24) return;
    cur.ff(); if(API.onSkip) API.onSkip();
    eatClickT=Date.now()+500;
  }
  function onAnyClick(e){
    if(!root) return;
    if(Date.now()<eatClickT){ eatClickT=0; e.stopPropagation(); e.preventDefault(); return; }
    if(cur&&!cur.done){ e.stopPropagation(); e.preventDefault(); cur.ff(); if(API.onSkip) API.onSkip(); }
  }
  const onResize=()=>{ if(root&&last) render(last); };
  let ro=null;
  function mount(el){
    if(root) unmount();
    injectCss(); host=el; root=document.createElement("div"); root.className="bs"; el.appendChild(root); laidOut=false;
    root.addEventListener("click",e=>{ if(root.__noTap) return; onTap(e); });
    root.addEventListener("pointerdown",onDown); window.addEventListener("pointermove",onMove); window.addEventListener("pointerup",onUp,true);
    window.addEventListener("resize",onResize);
    window.addEventListener("pointerdown",onAnyDown,true); window.addEventListener("pointerup",onAnyUp,true); window.addEventListener("pointercancel",onAnyUp,true); window.addEventListener("click",onAnyClick,true);
    if(window.ResizeObserver){ ro=new ResizeObserver(()=>layout()); ro.observe(root); }
    return root;
  }
  function unmount(){
    { const ce=host&&camEl(); if(ce){ ce.style.transform=""; ce.classList.remove("bs-cam","fast"); } }
    window.removeEventListener("pointermove",onMove); window.removeEventListener("pointerup",onUp,true); window.removeEventListener("resize",onResize);
    window.removeEventListener("pointerdown",onAnyDown,true); window.removeEventListener("pointerup",onAnyUp,true); window.removeEventListener("pointercancel",onAnyUp,true); window.removeEventListener("click",onAnyClick,true);
    if(ro){ ro.disconnect(); ro=null; }
    if(cur&&!cur.done) cur.skip(); clearTimeout(holdSkipT); clearTimeout(camOffT); { const h=camHost(); if(h) h.classList.remove("bs-cam-on"); } skipAll=false;
    if(root){ root.remove(); } root=null; host=null; last=null; sel=null; pickCard=null; drag=null; laidOut=false; info=null; clearTimeout(holdT); clearTimeout(arrowT); focus=null; cam={z:1,x:0,y:0};
    for(const o of [prevPos,seenHp,seenStag]) for(const k in o) delete o[k];
  }
  /* 합/일방 연출: 두 캐릭터가 서로 달려들고 가운데서 불꽃. 진 쪽은 밀려난다. */
  /* 주사위 종류 → 동작 (slash 휘두르기 · pierce 찌르기 · blunt 내려치기 · guard/evade 막기 · 주사위 없는 책장 = page) */
  const KO={"참격":"slash","관통":"pierce","타격":"blunt","방어":"guard","회피":"evade"};
  const mType=t=>KO[t]||(DT[t]?t:null);
  function motionOf(card,die){
    if(die&&typeof die==="object"&&die.type) return mType(die.type);
    const c=typeof card==="string"?(opts.cards&&opts.cards[card]):card; if(!c) return null;
    const ds=c.dice||[]; if(!ds.length) return "page";
    const at=ds.find(d=>["slash","pierce","blunt"].includes(mType(d.type))); return mType((at||ds[0]).type);
  }
  /* 새 이벤트 모양 {a:{unit,die,card}, b|null, steps:[{winner,dmg}]} → 예전 모양 {ally, enemy, allyDie, ...} */
  function normEv(ev){
    if(!ev||!ev.a||ev.ally) return ev;
    const id=x=>x&&typeof x==="object"?x.id:x, side=x=>{ const u=unit(x); return u&&u.side; };
    const aId=id(ev.a.unit), bId=ev.b?id(ev.b.unit):id(((ev.steps||[]).find(s=>s.dmg&&id(s.dmg.unit)!==aId)||{dmg:{}}).dmg.unit);
    const di=d=>typeof d==="number"?d:(d&&typeof d.index==="number"?d.index:null);
    const w=(ev.steps||[]).reduce((m,s)=>(m[s.winner]=(m[s.winner]||0)+1,m),{}), win=(w.a||0)>(w.b||0)?"a":(w.b||0)>(w.a||0)?"b":"tie";
    const aAlly=side(aId)!=="enemy", allyS=aAlly?ev.a:ev.b, enemyS=aAlly?ev.b:ev.a;
    return {...ev,ally:aAlly?aId:bId,enemy:aAlly?bId:aId,allyDie:allyS?di(allyS.die):null,enemyDie:enemyS?di(enemyS.die):null,
      allyCard:allyS&&allyS.card,enemyCard:enemyS&&enemyS.card,allyDieObj:allyS&&allyS.die,enemyDieObj:enemyS&&enemyS.die,
      by:{unit:aId,die:di(ev.a.die)},win:ev.kind==="clash"?(win==="tie"?"tie":((win==="a")===aAlly?"ally":"enemy")):null};
  }
  /* 합 한 번의 연출 전부: 카메라 다가감 → 합(steps 마다 한 번씩 부딪침) → 카메라 빠짐. 끝나면 풀리는 Promise.
     o.fast: 카메라 없이 빨리 (fastMs). 연출 중 탭 = 이번 합 빨리 감기, 길게 누르기 = 다음 배치 전까지 남은 합 모두 즉시.
     바깥에서 BattleStage.focus(ev) 로 이미 카메라를 맞춰 둔 경우(예전 흐름)엔 부딪침만 하고 카메라는 건드리지 않는다. */
  function clash(ev,o){
    ev=normEv(ev); o=o||{};
    if(!root||!ev||ev.kind==="skip"||skipAll) return Promise.resolve();
    const ue=id=>root&&root.querySelector(`.bs-unit[data-unit="${id}"]`);
    if(!ue(ev.ally)||!ue(ev.enemy)) return Promise.resolve();
    const ext=!!(focus&&focus.ext&&focus.ids.includes(ev.ally)&&focus.ids.includes(ev.enemy));
    const steps=Array.isArray(ev.steps)&&ev.a&&ev.steps.length?ev.steps:[null];
    const run={done:false,fast:!!o.fast,wake:null}; runs.add(run);
    const sleep=ms=>new Promise(r=>{ if(run.done||ms<=0) return r(); const t=setTimeout(()=>{ run.wake=null; r(); },ms); run.wake=()=>{ clearTimeout(t); run.wake=null; r(); }; });
    run.ff=()=>{ if(run.fast) return; run.fast=true; if(!ext&&focus&&!focus.ext) setFocus(null,true,true); if(run.wake) run.wake(); };
    let fin; const p=new Promise(r=>fin=r);
    run.skip=()=>{ if(run.done) return; run.done=true; if(run.wake) run.wake(); if(!ext&&focus&&!focus.ext&&!liveOwn(run)) setFocus(null,true,true); runs.delete(run); fin(); };
    (async()=>{
      const n=steps.length, gap=n>1?Math.min(API.stepMs,Math.max(80,(API.maxClashMs-API.clashMs)/(n-1))):0;
      if(!ext&&!run.fast){ setFocus(ev,false,true); }
      if(!ext) await sleep(run.fast?API.fastHitAt:API.hitAt);
      for(let k=0;k<n&&!run.done;k++){
        if(k) await sleep(run.fast?Math.min(60,gap):gap); if(run.done) break;
        hit(ev,steps[k],ue);   /* 카메라를 바깥에서 맞춰 둔 경우 첫 부딪침은 부르는 즉시(예전처럼) */
      }
      if(run.done) return;
      const res=ev.result||{};
      (res.staggered||[]).forEach(id=>{ const el=ue(id); if(!el) return; el.classList.add("staggered"); if(!el.querySelector(".bs-tag")){ const tag=document.createElement("span"); tag.className="bs-tag"; tag.textContent="흐트러짐"; el.prepend(tag); } });
      (res.dead||[]).forEach(id=>{ const el=ue(id); if(el) el.classList.add("dead","dying"); });
      const tail=run.fast?API.fastMs-API.fastHitAt:API.clashMs-API.hitAt;
      if(!ext){ await sleep(Math.max(0,tail-API.camOutMs)); if(focus&&!focus.ext&&!run.done&&!liveOwn(run)) setFocus(null,run.fast,true); await sleep(run.fast?0:API.camOutMs); }
      else await sleep(Math.min(tail,API.clashMs-API.hitAt));
      run.done=true; runs.delete(run);
      if(focus&&!focus.ext&&!liveOwn(run)) setFocus(null,false,true);   /* 겹쳐 부른 경우: 마지막 연출이 카메라를 뺀다 */
      fin();
    })();
    return p;
  }
  /* 부딪침 한 번 (step 없으면 이벤트 전체 승패로) */
  function hit(ev,st,ue){
    const A=ue(ev.ally), E=ue(ev.enemy); if(!A||!E) return;
    if(st&&ev.kind==="clash"){ const aAlly=ev.by&&ev.by.unit===ev.ally; const w=st.winner==="a"?(aAlly?"ally":"enemy"):st.winner==="b"?(aAlly?"enemy":"ally"):"tie"; ev={...ev,win:w}; }
    const attacker=ev.by&&ev.by.unit===ev.enemy?E:A, target=attacker===A?E:A;
    const fx=(el,c)=>{ el.classList.remove("lunge","flinch","lose","act"); void el.offsetWidth; el.classList.add(c,"act"); setTimeout(()=>el.classList.remove(c,"act"),460); };
    const dies=[[ev.ally,ev.allyDie],[ev.enemy,ev.enemyDie]].map(([u,i])=>i!=null&&dieEl(u,i)).filter(Boolean);
    dies.forEach(d=>{ d.classList.add("act"); setTimeout(()=>d.classList.remove("act"),460); });
    if(ev.kind==="clash"){ fx(A,ev.win==="enemy"?"lose":"lunge"); fx(E,ev.win==="ally"?"lose":"lunge"); }
    else { fx(attacker,"lunge"); fx(target,"flinch"); }
    /* 그림 동작: 주사위 종류별 m-*, 표정은 잠깐 이김(e3)/아픔(e1) */
    const mv=(el,m)=>{ if(!m) return; el.classList.remove("m-slash","m-pierce","m-blunt","m-guard","m-evade","m-page"); void el.offsetWidth; el.classList.add("m-"+m); setTimeout(()=>el.classList.remove("m-"+m),640); };
    const mA=(ev.allyCard||ev.allyDieObj)!=null?motionOf(ev.allyCard,ev.allyDieObj):null, mE=(ev.enemyCard||ev.enemyDieObj)!=null?motionOf(ev.enemyCard,ev.enemyDieObj):null;
    mv(A,mA); mv(E,mE);
    const face=(el,ex)=>{ const sv=el.querySelector("svg.gxn"); if(!sv||sv.classList.contains("down")) return; const was=sv.dataset.ex; sv.dataset.ex=ex; setTimeout(()=>{ if(sv.isConnected&&sv.dataset.ex===ex) sv.dataset.ex=was; },700); };
    const EX={idle:"e0",hurt:"e1",shock:"e2",win:"e3"};
    const applyEx=(id,name)=>{ const el=ue(id); if(!el||!name) return; face(el,EX[name]||name); el.dataset.expr=name; };
    if(st&&st.expr){ Object.entries(st.expr).forEach(([id,ex])=>applyEx(id,ex)); }
    else if(ev.expr){ Object.entries(ev.expr).forEach(([id,ex])=>applyEx(id,ex)); }
    else if(ev.a&&ev.a.expr){ applyEx(ev.a.unit&&(ev.a.unit.id||ev.a.unit),ev.a.expr); if(ev.b&&ev.b.expr) applyEx(ev.b.unit&&(ev.b.unit.id||ev.b.unit),ev.b.expr); }
    else if(ev.kind==="clash"){ if(ev.win==="ally"){ face(E,"e1"); } else if(ev.win==="enemy"){ face(E,"e3"); } }
    else if(target===E) face(E,"e1"); else face(E,"e3");
    const fa=figPt(A.querySelector(".bs-fig")), fe=figPt(E.querySelector(".bs-fig"));
    const sp=document.createElement("div"); sp.className="bs-spark"+(ev.kind==="clash"?"":" one"); sp.innerHTML="<b></b><b></b><b></b>";
    const at=ev.kind==="clash"?{x:(fa.x+fe.x)/2,y:(fa.y+fe.y)/2}:(target===A?fa:fe);
    sp.style.left=at.x+"px"; sp.style.top=at.y+"px"; root.appendChild(sp); setTimeout(()=>sp.remove(),420);
  }
  function unitPoint(id){ if(!root) return null; const f=figEl(id); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height*.3}; }
  Object.assign(API,{mount,unmount,render,place,relayout:layout,clash,unitPoint,floor:floorBand,focus:setFocus,redraw:drawArrows,pickCard:pickCardId,showInfo,_state:()=>({sel,pickCard,info})});
  window.BattleStage=API;
})();
