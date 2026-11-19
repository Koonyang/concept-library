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

/* 입 없애기(2026-11-19 큐 양): 로우폴리 얼굴의 입술 굴곡이 못생겨 보여서, 머리 메시에서 코 아래 가운데 상자 안 꼭짓점을
   둘레 얼굴 면에 맞춘 2차 곡면(z = a + b·x² + c·y + d·y² + e·x²y) 위로 눌러 평평하게 한다. 원본 지오메트리를 한 번만 고친다(복제는 공유).
   좌표는 머리 메시 자체 좌표(정면 +z, 대략 -1~1). 코 = 가운데(|x|<0.12, -0.75<y<0.05)에서 가장 앞으로 나온 부분 */
const MOUTH = { noseX: 0.12, noseY: [-0.75, 0.05], noseFront: 0.4, noseBand: 0.06, gap: 0.03, height: 0.32, half: 0.36, zmin: 0.35, ringX: 0.22, ringY: 0.15 };
function flattenMouth(root) {
  root.traverse(n => {
    if (!n.isMesh || !/_Head(_Hooded)?$/.test(n.name) || n.userData.mouthless) return;
    const pos = n.geometry.attributes.position, N = pos.count, X = i => pos.getX(i), Y = i => pos.getY(i), Z = i => pos.getZ(i);
    let zmax = -Infinity; const cen = [];
    for (let i = 0; i < N; i++) if (Math.abs(X(i)) < MOUTH.noseX && Y(i) > MOUTH.noseY[0] && Y(i) < MOUTH.noseY[1] && Z(i) > MOUTH.noseFront) { cen.push(i); zmax = Math.max(zmax, Z(i)); }
    if (!cen.length) return;
    let noseBottom = Infinity; for (const i of cen) if (Z(i) > zmax - MOUTH.noseBand) noseBottom = Math.min(noseBottom, Y(i));
    const top = noseBottom - MOUTH.gap, bottom = top - MOUTH.height;
    const inBox = i => Math.abs(X(i)) < MOUTH.half && Y(i) < top && Y(i) > bottom && Z(i) > MOUTH.zmin;
    const inRing = i => !inBox(i) && Math.abs(X(i)) < MOUTH.half + MOUTH.ringX && Y(i) < top + MOUTH.ringY && Y(i) > bottom - MOUTH.ringY && Z(i) > MOUTH.zmin;
    const f = (x, y) => [1, x * x, y, y * y, x * x * y];
    /* 최소제곱: (AᵀA)c = Aᵀz 를 가우스 소거로 */
    const M = Array.from({ length: 5 }, () => new Array(6).fill(0));
    let ring = 0; for (let i = 0; i < N; i++) { if (!inRing(i)) continue; ring++; const r = f(X(i), Y(i)), z = Z(i); for (let a = 0; a < 5; a++) { for (let b = 0; b < 5; b++) M[a][b] += r[a] * r[b]; M[a][5] += r[a] * z; } }
    if (ring < 8) return;
    for (let c = 0; c < 5; c++) { let p = c; for (let r = c + 1; r < 5; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
      if (Math.abs(M[c][c]) < 1e-9) return; for (let r = 0; r < 5; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let q = c; q < 6; q++) M[r][q] -= k * M[c][q]; } }
    const coef = M.map((row, i) => row[5] / row[i]);
    for (let i = 0; i < N; i++) if (inBox(i)) { const r = f(X(i), Y(i)); pos.setZ(i, r.reduce((s, v, k) => s + v * coef[k], 0)); }
    pos.needsUpdate = true; if (n.geometry.attributes.normal) n.geometry.computeVertexNormals(); n.geometry.computeBoundingSphere();
    n.userData.mouthless = true;
  });
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

function realFigure(look) {
  const src = models[look.model] || models.Rogue_Hooded;
  const obj = SkeletonUtils.clone(src);
  const box = new THREE.Box3().setFromObject(src), h = box.max.y - box.min.y || 1;
  const k = TARGET_H / h;
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
    obj: holder, placeholder: false, current: null, height: TARGET_H,
    hand: side => side === "l" ? handL : handR,
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
  const F = models ? realFigure(look) : placeholderFigure(look);
  /* 손님 장신구: 등 뒤 허리께에 작게 */
  if (look.accessory) { const acc = buildProp(look.accessory, new THREE.Color(look.palette.accent)); if (acc) { acc.scale.setScalar(0.55); acc.position.set(0.32, 0.55, -0.25); F.obj.add(acc); } }
  /* 발밑 둥근 그림자 판 */
  F.obj.add(shadowDisc());
  /* 이 figure 가 따로 만든 지오메트리·재질(소품·그림자·자리표시 도형)은 정리할 때 지운다. 모델 지오메트리는 원본과 공유라 남긴다 */
  F.obj.traverse(n => { if (n.isMesh && !n.isSkinnedMesh && !n.userData.fromModel) n.userData.own = true; });
  return F;
}

let shadowTex = null;
function shadowDisc() {
  if (!shadowTex) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); shadowTex = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = -1; return m;
}
