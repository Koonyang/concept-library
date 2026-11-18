import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";

const ROOT=LIB_ROOT;
const SHOT = join(ROOT, "shots", "overlap");
mkdirSync(SHOT, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".md": "text/plain; charset=utf-8",
};
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = url === "/" ? "/index.html" : url;
  const abs = normalize(join(ROOT, rel));
  if (!abs.startsWith(ROOT) || !existsSync(abs)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(abs).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(abs));
});
await new Promise((r) => server.listen(+(process.env.PORT||0), "127.0.0.1", r));

const VIEWS = [
  { w: 360, h: 740, name: "360x740" },
  { w: 390, h: 844, name: "390x844" },
  { w: 412, h: 915, name: "412x915" },
  { w: 412, h: 780, name: "412x780" },
  { w: 1440, h: 900, name: "1440x900" },
  // landscape phones
  { w: 740, h: 360, name: "740x360", land: true },
  { w: 844, h: 390, name: "844x390", land: true },
  { w: 915, h: 412, name: "915x412", land: true },
  { w: 780, h: 412, name: "780x412", land: true },
  { w: 667, h: 375, name: "667x375", land: true },
];

const browser = await launchBrowser(chromium,{args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  headless: true,
});

const issues = [];
const consoleErrs = [];

function inter(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

async function collectIssues(page, label) {
  const found = await page.evaluate(() => {
    const out = [];
    const visibleRect = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return null;
      let r = el.getBoundingClientRect();
      let p = el.parentElement;
      while (p && p !== document.documentElement) {
        const ps = getComputedStyle(p);
        if (/(auto|hidden|scroll|clip)/.test(ps.overflowX + ps.overflowY)) {
          const pr = p.getBoundingClientRect();
          r = { left: Math.max(r.left, pr.left), top: Math.max(r.top, pr.top), right: Math.min(r.right, pr.right), bottom: Math.min(r.bottom, pr.bottom) };
        }
        p = p.parentElement;
      }
      r = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, innerWidth), bottom: Math.min(r.bottom, innerHeight) };
      r.width = r.right - r.left; r.height = r.bottom - r.top;
      if (r.width < 2 || r.height < 2) return null;
      return r;
    };
    const vis = (el) => !!visibleRect(el);
    const inter = (a, b) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { t: desc(el), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const desc = (el) => {
      const id = el.id ? "#" + el.id : "";
      const cls = (el.className && String(el.className).split(" ").filter(Boolean)[0]) || "";
      const tx = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}:${tx}`;
    };
    const skip = (el) =>
      !el ||
      el.closest("#fx,#bg,#vignette,#grain,#transition,.burst,.flash,.pillar,.flare,.foil,.cbl,.cbr,.pf-ring,.filigree") ||
      el.classList.contains("cbl") ||
      el.classList.contains("cbr");

    // nav hit box = union of visible nav buttons (not the full gradient strip)
    const nav = document.querySelector(".botnav");
    const navOn = nav && vis(nav) && !nav.classList.contains("away");
    let navHit = null;
    if (navOn) {
      const rs = [...nav.querySelectorAll(".btn")].filter(vis).map((b) => b.getBoundingClientRect());
      if (rs.length) {
        navHit = {
          left: Math.min(...rs.map((r) => r.left)) - 2,
          right: Math.max(...rs.map((r) => r.right)) + 2,
          top: Math.min(...rs.map((r) => r.top)) - 4,
          bottom: Math.max(...rs.map((r) => r.bottom)) + 2,
        };
      }
    }

    const textSel =
      "h1,h2,h3,p,.gold-title,.gmeta,.pname,.hudstat,.bonus-sum,.empty-state,.sec-head,.bar-lab,.nm,.al-cell .gmeta";
    const panelSel = ".rb-card,.rb-gift,.empty-state,.book-item,.key-item,.gift-cell,.bonus-sum,.guest-card,.al-cell";
    const texts = [...document.querySelectorAll(textSel)].filter((el) => vis(el) && !skip(el));
    const panels = [...document.querySelectorAll(panelSel)].filter((el) => vis(el) && !skip(el));
    const btns = [...document.querySelectorAll("button.btn,button.sheet-close")].filter((el) => vis(el) && !skip(el));

    if (navHit) {
      for (const el of [...texts, ...panels, ...btns]) {
        if (nav.contains(el)) continue;
        const r = visibleRect(el); if(!r) continue;
        const area = inter(r, navHit);
        if (area > 10) out.push({ type: "nav", a: desc(el), area: Math.round(area), r: box(el) });
      }
    }

    // headings vs previous sibling (the cut-off empty box bug)
    for (const h of [...document.querySelectorAll("h2,h3,.sec-head")].filter((el) => vis(el) && !skip(el))) {
      let prev = h.previousElementSibling;
      while (prev && (getComputedStyle(prev).display === "none" || prev.matches(".cbl,.cbr"))) prev = prev.previousElementSibling;
      if (!prev || !vis(prev) || skip(prev)) continue;
      const hr=visibleRect(h), pr=visibleRect(prev); if(!hr||!pr) continue;
      const area = inter(hr, pr);
      if (area > 4) out.push({ type: "heading-overlap", a: desc(h), b: desc(prev), area: Math.round(area) });
    }

    // non-nested content panels should not intersect
    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        const a = panels[i], b = panels[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ar=visibleRect(a), br=visibleRect(b); if(!ar||!br) continue;
        const area = inter(ar, br);
        if (area > 12) out.push({ type: "panel-overlap", a: desc(a), b: desc(b), area: Math.round(area) });
      }
    }

    // audio toggles vs visible topbar / scroll text
    const mute = document.querySelector("#set-bm") || document.querySelector("#btn-sfx");
    if (mute && vis(mute)) {
      const mr = visibleRect(mute) || mute.getBoundingClientRect();
      for (const el of texts) {
        if (mute.contains(el)) continue;
        const r=visibleRect(el); if(!r) continue;
        const area = inter(r, mr);
        if (area > 8) out.push({ type: "mute", a: desc(el), area: Math.round(area) });
      }
    }

    // clipped empty frames: a .frame/.empty-state whose client box is clearly smaller than its content
    for (const el of document.querySelectorAll(".empty-state, .frame")) {
      if (!vis(el) || skip(el)) continue;
      if (el.closest(".gacha-stage,.floor-hero,.bars,.qpanel,.guest-card,.portrait-box,.portrait-frame,.hand,.card-inspect")) continue;
      if (el.scrollHeight > el.clientHeight + 8 && getComputedStyle(el).overflow !== "visible") {
        out.push({ type: "clipped-frame", a: desc(el), scrollH: el.scrollHeight, clientH: el.clientHeight });
      }
    }

    // inspect card must not cover HUD, hand, or mute
    const ci = document.querySelector(".card-inspect.on .ci-card");
    if (ci && vis(ci)) {
      const cr = visibleRect(ci);
      const LANDI = innerWidth > innerHeight && innerHeight <= 500;
      if (cr && LANDI && ci.scrollHeight > ci.clientHeight + 4) out.push({ type: "inspect-clipped", sh: ci.scrollHeight, ch: ci.clientHeight });
      if (!cr) { /* hidden */ } else
      for (const sel of LANDI ? ["#set-bm", ".botnav"] : ["#set-bm", ".hud-top", ".hand", ".botnav"]) {
        const t = document.querySelector(sel);
        if (!t || !vis(t)) continue;
        if (sel === ".botnav" && t.classList.contains("away")) continue;
        const tr = visibleRect(t); if(!tr) continue;
        const area = inter(cr, tr);
        if (area > 12) out.push({ type: "inspect-overlap", a: "ci-card", b: sel, area: Math.round(area) });
      }
      if (cr && (cr.top < 8 || cr.bottom > innerHeight - 8 || cr.left < 4 || cr.right > innerWidth - 4)) {
        out.push({ type: "inspect-overflow", r: { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) } });
      }
    }

    // dress-up (장서복 / 기프트)
    const dt=document.querySelector(".dress-top");
    if (dt && vis(dt)) {
      const R = (e) => e.getBoundingClientRect();
      const ch = R(document.querySelector("#dress-char")), gd = R(document.querySelector("#dress-grid")), dd = R(document.querySelector("#dress-detail")), sd = R(document.querySelector(".dress-side"));
      const ov = (a, b) => !(a.right <= b.left + 0.5 || a.left >= b.right - 0.5 || a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5);
      if (ov(ch, sd)) out.push({ type: "dress-char-vs-side" });
      const LAND = innerWidth > innerHeight && innerHeight <= 500;
      if (LAND) { if (ov(dd, ch) || ov(dd, sd)) out.push({ type: "dress-detail-overlaps-side" }); if (dd.right > innerWidth + 0.5) out.push({ type: "dress-detail-offscreen" }); }
      else if (dd.top < Math.max(ch.bottom, sd.bottom) - 1) out.push({ type: "dress-detail-overlaps-top" });
      for (const el of [ch, gd, dd]) if (el.left < 0 || el.right > innerWidth + 0.5) out.push({ type: "dress-offscreen-x", l: Math.round(el.left), r: Math.round(el.right) });
      const tiles = [...document.querySelectorAll(".dtile")];
      tiles.forEach((t, i) => { const r = R(t); if (r.width < 38 || r.height < 38) out.push({ type: "dtile-small", i, w: Math.round(r.width) }); if (r.left < gd.left - 1 || r.right > gd.right + 1) out.push({ type: "dtile-outside-grid", i });
        tiles.slice(i + 1).forEach((u, j) => { if (ov(r, R(u))) out.push({ type: "dtile-overlap", i, j: i + 1 + j }); }); });
      const eqb = [...document.querySelectorAll(".dt-eq")].find((b) => { const r = R(b); return r.right > innerWidth - 1 || r.left < 1; }); if (eqb) out.push({ type: "dt-eq-clipped" });
      const tabs = R(document.querySelector(".shelf-tabs")); if (tabs.right > innerWidth + 0.5) out.push({ type: "tabs-offscreen" });
      document.querySelectorAll(".shelf-tab").forEach((t) => { if (t.scrollWidth > t.clientWidth + 1) out.push({ type: "tab-text-clipped", t: t.textContent }); });
      document.querySelectorAll("#dress-detail .btn").forEach((b) => { const r = R(b); if (r.right > dd.right + 1 || r.left < dd.left - 1) out.push({ type: "dd-btn-outside" }); });
    }
    // 도서관 하위 탭 + 하단 내비 (접대 · 도서관) 균형
    { const st = document.querySelector(".shelf-tabs");
      if (st && vis(st)) { const r = st.getBoundingClientRect(); if (r.right > innerWidth + 0.5 || r.left < -0.5) out.push({ type: "shelf-tabs-offscreen" });
        st.querySelectorAll(".shelf-tab").forEach((t) => { if (t.scrollWidth > t.clientWidth + 1) out.push({ type: "shelf-tab-clipped", t: t.textContent }); }); }
      const nb = [...document.querySelectorAll(".botnav")].find((n) => vis(n));
      if (nb) { const bs = [...nb.querySelectorAll(".btn")].map((b) => b.getBoundingClientRect());
        if (bs.length !== 3) out.push({ type: "botnav-count", n: bs.length });
        else if (Math.max(...bs.map((r) => r.width)) - Math.min(...bs.map((r) => r.width)) > 2 || bs.some((r) => r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight + 0.5)) out.push({ type: "botnav-unbalanced", w: bs.map((r) => Math.round(r.width)) });
        const labels = [...nb.querySelectorAll(".btn")].map((b) => b.textContent.trim()).join("|"); if (labels !== "접대|도서관|계시") out.push({ type: "botnav-labels", labels }); }
    }
    // ---- landscape-only checks ----
    if (innerWidth > innerHeight && innerHeight <= 500) {
      // left rail must not cover scene content
      const rail = [...document.querySelectorAll(".scene.on .botnav")].find((n) => vis(n) && !n.classList.contains("away"));
      if (rail) { const rr = visibleRect(rail);
        for (const el of document.querySelectorAll(".scene.on .page-scroll, .scene.on .lobby-grid, .scene.on .topbar")) { if (!vis(el)) continue; const a = inter(rr, visibleRect(el)); if (a > 4) out.push({ type: "rail-covers-content", a: desc(el), area: Math.round(a) }); }
        if (rr.height > innerHeight + 1) out.push({ type: "rail-too-tall" }); }
      const st = document.querySelector("#scene-battle.on .battle-stage");
      if (st && !st.classList.contains("result-on")) {
        const W = st.getBoundingClientRect().width;
        for (const f of document.querySelectorAll(".fighter")) { const fr = f.getBoundingClientRect(); const ratio = fr.width / W; if (ratio < 0.12 || ratio > 0.2) out.push({ type: "fighter-size", ratio: +ratio.toFixed(3) }); if (fr.top < 0 || fr.bottom > innerHeight + 1) out.push({ type: "fighter-offscreen" }); }
        const L = document.querySelector(".bars.left"), R = document.querySelector(".bars.right");
        if (L && R && !(L.getBoundingClientRect().right <= R.getBoundingClientRect().left)) out.push({ type: "hp-bars-order" });
        const hand = document.querySelector("#hand");
        if (hand && vis(hand) && getComputedStyle(hand).opacity > 0.5) {
          /* 손패 카드는 화면 안에 둔다 (바깥 모서리 허용 0~2px). 캐릭터와 손패의 겹침은 아래 fighter-front-ui 가 본다. */
          for (const c of hand.querySelectorAll(".cc:not(.hot)")) { const cr = c.getBoundingClientRect();
            if (cr.bottom > innerHeight + 2 || cr.left < -2 || cr.right > innerWidth + 2) out.push({ type: "hand-card-offscreen", b: Math.round(cr.bottom), H: innerHeight, l: Math.round(cr.left), r: Math.round(cr.right) }); }
          const lc = document.querySelector(".lightchip"); if (lc && vis(lc)) { const lr = lc.getBoundingClientRect(), hr = hand.getBoundingClientRect(); if (Math.abs(lr.bottom - hr.top) > 60 && lr.bottom < hr.top) out.push({ type: "light-far-from-hand", gap: Math.round(hr.top - lr.bottom) }); }
        }
        const qp = document.querySelector(".qpanel.on");
        if (qp) { const qr = qp.getBoundingClientRect(); if (qp.scrollHeight > qp.clientHeight + 2 && !qp.classList.contains("short")) out.push({ type: "quiz-scrolls", sh: qp.scrollHeight, ch: qp.clientHeight });
          if (qr.top < 0 || qr.bottom > innerHeight + 1 || qr.left < 0 || qr.right > innerWidth + 1) out.push({ type: "quiz-offscreen" });
          for (const b of qp.querySelectorAll("[data-opt]")) { const br = b.getBoundingClientRect(); if (br.bottom > qr.bottom + 1) out.push({ type: "quiz-option-hidden" }); if (b.scrollWidth > b.clientWidth + 2) out.push({ type: "quiz-option-overflow" }); } }
      }
    }
    // combat rework: intent preview / short answer / resist pop
    const intent = document.querySelector(".intent");
    if (intent && vis(intent) && !document.querySelector(".battle-stage.rolling")) {
      const ir = visibleRect(intent);
      const against = [".hud-top .bars", ".hud-top .turnchip", "#set-bm", ".hand .cc"];
      for (const sel of against) for (const el of document.querySelectorAll(sel)) { if (!vis(el)) continue; const a = inter(ir, visibleRect(el)); if (a > 12) out.push({ type: "intent-overlap", b: sel, area: Math.round(a) }); }
      const full = intent.getBoundingClientRect();
      if (full.left < 2 || full.right > innerWidth - 2 || full.top < 2) out.push({ type: "intent-offscreen", r: [Math.round(full.left), Math.round(full.top), Math.round(full.right)] });
    }
    const qs = document.querySelector(".qpanel.short.on");
    if (qs) {
      const qr = qs.getBoundingClientRect();
      if (qr.top < 0 || qr.bottom > innerHeight - 4 || qr.left < 0 || qr.right > innerWidth) out.push({ type: "short-panel-offscreen", r: [Math.round(qr.left), Math.round(qr.top), Math.round(qr.right), Math.round(qr.bottom)] });
      const inp = qs.querySelector("input"); if (!inp || inp.getBoundingClientRect().height < 30) out.push({ type: "short-input-missing" });
    }
    const rp = document.querySelector(".resist-pop.on .rp-card");
    if (rp) { const rr = rp.getBoundingClientRect(); if (rr.left < 2 || rr.right > innerWidth - 2 || rr.top < 2 || rr.bottom > innerHeight - 2) out.push({ type: "resist-pop-offscreen" }); }
    const rb = document.querySelector("#rbanner.on");
    if (rb) {
      const rr = rb.getBoundingClientRect();
      if (rr.width < innerWidth - 2 || rr.height < innerHeight - 2) out.push({ type: "scrim-not-fullscreen", w: Math.round(rr.width), h: Math.round(rr.height) });
      for (const sel of [".fighter", ".clash", ".hud-top", ".hand", ".logbox", ".qpanel"]) {
        for (const el of document.querySelectorAll(".battle-stage " + sel)) if (vis(el)) out.push({ type: "battle-ui-visible-under-result", a: sel });
      }
      const card = rb.querySelector(".rb-card");
      if (card) {
        const cr = card.getBoundingClientRect();
        if (cr.width < Math.min(innerWidth * 0.9, 380) - 4) out.push({ type: "result-card-narrow", w: Math.round(cr.width) });
        if (cr.left < 4 || cr.right > innerWidth - 4) out.push({ type: "result-card-overflow-x" });
        const mt = rb.querySelector(".rb-msg");
        if (mt && !(innerWidth > innerHeight && innerHeight <= 500) && mt.getBoundingClientRect().width < cr.width * 0.7) out.push({ type: "result-text-narrow", w: Math.round(mt.getBoundingClientRect().width) });
        const aud = document.querySelector("#set-bm");
        if (aud && vis(aud)) { const ar = aud.getBoundingClientRect(); if (inter(cr, ar) > 8) out.push({ type: "result-card-vs-audio" }); }
      }
    }

    // 캐릭터(몸·이름 명찰·머리 막대)는 앞면 UI(손패 카드·개막·상태판·주사위 설명)와 겹치면 안 된다.
    // 무대 바닥·배경이 손패 뒤로 깔리는 것은 허용.
    {
      const st = document.querySelector("#scene-battle.on .battle-stage");
      const hideFront = st && (st.classList.contains("result-on") || st.classList.contains("bs-cam-on") || st.classList.contains("rolling"));
      if (st && !hideFront) {
        const visEl = (el) => {
          if (!el) return false;
          const cs = getComputedStyle(el);
          return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity !== 0;
        };
        const parts = [];
        for (const f of document.querySelectorAll(".fighter")) {
          const sub = [...f.querySelectorAll(".char, .char-plate, .stag-tag")].filter(visEl);
          if (sub.length) parts.push(...sub);
          else if (visEl(f)) parts.push(f);
        }
        for (const u of document.querySelectorAll(".bs-unit:not(.dead):not(.bg)")) {
          const sub = [...u.querySelectorAll(".bs-fig, .bs-plate, .bs-nm, .bs-bar")].filter(visEl);
          if (sub.length) parts.push(...sub);
          else if (visEl(u)) parts.push(u);
        }
        const uis = [];
        for (const sel of [".hand .cc", "#btn-mb-go", "#mb-stat-ally", "#mb-stat-enemy", ".bs-info"]) {
          document.querySelectorAll(sel).forEach((el) => { if (visEl(el)) uis.push(el); });
        }
        for (const part of parts) {
          const pr = part.getBoundingClientRect();
          if (pr.width < 2 || pr.height < 2) continue;
          for (const ui of uis) {
            const ur = ui.getBoundingClientRect();
            const area = inter(pr, ur);
            if (area > 2) out.push({ type: "fighter-front-ui", a: desc(part), b: desc(ui), area: Math.round(area) });
          }
        }
      }
    }
    return out;
  });
  for (const f of found) issues.push({ label, ...f });
  return found;
}

async function screenshot(page, name) {
  const path = join(SHOT, name + ".png");
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function settle(page) {
  await page.waitForTimeout(200);
  await page.evaluate(() => Promise.all(
    [...document.images].filter((i) => !i.complete).map(
      (i) => new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); })
    )
  ));
  await page.waitForTimeout(450);
}

async function scrollScene(page, where) {
  await page.evaluate((where) => {
    const root =
      document.querySelector(".scene.on .page-scroll") ||
      document.querySelector(".scene.on .guest-sheet.on") ||
      document.querySelector(".scene.on .guests") ||
      document.querySelector(".scene.on");
    if (!root) return;
    root.scrollTop = where === "bottom" ? root.scrollHeight : 0;
  }, where);
  await settle(page);
}

async function boot(page) {
  page.on("pageerror", (e) => consoleErrs.push(String(e)));
  page.on("console", (m) => {
    if ((m.type() === "error" && !/moon-words\.js/.test((m.location() || {}).url || ""))) consoleErrs.push(m.text());
  });
  await page.addInitScript((g) => { window.__G = g; }, process.env.GUEST || "");
  await page.goto("http://127.0.0.1:"+server.address().port+"/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__studyGame, { timeout: 8000 });
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__studyGame, { timeout: 8000 });
  await settle(page);
}

/* 다대다 접대가 기본(전투/시스템 담당). 1:1 전용 상태(intent·choosePage·#gst-char·r.g/r.p)는 battleApi.enable(false)로 1:1을 켜서 본다 */
const MODE = (on) => `window.__studyGame.battleApi && window.__studyGame.battleApi.enable(${on});`;
/* 다대다: 막 문제에 정답 → 배치 단계(양피지 손패 #hand .cc[data-card]) */
const MB_ASSIGN = "window.__studyGame.battle && window.__studyGame.battle.phase==='question' && window.__studyGame.battleApi.answerUI(true);";
const states = [
  { id: "title", setup: (p) => p.evaluate(() => window.__studyGame.setScene("title")) },
  { id: "credits", setup: (p) => p.evaluate(() => window.__studyGame.setScene("credits")) },
  { id: "lobby", setup: (p) => p.evaluate(() => window.__studyGame.setScene("lobby")) },
  {
    id: "sheet",
    setup: async (p) => {
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        const id = document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]")?.dataset.guest;
        if (id) window.__studyGame.openGuestSheet(id);
      });
    },
  },
  { id: "shelf-empty", setup: (p) => p.evaluate(() => { window.__studyGame.setShelfTab("books"); window.__studyGame.setScene("shelf"); }) },
  {
    id: "shelf-filled",
    setup: async (p) => {
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        const g = window.__studyGame;
        const ids = [...document.querySelectorAll("[data-guest]")].map((e) => e.dataset.guest);
        ids.forEach((id, i) => {
          g.save.conqueredIds = [...new Set([...g.save.conqueredIds, id])];
          g.save.bookCounts[id] = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 12;
        });
        g.setShelfTab("books");
        g.setScene("shelf");
      });
    },
  },
  {
    id: "lib-deck",
    setup: (p) =>
      p.evaluate(() => {
        const g = window.__studyGame;
        g.setShelfTab("deck");
        g.setScene("shelf");
      }),
  },
  {
    id: "battle",
    setup: async (p) => {
      await p.evaluate(MODE(true));
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        const id = document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]")?.dataset.guest;
        if (id) window.__studyGame.beginReception(id);
      });
      await p.waitForTimeout(700);
    },
  },
  {
    id: "battle-hand9",
    setup: async (p) => {
      await p.evaluate(MODE(true));
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        const id = document.querySelector("[data-guest]")?.dataset.guest;
        if (id) window.__studyGame.beginReception(id);
      });
      await p.waitForTimeout(700);
      await p.evaluate(MB_ASSIGN); await p.waitForTimeout(200);
      await p.evaluate(() => {
        const g = window.__studyGame, A = g.battleApi, u = g.battle.units[0], X = A.internals()[u.id];
        const ids = g.engine.COMBAT_PAGES.slice(0, 9).map((x) => x.id);
        X.handIds.splice(0, X.handIds.length, ...ids); u.light = 6; u.maxLight = 6; u.emotion = 4; g.renderBattle();
      });
      await p.waitForTimeout(300);
    },
  },
  {
    id: "burn",
    setup: async (p) => {
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        const g = window.__studyGame;
        const id = document.querySelector("[data-guest]")?.dataset.guest;
        g.save.bookCounts[id] = 6; g.setShelfTab("books"); g.setScene("shelf");
        g.selectBook && g.selectBook(id);
        document.querySelector('[data-burn-all]')?.click();
      });
      await p.waitForTimeout(1600);
    },
  },
  {
    id: "battle-inspect",
    setup: async (p) => {
      await p.evaluate(MODE(true));
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        const id = document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]")?.dataset.guest;
        if (id) window.__studyGame.beginReception(id);
      });
      await p.waitForTimeout(700);
      await p.evaluate(MB_ASSIGN); await p.waitForTimeout(300);
      await p.evaluate(() => {
        const id = document.querySelector("#hand .cc[data-card]")?.dataset.card || document.querySelector("#hand .cc")?.dataset.page;
        if (id) window.__studyGame.openCardInspect(id);
      });
    },
  },
  {
    id: "result-win",
    setup: async (p) => {
      await p.evaluate(MODE(true));
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        const g = window.__studyGame;
        g.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest);
      });
      await p.waitForTimeout(700);
      await p.evaluate(() => { const g = window.__studyGame; g.showWin(); });
      await p.waitForTimeout(500);
    },
  },
  {
    id: "result-lose",
    setup: async (p) => {
      await p.evaluate(MODE(true));
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => {
        window.__studyGame.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest);
      });
      await p.waitForTimeout(700);
      await p.evaluate(() => window.__studyGame.showLose());
      await p.waitForTimeout(500);
    },
  },
  {
    id: "battle-big",
    setup: async (p) => {
      await p.evaluate(MODE(false));   // 1:1 전용 화면
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => window.__studyGame.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest));
      await p.waitForTimeout(700);
      await p.evaluate(() => { const g = window.__studyGame, E = g.engine, r = E.getRec(); r.turn = r.kit.bigEvery; r.intent = E.planIntent(r.kit, r); g.renderBattle(); });
    },
  },
  {
    id: "q-key-mc",
    setup: async (p) => {
      await p.evaluate(MODE(false));   // 1:1 전용 화면
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => window.__studyGame.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest));
      await p.waitForTimeout(700);
      await p.evaluate(() => { const g = window.__studyGame, E = g.engine, r = E.getRec(); r.turn = r.kit.bigEvery; r.intent = E.planIntent(r.kit, r); g.renderBattle(); g.choosePage(r.handIds.find((id) => E.PAGE_BY[id].cost <= r.light)); });
      await p.waitForTimeout(500);
    },
  },
  {
    id: "q-key-short",
    setup: async (p) => {
      await p.evaluate(MODE(false));   // 1:1 전용 화면
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => window.__studyGame.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest));
      await p.waitForTimeout(700);
      await p.evaluate(() => { const g = window.__studyGame, E = g.engine, r = E.getRec(); r.turn = r.kit.bigEvery; r.keyIdx = 1; r.intent = E.planIntent(r.kit, r); g.renderBattle(); g.choosePage(r.handIds.find((id) => E.PAGE_BY[id].cost <= r.light)); });
      await p.waitForTimeout(500);
    },
  },
  {
    id: "resist-pop",
    setup: async (p) => {
      await p.evaluate(MODE(false));   // 1:1 전용 화면
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => window.__studyGame.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest));
      await p.waitForTimeout(700);
      await p.evaluate(() => document.querySelector("#gst-char").click());
      await p.waitForTimeout(300);
    },
  },
  {
    id: "guest-stag",
    setup: async (p) => {
      await p.evaluate(MODE(false));   // 1:1 전용 화면
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => window.__studyGame.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest));
      await p.waitForTimeout(700);
      await p.evaluate(() => { const g = window.__studyGame, r = g.engine.getRec(); r.g.stag = 1; r.g.st = 0; r.intent = null; g.renderBattle(); });
    },
  },
  {
    id: "player-stag",
    setup: async (p) => {
      await p.evaluate(MODE(false));   // 1:1 전용 화면
      await p.evaluate(() => window.__studyGame.setScene("lobby"));
      await p.evaluate(() => window.__studyGame.beginReception(document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]").dataset.guest));
      await p.waitForTimeout(700);
      await p.evaluate(() => { const g = window.__studyGame, r = g.engine.getRec(); r.p.stag = 1; r.p.st = 0; r.phase = "pstag"; g.renderBattle(); });
    },
  },
  {
    id: "keypage",
    setup: async (p) => {
      await p.evaluate(() => { const g = window.__studyGame; g.save.unlockedKeyIds = ["novice", "reading-room"]; g.save.equippedKeyId = "reading-room"; g.setShelfTab("outfit"); g.setScene("shelf"); });
      await p.waitForTimeout(500);
    },
  },
  {
    id: "keypage-locked",
    setup: async (p) => {
      await p.evaluate(() => { const g = window.__studyGame; g.setShelfTab("outfit"); g.setScene("shelf"); });
      await p.waitForTimeout(300);
      await p.evaluate(() => document.querySelector('[data-t="archivist"]').click());
      await p.waitForTimeout(300);
    },
  },
  {
    id: "gifts",
    setup: async (p) => {
      await p.evaluate(() => { const g = window.__studyGame, d = g.data; const eq = {}; d.EGO_GIFTS.slice(0, 5).forEach((x) => { eq[x.slot] = x.id; }); g.setGifts(d.EGO_GIFTS.slice(0, 9).map((x) => x.id), eq); g.setShelfTab("gifts"); g.setScene("shelf"); });
      await p.waitForTimeout(500);
    },
  },
  {
    id: "gifts-sel",
    setup: async (p) => {
      await p.evaluate(() => { const g = window.__studyGame; g.setShelfTab("gifts"); g.setScene("shelf"); });
      await p.waitForTimeout(300);
      await p.evaluate(() => document.querySelector('[data-t="' + window.__studyGame.data.EGO_GIFTS[11].id + '"]').click());
      await p.waitForTimeout(300);
    },
  },
  {
    id: "deck",
    setup: async (p) => {
      await p.evaluate(() => window.__studyGame.setScene("deck"));
    },
  },
  {
    id: "deck-full",
    setup: async (p) => {
      await p.evaluate(() => {
        window.__studyGame.giveAllPages();
        window.__studyGame.setScene("deck");
      });
    },
  },
];

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const STATES = process.env.STATES ? process.env.STATES.split(",") : null;
for (const view of VIEWS) {
  if (ONLY && !ONLY.includes(view.name)) continue;
  const page = await browser.newPage({
    viewport: { width: view.w, height: view.h },
    deviceScaleFactor: view.w >= 1440 ? 1 : 2,
  });
  await boot(page);
  for (const st of states) {
    if (STATES && !STATES.includes(st.id)) continue;
    await page.evaluate(() => { document.getElementById("burn-ov")?.remove(); document.querySelectorAll(".wrong-book,.wrong-vig").forEach((e) => e.remove()); });
    await st.setup(page);
    await settle(page);
    for (const where of st.id === "title" || st.id === "battle" ? ["top"] : ["top", "bottom"]) {
      await scrollScene(page, where);
      const found = await collectIssues(page, `${view.name}/${st.id}/${where}`);
      const shotName = `${view.name}_${st.id}_${where}`;
      const important = ["battle-hand9", "burn", "shelf-empty", "shelf-filled", "lib-deck", "keypage", "keypage-locked", "lobby", "sheet", "battle", "battle-inspect", "result-win", "result-lose", "gifts", "gifts-sel", "battle-big", "q-key-mc", "q-key-short", "resist-pop", "guest-stag", "player-stag", "title", "credits", "deck", "deck-full"].includes(st.id);
      if (found.length || important) {
        if (found.length || ["360x740", "390x844", "412x915", "412x780", "1440x900", "844x390"].includes(view.name)) {
          const path = await screenshot(page, shotName);
          if (view.name === "390x844" && st.id === "battle-inspect" && where === "top") {
            const dest = join(ROOT, "shots", "11-card-hold.png");
            writeFileSync(dest, readFileSync(path));
            console.log("WROTE", dest);
          }
          if (view.name === "390x844" && st.id === "deck-full" && where === "top") {
            const dest = join(ROOT, "shots", "12-deck-390.png");
            writeFileSync(dest, readFileSync(path));
            console.log("WROTE", dest);
          }
          if (view.name === "390x844" && st.id === "battle" && where === "top") {
            const dest = join(ROOT, "shots", "13-battle-hud-390.png");
            writeFileSync(dest, readFileSync(path));
            console.log("WROTE", dest);
            const destB = join(ROOT, "shots", "15-battle-390.png");
            writeFileSync(destB, readFileSync(path));
            console.log("WROTE", destB);
          }
          if (view.name === "390x844" && st.id === "lobby" && where === "top") {
            const dest = join(ROOT, "shots", "14-lobby-guests-390.png");
            writeFileSync(dest, readFileSync(path));
            console.log("WROTE", dest);
          }
          for (const [sid, fn] of [["battle-big", "31-intent-big-390.png"], ["q-key-short", "32-short-answer-390.png"], ["resist-pop", "33-resist-390.png"], ["guest-stag", "34-guest-stagger-390.png"], ["player-stag", "35-player-stagger-390.png"], ["q-key-mc", "36-key-mc-390.png"]]) {
            if (view.name === "390x844" && st.id === sid && where === "top") { const dest = join(ROOT, "shots", fn); writeFileSync(dest, readFileSync(path)); console.log("WROTE", dest); }
          }
          if (view.name === "390x844" && st.id === "result-win" && where === "top") {
            const dest = join(ROOT, "shots", "21-result-390.png");
            writeFileSync(dest, readFileSync(path));
            console.log("WROTE", dest);
          }
          if (view.name === "390x844" && st.id === "col-dress" && where === "top") {
            const dest = join(ROOT, "shots", "16-cosmetics-390.png");
            writeFileSync(dest, readFileSync(path));
            console.log("WROTE", dest);
          }
        }
      }
      if (found.length) {
        console.log("ISSUE", `${view.name}/${st.id}/${where}`, JSON.stringify(found, null, 0));
      } else {
        console.log("OK   ", `${view.name}/${st.id}/${where}`);
      }
    }
  }
  await page.close();
}

// functional: long-press must not play the card; quick tap must  (다대다: 탭 = 고른 주사위에 카드 집기, BattleStage.pickCard)
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await boot(page);
  await page.evaluate(MODE(true));
  await page.evaluate(() => window.__studyGame.setScene("lobby"));
  await page.evaluate(() => {
    const id = document.querySelector(window.__G?'[data-guest="'+window.__G+'"]':"[data-guest]")?.dataset.guest;
    if (id) window.__studyGame.beginReception(id);
  });
  await page.waitForTimeout(700);
  await page.evaluate(MB_ASSIGN);
  await page.waitForTimeout(400);
  const picked = () => (window.BattleStage && BattleStage._state().pickCard) || null;
  const holdResult = await page.evaluate(async () => {
    const picked = () => (window.BattleStage && BattleStage._state().pickCard) || null;
    const hand = document.querySelector("#hand"), cs = [...hand.querySelectorAll(".cc[data-card]")];
    const i = cs.findIndex((x) => !x.classList.contains("off")); const c = cs[i];
    if (!c) return { ok: false, err: "no card" };
    const g = hand._geo, r = hand.getBoundingClientRect();
    const x = r.left + g.left0 + i * g.step + (g.step || g.cw) / 2, y = r.bottom - 40;
    const evDown = { bubbles: true, cancelable: true, pointerId: 21, pointerType: "touch", button: 0, buttons: 1, clientX: x, clientY: y };
    c.dispatchEvent(new PointerEvent("pointerdown", evDown));
    await new Promise((r) => setTimeout(r, 340));
    const lifted = c.classList.contains("hot");
    const stillSelect = picked() === null;   // 누르고 있는 동안은 고르지 않는다
    c.dispatchEvent(new PointerEvent("pointercancel", { ...evDown, buttons: 0 }));
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 21 }));
    await new Promise((r) => setTimeout(r, 80));
    const chose = picked() === null;          // 길게 누른 뒤엔 고르지 않은 채로 남는다
    return { ok: lifted && stillSelect && chose, lifted, stillSelect, chose };
  });
  await page.evaluate(() => { window.closeCardInspect && closeCardInspect(); window.__studyGame.renderBattle(); });
  await page.waitForTimeout(400);
  const tapResult = await page.evaluate(async () => {
    const picked = () => (window.BattleStage && BattleStage._state().pickCard) || null;
    const hand = document.querySelector("#hand"), cs = [...hand.querySelectorAll(".cc[data-card]")];
    const i = cs.findIndex((x) => !x.classList.contains("off")); const c = cs[i];
    if (!c) return { ok: false, err: "no card" };
    const g = hand._geo, r = hand.getBoundingClientRect();
    const x = r.left + g.left0 + i * g.step + (g.step || g.cw) / 2, y = r.bottom - 40;
    const evDown = { bubbles: true, cancelable: true, pointerId: 22, pointerType: "touch", button: 0, buttons: 1, clientX: x, clientY: y };
    c.dispatchEvent(new PointerEvent("pointerdown", evDown));
    await new Promise((r) => setTimeout(r, 40));
    c.dispatchEvent(new PointerEvent("pointerup", { ...evDown, buttons: 0 }));
    c.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 80));
    const id = c.dataset.card;
    return { ok: picked() === id, picked: picked(), card: id };
  });
  console.log("HOLD TEST", holdResult);
  console.log("TAP TEST", tapResult);
  if (!holdResult.ok || !tapResult.ok) {
    issues.push({ label: "functional/hold-tap", type: "behavior", holdResult, tapResult });
  }
  await page.close();
}

await browser.close();
server.close();

const report = { issues, consoleErrs, count: issues.length };
writeFileSync(join(SHOT, "report.json"), JSON.stringify(report, null, 2));
console.log("\n==== SUMMARY ====");
/* 배포 기준(docs/decisions.md): 전투 UI끼리 겹침은 0건이어야 한다.
   fighter-front-ui(캐릭터와 앞쪽 UI 겹침)는 참고용이라 출력만 하고 실패로 치지 않는다. */
const ADVISORY = new Set(["fighter-front-ui"]);
const blocking = issues.filter(i => !ADVISORY.has(i.type));
console.log("issues:", issues.length, "(blocking:", blocking.length + ", advisory fighter-front-ui:", (issues.length - blocking.length) + ")");
console.log("console errors:", consoleErrs.length);
if (consoleErrs.length) console.log(consoleErrs);
if (issues.length) {
  const by = {};
  for (const i of issues) {
    const k = i.type + " @ " + i.label;
    by[k] = (by[k] || 0) + 1;
  }
  console.log(by);
}
process.exit(blocking.length ? 1 : 0);
