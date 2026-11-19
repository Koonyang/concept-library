/* 전투 화면(DOM, 무대 위). 규칙은 Game.battle, 그림은 stage.
   mountBattle(root, stage, guestId, {onEnd}) → {unmount()}
   막 진행: 문제 → 답 → 배정(내 주사위 → 카드 → 적) → [개막] → 교환마다 stage.play → 다음 막 | 끝(settle → onEnd(result))
   연출 중: 화면 탭 = 남은 교환 빨리 감기, 450ms 이상 누르기 = 막 끝까지 건너뛰기 */
import { sfx } from "./sfx.js";

const HOLD_MS = 450;
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TYPE_KO = { slash: "참격", pierce: "관통", blunt: "타격", guard: "방어", evade: "회피" };

export async function mountBattle(root, stage, guestId, { onEnd } = {}) {
  const G = window.Game, B = () => G.battle.state;
  const res = G.battle.begin(guestId);
  if (!res.ok) { root.innerHTML = `<div id="status"><span class="msg bad">${esc(res.why)}</span></div>`; return { unmount() { root.innerHTML = ""; }, error: res.why }; }
  const guest = G.data.GUEST_BY[guestId], floor = G.data.floorStage(guest.floorId);
  root.dataset.screen = "battle"; root.style.setProperty("--accent", floor.accent);
  root.innerHTML = `
    <div id="hud-bars"><div class="side ally"></div><div class="side enemy"></div></div>
    <svg id="target-arrows" aria-hidden="true"></svg>
    <div id="dice-layer"></div>
    <div id="status"><span class="scene num"></span><span class="guest"></span><span class="msg"></span></div>
    <div id="learn" role="note"></div>
    <div id="enemy-info" role="note" aria-live="polite"></div>
    <div id="clash-panel" aria-live="polite"></div>
    <div id="question" aria-live="polite"></div>
    <div id="hand" hidden><div class="info"></div><div class="cards"></div></div>
    <button id="btn-open" type="button" hidden>개막</button>
    <div id="skip-layer"><span class="hint">탭: 빨리 · 길게: 건너뛰기</span></div>`;
  const $ = s => root.querySelector(s);
  const el = { bars: $("#hud-bars"), arrows: $("#target-arrows"), dice: $("#dice-layer"), status: $("#status"), learn: $("#learn"), info: $("#enemy-info"), clash: $("#clash-panel"), q: $("#question"), hand: $("#hand"), open: $("#btn-open"), skip: $("#skip-layer") };
  let sel = null, selCard = null, busy = false, alive = true, raf = 0, barSnap = null, msgT = 0;

  await stage.setUnits(B().units, guest);

  /* ---------- 그리기 ---------- */
  const units = side => B().units.filter(u => !side || u.side === side);
  const liveAllies = () => units("ally").filter(u => u.hp > 0);
  function setMsg(text, cls, ms) { const m = el.status.querySelector(".msg"); m.textContent = text || ""; m.className = "msg " + (cls || ""); clearTimeout(msgT); if (ms) msgT = setTimeout(() => setMsg(""), ms); }
  function renderStatus() { el.status.querySelector(".scene").textContent = `${B().scene}막`; el.status.querySelector(".guest").textContent = guest.concept; }

  function renderBars(snap) {
    for (const side of ["ally", "enemy"]) {
      const box = el.bars.querySelector(".side." + side);
      box.innerHTML = units(side).map(u => { const s = snap && snap[u.id] || u, hp = Math.max(0, s.hp), st = Math.max(0, s.stagger);
        const hot = sel && sel.unit === u.id ? " hot" : "";
        return `<div class="unit-bar ${side}${hp <= 0 ? " dead" : ""}${s.staggered ? " stag" : ""}${hot}" data-unit="${u.id}">
          <span class="nm">${esc(u.name)}${u.leader ? " ★" : ""}</span><span class="v num">${hp}/${u.maxHp}</span>
          <span class="bars"><span class="hp"><i style="transform:scaleX(${(hp / u.maxHp).toFixed(3)})"></i></span><span class="st"><i style="transform:scaleX(${(st / u.maxStagger).toFixed(3)})"></i></span></span></div>`; }).join("");
    }
  }
  const snapUnits = () => Object.fromEntries(B().units.map(u => [u.id, { hp: u.hp, stagger: u.stagger, staggered: u.staggered }]));

  function renderDice() {
    const phase = B().phase;
    el.dice.innerHTML = units().filter(u => u.hp > 0).map(u => {
      const chips = u.dice.map((d, i) => {
        const cls = ["speed-die"]; if (u.side === "ally" && d.card) cls.push("set"); if (sel && sel.unit === u.id && sel.die === i) cls.push("sel");
        if (u.side === "enemy" && selCard) cls.push("can-target");
        return `<button type="button" class="${cls.join(" ")}" data-unit="${u.id}" data-die="${i}" data-side="${u.side}" aria-label="${esc(u.name)} 속도 ${d.speed}">${d.speed}</button>`; }).join("");
      const tgt = u.side === "enemy" && !u.dice.length && phase === "assign" ? `<button type="button" class="enemy-target${selCard ? " can-target" : ""}" data-unit="${u.id}" aria-label="${esc(u.name)} 노리기"></button>` : "";
      return `<div class="die-row" data-unit="${u.id}">${chips}</div>${tgt}`; }).join("");
    placeDice();
  }
  /* 머리 위 좌표(무대) — 무대가 없으면 화면 왼쪽/오른쪽 가운데에 세운다 */
  function pointOf(id) {
    const p = stage.unitPoint && stage.unitPoint(id); if (p) return p;
    const u = B().units.find(x => x.id === id), list = units(u.side), i = list.indexOf(u), r = root.getBoundingClientRect();
    return { x: r.width * (u.side === "ally" ? 0.22 : 0.78) + (i - 1) * 60, y: r.height * 0.42 + (i % 2) * 30 };
  }
  /* 정수 px 로만, 1px 넘게 움직였을 때만 옮긴다(카메라가 천천히 흔들려도 주사위가 떨지 않게) */
  function setPos(n, x, y) { x = Math.round(x); y = Math.round(y); const ox = +n.dataset.x, oy = +n.dataset.y;
    if (n.dataset.x != null && Math.abs(ox - x) <= 1 && Math.abs(oy - y) <= 1) return; n.dataset.x = x; n.dataset.y = y; n.style.left = x + "px"; n.style.top = y + "px"; }
  /* 막대 묶음 아래쪽 경계(주사위·화살표가 막대와 겹치지 않게) */
  function barsFloor(xL, xR) {
    let y = 0; const tops = [...el.bars.querySelectorAll(".side"), el.status, el.learn.classList.contains("on") ? el.learn : null, el.info.classList.contains("on") ? el.info : null];
    for (const s of tops) { if (!s) continue; const r = s.getBoundingClientRect(), m = s === el.info ? 80 : 0;   /* 정보창은 양옆 80px 까지: 화살표가 모서리를 스치지 않게 */
      if (r.width && r.top < innerHeight * 0.5 && xR > r.left - m && xL < r.right + m) y = Math.max(y, r.bottom); }
    return y;
  }
  /* 머리 위에 두되: 화면 안으로, 위쪽 막대·상태판 아래로, 다른 유닛의 주사위 줄과 안 겹치게 */
  function placeDice() {
    const rows = [...el.dice.querySelectorAll(".die-row")], W = innerWidth, placed = [];
    const want = rows.map(row => { const p = pointOf(row.dataset.unit), w = row.offsetWidth || 30, h = row.offsetHeight || 24;
      let x = Math.min(Math.max(p.x, w / 2 + 6), W - w / 2 - 6), y = p.y;               /* (x, y) = 줄의 가운데 아래 */
      return { row, x, y, w, h }; }).sort((a, b) => a.y - b.y);
    for (const r of want) {
      const floor = barsFloor(r.x - r.w / 2, r.x + r.w / 2) + 4; if (r.y - r.h < floor) r.y = floor + r.h;
      for (let k = 0; k < 6; k++) { const hit = placed.find(o => Math.abs(o.x - r.x) < (o.w + r.w) / 2 + 3 && Math.abs(o.y - r.y) < (o.h + r.h) / 2 + 3);
        if (!hit) break; r.y = hit.y + hit.h + 4; }
      placed.push(r); setPos(r.row, r.x, r.y);
    }
    for (const t of el.dice.querySelectorAll(".enemy-target")) { const p = pointOf(t.dataset.unit); setPos(t, p.x, p.y); }
  }
  function centerOf(unit, die) {
    const n = die == null ? el.dice.querySelector(`.die-row[data-unit="${unit}"]`) : el.dice.querySelector(`.speed-die[data-unit="${unit}"][data-die="${die}"]`);
    if (!n) { const p = pointOf(unit); return p; }
    const r = n.getBoundingClientRect(); if (!r.width) { const p = pointOf(unit); return p; } return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function drawArrows() {
    const st = B(); if (!st || busy || st.phase !== "assign") { el.arrows.innerHTML = ""; return; }
    const paths = [];
    for (const u of st.units) { if (u.hp <= 0) continue; u.dice.forEach((d, i) => { if (!d.target) return; if (u.side === "ally" && !d.card) return;
      const a = centerOf(u.id, i), b = centerOf(d.target.unit, d.target.die), lift = Math.max(30, Math.abs(b.x - a.x) * 0.22);
      /* 곡선 꼭대기(≈(a.y+2c+b.y)/4)가 막대 아래에 머물도록 */
      const lim = barsFloor(Math.min(a.x, b.x), Math.max(a.x, b.x)) + 8;
      let cy = Math.min(a.y, b.y) - lift; cy = Math.max(cy, 2 * lim - (a.y + b.y) / 2);
      const cls = G.battle.isClash(u.id, i) ? "clash" : u.side;
      paths.push(`<path class="${cls}" d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${((a.x + b.x) / 2).toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}"/>`); }); }
    el.arrows.innerHTML = paths.join("");
  }

  function renderHand() {
    const st = B(); const show = st.phase === "assign" && !busy;
    el.hand.hidden = !show; el.open.hidden = !show; el.open.disabled = busy;
    if (!show) return;
    const uid = (sel && sel.unit) || (liveAllies()[0] || {}).id; if (!uid) return;
    const u = st.units.find(x => x.id === uid), L = G.battle.lightOf ? G.battle.lightOf(uid) : { light: u.light, maxLight: u.maxLight, emotion: u.emotion };
    el.hand.querySelector(".info").innerHTML = `<span>${esc(u.name)}</span><span>빛 <b>${L.light}</b>/${L.maxLight}</span><span>감정 <b>${L.emotion || 0}</b></span>`;
    el.hand.querySelector(".cards").innerHTML = G.battle.hand(uid).map((cid, k) => { const c = G.battle.cardInfo(cid, uid) || {}, P = G.data.PAGE_BY[cid] || {};
      const dice = (c.dice || []).map(d => { const ko = d.ko || TYPE_KO[d.type] || d.type; return `<span class="t-${ko}">${ko} ${d.min}~${d.max}</span>`; }).join("");
      const dis = c.usable === false ? " disabled" : "", s = selCard === cid ? " sel" : "";
      return `<button type="button" class="card r-${P.rarity || "N"}${dis}${s}" data-card="${esc(cid)}" data-k="${k}" title="${esc(c.text)}"><span class="nm">${esc(c.name)}</span><span class="dice">${dice}</span>
        <span class="cost"><span>빛 ${c.cost}</span><span>${c.emotionReq ? "감정 " + c.emotionReq : ""}</span></span></button>`; }).join("");
  }

  function renderQuestion() {
    const st = B();
    if (st.phase !== "question" || busy) { el.q.classList.remove("on"); el.q.innerHTML = ""; return; }
    const info = G.battle.questionInfo ? G.battle.questionInfo() : null, q = (info && info.q) || G.battle.question(); if (!q) return;
    const from = st.units.find(u => u.id === ((info && info.fromUnit) || (st.question && st.question.fromUnit)));
    const isKey = info ? info.isKey : /-k\d+$/.test(q.id || "");
    let body;
    if (q.type === "short") body = `<form><input id="q-short" autocomplete="off" enterkeyhint="done" placeholder="답을 적어 줘"><button id="q-submit" type="submit">확인</button></form>`;
    else body = `<div class="opts${q.type === "ox" ? " ox" : ""}">${(q.options || []).map((o, i) => `<button type="button" class="q-opt" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
    el.q.innerHTML = `<div class="who">${from ? `<b>${esc(from.name)}</b>의 질문` : ""}${isKey ? `<span class="key">핵심 문제</span>` : ""}</div><div class="prompt">${esc(q.prompt)}</div>${body}`;
    el.q.classList.add("on");
  }

  function render() {
    if (!alive) return;
    renderStatus(); renderBars(barSnap); renderQuestion(); renderHand(); renderDice(); drawArrows();
    el.skip.classList.toggle("on", busy);
  }

  /* ---------- 문제 ---------- */
  function submit(correct, shown, typed) {
    if (busy || B().phase !== "question") return;
    const q = G.battle.question();
    G.battle.answer(correct);
    el.learn.classList.remove("on", "open");
    if (correct) { sfx.correct(); setMsg("정답 · 이번 막 내 주사위가 커져", "good", 3500); }
    else {
      sfx.wrong(); setMsg("오답 · 이번 막 내 주사위가 작아져", "bad", 3500);
      if (stage.wrongBonk) stage.wrongBonk().catch(() => {});   /* 사서 머리에 책이 떨어지고 화면이 짧게 흔들림(옛 결정) */
      const ans = q.type === "short" ? q.answer : (q.options || [])[q.correctIndex];
      el.learn.innerHTML = `<b>정답 · ${esc(ans)}${typed ? ` <span style="color:var(--muted);font-weight:400">(내 답 · ${esc(typed)})</span>` : ""}</b><p>${esc(guest.explanation)}</p>`;
      el.learn.classList.add("on");
    }
    sel = firstEmptyDie(); selCard = null; render();
  }
  el.q.addEventListener("click", e => {
    const b = e.target.closest(".q-opt"); if (!b) return;
    const q = G.battle.question(), i = +b.dataset.i, ok = i === q.correctIndex;
    b.classList.add(ok ? "ok" : "no"); submit(ok);
  });
  el.q.addEventListener("submit", e => {
    e.preventDefault(); const q = G.battle.question(), v = $("#q-short").value.trim(); if (!v) return;
    const check = G.checkShort || window.checkShort; submit(!!check(v, q), true, v);
  });
  el.learn.addEventListener("click", () => el.learn.classList.toggle("open"));

  /* ---------- 합 표시: 양쪽 책장 · 단계마다 주사위 종류·나온 값 · 승패 · 피해 (내 쪽은 늘 왼쪽) ---------- */
  const RES = { win: "승", lose: "패", draw: "무승부", block: "막음", evade: "회피", none: "" };
  let clashT = 0;
  function showClash(ev, isFast) {
    const st = B(), uA = st.units.find(u => u.id === ev.a.unit), allyFirst = uA && uA.side === "ally";
    const L = allyFirst ? "a" : "b", Rk = allyFirst ? "b" : "a";
    const side = k => { const x = ev[k]; if (!x) return null; const u = st.units.find(q => q.id === x.unit), c = G.battle.cardInfo(x.card, x.unit) || {}; return { u, name: c.name || "?", big: c.big }; };
    const left = side(L), right = side(Rk), tgt = st.units.find(u => u.id === ev.target);
    /* 대응 주사위가 없는 쪽(일방 공격을 받는 쪽): 맞는 유닛 이름 + "대응 없음" */
    const head = (o, cls) => o ? `<div class="cp-side ${cls}"><span class="who">${esc(o.u ? o.u.name : "")}</span><b>${esc(o.name)}</b>${o.big ? `<em>큰 일격</em>` : ""}</div>` : `<div class="cp-side ${cls} none"><span class="who">${esc(tgt ? tgt.name : "")}</span><b>대응 없음</b></div>`;
    const die = (d, r) => d ? `<span class="t-${d.type}">${d.type} <span class="num rng">${d.min}~${d.max}</span> ▸ <b class="num val">?</b></span>${r ? `<i class="res r-${r}" hidden>${RES[r] || ""}</i>` : ""}` : `<span class="muted">—</span>`;
    const rows = (ev.steps || []).map((s, i) => {
      const dl = s[L + "Die"], dr = s[Rk + "Die"], rl = s[L + "Result"], rr = s[Rk + "Result"];
      const parts = [];
      if (s.dmg) { const du = st.units.find(u => u.id === s.dmg.unit); parts.push(`${esc(du ? du.name : "")} 체력 -${s.dmg.hp}${s.dmg.stagger ? ` · 흐트러짐 -${s.dmg.stagger}` : ""}`); }
      if (s.blocked) parts.push(`${s.blocked} 막음`); if (s.recovered) parts.push(`흐트러짐 +${s.recovered} 회복`);
      if (!parts.length) parts.push(rl === "draw" ? "무승부 · 피해 없음" : "피해 없음");
      return `<li class="cp-step" data-i="${i}" data-l="${dl ? dl.value : ""}" data-r="${dr ? dr.value : ""}"><div class="cp-dice"><span class="l">${die(dl, rl)}</span><span class="vs num">${i + 1}</span><span class="r">${die(dr, rr)}</span></div><p class="cp-out" hidden>${parts.join(" · ")}</p></li>`; }).join("");
    el.clash.innerHTML = `<div class="cp-head">${head(left, "l")}<span class="cp-vs">${ev.kind === "clash" ? "VS" : "일방"}</span>${head(right, "r")}</div><ol class="cp-steps">${rows}</ol>`;
    el.clash.classList.add("on");
    clearTimeout(clashT); clashT = setTimeout(() => revealClash(), isFast ? 140 : 420);   /* 맞는 순간(약 40%)에 숫자 공개 */
  }
  function revealClash(i) {
    for (const li of el.clash.querySelectorAll(".cp-step")) { if (i != null && +li.dataset.i > i) continue;
      const vl = li.querySelector(".l .val"), vr = li.querySelector(".r .val"); if (vl) vl.textContent = li.dataset.l; if (vr) vr.textContent = li.dataset.r;
      li.querySelectorAll("[hidden]").forEach(x => x.hidden = false); li.classList.add("shown"); }
  }
  function hideClash() { clearTimeout(clashT); el.clash.classList.remove("on"); el.clash.innerHTML = ""; }

  /* ---------- 적 주사위 정보(책장을 안 고른 상태에서 누르면): 이번 막에 쓸 책장·주사위·속도·대상 ---------- */
  function showEnemyInfo(uid, die) {
    const st = B(), u = st.units.find(x => x.id === uid), d = u && u.dice[die]; if (!d) return;
    const c = G.battle.cardInfo(d.card, uid) || {}, t = d.target && st.units.find(x => x.id === d.target.unit);
    const td = t && d.target.die != null && t.dice[d.target.die];
    const dice = (c.dice || []).map(x => { const ko = x.ko || TYPE_KO[x.type] || x.type; return `<span class="t-${ko}">${ko} <b class="num">${x.min}~${x.max}</b></span>`; }).join(" · ");
    el.learn.classList.remove("on");
    el.info.innerHTML = `<div class="ei-head"><b>${esc(u.name)}</b><span class="num">속도 ${d.speed}</span>${c.big ? `<em>큰 일격</em>` : ""}</div>
      <p class="ei-card">${esc(c.name || "?")}</p><p class="ei-dice">${dice}</p>
      <p class="ei-target">${t ? `노림 → <b>${esc(t.name)}</b>${td ? ` 의 속도 ${td.speed} 주사위` : ""}${G.battle.isClash(uid, die) ? " · <b>합</b>" : ""}` : "노리는 대상 없음"}</p>`;
    el.info.dataset.unit = uid; el.info.dataset.die = die; el.info.classList.add("on"); sfx.tap();
  }
  const hideInfo = () => el.info.classList.remove("on");
  root.addEventListener("pointerdown", e => { if (el.info.classList.contains("on") && !e.target.closest(".speed-die[data-side=\"enemy\"], #enemy-info")) hideInfo(); }, true);

  /* ---------- 배정 ---------- */
  function firstEmptyDie() { for (const u of liveAllies()) { const i = u.dice.findIndex(d => !d.card); if (i >= 0) return { unit: u.id, die: i }; } return null; }
  el.dice.addEventListener("click", e => {
    if (busy || B().phase !== "assign") return;
    const chip = e.target.closest(".speed-die, .enemy-target"); if (!chip) return;
    const uid = chip.dataset.unit, die = chip.dataset.die == null ? null : +chip.dataset.die, u = B().units.find(x => x.id === uid);
    if (u.side === "ally") {
      if (u.dice[die].card) { G.battle.unassign(uid, die); sfx.tap(); sel = { unit: uid, die }; selCard = null; }
      else { sel = { unit: uid, die }; selCard = null; sfx.tap(); }
      render(); return;
    }
    if (!selCard) { if (die != null) showEnemyInfo(uid, die); else setMsg("책장을 먼저 골라 줘", "", 1800); return; }
    if (!sel) { setMsg("내 주사위를 먼저 골라 줘", "", 1800); return; }
    const r = G.battle.assign(sel.unit, sel.die, selCard, { unit: uid, die });
    if (!r.ok) { setMsg(r.reason === "light" ? "빛이 모자라" : r.reason === "emotion" ? "감정 단계가 모자라" : "놓을 수 없어", "bad", 1800); return; }
    sfx.tap(); selCard = null; sel = firstEmptyDie() || sel; render();
  });
  el.hand.addEventListener("click", e => {
    const c = e.target.closest(".card"); if (!c || busy) return;
    if (c.classList.contains("disabled")) { setMsg("지금은 못 쓰는 책장이야", "", 1500); return; }
    if (!sel) sel = firstEmptyDie(); if (!sel) return;
    selCard = c.dataset.card; sfx.tap();
    /* 노릴 적이 하나뿐이면 바로 놓는다 */
    const targets = units("enemy").filter(u => u.hp > 0);
    if (targets.length === 1 && targets[0].dice.length <= 1) {
      const r = G.battle.assign(sel.unit, sel.die, selCard, { unit: targets[0].id, die: targets[0].dice.length ? 0 : null });
      if (r.ok) { selCard = null; sel = firstEmptyDie() || sel; }
    }
    render();
  });

  /* ---------- 개막 ---------- */
  let fast = false, skipAll = false, holdT = 0;
  el.skip.addEventListener("pointerdown", () => { clearTimeout(holdT); holdT = setTimeout(() => { holdT = 0; skipAll = true; stage.finishNow(); }, HOLD_MS); });
  el.skip.addEventListener("pointerup", () => { if (holdT) { clearTimeout(holdT); holdT = 0; fast = true; } });
  el.skip.addEventListener("pointercancel", () => { clearTimeout(holdT); holdT = 0; });

  function floatNum(uid, text, cls) {
    const p = pointOf(uid); if (!p) return; const n = document.createElement("div"); n.className = "float-num " + cls; n.textContent = text;
    n.style.left = p.x + "px"; n.style.top = (p.y - 26) + "px"; root.appendChild(n); setTimeout(() => n.remove(), 950);
  }
  async function runOpen() {
    if (busy || B().phase !== "assign") return;
    const R = G.battle.stepBegin(); if (!R) return;
    busy = true; fast = false; skipAll = false; sel = null; selCard = null; el.learn.classList.remove("on"); hideInfo();
    barSnap = snapUnits(); render();
    for (;;) {
      const before = snapUnits();
      const ev = G.battle.stepNext(R); if (!ev) break;
      if (ev.kind === "skip") continue;
      if (skipAll) { barSnap = null; continue; }
      barSnap = before; renderBars(barSnap);
      sfx.clash(); showClash(ev, fast);
      try { await stage.play(ev, { fast: fast || skipAll, final: G.battle.outcome === "win", onHit: i => { revealClash(i);
        const s = ev.steps[i]; if (!s || !s.dmg) return; const side = (B().units.find(u => u.id === s.dmg.unit) || {}).side;
        sfx.hit(); if (s.dmg.hp) floatNum(s.dmg.unit, "-" + s.dmg.hp, "hp" + (side === "ally" ? " ally" : "")); if (s.dmg.stagger) floatNum(s.dmg.unit, "-" + s.dmg.stagger, "st");
        barSnap = null; renderBars(); } });
      } catch (e) { console.warn("[battle] 연출 오류 — 건너뛰고 계속", e); }
      revealClash(); barSnap = null; renderBars();
      if ((ev.result && ev.result.staggered || []).length) sfx.stagger();
      if ((ev.result && ev.result.dead || []).some(id => id[0] === "e")) sfx.book();
      if (!alive) return;
    }
    G.battle.stepEnd(R); barSnap = null; hideClash();
    if (stage.syncUnits) stage.syncUnits(B().units);   /* 건너뛴 교환에서 쓰러진 적·흐트러짐까지 무대에 맞춤 */
    if (G.battle.outcome) {
      const result = G.battle.settle();
      busy = true; render();
      await new Promise(r => setTimeout(r, skipAll ? 150 : 700));
      if (alive && onEnd) onEnd(result);
      return;
    }
    busy = false; render();
  }
  el.open.addEventListener("click", () => { sfx.tap(); runOpen(); });

  /* ---------- 매 프레임: 주사위·화살표를 무대 위치에 붙인다 ---------- */
  const loop = () => { if (!alive) return; placeDice(); drawArrows(); raf = requestAnimationFrame(loop); };
  render(); raf = requestAnimationFrame(loop);
  return { unmount() { alive = false; cancelAnimationFrame(raf); clearTimeout(msgT); root.innerHTML = ""; delete root.dataset.screen; } };
}
