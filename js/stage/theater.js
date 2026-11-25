/* 서고 = 극이 펼쳐지는 무대(2026-11-26 큐 양). setFloor 가 부른다. 모두 world 아래에 붙여 층을 바꿀 때 함께 지워진다.
   - 책장 부품(옆 기둥·선반 판·윗 몰딩·받침): InstancedMesh 하나
   - 무대: 마루 이음 줄(InstancedMesh), 앞 가장자리 풋라이트(InstancedMesh), 가운데 조명 웅덩이
   - 프로시니엄: 양옆 기둥 둘(InstancedMesh), 접혀 묶인 커튼 둘, 위쪽 물결 휘장
   카메라 위쪽 끝은 뒤 책장 꼭대기 근처라 그보다 높은 것(2층 회랑 등)은 보이지 않아 만들지 않는다. */
import * as THREE from "three";

const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o || {}));
const box = new THREE.BoxGeometry(1, 1, 1);   /* 인스턴스용 단위 상자(공유, 지우지 않음) */
box.userData.keep = true;

/* shelves: 책장 그룹들(world 좌표 matrix 가 계산된 것) */
export function buildTheater(world, T, accent, shelves) {
  const g = new THREE.Group(); g.name = "theater"; world.add(g);
  const tmp = new THREE.Object3D(), M = new THREE.Matrix4();

  /* ---- 책장 부품: 책장 하나에 옆 기둥 2, 선반 판 4, 윗 몰딩 1, 받침 1 ---- */
  const PARTS = [
    [-1.07, 2.45, 0.02, 0.16, 4.95, 0.6], [1.07, 2.45, 0.02, 0.16, 4.95, 0.6],
    ...[0, 1, 2, 3].map(r => [0, 0.43 + r * 1.12, 0.1, 2.0, 0.07, 0.42]),
    [0, 4.95, 0.05, 2.45, 0.24, 0.7], [0, 0.11, 0.06, 2.3, 0.22, 0.62],
  ];
  const trim = new THREE.Color(T.shelf).multiplyScalar(1.35);
  const parts = new THREE.InstancedMesh(box, lam(trim), shelves.length * PARTS.length); parts.name = "shelfParts";
  let n = 0;
  for (const sh of shelves) for (const [x, y, z, w, h, d] of PARTS) { tmp.position.set(x, y, z); tmp.scale.set(w, h, d); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); parts.setMatrixAt(n++, M.multiplyMatrices(sh.matrix, tmp.matrix)); }
  g.add(parts);

  /* ---- 마루: 바닥(반지름 ~7) 위 이음 줄 ---- */
  const lines = [];
  for (let x = -6.75; x <= 6.75; x += 0.5) { const L = 2 * Math.sqrt(Math.max(0, 6.9 * 6.9 - x * x)) * 0.97; if (L > 0.5) lines.push([x, L]); }
  const planks = new THREE.InstancedMesh(box, lam(new THREE.Color(T.floor).multiplyScalar(0.62)), lines.length); planks.name = "planks";
  lines.forEach(([x, L], i) => { tmp.position.set(x, 0.004, 0); tmp.scale.set(0.03, 0.006, L); tmp.updateMatrix(); planks.setMatrixAt(i, tmp.matrix); });
  g.add(planks);

  /* ---- 풋라이트: 팔각 단 앞쪽 가장자리(카메라 쪽)를 따라 ---- */
  const FN = 17, foot = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: T.foot, toneMapped: false }), FN); foot.name = "footlights";
  for (let i = 0; i < FN; i++) { const a = -1.15 + 2.3 * i / (FN - 1), r = 7.05 / Math.cos(((a + Math.PI / 8) % (Math.PI / 4) + Math.PI / 4) % (Math.PI / 4) - Math.PI / 8);
    tmp.position.set(Math.sin(a) * Math.min(r, 7.6) * 0.97, 0.07, Math.cos(a) * Math.min(r, 7.6) * 0.97); tmp.scale.setScalar(1); tmp.updateMatrix(); foot.setMatrixAt(i, tmp.matrix); }
  g.add(foot);
  /* 풋라이트 갓(어두운 반원통 띠) */
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(6.95, 6.95, 0.12, 24, 1, true, -1.2 + Math.PI / 2, 2.4), lam(new THREE.Color(T.shelf).multiplyScalar(0.8), { side: THREE.DoubleSide }));
  hood.position.y = 0.06; hood.rotation.y = Math.PI; g.add(hood);

  /* ---- 가운데 조명 웅덩이(위에서 떨어지는 핀 조명) ---- */
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), new THREE.MeshBasicMaterial({ map: poolTex(), color: T.spot, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.name = "spotPool"; pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.014, 0.2); pool.renderOrder = 1; g.add(pool);

  /* ---- 프로시니엄 기둥 둘 ---- */
  const colGeo = columnGeometry(), cols = new THREE.InstancedMesh(colGeo, lam(T.column), 2); cols.name = "columns";
  [-1, 1].forEach((s, i) => { tmp.position.set(s * 6.35, 0, -3.45); tmp.scale.setScalar(1); tmp.updateMatrix(); cols.setMatrixAt(i, tmp.matrix); });
  g.add(cols);

  /* ---- 커튼: 접힌 천이 아래 1.4 높이에서 바깥으로 묶여 있다 ---- */
  const curCol = new THREE.Color(T.curtain), curGeo = curtainGeometry(), curMat = lam(curCol, { side: THREE.DoubleSide, emissive: curCol, emissiveIntensity: 0.35 });   /* 빛이 덜 닿는 쪽도 검게 안 보이게 */
  for (const [s, name] of [[-1, "curtainL"], [1, "curtainR"]]) {
    const c = new THREE.Mesh(curGeo, curMat); c.name = name; c.position.set(s * 6.75, 0, -3.05); c.scale.x = -s; g.add(c);
  }
  /* 묶은 끈(포인트 색) */
  const tieMat = lam(accent, { emissive: accent, emissiveIntensity: 0.25 });
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 4, 10), tieMat); t.position.set(s * 6.5, 1.4, -3.0); t.rotation.x = Math.PI / 2; t.scale.set(1, 0.55, 1); g.add(t); }   /* 모인 천을 가로로 감싼 띠 */

  /* ---- 위쪽 휘장(물결 모양 아랫단 + 포인트 색 술 줄) ---- */
  const valCol = new THREE.Color(T.curtain).multiplyScalar(0.85), val = new THREE.Mesh(valanceGeometry(), lam(valCol, { side: THREE.DoubleSide, emissive: valCol, emissiveIntensity: 0.3 })); val.name = "valance"; val.position.set(0, 0, -3.15); g.add(val);
  const fringe = new THREE.Mesh(valanceGeometry(true), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, toneMapped: false })); fringe.position.set(0, -0.02, -3.13); g.add(fringe);
  return g;
}

/* 기둥: 받침 + 8각 몸통 + 머리(한 지오메트리) */
function columnGeometry() {
  const parts = [
    new THREE.BoxGeometry(1.0, 0.35, 1.0).translate(0, 0.175, 0),
    new THREE.CylinderGeometry(0.3, 0.34, 4.9, 8).translate(0, 0.35 + 2.45, 0),
    new THREE.BoxGeometry(0.95, 0.3, 0.95).translate(0, 5.4, 0),
    new THREE.BoxGeometry(0.75, 0.16, 0.75).translate(0, 5.25 - 0.0, 0),
  ];
  return merge(parts);
}
/* 커튼: x 0(바깥 끝)~W(안쪽 끝), 접힌 주름(z 지그재그), 묶은 높이에서 바깥으로 모인다 */
function curtainGeometry() {
  const W = 1.75, H = 5.2, C = 12, Rn = 14, TIE = 1.4, v = [], idx = [];
  for (let j = 0; j <= Rn; j++) { const y = H * j / Rn, gather = 1 - 0.7 * Math.exp(-(((y - TIE) / 0.75) ** 2)) - (y < TIE ? 0.15 * (TIE - y) / TIE : 0);
    for (let i = 0; i <= C; i++) { const u = i / C; v.push(-u * W * gather, y, (i % 2 ? 0.13 : -0.05) * (0.6 + 0.4 * gather)); } }
  for (let j = 0; j < Rn; j++) for (let i = 0; i < C; i++) { const a = j * (C + 1) + i, b = a + 1, c = a + C + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* 휘장: 폭 13.6, 위 4.25(세로 화면에서 너무 넓게 덮지 않게), 물결 아랫단(3.35 근처), 주름. fringe=true 면 아랫단을 따라 가는 띠 */
function valanceGeometry(fringe) {
  const W = 13.6, C = 64, v = [], idx = [];
  const bottom = x => 3.3 + 0.3 * Math.abs(Math.cos(x * Math.PI / 2.27));
  const rows = fringe ? 1 : 4;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= C; i++) { const x = -W / 2 + W * i / C, b = bottom(x), top = fringe ? b + 0.07 : 4.25, y = b + (top - b) * j / rows;
    v.push(x, y, (i % 2 ? 0.08 : -0.02) * (fringe ? 0 : 1) + (fringe ? 0.1 : 0)); }
  for (let j = 0; j < rows; j++) for (let i = 0; i < C; i++) { const a = j * (C + 1) + i, b = a + 1, c = a + C + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function merge(geos) {
  const pos = [], idx = []; let off = 0;
  for (const g0 of geos) { const g = g0.index ? g0 : g0; const p = g.attributes.position; for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); m.setIndex(idx); m.computeVertexNormals(); return m;
}
let poolT = null;
function poolTex() {
  if (poolT) return poolT;
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), gr = x.createRadialGradient(64, 64, 4, 64, 64, 63);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.55, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); poolT = new THREE.CanvasTexture(c); poolT.userData.keep = true; return poolT;
}
