/* 달의 계시: intro → quiz → bridge → result (규칙·저장은 Game.moon = MoonCore).
   서고의 편린: 시작·결과 화면의 [서고의 편린] → 단어 목록(시간 제한 없음, 눌러서 고름) → [정화] = 보상 없는 재현시 → 정화 결과(맞힌 단어는 편린에서 빠짐).
   renderMoon(root, stage, nav, {chrome(on)}) → {unmount}
   시계는 화면이 잰다: 정답 0.17초·오답 0.65초 표시 동안은 멈추고, 시간이 다 되면 endRound. 화면을 떠나면 rAF·타이머를 모두 정리한다. */
import { sfx } from "./sfx.js";

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const OK_MS = 170, BAD_MS = 650, SEC_PER_WORD = 2.5;
const POS = { v: "동사", n: "명사", adj: "형용사", adv: "부사", prep: "전치사", conj: "접속사", phr: "숙어" };

export function renderMoon(root, stage, nav, o = {}) {
  const M = window.Game.moon;
  root.dataset.screen = "moon"; root.style.setProperty("--accent", "#a99be0");
  let raf = 0, advT = 0, alive = true, used = 0, runFrom = 0, lock = false;
  const chrome = on => { if (o.chrome) o.chrome(on); };
  const left = () => { const st = M.state; if (!st || st.phase !== "quiz") return 0; return Math.max(0, st.limitMs - used - (runFrom ? performance.now() - runFrom : 0)); };
  const pause = () => { if (runFrom) { used += performance.now() - runFrom; runFrom = 0; } };
  const resume = () => { if (!runFrom) runFrom = performance.now(); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; clearTimeout(advT); pause(); };

  function head(sub) { return `<header class="lobby-head"><div><h1>달의 계시</h1><p>${sub}</p></div></header>`; }

  /* 편린이 있으면 시작·결과 카드에 들어가는 버튼 */
  const shardBtn = () => { const n = M.shards().length; return n ? `<button type="button" id="moon-shards" class="shard-btn">서고의 편린 <b class="num">${n}</b></button>` : ""; };
  const bindShardBtn = () => { const b = root.querySelector("#moon-shards"); if (b) b.addEventListener("click", () => { sfx.tap(); shardsView(); }); };

  function intro() {
    const n = M.todaysWords().length, sample = M.isSample();
    root.innerHTML = head("하루 한 번, 오늘의 영단어") + `<div class="moon-card moon-intro">
      <p class="big num">${n}<small> 단어</small></p><p>단어당 ${SEC_PER_WORD}초, 모두 ${Math.round(n * SEC_PER_WORD)}초. 단어 → 뜻, 뜻 → 단어가 섞여 나와.</p>
      <p class="muted">끝내면 오늘 첫 접대에서 기프트가 더 잘 떨어져.${sample ? " (지금은 예시 단어)" : ""}</p>
      <div class="acts">${shardBtn()}<button type="button" id="moon-start" class="primary">시작</button></div></div>`;
    root.querySelector("#moon-start").addEventListener("click", () => { sfx.tap(); start("reveal"); }); bindShardBtn();
    chrome(true);   /* innerHTML 을 바꾼 뒤에 서랍·설정을 붙인다 */
  }

  function start(kind) {
    M.start(kind); used = 0; runFrom = 0; lock = false; chrome(false);
    paintQ(); resume(); tick();
  }
  function paintQ() {
    const st = M.state, q = M.current(); if (!q) return;
    const dir = q.dir === "w2m" ? "뜻은?" : "영단어는?";
    root.innerHTML = `<div class="moon-quiz">
      <div class="moon-top"><span class="kind">${st.kind === "replay" ? "재현시" : st.kind === "purify" ? "정화" : "계시"}</span><span class="num">${st.i + 1}/${st.qs.length}</span><span>점수 <b id="moon-score" class="num">${st.correct}</b></span>
        <span class="moon-timer"><i id="moon-time"></i></span><span id="moon-sec" class="num"></span></div>
      <div id="moon-q" class="moon-card"><p class="pos">${esc(POS[q.word.pos] || q.word.pos || "")} · ${dir}</p><p class="prompt">${esc(q.prompt)}</p></div>
      <div class="moon-opts">${q.options.map((t, i) => `<button type="button" class="moon-opt" data-i="${i}">${esc(t)}</button>`).join("")}</div></div>`;
    root.querySelector(".moon-opts").addEventListener("click", e => { const b = e.target.closest(".moon-opt"); if (b) answer(+b.dataset.i, b); });
    paintTime();
  }
  function paintTime() {
    const st = M.state, bar = root.querySelector("#moon-time"), sec = root.querySelector("#moon-sec"); if (!bar || !st) return;
    const l = left(); bar.style.transform = `scaleX(${(l / st.limitMs).toFixed(4)})`; bar.parentElement.classList.toggle("low", l < 5000); sec.textContent = (l / 1000).toFixed(l < 10000 ? 1 : 0);
  }
  function tick() {
    if (!alive || !M.state || M.state.phase !== "quiz") return;
    window.__moonTicks = (window.__moonTicks || 0) + 1;
    paintTime();
    if (left() <= 0 && !lock) { timeUp(); return; }
    raf = requestAnimationFrame(tick);
  }
  function answer(i, btn) {
    if (lock || !M.current()) return;
    lock = true; pause();
    const r = M.answer(i), opts = root.querySelectorAll(".moon-opt");
    opts.forEach((b, k) => { b.disabled = true; if (k === r.correctIndex) b.classList.add("ok"); else if (k === i) b.classList.add("no"); });
    if (r.ok) sfx.correct(); else { sfx.wrong(); root.querySelector("#moon-q").classList.add("bonk"); }
    const sc = root.querySelector("#moon-score"); if (sc) sc.textContent = M.state.correct;
    advT = setTimeout(() => { if (!alive) return; lock = false; if (r.done || M.state.phase !== "quiz") after(); else { paintQ(); resume(); } }, r.ok ? OK_MS : BAD_MS);
  }
  function timeUp() { stop(); M.endRound(); after(); }
  function after() { stop(); const ph = M.state && M.state.phase; if (ph === "bridge") bridge(); else if (ph === "purified") purified(); else result(); }

  function bridge() {
    chrome(false);
    const st = M.state, wrong = (st.wrongFromReveal || []).length;
    root.innerHTML = head("계시가 끝났어") + `<div id="moon-bridge" class="moon-card"><p class="big num">${st.reveal}<small>/${st.revealTotal}</small></p>
      <p>틀리거나 못 푼 단어 <b class="num">${wrong}</b>개를 재현시로 다시 볼 수 있어.</p>
      <div class="acts"><button type="button" id="moon-skip">건너뛰기</button><button type="button" id="moon-replay" class="primary">재현시 하기</button></div></div>`;
    root.querySelector("#moon-skip").addEventListener("click", () => { sfx.tap(); M.skipReplay(); result(); });
    root.querySelector("#moon-replay").addEventListener("click", () => { sfx.tap(); start("replay"); });
  }
  function result() {
    stop();
    const m = window.Game.save.moon || { reveal: 0, replay: 0 }, last = window.Game.save.moonLast || {}, b = window.Game.moonBonus();
    const fresh = M.state && M.state.newShards;
    root.innerHTML = head("오늘의 계시를 마쳤어") + `<div id="moon-result" class="moon-card">
      <div class="scores"><div><span>계시</span><b class="num">${m.reveal}${last.total ? `<small>/${last.total}</small>` : ""}</b></div><div><span>재현시</span><b class="num">${m.replay}${last.replayTotal ? `<small>/${last.replayTotal}</small>` : ""}</b></div></div>
      <p>${b.active ? `오늘 첫 접대에서 기프트가 떨어질 확률이 <b>최대 +${Math.round(40 * b.ratio)}%p</b> 올라.` : m.used ? "오늘의 보너스는 이미 첫 접대에 썼어." : "보너스는 내일 다시."}</p>
      ${fresh ? `<p>오늘 못 맞힌 단어 <b class="num">${fresh}</b>개가 <b>서고의 편린</b>이 됐어. 정화하기 전까진 계시에 안 나와.</p>` : ""}
      <p class="muted">내일 새 단어가 열려.</p>${M.shards().length ? `<div class="acts">${shardBtn()}</div>` : ""}</div>`;
    bindShardBtn(); chrome(true);
  }

  /* ---------- 서고의 편린: 시간 제한 없이 단어와 뜻을 훑어보고, 외운 것을 골라 [정화] ---------- */
  let picked = new Set();
  function shardsView() {
    stop(); if (M.state && M.state.phase === "quiz") M.close();
    const list = M.shards(); picked = new Set([...picked].filter(k => list.some(w => M.keyOf(w) === k)));
    if (!list.length) { back(); return; }
    root.innerHTML = head("서고의 편린") + `<div class="shard-view">
      <p class="shard-hint">오늘 끝내 맞히지 못한 단어들. 천천히 보고, 외웠다고 자신 있는 단어를 눌러 골라 줘.</p>
      <div class="shard-list" role="list">${list.map(w => { const k = M.keyOf(w); return `<button type="button" class="shard${picked.has(k) ? " sel" : ""}" data-k="${esc(k)}" aria-pressed="${picked.has(k)}" role="listitem">
        <b class="en">${esc(w.w)}</b><span class="pos">${esc(POS[w.pos] || w.pos || "")}</span><span class="ko">${esc(w.m)}</span></button>`; }).join("")}</div></div>
      <div class="shard-bar"><button type="button" id="shard-back">돌아가기</button><button type="button" id="shard-all">${picked.size === list.length ? "선택 풀기" : "전부 고르기"}</button>
        <span class="cnt"><b class="num" id="shard-n">${picked.size}</b>/${list.length} 골랐어</span><button type="button" id="shard-purify" class="primary"${picked.size ? "" : " disabled"}>정화</button></div>`;
    const sync = () => { root.querySelector("#shard-n").textContent = picked.size; root.querySelector("#shard-purify").disabled = !picked.size;
      root.querySelector("#shard-all").textContent = picked.size === list.length ? "선택 풀기" : "전부 고르기"; };
    root.querySelector(".shard-list").addEventListener("click", e => { const c = e.target.closest(".shard"); if (!c) return; const k = c.dataset.k;
      if (picked.has(k)) picked.delete(k); else picked.add(k); c.classList.toggle("sel", picked.has(k)); c.setAttribute("aria-pressed", picked.has(k)); sfx.tap(); sync(); });
    root.querySelector("#shard-all").addEventListener("click", () => { const all = picked.size === list.length; picked = all ? new Set() : new Set(list.map(M.keyOf));
      root.querySelectorAll(".shard").forEach(c => { c.classList.toggle("sel", picked.has(c.dataset.k)); c.setAttribute("aria-pressed", picked.has(c.dataset.k)); }); sfx.tap(); sync(); });
    root.querySelector("#shard-back").addEventListener("click", () => { sfx.tap(); back(); });
    root.querySelector("#shard-purify").addEventListener("click", () => { if (!picked.size) return; sfx.tap();
      if (!M.startPurify([...picked])) return; used = 0; runFrom = 0; lock = false; chrome(false); paintQ(); resume(); tick(); });
    chrome(true);
  }
  function purified() {
    stop(); const st = M.state, ok = st.purified || [], kept = st.kept || []; picked = new Set(kept.map(M.keyOf));
    root.innerHTML = head("정화") + `<div id="moon-purified" class="moon-card"><p class="big num">${ok.length}<small>/${ok.length + kept.length}</small></p>
      <p>${ok.length ? `맞힌 <b class="num">${ok.length}</b>개는 편린에서 빠져 다시 계시에 나올 수 있어.` : "이번엔 정화된 단어가 없어."}${kept.length ? ` 남은 <b class="num">${kept.length}</b>개는 그대로 편린에 있어.` : ""}</p>
      ${ok.length ? `<p class="muted">${ok.map(w => esc(w.w)).join(" · ")}</p>` : ""}
      <div class="acts">${M.shards().length ? `<button type="button" id="moon-shards" class="shard-btn">편린으로</button>` : ""}<button type="button" id="moon-done" class="primary">돌아가기</button></div></div>`;
    bindShardBtn(); root.querySelector("#moon-done").addEventListener("click", () => { sfx.tap(); back(); });
    chrome(true);
  }
  /* 편린·정화에서 돌아가기: 오늘 계시를 마쳤으면 결과, 아니면 시작 화면 */
  function back() { M.close(); const st = M.open(); if (st.phase === "result") result(); else intro(); }

  /* 테스트·디버그: 남은 시간을 0으로 */
  window.__moonUI = { timeUp: () => { if (M.state && M.state.phase === "quiz") { used = M.state.limitMs; runFrom = 0; if (!lock) timeUp(); } } };
  const st0 = M.open();
  if (st0.phase === "result") result(); else intro();
  return { unmount() { alive = false; stop(); if (M.state && M.state.phase === "quiz") M.close(); delete window.__moonUI; } };
}
