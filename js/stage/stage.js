/* 3D 무대(배경층). 규칙은 모른다: UI 가 층 설정·유닛·교환 이벤트를 넘기면 그리기만 한다.
   const S = await createStage(canvas)
     S.ok                   WebGL 을 못 만들면 false (그 뒤 모든 호출은 아무것도 안 하고 play 는 바로 끝남)
     S.setFloor({mood, accent, props})   층 분위기·책장·소품 (Game.data.floorStage(id) 결과 그대로)
     S.resize()             캔버스 크기에 맞춤(창 크기 변화는 자동)
     S.play(ev, opts)       교환 연출 → Promise (Task 5)
     S.debug                {mood, props, frames, ...} 테스트용 */
import * as THREE from "three";
import { MOODS, DEFAULT_MOOD } from "./moods.js";
import { buildProp } from "./props.js";

const PIXEL_RATIO_MAX = 1.5;
const CAM = { fov: 34, pos: new THREE.Vector3(0, 2.7, 8.2), look: new THREE.Vector3(0, 1.05, 0), baseAspect: 844 / 390 };
/* 소품 자리: 무대 가장자리, 가운데(유닛 자리 x∈[-3.4,3.4], z∈[-0.9,0.9])를 피해서 */
const PROP_SLOTS = [[-5.0, -2.4], [5.0, -2.4], [-6.0, 0.6], [6.0, 0.6], [-3.0, -4.3], [3.0, -4.3]];
const MAX_PROP_LIGHTS = 3;

function nullStage() {
  const done = () => Promise.resolve();
  return { ok: false, setFloor() {}, resize() {}, setUnits: done, play: done, finishNow() {}, unitPoint: () => null,
    onFrame() {}, dispose() {}, debug: { mood: null, props: [], frames: 0 } };
}

function mat(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: 0.85, metalness: 0 }, o || {})); }
function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export async function createStage(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: false });
  } catch (e) { console.warn("[stage] WebGL 없음 — 무대 없이 진행", e && e.message); return nullStage(); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(CAM.fov, CAM.baseAspect, 0.1, 80);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1); key.position.set(-3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0); rim.position.set(4, 3, -5); scene.add(rim);
  let world = null, flicker = [], dust = null;
  const tickers = new Set();          /* (dt, now) => void — 캐릭터·연출이 매 프레임 쓰는 것 */
  const debug = { mood: null, props: [], frames: 0 };
  const camShake = { amp: 0 };

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

    /* 팔각 단 */
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.5, 0.3, 8), mat(T.floor)); floor.position.y = -0.15; floor.rotation.y = Math.PI / 8; world.add(floor);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.6, 0.12, 8), mat(T.floorEdge)); ring.position.y = -0.32; ring.rotation.y = Math.PI / 8; world.add(ring);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(7.25, 0.04, 3, 8), mat(accent.getHex(), { emissive: accent, emissiveIntensity: 0.25 }));
    trim.rotation.x = Math.PI / 2; trim.rotation.z = Math.PI / 8; trim.position.y = 0.01; world.add(trim);

    /* 뒤쪽 호를 따라 책장 9개. 책 색 = 분위기 색 + 층 포인트 색 */
    const R = rnd(7919), palette = [...T.books, accent.getHex()];
    const bookGeo = new THREE.BoxGeometry(1, 1, 0.3), bookMats = palette.map(c => mat(c));
    for (let k = -4; k <= 4; k++) {
      const a = k * 0.2, sh = new THREE.Group(); sh.position.set(Math.sin(a) * 10, 0, -Math.cos(a) * 10 + 1.4); sh.rotation.y = -a;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 4.8, 0.5), mat(T.shelf)); frame.position.y = 2.4; sh.add(frame);
      for (let row = 0; row < 4; row++) { let bx = -0.92;
        while (bx < 0.86) { const w = 0.1 + R() * 0.12, h = 0.55 + R() * 0.3, b = new THREE.Mesh(bookGeo, bookMats[Math.floor(R() * bookMats.length)]);
          b.scale.set(w, h, 1); b.position.set(bx + w / 2, 0.47 + row * 1.12 + h / 2, 0.12); if (R() < 0.12) b.rotation.z = (R() - 0.5) * 0.4; sh.add(b); bx += w + 0.015; } }
      world.add(sh);
    }
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
    const N = 90, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 13; pos[i * 3 + 1] = R() * 5; pos[i * 3 + 2] = (R() - 0.5) * 6 - 1; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: T.dust, size: 0.04, transparent: true, opacity: 0.7 })); world.add(dust);
    debug.mood = moodKey; debug.spark = T.spark;
  }

  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height; if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h; cam.aspect = aspect;
    /* 세로 화면: 가로 화면과 같은 폭이 보이도록 세로 시야를 넓힌다 */
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * CAM.baseAspect);
    cam.fov = aspect >= CAM.baseAspect ? CAM.fov : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hHalf) / aspect));
    cam.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  let raf = 0, last = performance.now();
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const f of tickers) f(dt, now);
    for (const { L, base, i } of flicker) L.intensity = base + Math.sin(now / 170 + i * 2) * 0.12 + Math.sin(now / 53 + i) * 0.05;
    if (dust) { dust.rotation.y = now / 40000; dust.position.y = Math.sin(now / 3000) * 0.1; }
    camShake.amp *= 0.86;
    cam.position.set(CAM.pos.x + Math.sin(now / 4200) * 0.3 + (Math.random() - 0.5) * camShake.amp, CAM.pos.y + (Math.random() - 0.5) * camShake.amp, CAM.pos.z);
    cam.lookAt(CAM.look);
    renderer.render(scene, cam); debug.frames++;
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener("visibilitychange", wake);
  wake();

  const S = {
    ok: true, three: THREE, scene, camera: cam, renderer, debug, camShake, tickers,
    setFloor, resize,
    setUnits: () => Promise.resolve(), unitPoint: () => null,
    play: () => Promise.resolve(), finishNow() {},
    onFrame(f) { tickers.add(f); return () => tickers.delete(f); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", wake); if (world) disposeTree(world); renderer.dispose(); },
  };
  return S;
}
