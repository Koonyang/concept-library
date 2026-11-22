/* 전투 화면(DOM, 무대 위). 규칙은 Game.battle, 그림은 stage.
   mountBattle(root, stage, guestId, {onEnd}) → {unmount()}
   막 진행: 문제 → 답 → 배정(내 주사위 → 책장 → 그 주사위를 상대 주사위·몸으로 끌어다 놓기) → [개막] → 교환마다 stage.play → 다음 막 | 끝(settle → onEnd(result))
   합이 맞물린 주사위 짝은 머리에서 떨어져 가운데 바닥 더미로(아군 왼쪽·적 오른쪽, 먼저 발동하는 짝이 아래). 일방 공격은 머리 위에 남아 화살표로.
   [전황] 수정구슬(배치 중에만)을 누르고 있으면 일방 공격까지 모두 더미로 떨어져 진행 순서를 미리 본다. 개막하면 전부 더미로, 교환마다 한 줄씩 빠짐.
   대상이 있는 내 주사위 탭 = 대상만 해제, 대상 없이 책장만 끼운 주사위 탭 = 책장 해제. 책장을 끼우고 대상이 없는 주사위가 있으면 [개막] 안 됨. 책장 없는 주사위는 개막하면 사라짐
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
    <div id="dice-stack" aria-label="이번 막 합 순서"></div>
    <div id="status"><span class="scene num"></span><span class="guest"></span><span class="msg"></span></div>
    <div id="learn" role="note"></div>
    <div id="enemy-info" role="note" aria-live="polite"></div>
    <div id="clash-panel" aria-live="polite"></div>
    <div id="question" aria-live="polite"></div>
    <div id="hand" hidden><div class="info"></div><div class="cards"></div></div>
    <button id="btn-open" type="button" hidden>개막</button>
    <button id="btn-orb" type="button" hidden aria-label="전황 보기(누르고 있기)" title="누르고 있으면 이번 막 진행 순서"><i></i><span>전황</span></button>
    <div id="skip-layer"><span class="hint">탭: 빨리 · 길게: 건너뛰기</span></div>`;
  const $ = s => root.querySelector(s);
  const el = { bars: $("#hud-bars"), arrows: $("#target-arrows"), dice: $("#dice-layer"), stack: $("#dice-stack"), orb: $("#btn-orb"), status: $("#status"), learn: $("#learn"), info: $("#enemy-info"), clash: $("#clash-panel"), q: $("#question"), hand: $("#hand"), open: $("#btn-open"), skip: $("#skip-layer") };
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

  const dieKey = (uid, i) => uid + ":" + i;
  const chipHtml = (u, d, i, extra) => {
    const cls = ["speed-die"]; if (u.side === "ally" && d.card) cls.push("set"); if (sel && sel.unit === u.id && sel.die === i) cls.push("sel"); if (extra) cls.push(extra);
    if (u.side === "enemy" && selHasCard()) cls.push("can-target");
    return `<button type="button" class="${cls.join(" ")}" data-unit="${u.id}" data-die="${i}" data-side="${u.side}" data-k="${dieKey(u.id, i)}" aria-label="${esc(u.name)} 속도 ${d.speed}">${d.speed}</button>`; };
  const selHasCard = () => { if (!sel) return false; const u = B().units.find(x => x.id === sel.unit), d = u && u.dice[sel.die]; return !!(d && d.card); };
  const short = n => { n = String(n || ""); return n.length > 5 ? n.slice(0, 5) + "…" : n; };
  function renderDice() {
    const st = B(), phase = st.phase, before = chipRects(), rows = stackRows(), onFloor = new Set();
    rows.forEach(r => { onFloor.add(dieKey(r.a.unit, r.a.die)); if (r.b) onFloor.add(dieKey(r.b.unit, r.b.die)); });
    /* 머리 위: 바닥 더미에 내려가지 않은 주사위. 적은 몸을 누르는 투명 자리도(일방 공격 대상) */
    el.dice.innerHTML = units().filter(u => u.hp > 0).map(u => {
      const chips = u.dice.map((d, i) => onFloor.has(dieKey(u.id, i)) ? "" : chipHtml(u, d, i)).join("");
      const tgt = u.side === "enemy" && phase === "assign" ? `<button type="button" class="enemy-target${selHasCard() ? " can-target" : ""}" data-unit="${u.id}" aria-label="${esc(u.name)} 노리기"></button>` : "";
      return `${chips ? `<div class="die-row" data-unit="${u.id}">${chips}</div>` : ""}${tgt}`; }).join("");
    renderStack(rows);
    placeDice(); placeStack(); flip(before);
  }
  /* 가운데 바닥 더미: 먼저 발동하는 짝이 맨 아래(쌓이는 순서). 아군 왼쪽 · 적 오른쪽 */
  /* 더미에 보일 줄: 개막 중엔 넘겨받은 남은 순서, 배치 중엔 합 짝만(전황을 누르고 있으면 전부) */
  let peek = false;
  const stackRows = () => B().phase === "assign" && !busy ? G.battle.plan().filter(r => peek || r.b) : [];
  function renderStack(rows) {
    const st = B(); rows = rows || stackRows(); const full = peek || busy;
    /* 개막 중에는 다음 4줄만(합 판·안내와 안 겹치게), 나머지는 "+N" */
    const more = busy && rows.length > 4 ? rows.length - 4 : 0; if (more) rows = rows.slice(0, 4);
    const U = id => st.units.find(u => u.id === id);
    el.stack.innerHTML = rows.map((r, n) => {
      const ua = U(r.a.unit), ub = r.b && U(r.b.unit), A = { u: ua, d: ua && ua.dice[r.a.die], i: r.a.die }, Bd = ub ? { u: ub, d: ub.dice[r.b.die], i: r.b.die } : null;
      const ally = A.u && A.u.side === "ally" ? A : Bd, enemy = A.u && A.u.side === "enemy" ? A : Bd, tgt = U(r.target);
      const cell = (x, side) => x && x.d ? `<span class="nm">${esc(short(x.u.name))}</span>${chipHtml(x.u, x.d, x.i, "stacked")}`
        : `<span class="to">${side === "ally" ? (tgt && tgt.side === "ally" ? "→ " + esc(short(tgt.name)) : "") : (tgt && tgt.side === "enemy" ? "→ " + esc(short(tgt.name)) : "")}</span>`;
      return `<div class="st-row${Bd ? " clash" : ""}" data-k="${dieKey(r.a.unit, r.a.die)}"><span class="st-l">${cell(ally, "ally")}</span><b class="st-n num">${full ? (Bd ? `${n + 1}<small>합</small>` : n + 1) : "합"}</b><span class="st-r">${cell(enemy, "enemy")}</span></div>`;
    }).join("") + (more ? `<span class="st-more num">+${more}</span>` : "");
    el.stack.classList.toggle("on", rows.length > 0);
  }
  /* 머리 → 더미(또는 반대)로 옮겨 간 주사위는 원래 자리에서 날아가듯 움직인다 */
  function chipRects() { const m = new Map(); root.querySelectorAll(".speed-die[data-k]").forEach(n => { const r = n.getBoundingClientRect(); if (r.width) m.set(n.dataset.k, { x: r.left, y: r.top, stacked: n.classList.contains("stacked") }); }); return m; }
  function flip(before) {
    if (!before.size || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.querySelectorAll(".speed-die[data-k]").forEach(n => { const o = before.get(n.dataset.k); if (!o || o.stacked === n.classList.contains("stacked")) return;
      const r = n.getBoundingClientRect(); const dx = o.x - r.left, dy = o.y - r.top; if (Math.abs(dx) + Math.abs(dy) < 2) return;
      n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 300, easing: "cubic-bezier(.3,.7,.3,1)" }); });
  }
  /* 머리 위 좌표(무대) — 무대가 없으면 화면 왼쪽/오른쪽 가운데에 세운다. part "body" = 몸통(머리 위보다 아래) */
  function pointOf(id, part = "head") {
    const p = stage.unitPoint && stage.unitPoint(id, part); if (p) return p;
    const u = B().units.find(x => x.id === id), list = units(u.side), i = list.indexOf(u), r = root.getBoundingClientRect();
    return { x: r.width * (u.side === "ally" ? 0.22 : 0.78) + (i - 1) * 60, y: r.height * 0.42 + (i % 2) * 30 + (part === "body" ? 70 : 0) };
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
    for (const t of el.dice.querySelectorAll(".enemy-target")) { const p = pointOf(t.dataset.unit, "body"); setPos(t, p.x, p.y); }   /* 몸통 가운데 */
  }
  /* 더미 자리: 가운데, 손패(없으면 개막 버튼·화면 아래) 바로 위에서 위로 쌓임. 높이가 모자라면 줄여서 */
  function placeStack() {
    if (!el.stack.classList.contains("on")) return;
    const W = innerWidth, H = innerHeight, hr = !el.hand.hidden ? el.hand.getBoundingClientRect() : null, qr = el.q.classList.contains("on") ? el.q.getBoundingClientRect() : null;
    const bottom = Math.min(hr && hr.height ? hr.top : H, qr && qr.height ? qr.top : H) - 8, top = topFloor(W / 2 - 110, 220) + 2;
    const h = el.stack.offsetHeight || 1, k = Math.min(1, Math.max(0.55, (bottom - top) / h));
    const key = `${Math.round(W / 2)}|${Math.round(bottom)}|${k.toFixed(2)}`; if (el.stack.dataset.p === key) return; el.stack.dataset.p = key;
    el.stack.style.left = Math.round(W / 2) + "px"; el.stack.style.top = Math.round(bottom) + "px"; el.stack.style.setProperty("--k", k.toFixed(3));
  }
  function centerOf(unit, die) {
    const n = die == null ? el.dice.querySelector(`.die-row[data-unit="${unit}"]`) : el.dice.querySelector(`.speed-die[data-unit="${unit}"][data-die="${die}"]`);
    if (!n) { const p = pointOf(unit); return p; }
    const r = n.getBoundingClientRect(); if (!r.width) { const p = pointOf(unit); return p; } return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  /* 화살표: 머리 위에 남은 일방 공격(내 것·적 것), 그리고 끌어다 놓는 중인 선. 바닥 더미에 내려간 합 짝은 안 그림.
     합이 아니면 대상 주사위가 아니라 대상의 몸통을 가리킨다(2026-11-23 큐 양): 대상 주사위가 다른 합으로 바닥에 내려가도
     허공을 가리키지 않고, 주사위 줄과 높이가 달라 합 대기와 헷갈리지 않는다 */
  function drawArrows() {
    const st = B(); if (!st || busy || st.phase !== "assign" || peek) { if (el.arrows.firstChild) el.arrows.innerHTML = ""; return; }
    const paths = [], curve = (a, b, cls) => { const lift = Math.max(30, Math.abs(b.x - a.x) * 0.22), lim = barsFloor(Math.min(a.x, b.x), Math.max(a.x, b.x)) + 8;
      let cy = Math.min(a.y, b.y) - lift; cy = Math.max(cy, 2 * lim - (a.y + b.y) / 2);
      paths.push(`<path class="${cls}" d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${((a.x + b.x) / 2).toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}"/>`); };
    for (const u of st.units) { if (u.hp <= 0) continue; u.dice.forEach((d, i) => { if (!d.target || G.battle.isClash(u.id, i)) return; if (drag && drag.on && drag.uid === u.id && drag.i === i) return;
      const n = el.dice.querySelector(`.speed-die[data-k="${dieKey(u.id, i)}"]`); if (!n) return;
      const r = n.getBoundingClientRect(), a = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      curve(a, pointOf(d.target.unit, "body"), u.side); }); }
    if (drag && drag.on) curve(drag.from, drag.at, drag.over ? "clash" : "ally");
    const html = paths.join(""); if (el.arrows.dataset.h !== html) { el.arrows.innerHTML = html; el.arrows.dataset.h = html; }
  }

  function renderHand() {
    const st = B(); const show = st.phase === "assign" && !busy;
    el.hand.hidden = !show; el.open.hidden = !show; el.open.disabled = busy;
    el.open.classList.toggle("wait", show && !G.battle.ready());
    el.orb.hidden = !show; if (!show && peek) setPeek(false);
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

  /* ---------- 합 표시: 양쪽 책장 판이 각 캐릭터 옆(세로는 머리 위)을 따라다님. 내 쪽은 늘 왼쪽 ----------
     단계마다(stage onStep) 숫자 공개 + 튀어 오름, 이긴 판 .hit · 피해 받은 판 .hurt 번쩍임 */
  const RES = { win: "승", lose: "패", draw: "무승부", block: "막음", evade: "회피", none: "" };
  let clashEv = null, clashFast = false, clashL = "a", clashR = "b", clashShown = -1, clashDirty = true;
  const flashT = new Set();
  function showClash(ev, isFast) {
    const st = B(), uA = st.units.find(u => u.id === ev.a.unit), allyFirst = uA && uA.side === "ally";
    const L = clashL = allyFirst ? "a" : "b", Rk = clashR = allyFirst ? "b" : "a";
    clashEv = ev; clashFast = !!isFast; clashShown = -1;
    const tgt = st.units.find(u => u.id === ev.target);
    const die = (d, r, i) => `<div class="cp-die" data-i="${i}">${d ? `<span class="ty t-${d.type}">${d.type}${d.reused ? `<small class="reuse">재사용</small>` : ""}</span><span class="rng num">${d.min}~${d.max}</span><b class="val num">?</b><i class="res${r ? " r-" + r : ""}" hidden>${RES[r] || ""}</i>` : `<span class="muted">—</span>`}</div>`;
    const panel = (k, cls) => {
      const x = ev[k];
      if (!x) return `<div class="cp-side ${cls} none" data-unit="${tgt ? tgt.id : ""}"><span class="who">${esc(tgt ? tgt.name : "")}</span><b class="cp-card">대응 없음</b><p class="cp-out" hidden></p></div>`;
      const u = st.units.find(q => q.id === x.unit), c = G.battle.cardInfo(x.card, x.unit) || {};
      const rows = (ev.steps || []).map((s, i) => die(s[k + "Die"], s[k + "Result"], i)).join("");
      return `<div class="cp-side ${cls}" data-unit="${x.unit}"><span class="who">${esc(u ? u.name : "")}${c.big ? `<em>큰 일격</em>` : ""}</span><b class="cp-card">${esc(c.name || "?")}</b><div class="cp-dice">${rows}</div><p class="cp-out" hidden></p></div>`;
    };
    el.clash.innerHTML = panel(L, "l") + panel(Rk, "r");
    el.clash.classList.add("on"); el.dice.hidden = true;
    clashDirty = true; placeClash();
  }
  /* 단계 i 까지 공개. i 없으면 남은 줄을 조용히 모두 공개 */
  function revealClash(i) {
    if (!clashEv) return;
    const steps = clashEv.steps || [], last = i == null ? steps.length - 1 : Math.min(i, steps.length - 1), loud = i != null && !clashFast && !fast && !skipAll;
    for (let k = clashShown + 1; k <= last; k++) revealStep(k, loud && k === last);
    clashDirty = true;
    clashShown = Math.max(clashShown, last);
  }
  function revealStep(k, loud) {
    const s = clashEv.steps[k], st = B();
    const sideOf = key => el.clash.querySelector(`.cp-side.${key === clashL ? "l" : "r"}`);
    for (const key of [clashL, clashR]) {
      const p = sideOf(key); if (!p) continue; const row = p.querySelector(`.cp-die[data-i="${k}"]`), d = s[key + "Die"], r = s[key + "Result"];
      if (!row) continue; row.classList.add("shown"); if (d) row.querySelector(".val").textContent = d.value;
      const rs = row.querySelector(".res"); if (rs) rs.hidden = !r || !RES[r];
      if (r === "win") row.classList.add("win"); else if (r === "lose") row.classList.add("lose");
      if (loud) { row.classList.remove("pop"); void row.offsetWidth; row.classList.add("pop"); }
    }
    /* 피해 문구는 피해 받은 쪽 판에(없으면 이긴 쪽 판에) */
    const parts = []; let hurtUnit = null;
    if (s.dmg) { hurtUnit = s.dmg.unit; parts.push(`체력 -${s.dmg.hp}${s.dmg.stagger ? ` · 흐트러짐 -${s.dmg.stagger}` : ""}`); }
    if (s.blocked) parts.push(`${s.blocked} 막음`); if (s.recovered) parts.push(`흐트러짐 +${s.recovered} 회복`);
    if (!parts.length) parts.push(s[clashL + "Result"] === "draw" ? "무승부 · 피해 없음" : "피해 없음");
    const panels = [...el.clash.querySelectorAll(".cp-side")];
    const hurtP = hurtUnit && panels.find(p => p.dataset.unit === hurtUnit);
    const winKey = s[clashL + "Result"] === "win" ? clashL : s[clashR + "Result"] === "win" ? clashR : null;
    const winP = winKey ? sideOf(winKey) : (hurtP ? panels.find(p => p !== hurtP) : null);
    const outP = hurtP || winP || panels[0];
    panels.forEach(p => { const o = p.querySelector(".cp-out"); if (o) { o.hidden = p !== outP; if (p === outP) o.textContent = parts.join(" · "); } });
    if (loud) { flash(winP && winP !== hurtP ? winP : null, "hit"); flash(hurtP, "hurt"); }
  }
  function flash(p, cls) {
    if (!p) return; p.classList.remove(cls); void p.offsetWidth; p.classList.add(cls);
    const t = setTimeout(() => { p.classList.remove(cls); flashT.delete(t); }, 180); flashT.add(t);
  }
  function hideClash() { flashT.forEach(clearTimeout); flashT.clear(); clashEv = null; el.clash.classList.remove("on"); el.clash.innerHTML = ""; el.dice.hidden = false; }
  /* 판이 내려와야 하는 위쪽 경계: 막대·상태판(barsFloor) + 연출 중 안내 글자 */
  function topFloor(x, w) {
    let f = barsFloor(x, x + w) + 6; const hint = el.skip.querySelector(".hint"), hr = hint && hint.getBoundingClientRect();
    if (hr && hr.width && hr.top < innerHeight * 0.5 && x < hr.right && x + w > hr.left) f = Math.max(f, hr.bottom + 6);
    return f;
  }
  /* 판 자리: 가로 = 내 판은 캐릭터 왼쪽, 상대 판은 오른쪽 / 세로 = 머리 위, 왼쪽 반·오른쪽 반 안에서 */
  function placeClash() {
    if (!clashEv) return;
    const W = innerWidth, H = innerHeight, land = W >= H, want = [];
    for (const p of el.clash.querySelectorAll(".cp-side")) {
      const left = p.classList.contains("l"), id = p.dataset.unit, pt = id && B().units.some(u => u.id === id) ? pointOf(id) : { x: left ? W * 0.3 : W * 0.7, y: H * 0.45 };
      /* 크기는 내용·화면 방향이 바뀔 때만 잰다(매 프레임 레이아웃을 강제하지 않게) */
      const key = land ? "L" : "P" + W;
      if (p.dataset.k !== key || clashDirty) { p.style.width = land ? "" : Math.floor(W / 2 - 12) + "px"; p.dataset.k = key; p.dataset.w = p.offsetWidth; p.dataset.h = p.offsetHeight; }
      const w = +p.dataset.w, h = +p.dataset.h; let x, y;
      if (land) { x = left ? pt.x - 36 - w : pt.x + 36; y = pt.y - 10; }
      else { const lo = left ? 8 : W / 2 + 4, hi = left ? W / 2 - 4 - w : W - 8 - w; x = Math.min(Math.max(pt.x - w / 2, lo), Math.max(lo, hi)); y = pt.y - 8 - h; }
      x = Math.min(Math.max(x, 6), W - w - 6);
      const floor = topFloor(x, w); if (y < floor) y = floor; if (y + h > H - 6) y = Math.max(floor, H - 6 - h);
      want.push({ p, x, y, w, h });
    }
    clashDirty = false;
    if (want.length === 2) { const [a, b] = want; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) { const lo = a.y <= b.y ? b : a, hi = lo === a ? b : a; lo.y = hi.y + hi.h + 6; } }
    /* 따라가기: 지난 시간 기준(약 60ms 반감) — 프레임이 느린 기기에서도 뒤처지지 않게 */
    const now = performance.now(), k = 1 - Math.pow(0.5, Math.min(200, now - (placeClash.t || now)) / 60); placeClash.t = now;
    for (const r of want) {
      const ox = r.p.dataset.x == null ? r.x : +r.p.dataset.x, oy = r.p.dataset.y == null ? r.y : +r.p.dataset.y;
      let nx = ox + (r.x - ox) * k, ny = oy + (r.y - oy) * k; if (Math.abs(r.x - nx) < 1) nx = r.x; if (Math.abs(r.y - ny) < 1) ny = r.y;
      ny = Math.max(ny, topFloor(nx, r.w));   /* 옮겨 가는 중간에도 막대·안내 글자 아래로 */
      r.p.dataset.x = nx; r.p.dataset.y = ny; r.p.style.transform = `translate(${Math.round(nx)}px, ${Math.round(ny)}px)`;
    }
  }

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
  const dieOf = (uid, i) => { const u = B().units.find(x => x.id === uid); return u && u.dice[i]; };
  const failMsg = r => setMsg(r.reason === "light" ? "빛이 모자라" : r.reason === "emotion" ? "감정 단계가 모자라" : "놓을 수 없어", "bad", 1800);
  /* 책장 끼운 내 주사위(uid,i)의 대상을 정한다: 적 주사위면 그 주사위, 몸이면 일방 공격 */
  function aim(uid, i, target) {
    const r = G.battle.target(uid, i, target); if (!r.ok) { failMsg(r); return false; }
    sfx.tap(); selCard = null; sel = firstEmptyDie(); render(); return true;
  }
  let drag = null, eatClick = false;
  el.dice.addEventListener("click", onDieClick); el.stack.addEventListener("click", onDieClick);
  function onDieClick(e) {
    if (eatClick) { eatClick = false; return; }
    if (busy || B().phase !== "assign") return;
    const chip = e.target.closest(".speed-die, .enemy-target"); if (!chip) return;
    const uid = chip.dataset.unit, die = chip.dataset.die == null ? null : +chip.dataset.die, u = B().units.find(x => x.id === uid);
    if (u.side === "ally") {
      const d = u.dice[die];
      if (d.target) { G.battle.target(uid, die, null); setMsg("합을 풀었어 · 다시 끌어다 놓아 줘", "", 1600); }   /* 더미의 내 주사위: 대상만 해제(책장은 그대로) */
      else if (d.card) G.battle.unassign(uid, die);                                                          /* 머리 위 책장 끼운 주사위: 책장 해제 */
      sel = { unit: uid, die }; selCard = null; sfx.tap(); render(); return;
    }
    /* 적: 고른 내 주사위에 책장이 있으면 탭으로도 대상 지정(끌기 대신) */
    if (selHasCard()) { aim(sel.unit, sel.die, { unit: uid, die }); return; }
    if (die != null) showEnemyInfo(uid, die); else setMsg("내 주사위에 책장을 먼저 끼워 줘", "", 1800);
  }
  /* 끌기: 책장 끼운 내 주사위를 상대 주사위나 몸 위에 놓는다 */
  function dropAt(x, y) {
    const hit = document.elementsFromPoint(x, y).find(n => n.matches && n.matches('.speed-die[data-side="enemy"], .enemy-target'));
    return hit ? { unit: hit.dataset.unit, die: hit.dataset.die == null ? null : +hit.dataset.die, el: hit } : null;
  }
  root.addEventListener("pointerdown", e => {
    if (busy || B().phase !== "assign") return;
    const chip = e.target.closest('.speed-die[data-side="ally"]'); if (!chip) return;
    const uid = chip.dataset.unit, i = +chip.dataset.die, d = dieOf(uid, i); if (!d || !d.card) return;
    const r = chip.getBoundingClientRect();
    drag = { uid, i, chip, id: e.pointerId, sx: e.clientX, sy: e.clientY, on: false, from: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, at: { x: e.clientX, y: e.clientY }, over: null };
  });
  root.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.at = { x: e.clientX, y: e.clientY };
    if (!drag.on && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) { drag.on = true; drag.chip.classList.add("dragging"); root.classList.add("aiming"); sel = { unit: drag.uid, die: drag.i }; }
    if (!drag.on) return;
    const t = dropAt(e.clientX, e.clientY); if (drag.over && (!t || t.el !== drag.over)) drag.over.classList.remove("drop"); drag.over = t ? t.el : null; if (drag.over) drag.over.classList.add("drop");
    drawArrows(); e.preventDefault();
  }, { passive: false });
  const endDrag = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return; const D = drag; drag = null;
    D.chip.classList.remove("dragging"); root.classList.remove("aiming"); if (D.over) D.over.classList.remove("drop");
    if (!D.on) return; eatClick = true; setTimeout(() => { eatClick = false; }, 0);
    const t = !cancel && dropAt(e.clientX, e.clientY);
    if (t) aim(D.uid, D.i, { unit: t.unit, die: t.die }); else render();
  };
  root.addEventListener("pointerup", e => endDrag(e, false)); root.addEventListener("pointercancel", e => endDrag(e, true));

  el.hand.addEventListener("click", e => {
    const c = e.target.closest(".card"); if (!c || busy) return;
    if (c.classList.contains("disabled")) { setMsg("지금은 못 쓰는 책장이야", "", 1500); return; }
    if (!sel) sel = firstEmptyDie(); if (!sel) return;
    const cid = c.dataset.card, d = dieOf(sel.unit, sel.die); if (!d) return;
    /* 노릴 적이 하나뿐이면 바로 대상까지, 아니면 이미 정한 대상은 그대로 두고 책장만 바꿔 끼운다 */
    const targets = units("enemy").filter(u => u.hp > 0);
    const auto = targets.length === 1 && targets[0].dice.length <= 1 ? { unit: targets[0].id, die: targets[0].dice.length ? 0 : null } : null;
    const r = G.battle.assign(sel.unit, sel.die, cid, d.target ? { ...d.target } : auto);
    if (!r.ok) { failMsg(r); return; }
    sfx.tap(); selCard = null;
    if (dieOf(sel.unit, sel.die).target) sel = firstEmptyDie() || sel; else setMsg("주사위를 상대 주사위(또는 몸)로 끌어다 놓아 줘", "", 2600);
    render();
  });

  /* ---------- 전황(수정구슬): 누르고 있는 동안 일방 공격까지 바닥 더미로 ---------- */
  function setPeek(on) { if (peek === on) return; peek = on; el.orb.classList.toggle("on", on); root.classList.toggle("peek", on); if (on) hideInfo(); renderDice(); drawArrows(); }
  el.orb.addEventListener("pointerdown", e => { if (busy || B().phase !== "assign") return; e.preventDefault(); try { el.orb.setPointerCapture(e.pointerId); } catch (x) {} setPeek(true); sfx.tap(); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.orb.addEventListener(ev, () => setPeek(false));
  el.orb.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); setPeek(true); } });
  el.orb.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") setPeek(false); });
  el.orb.addEventListener("contextmenu", e => e.preventDefault());

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
    if (!G.battle.ready()) { setMsg("대상을 정하지 않은 주사위가 있어 · 상대 주사위로 끌어다 놓아 줘", "bad", 2400); return; }
    const plan = G.battle.plan();
    const R = G.battle.stepBegin(); if (!R) return;
    busy = true; fast = false; skipAll = false; sel = null; selCard = null; el.learn.classList.remove("on"); hideInfo();
    const before = chipRects(); barSnap = snapUnits(); render();
    renderStack(plan); el.dice.hidden = true; placeStack(); flip(before);   /* 개막: 남은 주사위가 모두 바닥 더미로 */
    for (;;) {
      const before = snapUnits();
      const ev = G.battle.stepNext(R); if (!ev) break;
      if (ev.kind === "skip") continue;
      if (skipAll) { barSnap = null; continue; }
      barSnap = before; renderBars(barSnap);
      /* 바닥 더미에서 지금 교환의 줄을 치운다(남은 줄이 다음 순서) */
      const at = plan.findIndex(r => (r.a.unit === ev.a.unit && r.a.die === ev.a.die) || (r.b && ev.b && r.b.unit === ev.a.unit && r.b.die === ev.a.die));
      if (at >= 0) plan.splice(0, at + 1); renderStack(plan); placeStack();
      sfx.clash(); showClash(ev, fast);
      try { await stage.play(ev, { fast: fast || skipAll, final: G.battle.outcome === "win", onStep: i => revealClash(i), onHit: i => {
        const s = ev.steps[i]; if (!s || !s.dmg) return; const side = (B().units.find(u => u.id === s.dmg.unit) || {}).side;
        sfx.hit(); if (s.dmg.hp) floatNum(s.dmg.unit, "-" + s.dmg.hp, "hp" + (side === "ally" ? " ally" : "")); if (s.dmg.stagger) floatNum(s.dmg.unit, "-" + s.dmg.stagger, "st");
        barSnap = null; renderBars(); } });
      } catch (e) { console.warn("[battle] 연출 오류 — 건너뛰고 계속", e); }
      revealClash(); barSnap = null; renderBars();
      if ((ev.result && ev.result.staggered || []).length) sfx.stagger();
      if ((ev.result && ev.result.dead || []).some(id => id[0] === "e")) sfx.book();
      if (!alive) return;
    }
    G.battle.stepEnd(R); barSnap = null; hideClash(); renderStack([]);
    /* 막 끝: 합 치러 나갔던 캐릭터·카메라를 한 번에 제자리로 */
    if (stage.sceneEnd) { try { await stage.sceneEnd({ fast: fast || skipAll }); } catch (e) { console.warn(e); } if (!alive) return; }
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
  const loop = () => { if (!alive) return; placeDice(); placeStack(); placeClash(); drawArrows(); raf = requestAnimationFrame(loop); };
  render(); raf = requestAnimationFrame(loop);
  return { render: () => { if (alive) render(); },   /* 화면 밖(API·도구)에서 상태를 바꾼 뒤 다시 그리기 */
    unmount() { alive = false; cancelAnimationFrame(raf); clearTimeout(msgT); flashT.forEach(clearTimeout); root.innerHTML = ""; delete root.dataset.screen; } };
}
