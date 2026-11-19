/* 도서관: 책 · 덱 · 사서 · 기프트 (하위 탭). renderLibrary(root, stage, nav, tab)
   규칙은 Game.books / deck / libs, 무대에는 지금 사서 한 명(stage.showLibrarian, 3D 담당). 장착·덱을 바꿔도 목록 스크롤은 그대로 둔다. */
import { sfx } from "./sfx.js";

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const G = () => window.Game, SG = () => window.__studyGame;
const TABS = [["books", "책"], ["deck", "덱"], ["libs", "사서"], ["gifts", "기프트"]];
const TAB_KEY = "concept-library-libtab";
const TYPES = ["참격", "관통", "타격", "방어", "회피"], RARITIES = ["N", "R", "SR", "SSR"];
const filt = { floor: "all", type: "all", cost: "all", rarity: "all" };
let bookSel = null;

export function renderLibrary(root, stage, nav, tab) {
  if (!tab) { try { tab = localStorage.getItem(TAB_KEY); } catch (e) {} }
  if (!TABS.some(t => t[0] === tab)) tab = "books";
  try { localStorage.setItem(TAB_KEY, tab); } catch (e) {}
  root.dataset.screen = "library"; root.style.removeProperty("--accent");
  root.innerHTML = `<header class="lobby-head"><div><h1>도서관</h1><p>책을 태워 책장을 얻고, 덱과 사서를 꾸며</p></div></header>
    <div class="lib-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" class="lib-tab${k === tab ? " on" : ""}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join("")}</div>
    <section class="lib-pane" data-tab="${tab}"></section>`;
  root.querySelector(".lib-tabs").addEventListener("click", e => { const b = e.target.closest(".lib-tab"); if (b && b.dataset.tab !== tab) { sfx.tap(); nav.library(b.dataset.tab); } });
  const pane = root.querySelector(".lib-pane");
  const libId = () => G().save.activeLibrarianId || "kyu";
  if (stage.showLibrarian) stage.showLibrarian(libId()).catch(() => {});
  ({ books: paneBooks, deck: paneDeck, libs: paneLibs, gifts: paneGifts })[tab](pane, { stage, nav, root, libId });
}

/* 다시 그려도 스크롤이 튀지 않게: 스크롤 상자들의 위치를 기억했다 되돌린다 */
function keepScroll(pane, fn) {
  const pos = [...pane.querySelectorAll("[data-scroll]")].map(e => [e.dataset.scroll, e.scrollTop, e.scrollLeft]);
  fn();
  for (const [k, t, l] of pos) { const e = pane.querySelector(`[data-scroll="${k}"]`); if (e) { e.scrollTop = t; e.scrollLeft = l; } }
}

/* ---------- 책 ---------- */
function paneBooks(pane, ctx) {
  const B = G().books, D = G().data, held = B.held();
  if (!held.length) { pane.innerHTML = `<p class="empty">아직 책이 없어. 손님을 접대해서 책으로 만들면 여기에 쌓여.</p>`; return; }
  if (!bookSel || !held.some(g => g.id === bookSel)) bookSel = held[0].id;
  const g = D.GUEST_BY[bookSel], n = B.shown(g.id), pool = B.pool(g.id);
  const nameOf = e => e.k === "page" ? (D.PAGE_BY[e.id] || {}).name : (D.KEY_BY[e.id] || {}).name;
  pane.innerHTML = `<div class="books-wrap">
    <div class="book-list" data-scroll="books">${held.map(x => `<button type="button" class="book-item${x.id === bookSel ? " sel" : ""}" data-guest="${x.id}">
      <img src="${esc(D.bookCoverSrc(x))}" alt="" width="40" height="51"><span class="nm">${esc(x.concept)}</span><span class="cnt num">${B.shown(x.id)}권</span></button>`).join("")}</div>
    <div class="book-detail"><div class="bd-head"><img src="${esc(D.bookCoverSrc(g))}" alt="" width="72" height="91"><div><h2>${esc(g.concept)}</h2><p class="num">${n}권 보유</p></div></div>
      <ul class="pool" data-scroll="pool">${pool.map(e => `<li class="${e.count >= e.cap ? "done" : ""}"><span class="k">${e.k === "page" ? "책장" : "장서복"}</span><span class="nm">${esc(nameOf(e))}</span>
        <span class="num own">${e.count}/${e.cap}</span><span class="num rate">${e.count >= e.cap ? "다 모음" : Math.round(e.rate * 100) + "%"}</span></li>`).join("")}</ul>
      <div class="acts"><button type="button" id="btn-burn1"${n ? "" : " disabled"}>1권 소각</button><button type="button" id="btn-burnall" class="primary"${n > 1 ? "" : " disabled"}>전부 소각 (${n})</button></div></div></div>`;
  pane.querySelector(".book-list").addEventListener("click", e => { const b = e.target.closest(".book-item"); if (!b) return; bookSel = b.dataset.guest; sfx.tap(); keepScroll(pane, () => paneBooks(pane, ctx)); });
  let burning = false;
  const burn = async times => {
    if (burning) return;
    const r = B.burn(g.id, times); if (!r.ok) return;
    burning = true; sfx.book();
    /* 연출: 책이 떠올라 종이로 흩날리며 사라짐(3D 무대). 화면을 누르면 바로 결과로 */
    if (ctx.stage.burnBook) {
      const skip = document.createElement("div"); skip.id = "burn-skip"; skip.innerHTML = `<span class="hint">탭: 건너뛰기</span>`;
      skip.addEventListener("pointerdown", () => ctx.stage.finishNow && ctx.stage.finishNow());
      ctx.root.appendChild(skip);
      const cover = new URL(D.bookCoverSrc(g), document.baseURI).href;
      try { await ctx.stage.burnBook({ cover, n: r.n }); } catch (e) { console.warn("[library] 소각 연출 오류", e); }
      skip.remove();
    } else if (ctx.stage.cheer) ctx.stage.cheer();
    burning = false;
    if (!ctx.root.isConnected || ctx.root.dataset.screen !== "library") return;
    const box = document.createElement("div"); box.id = "burn-result";
    box.innerHTML = `<div class="rcard"><p class="eyebrow">「${esc(g.concept)}」 ${r.n}권 소각</p><ul>${r.cards.map(c => `<li class="burn-get${c.isNew ? " new" : ""}">
      <span class="k">${c.k === "page" ? "책장" : "장서복"}</span><b>${esc(c.name)}</b>${c.n > 1 ? `<span class="num">×${c.n}</span>` : ""}${c.isNew ? `<em>NEW</em>` : ""}</li>`).join("")}</ul>
      <button type="button" id="burn-ok" class="primary">확인</button></div>`;
    ctx.root.appendChild(box);
    box.querySelector("#burn-ok").addEventListener("click", () => { box.remove(); keepScroll(pane, () => paneBooks(pane, ctx)); });
  };
  pane.querySelector("#btn-burn1").addEventListener("click", () => burn(1));
  pane.querySelector("#btn-burnall").addEventListener("click", () => burn(n));
}

/* ---------- 덱 ---------- */
function rangesOf(page) {
  const R = SG().engine.playerDieRange;
  return (page.dice || []).map(d => { const ok = R(d, true, false, 0, 0), no = R(d, false, false, 0, 0);
    return `<span class="t-${d.type}">${d.type}</span> <span class="num">정답 ${ok[0]}~${ok[1]} · 오답 ${no[0]}~${no[1]}</span>`; }).join("<br>");
}
function paneDeck(pane, ctx) {
  const D = G().data, deck = G().deck.active(), ids = deck.pageIds, n = ids.length, MIN = D.DECK_MIN, MAX = D.DECK_MAX;
  const owned = G().deck.owned().map(id => D.PAGE_BY[id]).filter(Boolean);
  const inDeck = id => ids.filter(x => x === id).length;
  const pass = p => (filt.floor === "all" || (p.floorId || "basic") === filt.floor) && (filt.type === "all" || (p.dice || []).some(d => d.type === filt.type))
    && (filt.cost === "all" || (filt.cost === "3" ? (p.cost || 0) >= 3 : String(p.cost || 0) === filt.cost)) && (filt.rarity === "all" || (p.rarity || "N") === filt.rarity);
  const list = owned.filter(pass).sort((a, b) => (a.cost || 0) - (b.cost || 0) || RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
  const chips = (f, opts) => opts.map(([v, l]) => `<button type="button" class="chip${filt[f] === v ? " on" : ""}" data-f="${f}" data-v="${v}">${l}</button>`).join("");
  pane.innerHTML = `<div class="deck-wrap">
    <div class="deck-top"><span id="deck-count" class="num${n < MIN ? " warn" : ""}">${n}/${MAX}장</span>${n < MIN ? `<span class="warn-tx">${MIN}장 이상이어야 접대할 수 있어</span>` : ""}
      <div id="deck-slots" data-scroll="slots">${ids.map((id, i) => { const p = D.PAGE_BY[id]; return `<button type="button" class="slot-card r-${p.rarity || "N"}" data-page="${id}" data-i="${i}"><span class="num c">${p.cost || 0}</span>${esc(p.name)}</button>`; }).join("")}</div></div>
    <div class="filters" data-scroll="filters">${chips("floor", [["all", "모든 층"], ["basic", "기본"], ...D.FLOORS.map(f => [f.id, f.name.replace(/의 층.*$/, "")])])}<i></i>${chips("type", [["all", "모든 종류"], ...TYPES.map(t => [t, t])])}<i></i>${chips("cost", [["all", "모든 비용"], ["0", "빛 0"], ["1", "빛 1"], ["2", "빛 2"], ["3", "빛 3+"]])}<i></i>${chips("rarity", [["all", "모든 등급"], ...RARITIES.map(r => [r, r])])}</div>
    <div id="deck-pool" data-scroll="pool">${list.length ? list.map(p => { const k = inDeck(p.id), lim = G().deck.limit(p.id), full = k >= lim;
      return `<button type="button" class="pool-card r-${p.rarity || "N"}${k ? " in" : ""}${full ? " full" : ""}" data-page="${p.id}" data-types="${(p.dice || []).map(d => d.type).join(",")}">
        <span class="top"><b>${esc(p.name)}</b><span class="num">빛 ${p.cost || 0}${p.emotion ? ` · 감정 ${p.emotion}` : ""}</span></span>
        <span class="rng">${rangesOf(p)}</span><span class="own num">${k}/${lim}${k ? "<em>덱</em>" : ""}</span></button>`; }).join("") : `<p class="empty">조건에 맞는 책장이 없어</p>`}</div></div>`;
  const redraw = () => keepScroll(pane, () => paneDeck(pane, ctx));
  pane.querySelector("#deck-pool").addEventListener("click", e => { const c = e.target.closest(".pool-card"); if (!c) return; const r = G().deck.toggle(c.dataset.page); if (r.ok) sfx.tap(); redraw(); });
  pane.querySelector("#deck-slots").addEventListener("click", e => { const c = e.target.closest(".slot-card"); if (!c) return; G().deck.toggle(c.dataset.page, { slot: true }); sfx.tap(); redraw(); });
  pane.querySelector(".filters").addEventListener("click", e => { const c = e.target.closest(".chip"); if (!c) return; filt[c.dataset.f] = c.dataset.v; sfx.tap(); redraw(); });
}

/* ---------- 사서 ---------- */
function paneLibs(pane, ctx) {
  const D = G().data, L = G().libs, s = G().save, list = L.list(), cur = ctx.libId(), key = L.keyOf(cur);
  const next = L.nextAt(), have = (s.unlockedKeyIds || []).length, party = s.party || [];
  pane.innerHTML = `<div class="libs-wrap">
    <div class="lib-row">${list.map(l => `<button type="button" class="lib-card${l.id === cur ? " sel" : ""}" data-lib="${l.id}"><b>${esc(l.name)}</b><span>${party.includes(l.id) ? "접대 명단" : "쉬는 중"}</span></button>`).join("")}
      ${next != null ? `<div class="lib-card locked"><b>다음 사서</b><span class="num">장서복 ${have}/${next}</span></div>` : ""}</div>
    <div class="lib-actions"><button type="button" id="btn-party" aria-pressed="${party.includes(cur)}">${party.includes(cur) ? "접대 명단에서 빼기" : "접대에 데려가기"}</button><span class="note" id="party-note"></span></div>
    <div class="key-list" data-scroll="keys">${D.KEY_PAGES.map(k => { const own = (s.unlockedKeyIds || []).includes(k.id), on = key && key.id === k.id;
      return `<button type="button" class="key-card${on ? " on" : ""}${own ? "" : " locked"}" data-key="${k.id}"${own ? "" : " disabled"}>${on ? `<em class="badge">착용</em>` : ""}<b>${esc(own ? k.name : "???")}</b><span>${esc(own ? k.text : "책을 소각하면 얻을 수 있어")}</span></button>`; }).join("")}</div></div>`;
  const redraw = () => keepScroll(pane, () => paneLibs(pane, ctx));
  pane.querySelector(".lib-row").addEventListener("click", e => { const c = e.target.closest(".lib-card[data-lib]"); if (!c) return; if (L.pick(c.dataset.lib)) { sfx.tap(); if (ctx.stage.showLibrarian) ctx.stage.showLibrarian(c.dataset.lib).catch(() => {}); } redraw(); });
  pane.querySelector("#btn-party").addEventListener("click", () => { const r = L.toggleParty(); if (r && r.ok === false) { pane.querySelector("#party-note").textContent = "사서가 한 명은 나가야 해"; return; } sfx.tap(); redraw(); });
  pane.querySelector(".key-list").addEventListener("click", e => { const c = e.target.closest(".key-card"); if (!c || c.disabled) return;
    if (L.equipKey(c.dataset.key)) { sfx.tap(); if (ctx.stage.showLibrarian) ctx.stage.showLibrarian(cur).then(() => ctx.stage.cheer && ctx.stage.cheer()).catch(() => {}); } redraw(); });
}

/* ---------- 기프트 ---------- */
function perkText(g) { const u = (SG().gifts.EGO_GIFT_RULES.unit) || {}, t = {}; for (const [k, n] of Object.entries(g.perk || {})) t[k] = (u[k] || 1) * n; return G().libs.bonusLabel(t); }
function paneGifts(pane, ctx) {
  const D = G().data, id = ctx.libId(), GF = SG().gifts, owned = GF.egoOwned(G().save, id), eq = GF.egoEquip(G().save, id);
  const slots = GF.EGO_GIFT_RULES.slots, byId = Object.fromEntries(D.EGO_GIFTS.map(g => [g.id, g]));
  const eqIds = Object.values(eq).filter(Boolean), guestsOn = [...new Set(eqIds.map(x => byId[x] && byId[x].guestId))].filter(Boolean);
  const sets = guestsOn.map(gid => { const all = D.EGO_GIFTS.filter(g => g.guestId === gid), k = all.filter(g => eqIds.includes(g.id)).length;
    return `<li class="${k === all.length ? "on" : ""}"><b>「${esc(D.GUEST_BY[gid].concept)}」 세트</b> <span class="num">${k}/${all.length}</span></li>`; }).join("");
  const lib = G().libs.list().find(l => l.id === id) || { name: "" };
  pane.innerHTML = `<div class="gifts-wrap">
    <div class="gift-side"><p class="who">${esc(lib.name)}의 기프트</p><div class="slots">${slots.map(sl => { const g = byId[eq[sl]];
      return `<div class="slot${g ? " on" : ""}" data-slot="${sl}"><span class="sl">${sl}</span><b>${g ? esc(g.name) : "비어 있음"}</b></div>`; }).join("")}</div>
      <p class="total">${esc(G().libs.bonusLabel(G().libs.giftTotals(id)))}</p>${sets ? `<ul class="sets">${sets}</ul>` : ""}</div>
    <div class="gift-list" data-scroll="gifts">${owned.length ? owned.map(gid => { const g = byId[gid]; if (!g) return ""; const on = eq[g.slot] === g.id;
      return `<button type="button" class="gift-card${on ? " on" : ""}" data-gift="${g.id}">${on ? `<em class="badge">착용</em>` : ""}<span class="sl">${g.slot}</span><b>${esc(g.name)}</b><span class="perk">${esc(perkText(g))}</span><span class="tx">${esc(g.text || "")}</span></button>`; }).join("")
      : `<p class="empty">아직 기프트가 없어. 접대에서 이기면 가끔 떨어져.</p>`}</div></div>`;
  pane.querySelector(".gift-list").addEventListener("click", e => { const c = e.target.closest(".gift-card"); if (!c) return;
    const r = G().libs.equipGift(c.dataset.gift); if (r.ok) { sfx.tap(); if (ctx.stage.cheer) ctx.stage.cheer(); } keepScroll(pane, () => paneGifts(pane, ctx)); });
}
