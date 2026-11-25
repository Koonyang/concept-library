/* 무대 이펙트 조각들 + 책장별 전용 연출 등록.
   registerFx(pageId, async ctx => {...})  — 등록된 책장이 쓰인 교환은 등급 연출 대신 이 함수가 연출한다.
   ctx = {stage, ev, a:Figure, b:Figure|null, target:Figure, fast, wait(ms), burst(pos,color,n), flash(pos,color), shake(amp), hitAt:Promise} */
import * as THREE from "three";

export const CUSTOM_FX = new Map();
export function registerFx(pageId, fn) { CUSTOM_FX.set(pageId, fn); }

export const TIERS = ["N", "R", "SR", "SSR"];
export const tierRank = t => Math.max(0, TIERS.indexOf(t));

/* 이펙트들은 stage 가 주는 add(obj, life, step) 로 붙는다: step(k:0→1, dt) 를 매 프레임, k=1 이면 지운다.
   빛은 fx.light(color, distance, worldPos) 로 무대의 빛 묶음에서 빌린다(없으면 null — 빛 없이 진행).
   점광원 수가 바뀌면 three.js 가 모든 셰이더를 다시 만들어 연출 도중 멈칫하므로 새 PointLight 를 만들지 않는다. */
const borrow = (fx, color, dist, pos) => (fx.light ? fx.light(color, dist, pos) : null);
const tetra = new THREE.TetrahedronGeometry(0.07, 0);
export function burst(fx, pos, color, n = 14, spread = 1.5) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true });
  const g = new THREE.Group(); g.position.copy(pos);
  const parts = []; for (let i = 0; i < n; i++) { const s = new THREE.Mesh(tetra, m); const a = i / n * Math.PI * 2 + Math.random() * 0.3;
    parts.push({ s, d: new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.7 + 0.2, (Math.random() - 0.5) * 0.6).multiplyScalar(spread * (0.7 + Math.random() * 0.6)) }); g.add(s); }
  fx.add(g, 450, k => { parts.forEach(({ s, d }) => { s.position.copy(d).multiplyScalar(k); s.rotation.set(k * 6, k * 4, 0); }); m.opacity = 1 - k; }, () => m.dispose());
}
export function flash(fx, pos, color, size = 1.6) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true }), s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), m); s.position.copy(pos);
  const L = borrow(fx, color, 6, pos.clone().add(new THREE.Vector3(0, 0, 0.6)));
  const g = new THREE.Group(); g.add(s);
  fx.add(g, 380, k => { s.scale.setScalar(0.4 + k * size); m.opacity = 1 - k; if (L) L.intensity = (1 - k) * 4; }, () => { s.geometry.dispose(); m.dispose(); L && L.release(); });
}
export function ring(fx, pos, color, size = 3) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }), r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 4, 24), m);
  r.position.copy(pos); r.rotation.x = Math.PI / 2;
  fx.add(r, 600, k => { r.scale.setScalar(1 + k * size); m.opacity = 1 - k; }, () => { r.geometry.dispose(); m.dispose(); });
}
/* 쓰러진 자리에서 조각이 흩어진다 */
export function fragments(fx, pos, colors, n = 26) {
  const g = new THREE.Group(); g.position.copy(pos);
  const mats = colors.map(c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, transparent: true }));
  const parts = []; for (let i = 0; i < n; i++) { const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.08, 0), mats[i % mats.length]);
    const a = i * 2.39, sp = 0.6 + (i % 5) * 0.25; parts.push({ s, v: new THREE.Vector3(Math.cos(a) * sp * 1.4, 1.8 * sp, Math.sin(a) * sp), y0: 0.4 + (i % 7) * 0.15 }); g.add(s); }
  fx.add(g, 1100, k => { parts.forEach(({ s, v, y0 }) => { s.position.set(v.x * k, y0 + v.y * k - 2.6 * k * k, v.z * k); s.rotation.set(k * 8, k * 5, 0); s.scale.setScalar(1 - k * 0.7); });
    mats.forEach(m => m.opacity = 1 - Math.max(0, k - 0.6) / 0.4); }, () => { parts.forEach(p => p.s.geometry.dispose()); mats.forEach(m => m.dispose()); });
}
/* 책이 빛나며 떨어져 바닥에 놓인다. coverUrl 은 손님 책 표지(큐 양 제공 그림) */
const texCache = new Map();
/* 표지 텍스처는 url 마다 한 번만 읽어 계속 같이 쓴다(dropBook·burnBook 공용, 지우지 않음) */
function coverTex(url) {
  if (!url) return null; let tex = texCache.get(url);
  if (!tex) { tex = new THREE.TextureLoader().load(url); tex.colorSpace = THREE.SRGBColorSpace; texCache.set(url, tex); }
  return tex;
}
export function dropBook(fx, pos, coverUrl, glowColor, ms = 1100) {
  const book = new THREE.Group();
  const tex = coverTex(coverUrl);
  const side = new THREE.MeshStandardMaterial({ color: 0x5a3a28, flatShading: true });
  const top = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, emissive: glowColor, emissiveIntensity: 0.25 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.8), [side, side, top, side, side, side]);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.74), new THREE.MeshStandardMaterial({ color: 0xefe6cf }));
  pages.position.set(0.02, 0.005, 0); book.add(pages, cover);
  let L = borrow(fx, glowColor, 5, pos.clone().add(new THREE.Vector3(0, 0.7, 0.3)));
  const g = new THREE.Group(); g.add(book); g.position.copy(pos);
  const fall = 0.62;
  fx.add(g, ms + 2600, (k, _dt, el) => {
    const t = el / ms;   /* 낙하 진행 */
    if (t < fall) { const q = t / fall; book.position.y = 3.2 - 3.1 * q * q; book.rotation.set((1 - q) * 2.4, el / 600, (1 - q) * 1.2); if (L) L.intensity = q * 2.2; }
    else { const s = (el - fall * ms) / 1000; book.position.y = 0.1 + Math.sin(s * 18) * Math.exp(-s * 7) * 0.08; book.rotation.set(0, el / 1600, 0); /* 빛은 놓인 뒤 1.2초에 꺼지고 돌려준다(다음 타격 빛이 쓰게) */
      if (L) { if (s < 1.2) L.intensity = 2.2 * (1 - s / 1.2); else { L.release(); L = null; } } }
  }, () => { cover.geometry.dispose(); pages.geometry.dispose(); side.dispose(); top.dispose(); L && L.release(); });
  return g;
}

/* 부드러운 둥근 빛 텍스처(하나를 계속 같이 씀) */
let glowTexture = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); glowTexture = new THREE.CanvasTexture(c); glowTexture.colorSpace = THREE.SRGBColorSpace; return glowTexture;
}
/* 도서관 책 소각: 책이 떠올라 빛나다가 낱장이 흩날리고 불씨와 함께 오그라들어 사라진다.
   시간은 부르는 쪽이 정한다: 돌려준 B.set(k) 를 k=0→1 로 부르고, 끝나면(또는 건너뛰면) B.end() 로 전부 치운다.
   n(책 수)이 클수록 종이가 조금 더(14장 + 권당 3장, 최대 36장). B.info = {papers: 지금 보이는 종이 수, total, group} */
export const BURN_PAPER_MIN = 14, BURN_PAPER_MAX = 36;
export function burnBook(fx, pos, coverUrl, glowColor, n = 1) {
  const g = new THREE.Group(); g.position.copy(pos);
  const glow = new THREE.Color(glowColor), char = new THREE.Color(0x2a1a12), white = new THREE.Color(0xffffff);
  /* 책: dropBook 과 같은 모양, 표지 면이 카메라 쪽으로 서게 */
  const book = new THREE.Group(); book.rotation.x = 1.15; g.add(book);
  const side = new THREE.MeshStandardMaterial({ color: 0x5a3a28, flatShading: true, transparent: true, emissive: glow, emissiveIntensity: 0 });
  const top = new THREE.MeshStandardMaterial({ color: 0xffffff, map: coverTex(coverUrl), emissive: glow, emissiveIntensity: 0.2, transparent: true });
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xefe6cf, emissive: glow, emissiveIntensity: 0, transparent: true });
  const coverGeo = new THREE.BoxGeometry(0.62, 0.1, 0.8), pageGeo = new THREE.BoxGeometry(0.56, 0.08, 0.74);
  const pages = new THREE.Mesh(pageGeo, pageMat); pages.position.set(0.02, 0.005, 0);
  book.add(pages, new THREE.Mesh(coverGeo, [side, side, top, side, side, side]));
  /* 둘레 빛 */
  const haloMat = new THREE.SpriteMaterial({ map: glowTex(), color: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const halo = new THREE.Sprite(haloMat); halo.position.z = -0.1; g.add(halo);
  /* 낱장: 판 하나를 같이 쓰고 재질만 장마다(따로 흐려지게) */
  const N = Math.min(BURN_PAPER_MAX, BURN_PAPER_MIN + 3 * Math.max(0, Math.floor(n || 1) - 1));
  const paperGeo = new THREE.PlaneGeometry(0.15, 0.2), tints = [0xf3ead2, 0xe6d6b0, 0xfff6e0];
  const papers = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.MeshLambertMaterial({ color: tints[i % 3], side: THREE.DoubleSide, transparent: true, emissive: glow, emissiveIntensity: 0, depthWrite: false });
    const s = new THREE.Mesh(paperGeo, m); s.visible = false; g.add(s);
    const dir = i % 2 ? 1 : -1, r = Math.random;
    papers.push({ s, m, t0: 0.2 + 0.5 * (i / N) + r() * 0.05, life: 0.32 + r() * 0.12,
      p0: new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 0.4, 0.1),
      v: new THREE.Vector3(dir * (0.5 + r() * 1.3), 0.7 + r() * 1.2, 0.2 + r() * 0.6),
      spin: new THREE.Vector3((r() - 0.5) * 14, (r() - 0.5) * 10, (r() - 0.5) * 12), ph: r() * 6.28 });
  }
  /* 불씨: 점 묶음 하나 */
  const M = 28 + Math.floor(N / 2), ep = new Float32Array(M * 3), embers = [];
  for (let i = 0; i < M; i++) { const r = Math.random; embers.push({ t0: 0.3 + r() * 0.45, x: (r() - 0.5) * 0.6, y: (r() - 0.5) * 0.5, vx: (r() - 0.5) * 0.8, vy: 0.8 + r() * 1.4, ph: r() * 6.28 }); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute("position", new THREE.BufferAttribute(ep, 3));
  const em = new THREE.PointsMaterial({ map: glowTex(), color: glow.clone().lerp(white, 0.35), size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const points = new THREE.Points(eg, em); points.frustumCulled = false; g.add(points);
  let L = borrow(fx, glowColor, 5, pos.clone().add(new THREE.Vector3(0, 0, 0.5)));
  const info = { papers: 0, total: N, group: g };
  const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  function set(k) {
    /* 책: 나타나 떠오름(0~0.22) → 빛남(~0.45) → 오그라들며 탐(~0.9) */
    const appear = sm(k / 0.22), shrink = sm((k - 0.45) / 0.45), heat = sm((k - 0.2) / 0.3);
    book.visible = shrink < 1;
    book.scale.setScalar(Math.max(0.001, 1.25 * (0.6 + 0.4 * appear) * (1 - shrink)));
    book.position.set(0, -0.25 * (1 - appear) + Math.sin(k * 9) * 0.03, 0);
    book.rotation.set(1.15 + shrink * 0.6, Math.sin(k * 5) * 0.25 + shrink * 1.4, Math.sin(k * 7) * 0.08 * (1 - shrink));
    const op = appear * (1 - sm((k - 0.8) / 0.12));
    [side, top, pageMat].forEach(m => { m.opacity = op; });
    top.emissiveIntensity = 0.15 + heat * 0.25 + shrink * 1.4; pageMat.emissiveIntensity = heat * 0.5 + shrink * 1.5; side.emissiveIntensity = shrink * 0.8;
    top.color.copy(white).lerp(char, shrink * 0.7);
    haloMat.opacity = 0.75 * heat * (1 - sm((k - 0.7) / 0.3)); halo.scale.setScalar((1.1 + heat * 0.5) * (1 - 0.5 * shrink));
    if (L) L.intensity = 2.6 * heat * (1 - sm((k - 0.75) / 0.25));
    /* 낱장 */
    let live = 0;
    for (const P of papers) {
      const s = (k - P.t0) / P.life;
      if (s <= 0 || s >= 1) { P.s.visible = false; continue; }
      P.s.visible = true; live++;
      const e = 1 - (1 - s) * (1 - s);         /* 처음 빠르고 점점 느려짐 */
      P.s.position.set(P.p0.x + P.v.x * e + Math.sin(s * 11 + P.ph) * 0.09, P.p0.y + P.v.y * e - 0.25 * s * s, P.p0.z + P.v.z * e);
      P.s.rotation.set(P.spin.x * s + P.ph, P.spin.y * s, P.spin.z * s);
      P.s.scale.setScalar(0.7 + 0.3 * sm(s / 0.2) - 0.35 * sm((s - 0.6) / 0.4));
      P.m.opacity = sm(s / 0.1) * (1 - sm((s - 0.45) / 0.55));
      P.m.emissiveIntensity = 0.15 + 0.9 * sm((s - 0.3) / 0.5);   /* 가장자리부터 타는 느낌 */
    }
    info.papers = live;
    /* 불씨 */
    let eo = 0;
    embers.forEach((E, i) => { const s = Math.max(0, Math.min(1, (k - E.t0) / 0.3));
      ep[i * 3] = E.x + E.vx * s + Math.sin(s * 8 + E.ph) * 0.05; ep[i * 3 + 1] = E.y + E.vy * s; ep[i * 3 + 2] = 0.15 + s * 0.2; if (s > 0 && s < 1) eo++; });
    eg.attributes.position.needsUpdate = true;
    em.opacity = eo ? Math.min(1, sm((k - 0.3) / 0.1)) * (1 - sm((k - 0.85) / 0.15)) : 0;
  }
  const entry = fx.add(g, Infinity, () => {}, () => {
    coverGeo.dispose(); pageGeo.dispose(); paperGeo.dispose(); eg.dispose();
    [side, top, pageMat, haloMat, em].forEach(m => m.dispose()); papers.forEach(P => P.m.dispose());
    if (L) { L.release(); L = null; }
  });
  set(0);
  return { group: g, info, set, end() { fx.kill(entry); } };
}

/* 오답 연출: 작은 책이 사서 머리(head, 월드 좌표) 위에서 떨어져 "콩" 맞고 옆으로 튕겨 떨어지며 사라진다.
   시간은 부르는 쪽이 정한다: B.set(k) 를 k=0→1 로, 끝나면(또는 건너뛰면) B.end(). 맞는 순간은 k=BONK_HIT_AT.
   책 모양(표지·속지)은 모든 호출이 같이 쓰고(지우지 않음), 재질만 책마다 만들어 end 에서 지운다 */
export const BONK_HIT_AT = 0.32;
/* 진한 표지 색(어두운 책장 앞에서도 보이게 살짝 스스로 빛남) */
const BONK_COLORS = [0x2c5aa0, 0x9a2f3f, 0x2f7a52, 0x6a3fa0];
let bonkGeo = null;
export function bonkBook(fx, head, i = 0) {
  if (!bonkGeo) bonkGeo = { cover: new THREE.BoxGeometry(0.44, 0.08, 0.58), pages: new THREE.BoxGeometry(0.39, 0.06, 0.52) };
  const c = BONK_COLORS[i % BONK_COLORS.length], coverM = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, flatShading: true, transparent: true });
  const pageM = new THREE.MeshLambertMaterial({ color: 0xefe6cf, transparent: true });
  const book = new THREE.Group(), pages = new THREE.Mesh(bonkGeo.pages, pageM); pages.position.x = 0.02;
  book.add(pages, new THREE.Mesh(bonkGeo.cover, coverM));
  const g = new THREE.Group(); g.position.copy(head); g.add(book);
  const dir = i % 2 ? 1 : -1, spin = 0.6 + (i % 3) * 0.25;
  function set(k) {
    if (k < BONK_HIT_AT) { const q = k / BONK_HIT_AT;          /* 위 1.3 에서 점점 빨리 떨어짐 */
      book.position.set(0, 0.06 + 1.3 * (1 - q * q), 0); book.rotation.set(0.25 * (1 - q), q * 1.2, 0.18 * (1 - q)); }
    else { const s = (k - BONK_HIT_AT) / (1 - BONK_HIT_AT);    /* 튕겨 올랐다가 옆으로 떨어짐 */
      book.position.set(dir * 0.65 * s, 0.06 + 0.5 * s - 1.5 * s * s, 0.15 * s); book.rotation.set(s * 2.2, 1.2 + s * 0.8, -dir * s * 4 * spin); }
    const op = 1 - Math.max(0, k - 0.7) / 0.3; coverM.opacity = pageM.opacity = Math.max(0, op);
  }
  const entry = fx.add(g, Infinity, () => {}, () => { coverM.dispose(); pageM.dispose(); });
  set(0);
  return { group: g, set, end() { fx.kill(entry); } };
}

/* ---------- 종류별 타격 이펙트(2026-11-25 큐 양: 도트는 괴리감이 커서 로우폴리 파티클로) ----------
   typeFx(fx, kind, pos, dir, onEnd) — kind: 참격(베기)·관통(찌르기)·타격(치기)·방어(막기)·회피(흘리기).
   pos = 맞는 쪽 몸 가운데, dir = 공격이 오는 방향(±1, 화면 x). 지오메트리는 처음 한 번 만들어 공유, 재질만 이펙트마다 만들고 지운다 */
const TYPE_MS = 420;
const TCOL = {
  참격: [0xffffff, 0xffd98a, 0xf08a3a], 관통: [0xffffff, 0xaef0ff, 0x3aa8d8], 타격: [0xfff2c8, 0xffb43a, 0xe0502a],
  방어: [0xf0f8ff, 0x8cc8ff, 0x3a6ad0], 회피: [0xffffff, 0xcfe0f2, 0x7f98b4],
};
let TG = null;
function typeGeos() {
  if (TG) return TG;
  /* 초승달 띠: 반지름 0.55~0.72, 150° 를 9칸 삼각형 띠로 */
  const arc = new THREE.BufferGeometry(), v = [], N = 9, A0 = -0.35 * Math.PI, A1 = 0.48 * Math.PI;
  for (let i = 0; i < N; i++) { const a = A0 + (A1 - A0) * i / N, b = A0 + (A1 - A0) * (i + 1) / N, w = Math.sin(Math.PI * (i + 0.5) / N);
    const r0 = 0.62 - 0.1 * w, r1 = 0.62 + 0.1 * w, q = (r, t) => [Math.cos(t) * r, Math.sin(t) * r, 0];
    v.push(...q(r0, a), ...q(r1, a), ...q(r1, b), ...q(r0, a), ...q(r1, b), ...q(r0, b)); }
  arc.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  TG = {
    arc,
    spike: new THREE.ConeGeometry(0.07, 1.3, 4, 1).rotateZ(-Math.PI / 2),   /* +x 쪽이 뾰족 */
    ring: new THREE.RingGeometry(0.18, 0.3, 7, 1),
    hex: new THREE.CircleGeometry(0.42, 6),
    hexRim: new THREE.RingGeometry(0.42, 0.5, 6, 1),
    shard: new THREE.TetrahedronGeometry(0.07, 0),
    chunk: new THREE.OctahedronGeometry(0.08, 0),
    wedge: new THREE.ConeGeometry(0.05, 0.7, 3, 1).rotateZ(Math.PI / 2),   /* -x 쪽이 뾰족(지나간 자리) */
  };
  return TG;
}
const rnd = (a, b) => a + Math.random() * (b - a);
export const TYPE_FX = Object.keys(TCOL);
export function typeFx(fx, kind, pos, dir = 1, onEnd) {
  const C = TCOL[kind]; if (!C) return false;
  const G = typeGeos(), g = new THREE.Group(); g.position.copy(pos); g.scale.x = dir < 0 ? -1 : 1;   /* 오른쪽에서 오는 공격은 거울 */
  const mats = [], mat = c => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }); mats.push(m); return m; };
  const mesh = (geo, c) => { const m = new THREE.Mesh(geo, mat(c)); m.renderOrder = 10; g.add(m); return m; };
  const parts = [];   /* 파편: {m, v(속도), r(회전 속도)} */
  const spray = (geo, n, c, vfn) => { for (let i = 0; i < n; i++) { const m = mesh(geo, c[i % c.length]); parts.push({ m, v: vfn(i), r: new THREE.Vector3(rnd(-12, 12), rnd(-12, 12), rnd(-12, 12)) }); } };
  let anim;
  if (kind === "참격") {
    const a1 = mesh(G.arc, C[1]), a2 = mesh(G.arc, C[0]); a2.scale.setScalar(0.86); const grp = [a1, a2];
    grp.forEach(m => { m.rotation.z = 0.9; });
    spray(G.shard, 7, C, i => new THREE.Vector3(rnd(0.6, 1.6), rnd(-1.4, -0.3), rnd(-0.3, 0.3)));
    anim = k => { const sw = Math.min(1, k * 2.2); grp.forEach((m, i) => { m.rotation.z = 0.9 - 1.6 * sw; m.scale.setScalar((i ? 0.86 : 1) * (0.8 + 0.5 * sw)); m.material.opacity = k < 0.5 ? 1 : (1 - k) * 2; }); };
  } else if (kind === "관통") {
    const sp = mesh(G.spike, C[1]), core = mesh(G.spike, C[0]); core.scale.set(1, 0.5, 0.5);
    spray(G.shard, 8, C, i => new THREE.Vector3(rnd(0.8, 2.2), rnd(-0.5, 0.5), rnd(-0.4, 0.4)));
    anim = k => { const t = Math.min(1, k * 3); [sp, core].forEach(m => { m.position.x = -0.9 + 1.2 * t; m.material.opacity = k < 0.45 ? 1 : Math.max(0, (1 - k) / 0.55); }); };
  } else if (kind === "타격") {
    const r1 = mesh(G.ring, C[1]), r2 = mesh(G.ring, C[2]); r2.rotation.z = 0.4;
    const core = mesh(G.chunk, C[0]); core.scale.setScalar(2.2);
    spray(G.chunk, 9, C, i => { const a = i / 9 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * rnd(1, 1.8), Math.sin(a) * rnd(1, 1.8), rnd(-0.4, 0.4)); });
    anim = k => { r1.scale.setScalar(1 + k * 4); r2.scale.setScalar(1 + k * 2.6); r1.material.opacity = 1 - k; r2.material.opacity = (1 - k) * 0.8;
      core.scale.setScalar(2.2 * (1 - k)); core.rotation.set(k * 5, k * 3, 0); };
  } else if (kind === "방어") {
    const plate = mesh(G.hex, C[1]), rim = mesh(G.hexRim, C[0]); plate.rotation.z = rim.rotation.z = Math.PI / 6; plate.position.x = rim.position.x = -0.25;
    spray(G.shard, 6, C, i => new THREE.Vector3(rnd(-1.6, -0.6), rnd(-0.9, 1.1), rnd(-0.3, 0.3)));
    anim = k => { const p = k < 0.15 ? k / 0.15 : 1; plate.scale.setScalar(0.6 + 0.4 * p); rim.scale.setScalar(0.6 + 0.5 * p);
      plate.material.opacity = (k < 0.2 ? 0.7 : 0.7 * (1 - k) / 0.8); rim.material.opacity = 1 - k; };
  } else {   /* 회피 */
    const w = [0, 1, 2].map(i => { const m = mesh(G.wedge, C[i]); m.position.y = (i - 1) * 0.28; return m; });
    anim = k => { w.forEach((m, i) => { m.position.x = -0.2 + k * (1.1 + i * 0.25); m.scale.x = 0.6 + k * 1.2; m.material.opacity = 1 - k; }); };
  }
  fx.add(g, TYPE_MS, (k, dt) => {
    anim(k);
    for (const q of parts) { q.m.position.copy(q.v).multiplyScalar(k * 0.9); q.m.position.y -= k * k * 0.6; q.m.rotation.set(q.r.x * k, q.r.y * k, q.r.z * k); q.m.material.opacity = 1 - k; }
  }, () => { mats.forEach(m => m.dispose()); onEnd && onEnd(); });
  return true;
}
