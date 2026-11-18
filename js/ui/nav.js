/* 책갈피 서랍(큐 양 결정: 메뉴는 서랍, 앞으로 늘어남). 기본 화면에서만 붙인다.
   mountNav(root, {current, go}) — current: "floors"|"library"|"moon", go(key) */
export const NAV_ITEMS = [
  { key: "floors", label: "접대", sub: "층을 골라 손님 맞이" },
  { key: "library", label: "도서관", sub: "책 소각 · 덱 · 사서 · 기프트" },
  { key: "moon", label: "계시", sub: "하루 한 번 영단어", badge: () => (window.Game && Game.moon.doneToday() ? "완료" : "") },
];

export function mountNav(root, { current, go }) {
  const wrap = document.createElement("div"); wrap.id = "nav";
  wrap.innerHTML = `<button id="nav-bm" type="button" aria-label="메뉴 열기" aria-expanded="false" aria-controls="nav-drawer"><i></i><i></i><i></i></button>
    <div id="nav-scrim"></div>
    <nav id="nav-drawer" aria-label="메뉴" aria-hidden="true"><p class="nav-ttl">개념의 서고</p>
      ${NAV_ITEMS.map(it => { const b = it.badge ? it.badge() : "";
        return `<button type="button" class="nav-item${it.key === current ? " cur" : ""}" data-go="${it.key}"><b>${it.label}</b><span>${it.sub}</span>${b ? `<em>${b}</em>` : ""}</button>`; }).join("")}</nav>`;
  root.appendChild(wrap);
  const bm = wrap.querySelector("#nav-bm"), dr = wrap.querySelector("#nav-drawer"), scrim = wrap.querySelector("#nav-scrim");
  const set = open => { dr.classList.toggle("open", open); scrim.classList.toggle("on", open); bm.setAttribute("aria-expanded", String(open)); dr.setAttribute("aria-hidden", String(!open)); };
  bm.addEventListener("click", () => set(!dr.classList.contains("open")));
  scrim.addEventListener("click", () => set(false));
  const esc = e => { if (e.key === "Escape") set(false); }; document.addEventListener("keydown", esc);
  dr.addEventListener("click", e => { const it = e.target.closest(".nav-item"); if (!it) return; set(false); if (it.dataset.go !== current || current === "floors") go(it.dataset.go); });
  /* 화면이 바뀌어 root 가 비워지면 키 리스너도 정리 */
  new MutationObserver((_, mo) => { if (!wrap.isConnected) { document.removeEventListener("keydown", esc); mo.disconnect(); } }).observe(root, { childList: true });
  return { close: () => set(false) };
}
