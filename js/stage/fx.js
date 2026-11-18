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
export function dropBook(fx, pos, coverUrl, glowColor, ms = 1100) {
  const book = new THREE.Group();
  let tex = null; if (coverUrl) { tex = texCache.get(coverUrl); if (!tex) { tex = new THREE.TextureLoader().load(coverUrl); tex.colorSpace = THREE.SRGBColorSpace; texCache.set(coverUrl, tex); } }
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
