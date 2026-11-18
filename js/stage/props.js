/* 공용 소품 상자: 층 무대(stage.props)와 손님 장신구(accessory)가 같이 쓴다.
   전부 코드로 만든 로우폴리(flatShading), 높이 ≤ 1.2, 바닥(y=0)에 서는 기준. 새 소품은 MAKERS 에 하나 추가하면 된다. */
import * as THREE from "three";

export const PROP_KIT = ["scales","candles","hourglass","globe","clock","bookpile","scroll","lantern","chain","quill","mirror","watch","banner","gear","cage","orb"];

const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: 0.8, metalness: 0.1 }, o || {}));
const brass = () => M(0xb08a3e, { metalness: 0.5, roughness: 0.45 });
const wood = () => M(0x4a3020);
const glow = (accent, i = 1.4) => M(accent, { emissive: accent, emissiveIntensity: i });
function at(mesh, x, y, z, rx = 0, ry = 0, rz = 0) { mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); return mesh; }
const G = (...k) => { const g = new THREE.Group(); k.forEach(m => g.add(m)); return g; };

const MAKERS = {
  scales: a => G(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 6), brass()), 0, 0.04, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), brass()), 0, 0.5, 0),
    at(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.03), brass()), 0, 0.95, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.05, 6), brass()), -0.38, 0.72, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.05, 6), brass()), 0.38, 0.78, 0),
    at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), glow(a)), 0, 1.02, 0)),
  candles: a => { const g = new THREE.Group(); [[0, 0.5], [0.18, 0.34], [-0.16, 0.4]].forEach(([x, h], i) => {
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, h, 6), M(0xe8dcc0)), x, h / 2, i * 0.05));
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 5), glow(0xffc070, 2)), x, h + 0.05, i * 0.05)); });
    g.userData.light = { color: 0xffa760, y: 0.6 }; return g; },
  hourglass: a => G(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 6), wood()), 0, 0.03, 0),
    at(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 6), M(0xcfe6ff, { transparent: true, opacity: 0.55 })), 0, 0.22, 0, Math.PI),
    at(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 6), M(0xcfe6ff, { transparent: true, opacity: 0.55 })), 0, 0.5, 0),
    at(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 6), glow(a, 0.6)), 0, 0.14, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 6), wood()), 0, 0.68, 0)),
  globe: a => G(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.08, 6), wood()), 0, 0.04, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 5), brass()), 0, 0.22, 0),
    at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), M(a, { emissive: a, emissiveIntensity: 0.15 })), 0, 0.62, 0),
    at(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.02, 4, 12), brass()), 0, 0.62, 0, 0.4, 0, 0)),
  clock: a => G(
    at(new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.28), wood()), 0, 0.575, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 10), M(0xefe6cf)), 0, 0.9, 0.15, Math.PI / 2),
    at(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.01), M(0x1c1c1c)), 0, 0.94, 0.17),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), glow(a, 0.8)), 0, 0.4, 0.15, Math.PI / 2)),
  bookpile: a => { const g = new THREE.Group(); const cs = [0x8a3b2e, 0x2e5a5a, a, 0x6b4a2e, 0x3e4a6a];
    cs.forEach((c, i) => g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5 - i * 0.03, 0.09, 0.36), M(c)), (i % 2 ? 0.03 : -0.02), 0.05 + i * 0.095, 0, 0, i * 0.35)));
    return g; },
  scroll: a => G(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6), M(0xe8dcc0)), 0, 0.07, 0, 0, 0, Math.PI / 2),
    at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.4), M(0xefe6cf)), 0, 0.01, 0.24),
    at(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 4, 8), M(a)), 0, 0.07, 0, 0, Math.PI / 2, 0)),
  lantern: a => { const g = G(
      at(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.26), brass()), 0, 0.02, 0),
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 6), glow(0xffc070, 1.6)), 0, 0.2, 0),
      at(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.14, 4), brass()), 0, 0.42, 0, 0, Math.PI / 4),
      at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8), brass()), 0, 0.53, 0));
    g.userData.light = { color: 0xffa760, y: 0.25 }; return g; },
  chain: a => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 4, 6), M(0x6a6a72, { metalness: 0.6 })), 0, 0.08 + i * 0.12, 0, 0, i % 2 ? Math.PI / 2 : 0, 0)); return g; },
  quill: a => G(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 6), M(0x1c1c22)), 0, 0.07, 0),
    at(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.75, 4), M(0xefe6cf)), 0.05, 0.5, 0, 0, 0, -0.25),
    at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), glow(a)), 0.13, 0.85, 0)),
  mirror: a => G(
    at(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.2), wood()), 0, 0.03, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 8), brass()), 0, 0.6, 0, Math.PI / 2),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.045, 8), M(0xcfe6ff, { metalness: 0.9, roughness: 0.1, emissive: a, emissiveIntensity: 0.15 })), 0, 0.6, 0.005, Math.PI / 2)),
  watch: a => G(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 10), brass()), 0, 0.3, 0, Math.PI / 2),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.075, 10), M(0xefe6cf)), 0, 0.3, 0.01, Math.PI / 2),
    at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 8), brass()), 0, 0.57, 0),
    at(new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.14, 0.01), glow(a)), 0, 0.33, 0.05)),
  banner: a => G(
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), wood()), 0, 0.6, 0),
    at(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.02), M(a, { side: THREE.DoubleSide })), 0.22, 0.82, 0)),
  gear: a => G(
    at(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 4, 10), M(0x6a6a72, { metalness: 0.6 })), 0, 0.34, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6), glow(a, 0.6)), 0, 0.34, 0, Math.PI / 2)),
  cage: a => { const g = new THREE.Group();
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 6), brass()), 0, 0.03, 0));
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 6), brass()), 0, 0.8, 0));
    for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), brass()), Math.cos(t) * 0.28, 0.4, Math.sin(t) * 0.28)); }
    g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), glow(a)), 0, 0.4, 0)); return g; },
  orb: a => { const g = G(
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.18, 6), brass()), 0, 0.09, 0),
      at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), glow(a, 1)), 0, 0.36, 0));
    g.userData.light = { color: a, y: 0.36 }; return g; },
};

/* 이름 → 소품. 모르는 이름이면 null (+ 경고 한 줄) */
export function buildProp(name, accent) {
  const mk = MAKERS[name];
  if (!mk) { console.warn("[stage] 모르는 소품:", name); return null; }
  const a = accent instanceof THREE.Color ? accent.getHex() : new THREE.Color(accent || 0xd9a35a).getHex();
  const g = mk(a); g.name = "prop:" + name; return g;
}
