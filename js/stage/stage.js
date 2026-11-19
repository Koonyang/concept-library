/* 3D 무대(배경층). 규칙은 모른다: UI 가 층 설정·유닛·교환 이벤트를 넘기면 그리기만 한다.
   const S = await createStage(canvas)
     S.ok                   WebGL 을 못 만들면 false (그 뒤 모든 호출은 아무것도 안 하고 play 는 바로 끝남)
     S.setFloor({mood, accent, props})   층 분위기·책장·소품 (Game.data.floorStage(id) 결과 그대로)
     S.resize()             캔버스 크기에 맞춤(창 크기 변화는 자동)
     S.play(ev, opts)       교환 연출 → Promise (Task 5)
     S.showLibrarian(libId) 유닛 없이 그 사서 한 명만 가운데에 세움(장착 장서복 복장 반영) → Promise
     S.cheer()              서 있는 사서가 Cheer 한 번 → Promise
     S.burnBook({cover, n, fast}) 도서관 책 소각: 사서 앞에서 책이 빛나다 낱장으로 흩날리며 사라짐(1.4초, fast 0.4초) → Promise
     S.wrongBonk(ids?)      오답: 살아 있는 사서(ids, 없으면 전부) 머리에 작은 책이 떨어져 콩 → 움찔·짧은 흔들림(0.6초) → Promise
     S.debug                {mood, props, frames, ...} 테스트용 */
import * as THREE from "three";
import { MOODS, DEFAULT_MOOD } from "./moods.js";
import { buildProp } from "./props.js";
import { loadCharacters, makeFigure } from "./characters.js";
import { lookOf, MAGIC_MODELS } from "./looks.js";
import { CUSTOM_FX, registerFx, TIERS, tierRank, burst, flash, ring, fragments, dropBook, burnBook as burnBookFx, bonkBook, BONK_HIT_AT } from "./fx.js";
export { registerFx };

const PIXEL_RATIO_MAX = 1.5;
/* 느린 기기: 2초 평균 프레임이 34ms 를 넘으면 픽셀 비율을 0.25씩 내린다(1.0 까지, 다시 올리지 않음) */
const PIXEL_RATIO_MIN = 1, SLOW_FRAME_MS = 34, SLOW_WINDOW_MS = 2000;
/* 연출용 점광원 묶음(타격 빛, 책 빛). 점광원 수가 바뀌면 셰이더를 다시 만들어 멈칫하므로 처음부터 이 수만큼 둔다 */
const FX_LIGHTS = 1;
const CAM = { fov: 34, pos: new THREE.Vector3(0, 2.7, 8.2), look: new THREE.Vector3(0, 1.05, 0), baseAspect: 844 / 390 };
/* 세로 화면(390×844) 카메라: 앞으로 당기고 더 내려다본다(약 26°, 가로는 약 11°). 유닛 6명이 폭의 80% 넘게,
   머리~발이 화면 위쪽 30%~45%쯤에 온다. 아래 40%는 문제·손패 UI 자리. 가로와 세로 사이 비율은 둘을 섞는다. */
const CAM_TALL = { hfov: 61, pos: new THREE.Vector3(0, 2.25, 6.75), look: new THREE.Vector3(0, -1.0, 0), aspect: 390 / 844 };
/* 편 고리(발밑): 사서 청록, 적 붉은색. 우두머리는 더 크고 진하게 */
const RING = { ally: { color: 0x8fd3c8, r: 0.52, op: 0.85 }, enemy: { color: 0xe88a7e, r: 0.52, op: 0.85 }, leader: { color: 0xf06e5e, r: 0.66, op: 1 } };
/* 소품 자리: 무대 가장자리, 가운데(유닛 자리 x∈[-3.4,3.4], z∈[-0.9,0.9])를 피해서 */
const PROP_SLOTS = [[-5.0, -2.4], [5.0, -2.4], [-6.0, 0.6], [6.0, 0.6], [-3.0, -4.3], [3.0, -4.3]];
const MAX_PROP_LIGHTS = 3;
/* 유닛 자리: 사서 왼쪽 x∈[-3.4,-2.0], 적 오른쪽(대칭). 한 편 n명일 때 [x, z] (z 앞=+) */
const SLOTS = { 1: [[2.6, 0]], 2: [[3.1, -0.7], [2.0, 0.7]], 3: [[2.6, -0.1], [3.8, -1.1], [1.6, 0.9]] };
const FACE = Math.PI / 2 * 0.62;          /* 서로 마주 보되 카메라 쪽으로 조금 */
/* 교환 연출 시간(ms): 합 1.0초, 단계가 늘면 +0.2초, 최대 1.6초. 빨리 감기 0.35초. 맞는 순간은 40% 지점 */
export const CLASH_MS = 1000, STEP_MS = 200, MAX_MS = 1600, FAST_MS = 350, HIT_AT = 0.4;
/* 도서관 책 소각 연출 시간(ms) */
export const BURN_MS = 1400, BURN_FAST_MS = 400;
/* 오답 연출 시간(ms): 책이 떨어져 맞고 튕겨 사라질 때까지 */
export const BONK_MS = 600;
const ATTACK_ANIM = { 참격: "1H_Melee_Attack_Slice_Diagonal", 관통: "1H_Melee_Attack_Stab", 타격: "2H_Melee_Attack_Chop" };

function nullStage() {
  const done = () => Promise.resolve();
  return { ok: false, setFloor() {}, resize() {}, setUnits: done, showLibrarian: done, cheer: done, play: done, burnBook: done, wrongBonk: done, finishNow() {}, syncUnits() {}, setStaggered() {}, unitPoint: () => null, figure: () => null,
    ring: () => null, onFrame() {}, dispose() {}, debug: { mood: null, props: [], frames: 0 } };
}

/* 발밑 편 고리: 부드러운 가장자리의 얇은 고리 텍스처 하나를 색만 바꿔 쓴다(더하기 섞기라 바닥에서 살짝 빛남) */
let ringTex = null;
function sideRing(R) {
  if (!ringTex) { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.66, "rgba(255,255,255,0)"); g.addColorStop(0.74, "rgba(255,255,255,.35)");
    g.addColorStop(0.8, "rgba(255,255,255,1)"); g.addColorStop(0.86, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); ringTex = new THREE.CanvasTexture(c); ringTex.colorSpace = THREE.SRGBColorSpace; }
  const size = R.r / 0.8 * 2;     /* 텍스처의 가장 밝은 곳(반지름 80%)이 R.r 에 오게 */
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: ringTex, color: R.color, transparent: true, opacity: R.op,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 1; m.name = "side-ring"; return m;
}

/* 무대(바닥·책장·책)는 거친 무광이라 Lambert 로 충분하다(Standard 보다 픽셀당 계산이 훨씬 가벼움) */
function mat(c, o) { return new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o || {})); }
function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export async function createStage(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: false });
  } catch (e) { console.warn("[stage] WebGL 없음 — 무대 없이 진행", e && e.message); return nullStage(); }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(CAM.fov, CAM.baseAspect, 0.1, 80);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1); key.position.set(-3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0); rim.position.set(4, 3, -5); scene.add(rim);
  let world = null, flicker = [], dust = null;
  const tickers = new Set();          /* (dt, now) => void — 캐릭터·연출이 매 프레임 쓰는 것 */
  const debug = { mood: null, props: [], frames: 0, lastTier: null, bookDrops: 0, lastPlayMs: 0, pixelRatio };
  /* 연출용 빛 묶음: 늘 장면에 있고 꺼져 있다가 fx.light 로 빌려 쓴다 */
  const fxLights = Array.from({ length: FX_LIGHTS }, () => { const L = new THREE.PointLight(0xffffff, 0, 6, 2); L.userData.free = true; scene.add(L); return L; });
  function borrowLight(color, distance, pos) {
    const L = fxLights.find(l => l.userData.free); if (!L) return null;
    L.userData.free = false; L.color.set(color); L.distance = distance; L.intensity = 0; L.position.copy(pos);
    return { get intensity() { return L.intensity; }, set intensity(v) { L.intensity = v; }, release() { L.intensity = 0; L.userData.free = true; } };
  }
  const camShake = { amp: 0 };
  const camBase = { pos: CAM.pos.clone(), look: CAM.look.clone() };   /* 화면 비율에 따라 resize 가 정한다 */
  const focus = { k: 0, target: 0, x: 0, z: 0 }, dim = { k: 0, target: 0 }, time = { scale: 1 };
  let lightBase = { hemi: 1, key: 1, rim: 0 };

  function disposeTree(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(m => m.dispose()); }); }

  function setFloor(cfg) {
    cfg = cfg || {};
    const moodKey = MOODS[cfg.mood] ? cfg.mood : DEFAULT_MOOD, T = MOODS[moodKey];
    const accent = new THREE.Color(cfg.accent || 0xd9a35a);
    if (world) { scene.remove(world); disposeTree(world); }
    world = new THREE.Group(); world.name = "world"; scene.add(world); flicker = [];
    scene.background = new THREE.Color(T.bg); scene.fog = new THREE.Fog(T.fog[0], T.fog[1], T.fog[2]);
    hemi.color.set(T.amb[0]); hemi.groundColor.set(T.bg); hemi.intensity = T.amb[1];
    key.color.set(T.key[0]); key.intensity = T.key[1]; rim.color.set(T.rim[0]); rim.intensity = T.rim[1];
    lightBase = { hemi: T.amb[1], key: T.key[1], rim: T.rim[1] };

    /* 팔각 단 */
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.5, 0.3, 8), mat(T.floor)); floor.position.y = -0.15; floor.rotation.y = Math.PI / 8; world.add(floor);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.6, 0.12, 8), mat(T.floorEdge)); ring.position.y = -0.32; ring.rotation.y = Math.PI / 8; world.add(ring);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(7.25, 0.04, 3, 8), mat(accent.getHex(), { emissive: accent, emissiveIntensity: 0.25 }));
    trim.rotation.x = Math.PI / 2; trim.rotation.z = Math.PI / 8; trim.position.y = 0.01; world.add(trim);

    /* 뒤쪽 호를 따라 책장 9개. 책 색 = 분위기 색 + 층 포인트 색 */
    /* 책 수백 권은 InstancedMesh 하나로 그린다(그리기 호출 ~400 → 1) */
    const R = rnd(7919), palette = [...T.books, accent.getHex()].map(c => new THREE.Color(c));
    const shelfGeo = new THREE.BoxGeometry(2.1, 4.8, 0.5), shelfMat = mat(T.shelf), books = [], tmp = new THREE.Object3D();
    for (let k = -4; k <= 4; k++) {
      const a = k * 0.2, sh = new THREE.Group(); sh.position.set(Math.sin(a) * 10, 0, -Math.cos(a) * 10 + 1.4); sh.rotation.y = -a; sh.updateMatrix();
      const frame = new THREE.Mesh(shelfGeo, shelfMat); frame.position.y = 2.4; sh.add(frame);
      for (let row = 0; row < 4; row++) { let bx = -0.92;
        while (bx < 0.86) { const w = 0.1 + R() * 0.12, h = 0.55 + R() * 0.3, c = palette[Math.floor(R() * palette.length)];
          tmp.scale.set(w, h, 1); tmp.position.set(bx + w / 2, 0.47 + row * 1.12 + h / 2, 0.12); tmp.rotation.set(0, 0, R() < 0.12 ? (R() - 0.5) * 0.4 : 0); tmp.updateMatrix();
          books.push({ m: sh.matrix.clone().multiply(tmp.matrix), c }); bx += w + 0.015; } }
      world.add(sh);
    }
    const bookInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.3), mat(0xffffff), books.length);
    books.forEach((b, i) => { bookInst.setMatrixAt(i, b.m); bookInst.setColorAt(i, b.c); }); bookInst.name = "books"; world.add(bookInst);
    /* 등불 */
    if (T.lamps) [[-3.8, 3.4, -2.8], [3.8, 3.4, -2.8], [0, 4.4, -5.4]].forEach((p, i) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffd28a })); m.position.set(...p); world.add(m);
      const L = new THREE.PointLight(0xffa760, 1.4, 10, 2); L.position.set(...p); world.add(L); flicker.push({ L, base: 1.3, i }); });
    /* 소품 */
    debug.props = []; let lights = 0;
    for (const name of cfg.props || []) {
      if (debug.props.length >= PROP_SLOTS.length) break;
      const prop = buildProp(name, accent); if (!prop) continue;
      const [x, z] = PROP_SLOTS[debug.props.length]; prop.position.set(x, 0, z); prop.rotation.y = -x * 0.08; prop.scale.setScalar(1.25); world.add(prop);
      if (prop.userData.light && lights < MAX_PROP_LIGHTS) { const L = new THREE.PointLight(prop.userData.light.color, 0.9, 4, 2); L.position.set(x, prop.userData.light.y * 1.25, z); world.add(L); flicker.push({ L, base: 0.9, i: lights + 3 }); lights++; }
      debug.props.push(name);
    }
    /* 떠다니는 먼지 */
    const N = 90, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 13; pos[i * 3 + 1] = R() * 5; pos[i * 3 + 2] = R() * 5 - 4.5; }   /* 카메라 쪽(z>0.5)엔 두지 않는다: 가까운 입자는 큰 네모로 보임 */
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: T.dust, size: 0.04, transparent: true, opacity: 0.7 })); world.add(dust);
    debug.mood = moodKey; debug.spark = T.spark;
  }

  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height; if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h; cam.aspect = aspect;
    /* 가로(844×390)보다 좁으면 세로 카메라 쪽으로 섞는다(t=1 이 390×844). 가로 시야각도 섞어서 세로 시야를 정한다 */
    const t = THREE.MathUtils.clamp((CAM.baseAspect - aspect) / (CAM.baseAspect - CAM_TALL.aspect), 0, 1);
    const hHalfWide = Math.atan(Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * CAM.baseAspect);
    const hHalf = THREE.MathUtils.lerp(hHalfWide, THREE.MathUtils.degToRad(CAM_TALL.hfov / 2), t);
    cam.fov = aspect >= CAM.baseAspect ? CAM.fov : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hHalf) / aspect));
    camBase.pos.lerpVectors(CAM.pos, CAM_TALL.pos, t); camBase.look.lerpVectors(CAM.look, CAM_TALL.look, t);
    cam.updateProjectionMatrix(); placeCamera(performance.now());
    if (typeof placeLibrarian === "function") placeLibrarian();
  }
  function placeCamera(now) {
    const fk = focus.k, P = camBase.pos, L = camBase.look;
    cam.position.set(P.x + Math.sin(now / 4200) * 0.3 * (1 - fk) + focus.x * 0.55 * fk + (Math.random() - 0.5) * camShake.amp,
      P.y - 0.7 * fk + (Math.random() - 0.5) * camShake.amp, P.z - 3.4 * fk);
    cam.lookAt(L.x + (focus.x - L.x) * fk, L.y + 0.15 * fk, focus.z * fk);
    cam.updateMatrixWorld();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  let raf = 0, last = performance.now();
  const slow = { t: 0, n: 0 };
  function adaptResolution(ms) {
    if (pixelRatio <= PIXEL_RATIO_MIN || ms > 1000) return;       /* 탭 전환 뒤 같은 아주 긴 틈은 빼고 */
    slow.t += ms; slow.n++;
    if (slow.t < SLOW_WINDOW_MS) return;
    if (slow.t / slow.n > SLOW_FRAME_MS) { pixelRatio = Math.max(PIXEL_RATIO_MIN, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); debug.pixelRatio = pixelRatio; resize(); }
    slow.t = 0; slow.n = 0;
  }
  function frame(now) {
    raf = 0;
    const rawMs = now - last;
    const dt = Math.min(0.05, rawMs / 1000); last = now;
    adaptResolution(rawMs);
    for (const f of tickers) f(dt, now);
    focus.k += (focus.target - focus.k) * Math.min(1, dt * 9); dim.k += (dim.target - dim.k) * Math.min(1, dt * 9);
    const lit = 1 - dim.k * 0.85;
    hemi.intensity = lightBase.hemi * lit; key.intensity = lightBase.key * (1 - dim.k * 0.6); rim.intensity = lightBase.rim * lit;
    for (const { L, base, i } of flicker) L.intensity = (base + Math.sin(now / 170 + i * 2) * 0.12 + Math.sin(now / 53 + i) * 0.05) * lit;
    if (dust) { dust.rotation.y = Math.sin(now / 20000) * 0.15;   /* 크게 돌면 뒤쪽 입자가 카메라 앞으로 온다 */ dust.position.y = Math.sin(now / 3000) * 0.1; }
    camShake.amp *= 0.86;
    placeCamera(now);
    renderer.render(scene, cam); debug.frames++;
    if (!document.hidden && !debug.contextLost) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && !document.hidden && !debug.contextLost) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener("visibilitychange", wake);
  /* 휴대폰이 앱을 내리거나 메모리가 모자라면 3D 메모리를 회수한다(컨텍스트 손실). 그동안은 그리지 않고,
     돌려받으면(복구) three.js 가 재질·텍스처를 다시 올리므로 그리기만 다시 시작한다 → 검은 화면으로 남지 않게 */
  debug.contextLost = false;
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); debug.contextLost = true; cancelAnimationFrame(raf); raf = 0; }, false);
  canvas.addEventListener("webglcontextrestored", () => { debug.contextLost = false; resize(); wake(); }, false);
  wake();

  /* ---------- 유닛 ---------- */
  const figures = new Map();   /* id → {F, home:Vector3, side} */
  let unitsRoot = null, unitsSeq = 0;
  /* 있던 유닛을 다 치우고(자원 정리) 빈 묶음을 새로 만든다 */
  function resetUnits() {
    if (unitsRoot) { scene.remove(unitsRoot); for (const f of figures.values()) disposeFigure(f); }
    figures.clear(); unitsRoot = new THREE.Group(); unitsRoot.name = "units"; scene.add(unitsRoot);
  }
  async function setUnits(units, guest) {
    const my = ++unitsSeq; await loadCharacters(); if (my !== unitsSeq) return;   /* 그새 다른 setUnits/showLibrarian 이 불렸으면 그쪽이 이김 */
    resetUnits(); guestNow = guest || null; debug.librarian = null;
    for (const side of ["ally", "enemy"]) {
      /* 우두머리를 가운데 줄(첫 자리)에 */
      const list = units.filter(u => u.side === side).sort((a, b) => (b.leader ? 1 : 0) - (a.leader ? 1 : 0));
      const slots = SLOTS[Math.min(3, list.length)] || SLOTS[3];
      list.forEach((u, i) => {
        const [ax, z] = slots[i] || [2.6 + i * 0.3, 0], x = side === "ally" ? -ax : ax;
        const look = lookOf(u, guest), F = makeFigure(look);
        const depth = 0.8 + 0.2 * ((z + 0.9) / 1.8);          /* 뒷줄 최대 20% 작게 */
        F.obj.scale.setScalar(look.scale * depth);
        F.obj.position.set(x, 0, z); F.obj.rotation.y = side === "ally" ? FACE : -FACE;
        F.act("Idle"); unitsRoot.add(F.obj);
        const R = side === "ally" ? RING.ally : u.leader ? RING.leader : RING.enemy, ringM = sideRing(R);
        F.obj.add(ringM);
        F.look = look; figures.set(u.id, { F, home: F.obj.position.clone(), side, unit: u, look, dead: u.hp <= 0, ring: ringM, ringR: R.r });
        if (u.hp <= 0) { F.obj.visible = false; ringM.visible = false; }
      });
    }
  }
  /* 도서관: 사서 한 명만, 정면에서 조금 비스듬히. 장서복(복장)을 바꾼 뒤 다시 부르면 새로 입힌다.
     목록 패널을 피한다: 가로(aspect ≥ 1)는 패널이 오른쪽 64% → 화면 왼쪽 1/3 가운데쯤, 세로는 패널이 아래 54% → 가운데 위쪽 */
  const LIB_POSE = { wideX: -2.6, tallX: 0, z: 0.4, ry: 0.35 };
  function placeLibrarian() {
    if (!debug.librarian) return; const f = figures.get("lib:" + debug.librarian); if (!f) return;
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height, x = w / h >= 1 ? LIB_POSE.wideX : LIB_POSE.tallX;
    f.F.obj.position.set(x, 0, LIB_POSE.z); f.home.copy(f.F.obj.position);
  }
  async function showLibrarian(libId) {
    const my = ++unitsSeq; await loadCharacters(); if (my !== unitsSeq) return;
    resetUnits(); guestNow = null; debug.librarian = libId || "kyu";
    const u = { id: "lib:" + debug.librarian, side: "ally", libId: debug.librarian, hp: 1 };
    const look = lookOf(u, null), F = makeFigure(look);
    F.obj.scale.setScalar(look.scale); F.obj.position.set(LIB_POSE.tallX, 0, LIB_POSE.z); F.obj.rotation.y = LIB_POSE.ry;
    F.act("Idle"); unitsRoot.add(F.obj);
    const ringM = sideRing(RING.ally); ringM.visible = false; F.obj.add(ringM);   /* 편 고리는 전투에서만 */
    F.look = look; figures.set(u.id, { F, home: F.obj.position.clone(), side: "ally", unit: u, look, dead: false, ring: ringM, ringR: RING.ally.r });
    placeLibrarian();
  }
  /* 서 있는 사서가 Cheer 한 번 하고 Idle 로. 그새 사서가 치워져도 3초 안에 끝난다 */
  function cheer() {
    const list = [...figures.values()].filter(f => f.side === "ally" && !f.dead);
    const capped = pr => Promise.race([pr, new Promise(r => setTimeout(r, 3000))]);
    return Promise.all(list.map(f => capped(f.F.act("Cheer", { once: true })).then(() => { if (figures.get(f.unit.id) === f && f.F.current === "Cheer") f.F.act("Idle", { fadeMs: 200 }); })));
  }
  tickers.add(dt => { for (const { F } of figures.values()) F.update(dt * time.scale); });
  function disposeFigure(f) {
    if (f.starsOff) f.starsOff(); if (f.F.dispose) f.F.dispose();
    f.F.obj.traverse(n => { if (n.userData.own) { if (n.geometry) n.geometry.dispose(); [].concat(n.material || []).forEach(m => m && m.dispose()); } else if (n.userData.ownMat && n.material) n.material.dispose(); });
    if (f.ring) { f.ring.geometry && f.ring.geometry.dispose(); f.ring.material && f.ring.material.dispose(); }
  }
  /* 연출 없이 지나간 교환(길게 눌러 건너뛰기)까지 포함해, 규칙 상태에 무대를 맞춘다: 쓰러짐(조각·책 한 번)·흐트러짐 */
  function syncUnits(units) {
    for (const u of units || []) { const f = figures.get(u.id); if (!f) continue;
      if (u.hp <= 0 && !f.dead) { f.dead = true; if (f.ring) f.ring.visible = false; const pos = f.F.obj.position.clone();
        const pal = f.look ? [f.look.palette.accent, f.look.palette.cloth, f.look.palette.light] : [0x6e2c38];
        fragments(fx, pos, pal.map(c => new THREE.Color(c).getHex()), 14); f.F.obj.visible = false;
        if (f.side === "enemy") { dropBook(fx, pos, coverUrl(), new THREE.Color(debug.spark || 0xffd28a).getHex(), 700); debug.bookDrops++; } }
      setStaggered(u.id, u.hp > 0 && !!u.staggered); }
  }

  /* ---------- 이펙트 묶음 ---------- */
  const fxRoot = new THREE.Group(); scene.add(fxRoot);
  const live = new Set();
  const fx = { light: borrowLight, add(obj, ms, step, cleanup) { fxRoot.add(obj); const e = { obj, ms, step, cleanup, el: 0 }; live.add(e); step(0, 0, 0); return e; },
    /* 수명 전에 바로 치움(시간을 스스로 재는 연출용, ms=Infinity 로 붙인 것) */
    kill(e) { if (!live.delete(e)) return; fxRoot.remove(e.obj); e.cleanup && e.cleanup(); } };
  tickers.add(dt => { for (const e of live) { e.el += dt * 1000; const k = Math.min(1, e.el / e.ms); e.step(k, dt, e.el);
    if (k >= 1) { live.delete(e); fxRoot.remove(e.obj); e.cleanup && e.cleanup(); } } });

  /* ---------- 교환 연출 ---------- */
  let current = null;                                   /* 진행 중인 play 의 토큰 */
  let guestNow = null;
  const sleep = (tok, ms) => new Promise(res => { if (tok.abort || ms <= 0) return res(); const t = setTimeout(done, ms); tok.waits.add(done); function done() { clearTimeout(t); tok.waits.delete(done); res(); } });
  /* 프레임마다 fn(k), 끝은 프레임이 아니라 시계로 정한다 — 느린 기기에서도 연출(특히 빨리 감기)이 제시간에 끝난다 */
  const tween = (tok, ms, fn) => new Promise(res => { if (tok.abort || ms <= 0) { fn(1); return res(); } const t0 = performance.now(); let done = false;
    const end = () => { if (done) return; done = true; clearTimeout(timer); off(); tok.waits.delete(end); fn(1); res(); };
    const off = S.onFrame(() => { const k = Math.min(1, (performance.now() - t0) / ms); if (k >= 1 || tok.abort) return end(); fn(k); });
    const timer = setTimeout(end, ms); tok.waits.add(end); });
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const cardTier = card => { if (!card) return "N"; const P = (window.Game && Game.data.PAGE_BY[card]); if (P) return P.rarity || "N";
    const ci = window.Game && Game.battle.cardInfo(card); return ci && ci.big ? "SR" : "N"; };
  const tierOf = ev => [ev.a && ev.a.card, ev.b && ev.b.card].map(cardTier).reduce((m, t) => tierRank(t) > tierRank(m) ? t : m, "N");
  const dieType = (st, which) => { const d = st && st[which + "Die"]; return d && d.type; };
  function attackClip(f, type) { if (type === "방어") return "Block"; if (type === "회피") return "Dodge_Backward";
    return MAGIC_MODELS.has(f.look && f.look.model) ? "Spellcast_Shoot" : (ATTACK_ANIM[type] || "1H_Melee_Attack_Slice_Diagonal"); }
  const coverUrl = () => { try { const src = window.Game && guestNow && Game.data.bookCoverSrc(guestNow); return src ? new URL("../../" + src, import.meta.url).href : null; } catch (e) { return null; } };
  const homeOf = f => f.home.clone();

  function snapHome(tok) {
    for (const [id, f] of figures) { if (f.dead) continue; f.F.obj.position.copy(f.home); f.F.act("Idle", { fadeMs: 80 }); }
    focus.target = 0; dim.target = 0; time.scale = 1;
  }

  async function killUnit(tok, id, isFinal) {
    const f = figures.get(id); if (!f || f.dead) return; f.dead = true;
    const fast = tok.fast; f.ring.visible = false;
    f.F.act("Death_A", { once: true, speed: fast ? 2.4 : 1.4 });
    await sleep(tok, fast ? 220 : 520);
    const pos = f.F.obj.position.clone();
    const pal = f.look ? [f.look.palette.accent, f.look.palette.cloth, f.look.palette.light] : [0x6e2c38];
    fragments(fx, pos, pal.map(c => new THREE.Color(c).getHex()));
    f.F.obj.visible = false;
    if (f.side === "enemy") { dropBook(fx, pos, coverUrl(), new THREE.Color(debug.spark || 0xffd28a).getHex(), isFinal ? 1760 : 1100); debug.bookDrops++; }
    await sleep(tok, fast ? 150 : (isFinal ? 1100 : 600));
  }

  async function playDefault(tok, ev, o) {
    const A = figures.get(ev.a.unit), B = ev.b ? figures.get(ev.b.unit) : null, T = figures.get(ev.target) || B;
    if (!A || !T) return;
    const steps = ev.steps || [], tier = tok.tier, rank = tierRank(tier), fast = tok.fast;
    /* 한 교환 = 달려가기(~0.3) → 맞기(0.4, 단계가 여럿이면 0.8까지) → 밀려남 0.12 → 돌아오기 0.2 (×dur).
       빨리 감기는 그 합이 FAST_MS 가 되게 dur 를 줄인다 */
    const span = (steps.length > 1 ? 0.8 : HIT_AT) + 0.32;
    const dur = fast ? FAST_MS / span : Math.min(MAX_MS, CLASH_MS + STEP_MS * Math.max(0, steps.length - 1));
    const runMs = dur * 0.3, hitMs = dur * HIT_AT;
    /* 기다림은 교환 시작 시각 기준으로 잰다: 프레임이 늦어 한 구간이 밀려도 다음 구간이 줄어 전체 길이는 그대로 */
    const T0 = performance.now(), left = at => Math.max(0, T0 + at - performance.now());
    /* 만나는 자리: 둘 사이 가운데 */
    const pa = homeOf(A), pt = homeOf(T), mid = pa.clone().lerp(pt, 0.5); mid.z = (pa.z + pt.z) / 2;
    const dir = Math.sign(pt.x - pa.x) || 1, gap = 0.55;
    const aTo = mid.clone().add(new THREE.Vector3(-dir * gap, 0, 0)), bTo = mid.clone().add(new THREE.Vector3(dir * gap, 0, 0));
    const movers = [[A, pa, aTo]]; if (ev.kind === "clash" && B) movers.push([B, homeOf(B), bTo]);
    else if (!B || B === T) { /* 일방 공격: 맞는 쪽은 제자리 */ }
    movers.forEach(([f]) => f.F.act("Running_A", { fadeMs: 80 }));
    if (rank >= 2 && !fast) { focus.x = mid.x; focus.z = mid.z; focus.target = 1; dim.target = rank >= 3 ? 0.7 : 0.4; }
    else if (rank >= 3) dim.target = 0.5;
    await tween(tok, left(runMs), k => { const e = ease(k); movers.forEach(([f, from, to]) => f.F.obj.position.lerpVectors(from, to, e)); });
    /* 공격 동작 */
    const st0 = steps[0] || {};
    A.F.act(attackClip(A, dieType(st0, "a")), { once: true, speed: fast ? 2.2 : 1.3, fadeMs: 60 });
    if (ev.kind === "clash" && B) B.F.act(attackClip(B, dieType(st0, "b")), { once: true, speed: fast ? 2.2 : 1.3, fadeMs: 60 });
    await sleep(tok, left(hitMs));
    /* 맞는 순간들: 40%~80% 사이에 단계마다 */
    const hitSpan = steps.length > 1 ? (dur * 0.4) / (steps.length - 1) : 0, hp = mid.clone().setY(1.35);
    const spark = new THREE.Color(debug.spark || 0xffd28a).getHex();
    for (let i = 0; i < Math.max(1, steps.length); i++) {
      if (tok.abort) break;
      const st = steps[i] || {};
      burst(fx, hp, spark, rank >= 1 ? 28 : 14, rank >= 1 ? 2 : 1.5); flash(fx, hp, spark, rank >= 3 ? 2.6 : 1.6);
      if (rank >= 3) ring(fx, hp, spark, 4);
      camShake.amp = Math.max(camShake.amp, fast ? 0.06 : (rank >= 2 ? 0.2 : 0.12));
      time.scale = 0; setTimeout(() => { time.scale = (rank >= 3 && !fast) ? 0.4 : 1; setTimeout(() => { time.scale = 1; }, 300); }, 70);   /* 히트스톱 70ms (+SSR 감속) */
      /* 반응 */
      const who = id => figures.get(id);
      if (st.dmg && who(st.dmg.unit) && !(ev.result && ev.result.dead || []).includes(st.dmg.unit)) who(st.dmg.unit).F.act(i % 2 ? "Hit_B" : "Hit_A", { once: true, speed: fast ? 2 : 1.2, fadeMs: 50 });
      if (st.aResult === "block" || st.bResult === "block") { const d = st.aResult === "block" ? A : B; d && d.F.act("Block_Hit", { once: true, fadeMs: 50 }); }
      if (st.aResult === "evade" || st.bResult === "evade") { const d = st.aResult === "evade" ? A : B; d && d.F.act("Dodge_Backward", { once: true, fadeMs: 50 }); }
      if (st.dmg && o.onHit) { try { o.onHit(i); } catch (e) { console.warn(e); } }
      if (i < steps.length - 1) await sleep(tok, left(hitMs + hitSpan * (i + 1)));
    }
    /* 진 쪽 밀려남 */
    const loser = ev.win === "ally" ? (A.side === "enemy" ? A : B) : ev.win === "enemy" ? (A.side === "ally" ? A : B) : (ev.kind !== "clash" ? T : null);
    if (loser && !loser.dead) { const from = loser.F.obj.position.clone(), to = from.clone().add(new THREE.Vector3(Math.sign(loser.home.x) * 0.5, 0, 0));
      await tween(tok, left(hitMs + hitSpan * Math.max(0, steps.length - 1) + dur * 0.12), k => loser.F.obj.position.lerpVectors(from, to, ease(k))); }
    focus.target = 0; dim.target = 0;
    /* 쓰러짐 → 조각 → 책 */
    const dead = (ev.result && ev.result.dead) || [];
    for (const id of dead) await killUnit(tok, id, o.final && id === dead[dead.length - 1]);
    /* 흐트러짐 표시 */
    for (const id of (ev.result && ev.result.staggered) || []) setStaggered(id, true);
    /* 제자리로 */
    const back = [...figures.values()].filter(f => !f.dead && !f.F.obj.position.equals(f.home));
    back.forEach(f => f.F.act("Running_A", { fadeMs: 80 }));
    const froms = back.map(f => f.F.obj.position.clone());
    const backAt = hitMs + hitSpan * Math.max(0, steps.length - 1) + dur * 0.32;     /* 쓰러짐이 없으면 시작 기준 시각으로 */
    await tween(tok, dead.length ? dur * 0.2 : left(backAt), k => back.forEach((f, i) => f.F.obj.position.lerpVectors(froms[i], f.home, ease(k))));
    back.forEach(f => f.F.act("Idle", { fadeMs: 120 }));
    if (o.final) { for (const f of figures.values()) if (!f.dead && f.side === "ally") f.F.act("Cheer"); }
  }

  /* 흐트러진 유닛 머리 위 별 고리 */
  function setStaggered(id, on) {
    const f = figures.get(id); if (!f) return;
    if (on && !f.stars) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffe08a });
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), m); const a = i / 5 * Math.PI * 2; s.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); g.add(s); }
      g.position.y = f.F.height + 0.15; f.F.obj.add(g); f.stars = g; f.starsOff = S.onFrame(dt => { g.rotation.y += dt * 3; }); g.traverse(n => { if (n.isMesh) n.userData.own = true; }); }
    if (!on && f.stars) { f.F.obj.remove(f.stars); f.starsOff(); f.starsOff = null; f.stars.traverse(n => { if (n.isMesh) { n.geometry.dispose(); n.material.dispose(); } }); f.stars = null; }
  }

  async function play(ev, o = {}) {
    if (!ev || ev.kind === "skip" || !ev.a) return;
    if (current) finishNow();
    const tok = current = { abort: false, fast: !!o.fast, waits: new Set(), tier: tierOf(ev) };
    debug.lastTier = tok.tier; const t0 = performance.now();
    try {
      const custom = CUSTOM_FX.get(ev.a.card) || (ev.b && CUSTOM_FX.get(ev.b.card));
      if (custom) {
        const hitDone = sleep(tok, (tok.fast ? FAST_MS : CLASH_MS) * HIT_AT);
        await custom({ stage: S, ev, a: (figures.get(ev.a.unit) || {}).F, b: ev.b ? (figures.get(ev.b.unit) || {}).F : null, target: (figures.get(ev.target) || {}).F,
          fast: tok.fast, wait: ms => sleep(tok, ms), burst: (p, c, n) => burst(fx, p, c, n), flash: (p, c) => flash(fx, p, c), shake: a => { camShake.amp = a; }, hitAt: hitDone });
        (ev.steps || []).forEach((st, i) => { if (st.dmg && o.onHit) o.onHit(i); });
        for (const id of (ev.result && ev.result.dead) || []) await killUnit(tok, id, o.final);
      } else await playDefault(tok, ev, o);
    } finally {
      if (tok.abort) { /* 건너뛰기: 남은 반응을 바로 정리 */
        for (const id of (ev.result && ev.result.dead) || []) { const f = figures.get(id); if (f && !f.dead) { f.dead = true; f.F.obj.visible = false; f.ring.visible = false; if (f.side === "enemy") debug.bookDrops++; } }
        if (o.onHit && !tok.hitsSent) {}
        snapHome(tok);
      }
      if (current === tok) current = null;
      debug.lastPlayMs = performance.now() - t0;
    }
  }
  function finishNow() { for (const tok of [current, burnTok, bonkTok]) { if (!tok) continue; tok.abort = true; for (const w of [...tok.waits]) w(); } }

  /* ---------- 도서관 책 소각 ---------- */
  /* 사서 앞 공중, 상반신 높이. 가로는 사서(x=-2.6) 조금 오른쪽 앞, 세로는 가운데 */
  function burnPoint() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height, wide = w / h >= 1;
    const f = debug.librarian && figures.get("lib:" + debug.librarian);
    const p = f ? f.F.obj.position : new THREE.Vector3(wide ? LIB_POSE.wideX : LIB_POSE.tallX, 0, LIB_POSE.z);
    const ht = f ? f.F.height * f.F.obj.scale.y : 1.9;
    return new THREE.Vector3(p.x + (wide ? 0.85 : 0.55), p.y + ht * 0.62, p.z + 0.9);
  }
  let burnTok = null;
  async function burnBook(o = {}) {
    if (burnTok) finishNow();
    const tok = burnTok = { abort: false, fast: !!o.fast, waits: new Set() };
    const B = burnBookFx(fx, burnPoint(), o.cover || null, new THREE.Color(debug.spark || 0xffb46a).getHex(), o.n || 1);
    debug.burn = B.info; debug.burns = (debug.burns || 0) + 1;
    try { await tween(tok, tok.fast ? BURN_FAST_MS : BURN_MS, k => B.set(k)); }
    finally { B.end(); if (burnTok === tok) burnTok = null; B.info.papers = 0; }
    cheer();
  }
  /* ---------- 오답 연출 ---------- */
  /* 머리 위에서 책이 떨어져 콩(맞는 순간 Hit_A·흔들림) → 옆으로 튕겨 사라짐. 입력은 막지 않는다(UI 가 기다리지 않아도 됨).
     겹쳐 부르면 앞의 것은 바로 치우고 새로. finishNow() 로 바로 끝 */
  let bonkTok = null; debug.bonk = { books: 0, count: 0 };
  async function wrongBonk(ids) {
    if (bonkTok) { bonkTok.abort = true; for (const w of [...bonkTok.waits]) w(); }
    const tok = bonkTok = { abort: false, waits: new Set() };
    const want = Array.isArray(ids) ? new Set(ids) : null;
    const list = [...figures.entries()].filter(([id, f]) => f.side === "ally" && !f.dead && f.F.obj.visible && (!want || want.has(id))).map(([, f]) => f);
    const books = list.map((f, i) => { const o = f.F.obj; return bonkBook(fx, new THREE.Vector3(o.position.x, o.position.y + f.F.height * o.scale.y, o.position.z), i); });
    debug.bonk.books = books.length; debug.bonk.count++;
    let hit = false;
    const doHit = () => { if (hit) return; hit = true; camShake.amp = Math.max(camShake.amp, 0.09);
      list.forEach(f => { if (figures.get(f.unit.id) === f && !f.dead) f.F.act("Hit_A", { once: true, speed: 1.7, fadeMs: 40 }); }); };
    /* 맞는 순간은 프레임이 아니라 시계로(느린 기기에서 프레임이 늦어도 움찔·흔들림이 제때) */
    sleep(tok, BONK_MS * BONK_HIT_AT).then(() => { if (!tok.abort) doHit(); });
    try { await tween(tok, BONK_MS, k => books.forEach(B => B.set(k))); }
    finally {
      books.forEach(B => B.end());
      if (bonkTok === tok) { bonkTok = null; debug.bonk.books = 0; }
      list.forEach(f => { if (figures.get(f.unit.id) === f && !f.dead && f.F.current === "Hit_A") f.F.act("Idle", { fadeMs: 150 }); });
    }
  }
  const v3 = new THREE.Vector3();
  function unitPoint(id) {
    const f = figures.get(id); if (!f) return null;
    const o = f.F.obj; v3.set(o.position.x, o.position.y + f.F.height * o.scale.y + 0.25, o.position.z).project(cam);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height };
  }

  /* 편 고리 상태(테스트·UI용): {color:"#rrggbb", radius(월드), opacity, visible} */
  function ringInfo(id) {
    const f = figures.get(id); if (!f) return null;
    return { color: "#" + f.ring.material.color.getHexString(), radius: f.ringR * f.F.obj.scale.x, opacity: f.ring.material.opacity, visible: f.ring.visible && f.F.obj.visible };
  }

  const S = {
    ok: true, three: THREE, scene, camera: cam, renderer, debug, camShake, tickers,
    setFloor, resize,
    setUnits, showLibrarian, cheer, unitPoint, ring: ringInfo, figure: id => (figures.get(id) || {}).F || null, figures,
    play, finishNow, burnBook, wrongBonk, setStaggered, syncUnits, fx,
    onFrame(f) { tickers.add(f); return () => tickers.delete(f); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", wake); if (world) disposeTree(world); renderer.dispose(); },
  };
  return S;
}
