/* 도서관: 책 · 덱 · 사서 · 기프트 (하위 탭). renderLibrary(root, stage, nav, tab) */
export function renderLibrary(root, stage, nav, tab) {
  root.dataset.screen = "library"; root.style.removeProperty("--accent");
  root.innerHTML = `<header class="lobby-head"><div><h1>도서관</h1><p>책을 태워 책장을 얻고, 덱과 사서를 꾸며</p></div></header>`;
}
