/* 캐릭터: KayKit 모델(뼈대 공유) + anims.glb 클립. 로드 실패면 코드 도형 자리표시(같은 인터페이스).
   await loadCharacters()      한 번만 받는다. 실패해도 reject 하지 않는다(자리표시로 감)
   const F = makeFigure(look)  look = lookOf(unit, guest)
     F.obj                     THREE.Object3D (바닥 y=0, +Z 앞)
     F.act(name, {once, fadeMs, speed}) → Promise (once 면 클립이 끝날 때, 아니면 바로)
     F.current, F.placeholder, F.height(머리까지 높이), F.update(dt), F.hand(side) 손 뼈 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { WEAPONS, LIB_BOOK, OUTFIT_BONES } from "./looks.js";
import { buildProp } from "./props.js";
import { MONSTERS, isMonster } from "./monsters.js";

const BASE = new URL("../../assets/models/characters/", import.meta.url).href;
const MODELS = ["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"];
const TARGET_H = 1.9;                       /* 모델 키를 이 높이에 맞춘다 */
const CLOTH = /Cape|Hat|Helmet|Hood/;       /* 옷 색을 바꿀 메시 */
const ALL_WEAPONS = /Sword|Shield|Axe|Mug|Wand|Staff|Spellbook|Crossbow|Knife|Throwable/;

let loading = null, models = null, clips = null;
export function loadCharacters() {
  if (loading) return loading;
  const L = new GLTFLoader();
  loading = Promise.all([...MODELS.map(m => L.loadAsync(BASE + m + ".glb")), L.loadAsync(BASE + "anims.glb")])
    .then(gs => { models = {}; MODELS.forEach((m, i) => { models[m] = gs[i].scene; flattenMouth(models[m]); }); clips = gs[gs.length - 1].animations; })
    .catch(e => { console.warn("[stage] 캐릭터 모델을 못 받음 — 자리표시로", e && e.message); models = null; clips = null; });
  return loading;
}
export const charactersReady = () => !!models;

/* 입 없애기(2026-11-19 큐 양): 로우폴리 얼굴의 입술이 못생겨 보여서 처음부터 입이 없던 얼굴처럼 메운다. 원본 지오메트리를 한 번만 고친다(복제는 공유).
   좌표는 머리 메시 자체 좌표(정면 +z, 대략 -1~1). 코 = 가운데(|x|<0.12, -0.75<y<0.05)에서 가장 앞으로 나온 부분, 입 = 코 밑 상자.
   상자 안 꼭짓점을 구멍으로 보고, 둘레는 그대로 둔 채 x·y·z 를 얇은 판(∆²=0)으로 풀어 볼·턱 곡면을 이어 붙인다
   (예전 2차 곡면 맞추기는 입 자리가 안으로 파여 보였다). 위아래 입술이 겹쳐 생긴 얇은 면도 고르게 펴진다.
   입술·입안 색이 남지 않게 메운 곳의 UV 는 둘레에서 가장 흔한 색(피부/수염)으로, 이음매 줄이 안 보이게 법선은 하나로 */
const MOUTH = { noseX: 0.12, noseY: [-0.75, 0.05], noseFront: 0.4, noseBand: 0.06, gap: 0.03, height: 0.32, half: 0.36, zmin: 0.35 };
function flattenMouth(root) {
  root.traverse(n => {
    if (!n.isMesh || !/_Head(_Hooded)?$/.test(n.name) || n.userData.mouthless) return;
    if (fillMouth(n.geometry)) n.userData.mouthless = true;
  });
}
function fillMouth(g) {
  const pos = g.attributes.position, N = pos.count, X = i => pos.getX(i), Y = i => pos.getY(i), Z = i => pos.getZ(i);
  let zmax = -Infinity; const cen = [];
  for (let i = 0; i < N; i++) if (Math.abs(X(i)) < MOUTH.noseX && Y(i) > MOUTH.noseY[0] && Y(i) < MOUTH.noseY[1] && Z(i) > MOUTH.noseFront) { cen.push(i); zmax = Math.max(zmax, Z(i)); }
  if (!cen.length) return false;
  let noseBottom = Infinity; for (const i of cen) if (Z(i) > zmax - MOUTH.noseBand) noseBottom = Math.min(noseBottom, Y(i));
  const top = noseBottom - MOUTH.gap, bottom = top - MOUTH.height;
  const inBox = i => Math.abs(X(i)) < MOUTH.half && Y(i) < top && Y(i) > bottom && Z(i) > MOUTH.zmin;
  /* 같은 자리 꼭짓점(UV 때문에 갈라진 것)을 하나로 */
  const key = i => Math.round(X(i)*1e4)+","+Math.round(Y(i)*1e4)+","+Math.round(Z(i)*1e4);
  const vid = new Int32Array(N), rep = [], members = []; const km = new Map();
  for (let i = 0; i < N; i++) { const k = key(i); let v = km.get(k); if (v === undefined) { v = rep.length; km.set(k, v); rep.push(i); members.push([]); } vid[i] = v; members[v].push(i); }
  const V = rep.length, nb = Array.from({length:V}, () => new Set());
  const idx = g.index ? g.index.array : null, T = idx ? idx.length : N;
  for (let t = 0; t < T; t += 3) { const a = vid[idx?idx[t]:t], b = vid[idx?idx[t+1]:t+1], c = vid[idx?idx[t+2]:t+2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const free = []; const fi = new Int32Array(V).fill(-1);
  for (let v = 0; v < V; v++) if (inBox(rep[v])) { fi[v] = free.length; free.push(v); }
  const n = free.length; if (!n) return false;
  /* 구멍 메우기: 바깥은 고정, 안쪽 꼭짓점 x·y·z 를 각각 ∆²=0(얇은 판)으로 푼다 */
  const lapRows = (() => { const nbl = v => [...nb[v]].filter(u => u !== v);
    const lap = v => { const m = new Map(), us = nbl(v), w = 1 / us.length; for (const u of us) m.set(u, (m.get(u) || 0) + w); m.set(v, (m.get(v) || 0) - 1); return m; };
    return free.map(v => { const us = nbl(v), w = 1 / us.length, row = new Map();
      const acc = (m, k) => { for (const [u, q] of m) row.set(u, (row.get(u) || 0) + k * q); };
      for (const u of us) acc(lap(u), w); acc(lap(v), -1); return row; }); })();
  const out = [];
  for (const get of [X, Y, Z]) {
    const A = Array.from({ length: n }, () => new Float64Array(n + 1));
    lapRows.forEach((row, r) => { for (const [u, q] of row) { if (fi[u] >= 0) A[r][fi[u]] += q; else A[r][n] -= q * get(rep[u]); } });
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
      if (Math.abs(A[c][c]) < 1e-12) return false; for (let r = 0; r < n; r++) if (r !== c) { const k = A[r][c] / A[c][c]; if (k) for (let q = c; q <= n; q++) A[r][q] -= k * A[c][q]; } }
    out.push(A.map((row, r) => row[n] / row[r]));
  }
  free.forEach((v, r) => { for (const i of members[v]) pos.setXYZ(i, out[0][r], out[1][r], out[2][r]); });
  /* 색: 가장자리(구멍 바로 바깥) 꼭짓점에서 가장 흔한 UV(피부/수염 색) 하나로 칠한다 */
  const uv = g.attributes.uv; if (uv) { const cnt = new Map();
    for (const v of free) for (const u of nb[v]) if (fi[u] < 0) for (const i of members[u]) { const k = uv.getX(i).toFixed(4)+","+uv.getY(i).toFixed(4); cnt.set(k, (cnt.get(k)||0)+1); }
    let best = null, bc = -1; for (const [k,c] of cnt) if (c > bc) { bc = c; best = k; }
    if (best) { const [bu,bv] = best.split(",").map(Number); for (const v of free) for (const i of members[v]) uv.setXY(i, bu, bv); uv.needsUpdate = true; } }
  pos.needsUpdate = true; g.computeVertexNormals();
  /* 메운 곳과 그 둘레는 갈라진 꼭짓점도 한 법선(이음매 줄이 안 보이게) */
  const nrm = g.attributes.normal, near = new Set(free); for (const v of free) for (const u of nb[v]) near.add(u);
  for (const v of near) { let x = 0, y = 0, zz = 0; for (const i of members[v]) { x += nrm.getX(i); y += nrm.getY(i); zz += nrm.getZ(i); } const l = Math.hypot(x, y, zz) || 1; for (const i of members[v]) nrm.setXYZ(i, x / l, y / l, zz / l); }
  nrm.needsUpdate = true; g.computeBoundingSphere(); return true;
}

/* 장서복이 다른 모델에서 빌려 입히는 부품.
   - 상의(top): "<모델>_Body/_ArmLeft/_ArmRight" 스킨 메시를 이 캐릭터 뼈대에 다시 묶는다(뼈 이름이 모두 같음). 머리·다리는 그대로
   - 단단한 부품(모자·투구·망토·무기·방패): 이름으로 아무 모델에서 찾아, 원래 붙어 있던 뼈와 같은 이름의 뼈에 같은 자리로 붙인다 */
const TOP_PARTS = ["Body", "ArmLeft", "ArmRight"];
function findPart(name) { if (!models) return null; for (const m of MODELS) { const n = models[m].getObjectByName(name); if (n) return n; } return null; }
function borrowRigid(obj, name) {
  const src = findPart(name); if (!src || !src.parent) return null;
  const bone = obj.getObjectByName(src.parent.name); if (!bone) return null;
  const c = src.clone(); c.name = name; c.visible = true; bone.add(c); return c;
}
function borrowTop(obj, top, base) {
  const src = models[top]; if (!src || top === base) return [];
  const bones = new Map(); obj.traverse(n => { if (n.isBone) bones.set(n.name, n); });
  const out = [];
  for (const part of TOP_PARTS) {
    const s = src.getObjectByName(`${top}_${part}`), mine = obj.getObjectByName(`${base}_${part}`);
    if (!s || !s.isSkinnedMesh || !mine) continue;
    const sk = new THREE.Skeleton(s.skeleton.bones.map(b => bones.get(b.name)), s.skeleton.boneInverses.map(m => m.clone()));
    if (sk.bones.some(b => !b)) continue;
    const m = new THREE.SkinnedMesh(s.geometry, s.material); m.name = `${top}_${part}`; m.bind(sk, s.bindMatrix.clone());
    mine.parent.add(m); mine.visible = false; out.push(m);
  }
  return out;
}

function codeBook(color) {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: 0xefe6cf, flatShading: true }));
  pages.position.y = 0.01; g.add(cover, pages); g.rotation.x = Math.PI / 2; return g;
}

/* KayKit 재질(Standard, 거칠기 0.5, 금속 0)을 Phong 으로 바꿔 쓴다: 겉보기는 거의 같고 픽셀당 계산이 가볍다(휴대폰 성능) */
const phongCache = new Map();
function phongOf(m) {
  if (!m || !m.isMeshStandardMaterial) return m;
  let p = phongCache.get(m);
  if (!p) { p = new THREE.MeshPhongMaterial({ map: m.map, color: m.color, side: m.side, transparent: m.transparent, opacity: m.opacity, shininess: 24, specular: 0x161616 }); p.name = m.name; phongCache.set(m, p); }
  return p;
}

/* 복장 소품 기본 자리(키 1.9 기준 단위, 뼈 좌표계). head·back: 위 +y, 앞 +z / hand: 무기가 뻗는 쪽 +y */
const PROP_DEFAULT = { head: { scale: 0.35, pos: [0, 0.9, 0] }, back: { scale: 0.5, pos: [0, 0.1, -0.34] },
  "hand.l": { scale: 0.4, pos: [0, 0.05, 0] }, "hand.r": { scale: 0.4, pos: [0, 0.05, 0] } };
/* 자리표시 도형에서 뼈 대신 쓰는 점(몸통 근처) */
const PH_ANCHOR = { head: [0, 1.17, 0], back: [0, 1.2, 0], "hand.l": [-0.42, 0.95, 0.15], "hand.r": [0.42, 0.95, 0.15] };
const V = a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
/* 소품 하나를 parent 에 붙인다. unit = parent 쪽 1단위가 화면에서 몇 배인지(모델 보정 k) */
function attachProp(parent, q, unit, accent, anchor) {
  const d = PROP_DEFAULT[q.bone]; if (!d) { console.warn("[stage] 모르는 복장 뼈:", q.bone); return null; }
  const p = buildProp(q.name, accent); if (!p) return null;
  const pos = V(q.pos) ? q.pos : d.pos, a = anchor || [0, 0, 0], sc = Number.isFinite(q.scale) ? q.scale : d.scale;
  p.position.set((a[0] + pos[0]) / unit, (a[1] + pos[1]) / unit, (a[2] + pos[2]) / unit);
  if (V(q.rot)) p.rotation.set(q.rot[0], q.rot[1], q.rot[2]);
  p.scale.setScalar(sc / unit); p.userData.outfit = q.bone; parent.add(p); return p;
}

function realFigure(look, srcOver, targetH) {
  const src = srcOver || models[look.model] || models.Rogue_Hooded, TH = targetH || TARGET_H;
  const obj = SkeletonUtils.clone(src);
  const box = new THREE.Box3().setFromObject(src), h = box.max.y - box.min.y || 1;
  const k = TH / h;
  const holder = new THREE.Group(); obj.scale.setScalar(k); holder.add(obj);
  /* 장서복 복장(look.outfit): show/hide 가 기본 무기 규칙보다 우선. "book" 은 사서의 책(모델 책·코드 책) */
  const O = look.outfit || null, show = new Set(O ? O.show : []), hide = new Set(O ? O.hide : []);
  /* 빌려 입기: 상의, 그리고 이 모델에 없는 단단한 부품(show 에 적은 모자·망토·무기). "hat"·"cape" 는 원래 모자·투구·망토 모두 */
  if (O) {
    if (O.top) borrowTop(obj, O.top, look.model);
    for (const name of show) if (name !== "book" && !obj.getObjectByName(name)) borrowRigid(obj, name);
    obj.traverse(n => { if (!n.isMesh || show.has(n.name)) return; if ((hide.has("hat") && /_(Hat|Helmet)$/.test(n.name)) || (hide.has("cape") && /_Cape$/.test(n.name))) hide.add(n.name); });
  }
  /* 왼손에 방패·보조 무기·소품을 들면 사서 책(모델 책 포함)은 뺀다 */
  const leftBusy = [...show].some(x => /Shield|Offhand|Spellbook|Mug/.test(x)) || !!(O && O.props.some(q => q.bone === "hand.l"));
  const keep = new Set(WEAPONS[look.model] || []), bookName = look.librarian && !hide.has("book") && !leftBusy ? LIB_BOOK[look.model] : null;
  if (bookName) keep.add(bookName);
  /* 텍스처가 어두운 편이라 복장 색은 1.5배 밝혀 곱한다(지정한 색에 가깝게 보이도록) */
  const cloth = O && O.cloth ? new THREE.Color(O.cloth).multiplyScalar(1.5) : new THREE.Color(look.palette.accent).lerp(new THREE.Color(0xffffff), 0.25);
  const body = O && O.body ? new THREE.Color(O.body).multiplyScalar(1.5) : null;
  let handL = null, handR = null;
  obj.traverse(n => {
    if (n.name === "handslot.l" || n.name === "handslotl") handL = n; if (n.name === "handslot.r" || n.name === "handslotr") handR = n;   /* GLTFLoader 는 이름의 점을 지운다 */
    if (n.isBone) return;
    if (show.has(n.name)) n.visible = true; else if (hide.has(n.name)) n.visible = false;
    if (!n.isMesh) return;
    n.userData.fromModel = true; n.frustumCulled = false; n.material = phongOf(n.material);
    if (ALL_WEAPONS.test(n.name) && !show.has(n.name)) n.visible = keep.has(n.name) && !hide.has(n.name);
    if (CLOTH.test(n.name)) { n.material = n.material.clone(); n.userData.ownMat = true; n.material.color.copy(cloth); }
    if (body && /_(Body|ArmLeft|ArmRight)$/.test(n.name)) { n.material = n.material.clone(); n.userData.ownMat = true; n.material.color.copy(body); }
  });
  /* 왼손에 다른 것(방패·보조 무기·소품)을 들면 코드 책은 안 든다 */
  if (look.librarian && !bookName && handL && !hide.has("book") && !leftBusy) { const b = codeBook(new THREE.Color(look.palette.accent)); b.scale.setScalar(1 / k); handL.add(b); }
  if (O && O.props.length) {
    holder.updateMatrixWorld(true); const ws = new THREE.Vector3(), acc = new THREE.Color(O.cloth || look.palette.accent);
    for (const q of O.props) { const bn = OUTFIT_BONES[q.bone], bone = bn ? (obj.getObjectByName(bn) || obj.getObjectByName(bn.replace(/\./g, ""))) : null;   /* GLTFLoader 는 이름의 점을 지운다(handslot.r → handslotr) */
      if (!bone) { if (!OUTFIT_BONES[q.bone]) console.warn("[stage] 모르는 복장 뼈:", q.bone); continue; }
      bone.getWorldScale(ws); attachProp(bone, q, ws.x || k, acc); }
  }
  const mixer = new THREE.AnimationMixer(obj), actions = {};
  let cur = null;
  const F = {
    obj: holder, placeholder: false, current: null, height: TH,
    hand: side => side === "l" ? handL : handR,
    debugClip: () => cur && cur.getClip().name,
    update(dt) { mixer.update(dt); },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(obj); obj.traverse(n => { if (n.isSkinnedMesh && n.skeleton) n.skeleton.dispose(); }); },
    act(name, o = {}) {
      const clip = THREE.AnimationClip.findByName(clips, name);
      if (!clip) return Promise.resolve();
      const a = actions[name] || (actions[name] = mixer.clipAction(clip));
      a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setEffectiveWeight(1);
      a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
      if (cur && cur !== a) a.crossFadeFrom(cur, (o.fadeMs ?? 120) / 1000, false);
      a.play(); cur = a; F.current = name;
      if (!o.once) return Promise.resolve();
      return new Promise(res => { const done = e => { if (e.action === a) { mixer.removeEventListener("finished", done); res(); } }; mixer.addEventListener("finished", done); });
    },
  };
  return F;
}

/* 자리표시(모델이 없을 때): 시안 같은 도형. act 는 시간만 기다린다 */
function placeholderFigure(look) {
  const O = look.outfit || null;
  const g = new THREE.Group(), c = new THREE.Color(O && O.cloth || look.palette.accent), m = new THREE.MeshStandardMaterial({ color: c, flatShading: true });
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 6), m); cloak.position.y = 0.68;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.5, 6), m); chest.position.y = 1.32;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), m); head.position.y = 1.8;
  g.add(cloak, chest, head);
  if (O) for (const q of O.props) attachProp(g, q, 1, c, PH_ANCHOR[q.bone]);
  const holder = new THREE.Group(); holder.add(g);
  let t = 0;
  const F = {
    obj: holder, placeholder: true, current: null, height: TARGET_H, hand: () => chest,
    update(dt) { t += dt; g.position.y = Math.sin(t * 3) * 0.03; g.rotation.z = F.current && /Hit|Death/.test(F.current) ? -0.25 : 0; },
    act(name, o = {}) { F.current = name; return o.once ? new Promise(r => setTimeout(r, 600 / (o.speed || 1))) : Promise.resolve(); },
  };
  return F;
}

export function makeFigure(look) {
  const F = look.monster && models && monsterReady(look.monster) ? monsterFigure(look) : models ? realFigure(look) : placeholderFigure(look);
  /* 손님 장신구: 등 뒤 허리께에 작게. 몬스터는 키·폭에 맞춰 몸 밖 옆자리 */
  if (look.accessory) { const acc = buildProp(look.accessory, new THREE.Color(look.palette.accent)); if (acc) { acc.scale.setScalar(0.55); acc.userData.accessory = true;
    if (F.monster) acc.position.set(Math.max(0.32, (F.halfW || 0) + 0.05), 0.55 * F.height / TARGET_H, -0.25); else acc.position.set(0.32, 0.55, -0.25); F.obj.add(acc); } }
  /* 발밑 둥근 그림자 판 */
  F.obj.add(shadowDisc());
  /* 이 figure 가 따로 만든 지오메트리·재질(소품·그림자·자리표시 도형)은 정리할 때 지운다. 모델 지오메트리는 원본과 공유라 남긴다 */
  F.obj.traverse(n => { if (n.isMesh && !n.isSkinnedMesh && !n.userData.fromModel) n.userData.own = true; });
  return F;
}

/* ---------- 몬스터(적 모델 다양화, js/stage/monsters.js) ---------- */
const MBASE = new URL("../../assets/models/monsters/", import.meta.url).href;
const MAX_W = 1.4;                          /* 몬스터 폭(x·z 중 큰 값) 상한 = 사람 적 자리 폭 */
const mons = new Map(), monLoading = new Map();   /* id → { scene, clips } / 받는 중 promise */
/* 처음 보는 id 만 받는다. 실패해도 reject 하지 않는다(그 적은 사람 모델로) */
export function loadMonsters(ids) {
  const want = [...new Set((ids || []).filter(isMonster))];
  return Promise.all(want.map(id => {
    if (mons.has(id)) return null; if (monLoading.has(id)) return monLoading.get(id);
    const m = MONSTERS[id], L = new GLTFLoader();
    const pr = (m.kaykit ? loadCharacters() : Promise.resolve()).then(() => L.loadAsync(MBASE + m.file))
      .then(g => { if (m.kaykit && !clips) throw new Error("anims.glb 없음"); mons.set(id, { scene: g.scene, clips: m.kaykit ? clips : g.animations }); })
      .catch(e => console.warn("[stage] 몬스터 모델을 못 받음 — 사람 모델로", id, e && e.message))
      .finally(() => monLoading.delete(id));
    monLoading.set(id, pr); return pr;
  })).then(() => {});
}
export const monsterReady = id => mons.has(id);

/* 무대가 부르는 동작 이름 → 몬스터 표준 클립(빌드가 바꿔 둔 이름). 배열은 앞에서부터 있는 것 */
const MON_ACT = { Idle: ["Idle"], Running_A: ["Run"], Hit_A: ["Hit"], Hit_B: ["Hit"], Block_Hit: ["Block", "Hit"], Dodge_Backward: ["Dodge", "Hit"], Death_A: ["Death"], Cheer: ["Cheer"] };
/* 클립이 없을 때 대신하는 코드 동작(rig 그룹을 움직임). 공격=앞으로 들이받기, 맞음·막기·피하기=흔들기, 쓰러짐=옆으로 눕기, 환호=통통 */
const FAKE = { attack: "lunge", Hit_A: "shake", Hit_B: "shake", Block_Hit: "shake", Dodge_Backward: "back", Death_A: "fall", Cheer: "hop" };
const FAKE_S = 0.45;

function monsterFigure(look) {
  const id = look.monster, M = MONSTERS[id], src = mons.get(id);
  if (M.kaykit) { const F = realFigure(look, src.scene, M.h); F.monster = id; F.halfW = 0.35; return F; }
  const obj = SkeletonUtils.clone(src.scene), rig = new THREE.Group(), holder = new THREE.Group();
  rig.add(obj); holder.add(rig);
  const accent = new THREE.Color(look.palette.accent), bodyCol = accent.clone().lerp(new THREE.Color(0xffffff), 0.25);
  obj.traverse(n => {
    if (!n.isMesh) return;
    n.userData.fromModel = true; n.frustumCulled = false;
    n.material = [].concat(n.material).map(m0 => { const m = phongOf(m0).clone(); if (!m0.isMeshStandardMaterial && !m0.isMeshPhongMaterial) return m0;
      if (M.tint === "body") m.color.copy(bodyCol); else if (typeof M.tint === "number") m.color.lerp(accent, M.tint);
      if (!n.geometry.attributes.normal) m.flatShading = true;
      return m; });
    if (n.material.length === 1) n.material = n.material[0];
    n.userData.ownMat = true;
  });
  const mixer = new THREE.AnimationMixer(obj), clipsM = src.clips, has = n => !!THREE.AnimationClip.findByName(clipsM, n);
  /* 키 맞추기: Idle 첫 자세에서 잰다(나는 것은 떠 있는 자세라 바닥에 내린다) */
  const idle = THREE.AnimationClip.findByName(clipsM, "Idle");
  /* 날갯짓처럼 Idle 중에 크기가 바뀌므로 여러 순간의 상자를 합친다 */
  if (M.rotY) obj.rotation.y = M.rotY;
  const box = new THREE.Box3(), a0 = idle && mixer.clipAction(idle);
  if (a0) a0.play();
  for (let i = 0; i < (a0 ? 12 : 1); i++) {
    if (a0) { a0.time = idle.duration * i / 12; mixer.update(0); }
    obj.updateMatrixWorld(true);
    obj.traverse(n => { if (n.isMesh) { if (n.isSkinnedMesh) n.computeBoundingBox(); box.expandByObject(n); } });
  }
  const sz = box.getSize(new THREE.Vector3()), w = Math.max(sz.x, sz.z) || 1;
  const k = Math.min(M.h / (sz.y || 1), MAX_W * 0.95 / w);   /* 표본 사이 순간이 조금 더 클 수 있어 5% 여유 */
  obj.scale.multiplyScalar(k);
  obj.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
  obj.traverse(n => { if (n.isSkinnedMesh) n.boundingBox = null; });
  mixer.stopAllAction();
  const handPt = new THREE.Object3D(); handPt.position.set(0, sz.y * k * 0.5, sz.z * k * 0.5); holder.add(handPt);
  const actions = {}; let cur = null, atkN = 0, fake = null;
  const resetRig = () => { rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); };
  const F = {
    obj: holder, placeholder: false, current: null, height: sz.y * k, halfW: sz.x * k / 2, monster: id,
    hand: () => handPt,
    debugClip: () => cur && cur.getClip().name,
    update(dt) {
      mixer.update(dt);
      if (!fake) return;
      fake.t += dt * fake.speed; const x = Math.min(1, fake.t / FAKE_S), s = Math.sin(Math.PI * x);
      if (fake.kind === "lunge") rig.position.z = s * 0.35;
      else if (fake.kind === "shake") rig.rotation.z = Math.sin(x * Math.PI * 4) * 0.14 * (1 - x);
      else if (fake.kind === "back") rig.position.z = -s * 0.3;
      else if (fake.kind === "hop") rig.position.y = s * 0.25;
      else if (fake.kind === "fall") { rig.rotation.z = -x * 1.35; rig.position.y = -x * 0.1; }
      if (x >= 1) { const r = fake.res; if (fake.kind !== "fall") resetRig(); fake = null; r && r(); }
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(obj); obj.traverse(n => { if (n.isSkinnedMesh && n.skeleton) n.skeleton.dispose(); }); },
    act(name, o = {}) {
      if (fake) { const r = fake.res; fake = null; r && r(); }
      resetRig(); F.current = name;
      const isAtk = /Attack|Spellcast/.test(name);
      let want = isAtk ? ((atkN++ % 2 && has("Attack2")) ? ["Attack2", "Attack"] : ["Attack", "Attack2"]) : (MON_ACT[name] || ["Idle"]);
      const clipName = want.find(has);
      if (!clipName || (clipName === "Idle" && name !== "Idle")) {
        const kind = FAKE[isAtk ? "attack" : name];
        play("Idle", {}, false);
        if (!o.once || !kind) return Promise.resolve();
        return new Promise(res => { fake = { kind, t: 0, speed: o.speed || 1, res }; });
      }
      return play(clipName, o, true);
    },
  };
  function play(clipName, o, ret) {
    const clip = THREE.AnimationClip.findByName(clipsM, clipName); if (!clip) return Promise.resolve();
    const a = actions[clipName] || (actions[clipName] = mixer.clipAction(clip));
    if (a === cur && !o.once) return Promise.resolve();
    a.reset(); a.setEffectiveTimeScale(o.speed || 1); a.setEffectiveWeight(1);
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    if (cur && cur !== a) a.crossFadeFrom(cur, (o.fadeMs ?? 120) / 1000, false);
    a.play(); cur = a;
    if (!o.once || !ret) return Promise.resolve();
    return new Promise(res => { const done = e => { if (e.action === a) { mixer.removeEventListener("finished", done); res(); } }; mixer.addEventListener("finished", done); });
  }
  return F;
}

let shadowTex = null;
function shadowDisc() {
  if (!shadowTex) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); shadowTex = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = -1; return m;
}
