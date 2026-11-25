/* 적 모델 카탈로그 그림: js/stage/monsters.js 의 MONSTERS 를 분류별 격자로 그려 docs/monsters/<kind>.png 로 저장.
   새 강의 적에 model 을 고를 때 본다(.claude/skills/add-lecture). 실제 게임과 같은 figure(키·폭 맞춤, 색 물들이기, 꼭두각시 장식)를
   등불 서고 조명으로, 왼쪽에 반투명한 사람 기사(키 비교용)와 함께. 실행: node tools/assets/catalog.mjs */
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { extname, join, normalize } from "path";
import { LIB_ROOT, launchBrowser } from "../../tests/lib/browser.mjs";

const OUT = join(LIB_ROOT, "docs/monsters"); mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const server = createServer((q, r) => { const u = decodeURIComponent((q.url || "/").split("?")[0]); const a = normalize(join(LIB_ROOT, u));
  if (!a.startsWith(LIB_ROOT) || !existsSync(a)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[extname(a)] || "application/octet-stream" }); r.end(readFileSync(a)); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const BASE = "http://127.0.0.1:" + server.address().port + "/";
const browser = await launchBrowser(chromium, { args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1800, height: 1400 } }); const errs = [];
page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
await page.goto(BASE + "tests/stage.html"); await page.waitForFunction(() => window.__stageMod, null, { timeout: 20000 });
const kinds = await page.evaluate(async () => (await import("/js/stage/monsters.js")).MONSTER_KINDS);
for (const kind of kinds) {
  const n = await page.evaluate(async kind => {
    const THREE = await import("three"), C = await import("/js/stage/characters.js"), L = await import("/js/stage/looks.js"), { MONSTERS } = await import("/js/stage/monsters.js");
    const ids = Object.keys(MONSTERS).filter(k => MONSTERS[k].kind === kind);
    await C.loadCharacters(); await C.loadMonsters(ids);
    const W = 300, H = 300, cols = 6, rows = Math.ceil(ids.length / cols);
    document.body.innerHTML = `<div id="g" style="position:relative;background:#15110e;width:${W * cols}px;font:600 15px sans-serif;color:#f0e2c8"></div>`;
    const R = new THREE.WebGLRenderer({ antialias: true }); R.setSize(W * cols, H * rows); R.setScissorTest(true); R.outputColorSpace = THREE.SRGBColorSpace;
    const g = document.getElementById("g"); g.appendChild(R.domElement);
    ids.forEach((id, i) => {
      const s = new THREE.Scene(); s.background = new THREE.Color(0x15110e);
      s.add(new THREE.HemisphereLight(0x2c4048, 0x15110e, 2)); const k = new THREE.DirectionalLight(0xffb36b, 2.6); k.position.set(-3, 6, 4); s.add(k);
      const r = new THREE.DirectionalLight(0x4fa3a3, 1.1); r.position.set(4, 3, -5); s.add(r);
      const f = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.9 })); f.rotation.x = -Math.PI / 2; s.add(f);
      const ref = C.makeFigure({ model: "Knight", palette: L.PALETTES.steel, scale: 0.9 }); ref.obj.scale.setScalar(0.9); ref.act("Idle"); ref.update(0.6); ref.obj.position.x = -1.15;
      ref.obj.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.transparent = true; n.material.opacity = 0.3; } }); s.add(ref.obj);
      const F = C.makeFigure({ monster: id, model: "Rogue", palette: L.PALETTES.crimson, scale: 0.9 }); F.obj.scale.setScalar(0.9); F.act("Idle"); F.update(0.6);
      F.obj.position.x = 0.45; F.obj.rotation.y = -0.5; s.add(F.obj);
      const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50); cam.position.set(0.3, 2.4, 7); cam.lookAt(-0.2, 0.95, 0);
      const x = (i % cols) * W, y = (rows - 1 - Math.floor(i / cols)) * H; R.setViewport(x, y, W, H); R.setScissor(x, y, W, H); R.render(s, cam);
      const d = document.createElement("div"); d.style.cssText = `position:absolute;left:${(i % cols) * W}px;top:${Math.floor(i / cols) * H + 8}px;width:${W}px;text-align:center;text-shadow:0 1px 2px #000`;
      d.textContent = id + (F.monster ? "" : " (실패)"); g.appendChild(d);
    });
    return ids.length;
  }, kind);
  await page.locator("#g").screenshot({ path: join(OUT, kind + ".png") }); console.log(kind, n);
}
await browser.close(); server.close();
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
