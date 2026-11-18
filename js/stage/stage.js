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
import { loadCharacters, makeFigure } from "./characters.js";
import { lookOf, MAGIC_MODELS } from "./looks.js";
import { CUSTOM_FX, registerFx, TIERS, tierRank, burst, flash, ring, fragments, dropBook } from "./fx.js";
export { registerFx };

const PIXEL_RATIO_MAX = 1.5;
const CAM = { fov: 34, pos: new THREE.Vector3(0, 2.7, 8.2), look: new THREE.Vector3(0, 1.05, 0), baseAspect: 844 / 390 };
/* 소품 자리: 무대 가장자리, 가운데(유닛 자리 x∈[-3.4,3.4], z∈[-0.9,0.9])를 피해서 */
const PROP_SLOTS = [[-5.0, -2.4], [5.0, -2.4], [-6.0, 0.6], [6.0, 0.6], [-3.0, -4.3], [3.0, -4.3]];
const MAX_PROP_LIGHTS = 3;
/* 유닛 자리: 사서 왼쪽 x∈[-3.4,-2.0], 적 오른쪽(대칭). 한 편 n명일 때 [x, z] (z 앞=+) */
const SLOTS = { 1: [[2.6, 0]], 2: [[3.1, -0.7], [2.0, 0.7]], 3: [[2.6, -0.1], [3.8, -1.1], [1.6, 0.9]] };
const FACE = Math.PI / 2 * 0.62;          /* 서로 마주 보되 카메라 쪽으로 조금 */
/* 교환 연출 시간(ms): 합 1.0초, 단계가 늘면 +0.2초, 최대 1.6초. 빨리 감기 0.35초. 맞는 순간은 40% 지점 */
export const CLASH_MS = 1000, STEP_MS = 200, MAX_MS = 1600, FAST_MS = 350, HIT_AT = 0.4;
const ATTACK_ANIM = { 참격: "1H_Melee_Attack_Slice_Diagonal", 관통: "1H_Melee_Attack_Stab", 타격: "2H_Melee_Attack_Chop" };

function nullStage() {
  const done = () => Promise.resolve();
  return { ok: false, setFloor() {}, resize() {}, setUnits: done, play: done, finishNow() {}, unitPoint: () => null, figure: () => null,
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
  const debug = { mood: null, props: [], frames: 0, lastTier: null, bookDrops: 0, lastPlayMs: 0 };
  const camShake = { amp: 0 };
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
    focus.k += (focus.target - focus.k) * Math.min(1, dt * 9); dim.k += (dim.target - dim.k) * Math.min(1, dt * 9);
    const lit = 1 - dim.k * 0.85;
    hemi.intensity = lightBase.hemi * lit; key.intensity = lightBase.key * (1 - dim.k * 0.6); rim.intensity = lightBase.rim * lit;
    for (const { L, base, i } of flicker) L.intensity = (base + Math.sin(now / 170 + i * 2) * 0.12 + Math.sin(now / 53 + i) * 0.05) * lit;
    if (dust) { dust.rotation.y = now / 40000; dust.position.y = Math.sin(now / 3000) * 0.1; }
    camShake.amp *= 0.86;
    const fk = focus.k;
    cam.position.set(CAM.pos.x + Math.sin(now / 4200) * 0.3 * (1 - fk) + focus.x * 0.55 * fk + (Math.random() - 0.5) * camShake.amp,
      CAM.pos.y - 0.7 * fk + (Math.random() - 0.5) * camShake.amp, CAM.pos.z - 3.4 * fk);
    cam.lookAt(CAM.look.x + (focus.x - CAM.look.x) * fk, CAM.look.y + 0.15 * fk, focus.z * fk);
    renderer.render(scene, cam); debug.frames++;
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener("visibilitychange", wake);
  wake();

  /* ---------- 유닛 ---------- */
  const figures = new Map();   /* id → {F, home:Vector3, side} */
  let unitsRoot = null;
  async function setUnits(units, guest) {
    await loadCharacters();
    if (unitsRoot) { scene.remove(unitsRoot); }
    guestNow = guest || null; figures.clear(); unitsRoot = new THREE.Group(); unitsRoot.name = "units"; scene.add(unitsRoot);
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
        F.look = look; figures.set(u.id, { F, home: F.obj.position.clone(), side, unit: u, look, dead: u.hp <= 0 });
        if (u.hp <= 0) F.obj.visible = false;
      });
    }
  }
  tickers.add(dt => { for (const { F } of figures.values()) F.update(dt * time.scale); });

  /* ---------- 이펙트 묶음 ---------- */
  const fxRoot = new THREE.Group(); scene.add(fxRoot);
  const live = new Set();
  const fx = { add(obj, ms, step, cleanup) { fxRoot.add(obj); const e = { obj, ms, step, cleanup, el: 0 }; live.add(e); step(0, 0, 0); return e; } };
  tickers.add(dt => { for (const e of live) { e.el += dt * 1000; const k = Math.min(1, e.el / e.ms); e.step(k, dt, e.el);
    if (k >= 1) { live.delete(e); fxRoot.remove(e.obj); e.cleanup && e.cleanup(); } } });

  /* ---------- 교환 연출 ---------- */
  let current = null;                                   /* 진행 중인 play 의 토큰 */
  let guestNow = null;
  const sleep = (tok, ms) => new Promise(res => { if (tok.abort || ms <= 0) return res(); const t = setTimeout(done, ms); tok.waits.add(done); function done() { clearTimeout(t); tok.waits.delete(done); res(); } });
  const tween = (tok, ms, fn) => new Promise(res => { if (tok.abort || ms <= 0) { fn(1); return res(); } const t0 = performance.now();
    const off = S.onFrame(() => { const k = Math.min(1, (performance.now() - t0) / ms); fn(k); if (k >= 1 || tok.abort) { if (tok.abort) fn(1); off(); res(); } }); tok.waits.add(() => {}); });
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
    const fast = tok.fast;
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
    const dur = fast ? FAST_MS : Math.min(MAX_MS, CLASH_MS + STEP_MS * Math.max(0, steps.length - 1));
    const runMs = dur * 0.3, hitMs = dur * HIT_AT;
    /* 만나는 자리: 둘 사이 가운데 */
    const pa = homeOf(A), pt = homeOf(T), mid = pa.clone().lerp(pt, 0.5); mid.z = (pa.z + pt.z) / 2;
    const dir = Math.sign(pt.x - pa.x) || 1, gap = 0.55;
    const aTo = mid.clone().add(new THREE.Vector3(-dir * gap, 0, 0)), bTo = mid.clone().add(new THREE.Vector3(dir * gap, 0, 0));
    const movers = [[A, pa, aTo]]; if (ev.kind === "clash" && B) movers.push([B, homeOf(B), bTo]);
    else if (!B || B === T) { /* 일방 공격: 맞는 쪽은 제자리 */ }
    movers.forEach(([f]) => f.F.act("Running_A", { fadeMs: 80 }));
    if (rank >= 2 && !fast) { focus.x = mid.x; focus.z = mid.z; focus.target = 1; dim.target = rank >= 3 ? 0.7 : 0.4; }
    else if (rank >= 3) dim.target = 0.5;
    await tween(tok, runMs, k => { const e = ease(k); movers.forEach(([f, from, to]) => f.F.obj.position.lerpVectors(from, to, e)); });
    /* 공격 동작 */
    const st0 = steps[0] || {};
    A.F.act(attackClip(A, dieType(st0, "a")), { once: true, speed: fast ? 2.2 : 1.3, fadeMs: 60 });
    if (ev.kind === "clash" && B) B.F.act(attackClip(B, dieType(st0, "b")), { once: true, speed: fast ? 2.2 : 1.3, fadeMs: 60 });
    await sleep(tok, hitMs - runMs);
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
      if (i < steps.length - 1) await sleep(tok, hitSpan);
    }
    /* 진 쪽 밀려남 */
    const loser = ev.win === "ally" ? (A.side === "enemy" ? A : B) : ev.win === "enemy" ? (A.side === "ally" ? A : B) : (ev.kind !== "clash" ? T : null);
    if (loser && !loser.dead) { const from = loser.F.obj.position.clone(), to = from.clone().add(new THREE.Vector3(Math.sign(loser.home.x) * 0.5, 0, 0));
      await tween(tok, dur * 0.12, k => loser.F.obj.position.lerpVectors(from, to, ease(k))); }
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
    await tween(tok, dur * 0.2, k => back.forEach((f, i) => f.F.obj.position.lerpVectors(froms[i], f.home, ease(k))));
    back.forEach(f => f.F.act("Idle", { fadeMs: 120 }));
    if (o.final) { for (const f of figures.values()) if (!f.dead && f.side === "ally") f.F.act("Cheer"); }
  }

  /* 흐트러진 유닛 머리 위 별 고리 */
  function setStaggered(id, on) {
    const f = figures.get(id); if (!f) return;
    if (on && !f.stars) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffe08a });
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), m); const a = i / 5 * Math.PI * 2; s.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3); g.add(s); }
      g.position.y = f.F.height + 0.15; f.F.obj.add(g); f.stars = g; f.starsOff = S.onFrame(dt => { g.rotation.y += dt * 3; }); }
    if (!on && f.stars) { f.F.obj.remove(f.stars); f.starsOff(); f.stars = null; }
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
        for (const id of (ev.result && ev.result.dead) || []) { const f = figures.get(id); if (f && !f.dead) { f.dead = true; f.F.obj.visible = false; if (f.side === "enemy") debug.bookDrops++; } }
        if (o.onHit && !tok.hitsSent) {}
        snapHome(tok);
      }
      if (current === tok) current = null;
      debug.lastPlayMs = performance.now() - t0;
    }
  }
  function finishNow() { const tok = current; if (!tok) return; tok.abort = true; for (const w of [...tok.waits]) w(); }
  const v3 = new THREE.Vector3();
  function unitPoint(id) {
    const f = figures.get(id); if (!f) return null;
    const o = f.F.obj; v3.set(o.position.x, o.position.y + f.F.height * o.scale.y + 0.25, o.position.z).project(cam);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height };
  }

  const S = {
    ok: true, three: THREE, scene, camera: cam, renderer, debug, camShake, tickers,
    setFloor, resize,
    setUnits, unitPoint, figure: id => (figures.get(id) || {}).F || null, figures,
    play, finishNow, setStaggered, fx,
    onFrame(f) { tickers.add(f); return () => tickers.delete(f); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", wake); if (world) disposeTree(world); renderer.dispose(); },
  };
  return S;
}
