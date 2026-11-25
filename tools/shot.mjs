/* 화면 찍기(눈으로 확인용): node tools/shot.mjs [장면 ...] [--size land|port|both] [--guest id] [--out 폴더]
   장면(여러 개 가능, 없으면 deploy):
     floors · library · moon            기본 화면(index.html)
     battle · assign · resolve           전투 3:3(문제 / 책장 하나 놓은 뒤 / 개막 뒤 합 중), tests/battle.html
     gimmick                             기믹: 모욕죄 손님(--guest 무시), 손패를 기믹 책장으로, 상태 칩(출혈·신속 등), 반격 책장 하나 놓음
     einfo                               적 주사위 하나를 누른 모습(정보창 + 그 주사위의 대상 선만 실선)
     aim                                 내 주사위 전부를 첫 적의 주사위 하나에 놓은 뒤(합 하나 + 나머지 일방 공격 화살표)
     outfit:<장서복 id>                  사서(kyu)가 그 장서복을 입은 모습, tests/stage.html  예) outfit:archivist
     monsters · monsters-assign          괴물 적 확인: 손님(--guest) 적에 model 을 넣고(우두머리 dragon, 나머지 slime_pink·puppet_mage·robot_large) battle·assign 과 같은 화면
     fx:<참격|관통|타격|방어|회피>         그 종류 로우폴리 타격 이펙트를 첫 적 몸에 멈춰 세운 모습(가로만)
     faces                               다섯 모델 얼굴 가까이(정면·비스듬히·옆), 실제 게임과 같은 입 메우기 적용
     deploy                              = floors library moon battle assign resolve (배포 전 확인용)
   크기: land=844×390, port=390×844, both(기본). faces·outfit 은 land 만.
   결과: shots/shot/<장면>-<가로>x<세로>.png (git 에 안 올림). 페이지 오류가 있으면 끝에 출력하고 종료 코드 1.
   서버는 이 스크립트가 직접 띄운다(python 서버 필요 없음). 3D 는 swiftshader 라 한 장면에 몇 초 걸린다. */
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { extname, join, normalize } from "path";
import { LIB_ROOT, launchBrowser } from "../tests/lib/browser.mjs";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const SIZE = opt("size", "both"), GUEST = opt("guest", "beccaria"), OUT = join(LIB_ROOT, opt("out", "shots/shot"));
let scenes = args.filter(a => !a.startsWith("--")); if (!scenes.length) scenes = ["deploy"];
scenes = scenes.flatMap(s => s === "deploy" ? ["floors", "library", "moon", "battle", "assign", "resolve"] : [s]);
mkdirSync(OUT, { recursive: true });

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary" };
const server = createServer((q, r) => { const u = decodeURIComponent((q.url || "/").split("?")[0]); const a = normalize(join(LIB_ROOT, u === "/" ? "/index.html" : u));
  if (!a.startsWith(LIB_ROOT) || !existsSync(a)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[extname(a)] || "application/octet-stream" }); r.end(readFileSync(a)); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const BASE = "http://127.0.0.1:" + server.address().port + "/";
const browser = await launchBrowser(chromium, { args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const errs = [], saved = [];
const SIZES = { land: [844, 390], port: [390, 844] };
const sizesFor = s => (/^(faces|outfit:|fx:)/.test(s) || SIZE === "land") ? [SIZES.land] : SIZE === "port" ? [SIZES.port] : [SIZES.land, SIZES.port];

/* monsters 장면: 적 차례대로 이 모델(우두머리가 첫 적) — 겹침 검사 --monsters 와 같음 */
const MONSTER_MODELS = ["dragon", "slime_pink", "puppet_mage", "robot_large"];
/* 겹침 검사와 같은 3:3 구성 */
const party3 = () => { const G = __studyGame, s = G.save; s.unlockedKeyIds = ["novice", "reading-room", "midnight", "archivist", "classical-robe", "panopticon-coat", "truth-robe", "pad8", "pad9", "pad10"]; G.libs.sync(s);
  G.libs.equipKey(s, "lib2", "archivist"); G.libs.equipKey(s, "lib3", "classical-robe"); G.libs.setParty(s, ["kyu", "lib2", "lib3"]); Game.persist(); };
/* aim: 나를 노리는 적 주사위 하나와 합을 만들고(그 적 주사위가 바닥 더미로), 나머지 내 주사위도 같은 적 주사위에 → 일방 공격 화살표 */
const aimAll = () => { const B = Game.battle.state, G = Game.battle, allies = B.units.filter(u => u.side === "ally" && u.hp > 0);
  let ed = null; for (const e of B.units.filter(u => u.side === "enemy" && u.hp > 0)) e.dice.forEach((d, i) => { if (!ed && d.target && d.target.die != null && allies.some(a => a.id === d.target.unit)) ed = { unit: e.id, die: i, t: d.target }; });
  if (!ed) return false; const card = uid => G.hand(uid).find(c => G.usable(uid, c).usable);
  const c0 = card(ed.t.unit); if (c0) G.assign(ed.t.unit, ed.t.die, c0, { unit: ed.unit, die: ed.die });
  for (const a of allies) a.dice.forEach((d, i) => { if (d.card) return; const c = card(a.id); if (c) G.assign(a.id, i, c, { unit: ed.unit, die: ed.die }); });
  return allies.some(a => a.dice.some((d, i) => G.isClash(a.id, i))); };   /* 더 빠른 내 주사위가 그 적 주사위를 끌어가 합 짝이 바뀔 수 있음 */
/* 살아 있는 사서 주사위마다 쓸 수 있는 책장을 첫 적에게 놓는다(n 개까지) */
const fill = n => { const B = Game.battle.state; let k = 0;
  for (const u of B.units.filter(u => u.side === "ally" && u.hp > 0)) u.dice.forEach((d, i) => { if (k >= n || d.card) return; const e = B.units.find(x => x.side === "enemy" && x.hp > 0);
    const c = Game.battle.hand(u.id).find(c => Game.battle.usable(u.id, c).usable); if (c && e && Game.battle.assign(u.id, i, c, { unit: e.id, die: 0 }).ok) k++; }); };

async function shoot(p, name, w, h) { const f = join(OUT, `${name.replace(/[:/]/g, "-")}-${w}x${h}.png`); await p.screenshot({ path: f }); saved.push(f); }

async function run(scene, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
  p.on("pageerror", e => errs.push(`${scene} ${w}x${h}: ${e.message}`)); p.on("console", m => { if (m.type() === "error" && !/favicon|404/.test(m.text())) errs.push(`${scene} ${w}x${h}: ${m.text()}`); });
  try {
    if (["floors", "library", "moon"].includes(scene)) {
      await p.goto(BASE + "index.html"); await p.waitForFunction(() => window.__app, null, { timeout: 30000 });
      if (scene !== "floors") await p.evaluate(s => window.__app.nav[s](), scene);
      await p.waitForTimeout(1500);
    } else if (["battle", "assign", "aim", "einfo", "gimmick", "resolve", "monsters", "monsters-assign"].includes(scene)) {
      await p.goto(BASE + "tests/battle.html?guest=" + (scene === "gimmick" ? "insult" : GUEST)); await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
      await p.evaluate(party3);
      if (scene.startsWith("monsters")) await p.evaluate(([gid, ms]) => { ms.forEach((m, i) => { const e = Game.data.GUEST_BY[gid].enemies[i]; if (e) e.model = m; }); }, [GUEST, MONSTER_MODELS]);
      await p.evaluate(async () => { window.__battle.unmount(); Game.battle.leave(); window.__battle = await window.__mount(); });
      await p.waitForSelector("#question.on");
      if (scene !== "battle" && scene !== "monsters") {
        const ci = await p.evaluate(() => Game.battle.question().correctIndex);
        await p.evaluate(ci => { const b = document.querySelector(`.q-opt[data-i="${ci}"]`); if (b) b.click(); else Game.battle.answer(true); }, ci);
        await p.waitForTimeout(600); if (scene === "gimmick") { await p.evaluate(() => { const A = __studyGame.battleApi, X = A.internals(), B = Game.battle.state;
          X.a1.handIds.splice(0, X.a1.handIds.length, "complaint-only", "press-megaphone", "intent-to-defame", "singled-out", "social-norm-shield"); const a = B.units.find(u => u.id === "a1"); a.light = 6; a.maxLight = 6; a.emotion = 2;
          Game.battle.give("a1", "haste", 2); Game.battle.give("a1", "bleed", 3); const e = B.units.find(u => u.side === "enemy"); Game.battle.give(e.id, "bleed", 4); Game.battle.give(e.id, "para", 1);
          Game.battle.assign("a1", 0, "complaint-only", null); window.__battle.render(); }); await p.waitForTimeout(400); } else if (scene === "einfo") { await p.click('.speed-die[data-side="enemy"]'); await p.waitForTimeout(300); } else if (scene === "aim") { if (!await p.evaluate(aimAll)) errs.push(`aim ${w}x${h}: 합을 못 만듦`); } else await p.evaluate(fill, scene === "assign" ? 1 : 99); await p.evaluate(() => window.__battle.render && window.__battle.render());
        if (scene === "resolve") { await p.click("#btn-open"); await p.waitForSelector("#clash-panel.on .cp-die.shown", { timeout: 30000 }); await p.waitForTimeout(150); }
        else await p.waitForTimeout(400);
      } else await p.waitForTimeout(800);
    } else if (scene.startsWith("outfit:")) {
      const id = scene.slice(7);
      await p.goto(BASE + "tests/stage.html"); await p.waitForFunction(() => window.__stageMod);
      const ok = await p.evaluate(async id => { const K = Game.data.KEY_PAGES, A = K.find(k => k.id === id); if (!A) return false;
        if (A !== K[0]) K[0].look = A.look ? JSON.parse(JSON.stringify(A.look)) : undefined;
        const S = await __stageMod.createStage(document.getElementById("stage")); S.setFloor(Game.data.floorStage("crime")); await S.showLibrarian("kyu"); return true; }, id);
      if (!ok) { errs.push(`${scene}: 그런 장서복 id 없음`); return; }
      await p.waitForTimeout(1500);
    } else if (scene.startsWith("fx:")) {   /* fx:<참격|관통|타격|방어|회피> 그 종류 로우폴리 타격 이펙트를 첫 적 몸에 멈춰 세운 모습(3:3). swiftshader 는 느려서 실제 재생 순간을 못 잡으므로 고정 */
      const kind = scene.slice(3);
      await p.goto(BASE + "tests/stage.html"); await p.waitForFunction(() => window.__stageMod);
      await p.evaluate(async kind => { Game.battle.leave(); Game.battle.begin("beccaria"); const U = Game.battle.state.units, e = U.find(u => u.side === "enemy").id, a = U.find(u => u.side === "ally").id;
        const S = await __stageMod.createStage(document.getElementById("stage")); S.setFloor(Game.data.floorStage("crime")); await S.setUnits(U, Game.data.GUEST_BY.beccaria);
        const FX = await import("/js/stage/fx.js"), THREE = await import("three"), F = S.figure(e), o = F.obj;
        const pos = o.position.clone().add(new THREE.Vector3(0, F.height * o.scale.y * 0.55, 0.3));
        FX.typeFx({ add: (obj, ms, step) => { S.scene.add(obj); step(0.25, 0, 0); } }, kind, pos, 1); }, kind);
      await p.waitForTimeout(600);
    } else if (scene === "faces") {
      await p.goto(BASE + "tests/stage.html"); await p.waitForFunction(() => window.__stageMod);
      await p.evaluate(async ([W, H]) => {
        const THREE = await import("three"), C = await import("/js/stage/characters.js"); await C.loadCharacters();
        const M = ["Mage", "Knight", "Barbarian", "Rogue", "Rogue_Hooded"], heads = M.map(m => { let h = null; C.makeFigure({ model: m, palette: { accent: "#888888" }, scale: 1 }).obj.traverse(n => { if (n.isMesh && /_Head/.test(n.name)) h = n; }); return h; });
        document.body.innerHTML = ""; const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(W, H); document.body.appendChild(r.domElement); r.setScissorTest(true);
        const angles = [0, 0.5, 1.1], cw = W / M.length, ch = H / angles.length;
        angles.forEach((ang, ri) => heads.forEach((h, ci) => { if (!h) return; const s = new THREE.Scene(); s.background = new THREE.Color(0x404448);
          const g = h.geometry; s.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({ map: h.material.map, shininess: 24, specular: 0x161616 })));
          s.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(0.6, 0.8, 1.5); s.add(d);
          g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), dist = sz.y * 2.2;
          const cam = new THREE.PerspectiveCamera(30, cw / ch, 0.01, 100); cam.position.set(c.x + Math.sin(ang) * dist, c.y - sz.y * 0.1, c.z + Math.cos(ang) * dist); cam.lookAt(c.x, c.y - sz.y * 0.1, c.z);
          r.setViewport(ci * cw, H - (ri + 1) * ch, cw, ch); r.setScissor(ci * cw, H - (ri + 1) * ch, cw, ch); r.render(s, cam); }));
      }, [w, h]);
    } else { errs.push(`모르는 장면: ${scene}`); return; }
    await shoot(p, scene, w, h);
  } catch (e) { errs.push(`${scene} ${w}x${h}: ${e.message.split("\n")[0]}`); }
  finally { await ctx.close(); }
}

for (const s of scenes) for (const [w, h] of sizesFor(s)) await run(s, w, h);
await browser.close(); server.close();
for (const f of saved) console.log(f);
if (errs.length) { console.log("\n오류:"); errs.forEach(e => console.log("  " + e)); process.exitCode = 1; }
