/* 무대 성능 확인(참고용, run.mjs 대상 아님): node tests/perf.mjs [가로 세로]
   tests/stage.html 에 3:3 전투(beccaria, 사서 kyu·lib2·lib3)를 띄우고, CDP 로 CPU 4배 감속을 건 뒤
     1) 가만히 10초: 평균·p95·최대 프레임 시간
     2) S.play 연속 재생(교환을 계속 만들어 이어서 재생) 10초: 같은 값
   을 출력한다. 33ms(30fps) 이하가 목표. 이 Chromium 은 --use-gl=swiftshader(소프트웨어 GL)라 실제 GPU 보다 훨씬 느리다
   — 수치는 참고용으로만 본다. 환경변수: PERF_SECONDS(기본 10), PERF_THROTTLE(기본 4), PERF_DPR(기본 2) */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";

const ROOT = LIB_ROOT;
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390);
const SECONDS = +(process.env.PERF_SECONDS || 10), THROTTLE = +(process.env.PERF_THROTTLE || 4);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".glb": "model/gltf-binary" };
const server = createServer((q, r) => { const u = decodeURIComponent((q.url || "/").split("?")[0]); const a = normalize(join(ROOT, u)); if (!a.startsWith(ROOT) || !existsSync(a)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[extname(a)] || "application/octet-stream" }); r.end(readFileSync(a)); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const BASE = "http://127.0.0.1:" + server.address().port + "/";
const b = await launchBrowser(chromium, { args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.PERF_DPR || 2) });   /* 휴대폰처럼 dpr 2 → 무대는 1.5 로 자름 */
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto(BASE + "tests/stage.html"); await p.waitForFunction(() => window.__stageMod, null, { timeout: 15000 });

await p.evaluate(async () => {
  const G = __studyGame, s = G.save;
  s.unlockedKeyIds = ["novice", "reading-room", "midnight", "archivist", "classical-robe", "panopticon-coat", "truth-robe", "pad8", "pad9", "pad10"]; G.libs.sync(s);
  G.libs.equipKey(s, "lib2", "archivist"); G.libs.equipKey(s, "lib3", "classical-robe"); G.libs.setParty(s, ["kyu", "lib2", "lib3"]);
  Game.battle.leave(); Game.battle.begin("beccaria");
  /* 프레임 하나에 메인 스레드가 쓰는 JS 시간(애니메이션·연출 계산 + 그리기 명령) — CPU 감속이 실제로 거는 부분 */
  window.__jt = []; const raf0 = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf0(t => { const s = performance.now(); cb(t); __jt.push(performance.now() - s); });
  const S = await __stageMod.createStage(document.getElementById("stage")); window.__S = S; S.setFloor(Game.data.floorStage("crime"));
  await S.setUnits(Game.battle.state.units, Game.data.GUEST_BY.beccaria);
  /* 프레임 시간 기록기 */
  window.__ft = []; window.__rt = []; let last = performance.now();
  /* 렌더 호출 한 번에 메인 스레드가 쓰는 시간(그리기 명령 보내기 + 애니메이션 계산은 따로 tickers) */
  const r0 = S.renderer.render.bind(S.renderer); S.renderer.render = (a, c) => { const t = performance.now(); r0(a, c); __rt.push(performance.now() - t); };
  S.onFrame(() => { const n = performance.now(); __ft.push(n - last); last = n; });
  /* 한 막을 돌려 교환 목록을 만든다(적이 다 쓰러지면 새로 시작) */
  window.__scene = () => {
    if (Game.battle.outcome) { Game.battle.leave(); Game.battle.begin("beccaria"); }
    Game.battle.answer(true); const B = Game.battle.state, en = B.units.filter(u => u.side === "enemy" && u.hp > 0);
    for (const u of B.units.filter(u => u.side === "ally" && u.hp > 0)) u.dice.forEach((d, i) => { const c = Game.battle.hand(u.id).find(c => Game.battle.usable(u.id, c).usable); if (c && en.length) Game.battle.assign(u.id, i, c, { unit: en[i % en.length].id, die: 0 }); });
    const R = Game.battle.stepBegin(), evs = []; let ev; while ((ev = Game.battle.stepNext(R))) evs.push(ev); Game.battle.stepEnd(R);
    return evs.filter(e => e.kind !== "skip" && !(e.result && e.result.dead && e.result.dead.length));   /* 연출만 재려고 쓰러짐은 뺀다 */
  };
  await new Promise(r => setTimeout(r, 1500));   /* 셰이더 컴파일 등 첫 프레임 정리 */
});

const cdp = await ctx.newCDPSession(p);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

const stats = a => { const s = a.slice().sort((x, y) => x - y), avg = a.reduce((x, y) => x + y, 0) / (a.length || 1);
  return { frames: a.length, avg: +avg.toFixed(1), p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1), max: +(s[s.length - 1] || 0).toFixed(1) }; };

/* 1) 가만히 */
await p.evaluate(() => { __ft.length = 0; __rt.length = 0; __jt.length = 0; });
await p.waitForTimeout(SECONDS * 1000);
const idle = stats(await p.evaluate(() => __ft.slice(1))), idleR = stats(await p.evaluate(() => __rt.slice(1))), idleJ = stats(await p.evaluate(() => __jt.slice(1)));

/* 2) 교환 연속 재생 */
const play = await p.evaluate(async (sec) => {
  __ft.length = 0; __rt.length = 0; __jt.length = 0; const t0 = performance.now(); let plays = 0; const S = __S;
  while (performance.now() - t0 < sec * 1000) { const evs = __scene(); if (!evs.length) continue;
    for (const ev of evs) { if (performance.now() - t0 >= sec * 1000) break; await S.play(ev); plays++; } }
  return { ft: __ft.slice(1), rt: __rt.slice(1), jt: __jt.slice(1), plays };
}, SECONDS);
const playS = stats(play.ft), playR = stats(play.rt), playJ = stats(play.jt);

const info = await p.evaluate(() => ({ dpr: devicePixelRatio, pixelRatio: __S.renderer.getPixelRatio(), canvas: [__S.renderer.domElement.width, __S.renderer.domElement.height],
  programs: __S.renderer.info.programs.length, calls: __S.renderer.info.render.calls, triangles: __S.renderer.info.render.triangles,
  pointLights: (() => { let n = 0; __S.scene.traverse(o => { if (o.isPointLight) n++; }); return n; })() }));

console.log(`무대 성능 ${W}×${H}, CPU ${THROTTLE}배 감속, ${SECONDS}초씩 — 참고용: 이 Chromium 은 swiftshader(소프트웨어 GL)라 실제 휴대폰 GPU 보다 느리다`);
console.log("렌더", JSON.stringify(info));
console.log(`가만히      프레임 평균 ${idle.avg}ms  p95 ${idle.p95}ms  최대 ${idle.max}ms  (${idle.frames}프레임) · 프레임당 JS 평균 ${idleJ.avg}ms (render 호출 ${idleR.avg}ms)`);
console.log(`교환 재생   프레임 평균 ${playS.avg}ms  p95 ${playS.p95}ms  최대 ${playS.max}ms  (${playS.frames}프레임, play ${play.plays}번) · 프레임당 JS 평균 ${playJ.avg}ms 최대 ${playJ.max}ms (render 호출 ${playR.avg}ms)`);
console.log(idle.avg <= 33 && playS.avg <= 33 ? "목표(프레임 평균 33ms 이하) 안" : "목표(프레임 평균 33ms 이하) 넘음 — swiftshader 는 그리기(픽셀)를 CPU 로 하므로 프레임 시간은 크게 나온다. 메인 스레드 몫은 '프레임당 JS' 를 본다");
if (errs.length) console.log("page errors", errs);
await b.close(); server.close();
