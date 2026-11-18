/* 달의 계시: intro → quiz → bridge → result. renderMoon(root, stage, nav, {chrome}) → {unmount} */
export function renderMoon(root, stage, nav, o = {}) {
  root.dataset.screen = "moon"; root.style.setProperty("--accent", "#a99be0");
  root.innerHTML = `<header class="lobby-head"><div><h1>달의 계시</h1><p>하루 한 번 영단어</p></div></header>`;
  if (o.chrome) o.chrome(true);
  return { unmount() {} };
}
