/* 평면 화면 3개(층 고르기·손님 고르기·결과). 각 함수는 root 를 채우고 이벤트를 붙인다. 규칙은 Game, 이동은 nav 콜백. */
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const G = () => window.Game;
const coverUrl = g => G().data.bookCoverSrc(g);

function guestsOf(floorId) { return G().data.WEAK_POINTS.filter(g => g.floorId === floorId); }
const done = g => G().save.conqueredIds.includes(g.id);

/* ---------- 층 고르기 ---------- */
export function renderFloors(root, nav) {
  const D = G().data;
  root.dataset.screen = "floors"; root.style.removeProperty("--accent");
  const ready = G().deck.ready();
  root.innerHTML = `
    <header class="lobby-head"><h1>개념의 서고</h1><p>오늘 접대할 층을 골라 줘</p></header>
    ${ready ? "" : `<p class="notice">책장이 ${D.DECK_MIN}장 이상 있어야 접대할 수 있어</p>`}
    <div class="floor-row">${D.FLOORS.map(f => { const gs = guestsOf(f.id), n = gs.filter(done).length, st = D.floorStage(f.id);
      return `<button type="button" class="floor-card" data-floor="${f.id}" style="--fa:${st.accent}">
        <span class="mood">${st.mood === "moon" ? "달빛 열람실" : "등불 서고"}</span>
        <span class="nm">${esc(f.name)}</span><span class="sub">${esc(f.subject)}</span>
        <span class="motto">${esc(f.motto || "")}</span>
        <span class="prog num">${n}/${gs.length}<small> 책</small></span></button>`; }).join("")}</div>`;
  root.querySelector(".floor-row").addEventListener("click", e => { const c = e.target.closest(".floor-card"); if (c) nav.floor(c.dataset.floor); });
  root.querySelector(".floor-row").addEventListener("pointerover", e => { const c = e.target.closest(".floor-card"); if (c && nav.preview) nav.preview(c.dataset.floor); });
}

/* ---------- 손님 고르기 ---------- */
export function renderGuests(root, floorId, nav) {
  const D = G().data, f = D.FLOORS.find(x => x.id === floorId), st = D.floorStage(floorId), ready = G().deck.ready();
  root.dataset.screen = "guests"; root.style.setProperty("--accent", st.accent);
  const gs = guestsOf(floorId);
  root.innerHTML = `
    <header class="lobby-head"><button id="btn-back" type="button" aria-label="층으로">←</button><div><h1>${esc(f.name)}</h1><p>${esc(f.subject)}</p></div></header>
    ${ready ? "" : `<p class="notice">책장이 ${D.DECK_MIN}장 이상 있어야 접대할 수 있어</p>`}
    <div class="guest-grid">${gs.map(g => { const b = G().books.shown(g.id), isDone = done(g);
      return `<button type="button" class="guest-card${isDone ? " done" : ""}" data-guest="${g.id}"${ready ? "" : " disabled"}>
        <img class="cover" src="${coverUrl(g)}" alt="" width="44" height="56" loading="lazy">
        <span class="txt"><span class="nm">${esc(g.concept)}</span><span class="sub">${"●".repeat(g.weakness)}${"○".repeat(3 - g.weakness)} 약함 · ${isDone ? "책이 됨 · 회상" : "새 손님"}</span></span>
        ${b ? `<span class="books num">${b}<small>권</small></span>` : ""}</button>`; }).join("")}</div>`;
  root.querySelector("#btn-back").addEventListener("click", () => nav.floors());
  root.querySelector(".guest-grid").addEventListener("click", e => { const c = e.target.closest(".guest-card"); if (c && !c.disabled) nav.battle(c.dataset.guest); });
}

/* ---------- 결과 (80% 이상 불투명한 검은 화면) ---------- */
export function renderResult(root, r, nav) {
  const D = G().data, g = D.GUEST_BY[r.guestId];
  root.dataset.screen = "result";
  const gifts = (r.gifts || []).map(x => `<li><b>${esc(x.libName)}</b> · 에고 기프트 <span>${esc(x.item.name)}</span> <small>${esc(x.item.slot)}</small></li>`).join("");
  const body = r.won
    ? `<img class="cover big" src="${coverUrl(g)}" alt="${esc(g.concept)} 책 표지" width="120" height="152">
       <div class="txt"><p class="eyebrow">${r.isRecall ? "회상 완료" : "접대 완료"}</p><h1>${esc(g.concept)}</h1>
       <p>${r.isRecall ? "다시 한 번 손님을 책으로 돌려보냈어." : "손님이 서고의 책이 됐어. 도서관에서 소각하면 이 손님의 책장이 나와."}</p>
       <ul class="gains"><li><b>책</b> · ${esc(g.concept)} ×${r.bookGain} <small>보유 ${r.books}권</small></li>${gifts || `<li class="muted">이번엔 기프트가 떨어지지 않았어</li>`}</ul>
       <p class="score num">정답 ${r.correct}/${r.total}</p></div>`
    : `<div class="txt"><p class="eyebrow bad">접대 실패</p><h1>접대가 꺾였어</h1><p>괜찮아. 해설을 다시 읽고 책장을 바꿔서 또 해 보자. 모은 책과 장서는 그대로야.</p>
       <p class="expl">${esc(r.explanation)}</p><p class="score num">정답 ${r.correct}/${r.total}</p></div>`;
  const next = G().battle.nextGuest(r.guestId);
  root.innerHTML = `<div id="result" class="${r.won ? "won" : "lost"}"><div class="rcard">${body}
    <div class="acts">${r.won && r.books > 0 ? `<button id="btn-burn" type="button">도서관에서 소각</button>` : ""}<button id="btn-retry" type="button">다시 접대</button>${r.won && next ? `<button id="btn-next" type="button">다음 손님</button>` : ""}<button id="btn-floors" type="button" class="primary">층으로</button></div></div></div>`;
  root.querySelector("#btn-retry").addEventListener("click", () => nav.battle(r.guestId));
  const bb = root.querySelector("#btn-burn"); if (bb) bb.addEventListener("click", () => nav.library("books", r.guestId));
  root.querySelector("#btn-floors").addEventListener("click", () => nav.floors());
  const nb = root.querySelector("#btn-next"); if (nb) nb.addEventListener("click", () => nav.battle(next.id));
}
