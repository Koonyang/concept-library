/* 캐릭터: KayKit 모델(뼈대 공유) + anims.glb 클립. 로드 실패면 코드 도형 자리표시(같은 인터페이스).
   await loadCharacters()      한 번만 받는다. 실패해도 reject 하지 않는다(자리표시로 감)
   const F = makeFigure(look)  look = lookOf(unit, guest)
     F.obj                     THREE.Object3D (바닥 y=0, +Z 앞)
     F.act(name, {once, fadeMs, speed}) → Promise (once 면 클립이 끝날 때, 아니면 바로)
     F.current, F.placeholder, F.height(머리까지 높이), F.update(dt), F.hand(side) 손 뼈 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { WEAPONS, LIB_BOOK } from "./looks.js";
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
    .then(gs => { models = {}; MODELS.forEach((m, i) => { models[m] = gs[i].scene; }); clips = gs[gs.length - 1].animations; })
    .catch(e => { console.warn("[stage] 캐릭터 모델을 못 받음 — 자리표시로", e && e.message); models = null; clips = null; });
  return loading;
}
export const charactersReady = () => !!models;

function codeBook(color) {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: 0xefe6cf, flatShading: true }));
  pages.position.y = 0.01; g.add(cover, pages); g.rotation.x = Math.PI / 2; return g;
}

function realFigure(look) {
  const src = models[look.model] || models.Rogue_Hooded;
  const obj = SkeletonUtils.clone(src);
  const box = new THREE.Box3().setFromObject(src), h = box.max.y - box.min.y || 1;
  const k = TARGET_H / h;
  const holder = new THREE.Group(); obj.scale.setScalar(k); holder.add(obj);
  const keep = new Set(WEAPONS[look.model] || []), bookName = look.librarian ? LIB_BOOK[look.model] : null;
  if (bookName) keep.add(bookName);
  const cloth = new THREE.Color(look.palette.accent);
  let handL = null, handR = null;
  obj.traverse(n => {
    if (n.name === "handslot.l") handL = n; if (n.name === "handslot.r") handR = n;
    if (!n.isMesh) return;
    n.frustumCulled = false;
    if (ALL_WEAPONS.test(n.name)) n.visible = keep.has(n.name);
    if (CLOTH.test(n.name)) { n.material = n.material.clone(); n.material.color.copy(cloth).lerp(new THREE.Color(0xffffff), 0.25); }
  });
  if (look.librarian && !bookName && handL) { const b = codeBook(new THREE.Color(look.palette.accent)); b.scale.setScalar(1 / k); handL.add(b); }
  const mixer = new THREE.AnimationMixer(obj), actions = {};
  let cur = null;
  const F = {
    obj: holder, placeholder: false, current: null, height: TARGET_H,
    hand: side => side === "l" ? handL : handR,
    update(dt) { mixer.update(dt); },
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
  const g = new THREE.Group(), c = new THREE.Color(look.palette.accent), m = new THREE.MeshStandardMaterial({ color: c, flatShading: true });
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 6), m); cloak.position.y = 0.68;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.5, 6), m); chest.position.y = 1.32;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), m); head.position.y = 1.8;
  g.add(cloak, chest, head);
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
  return F;
}

let shadowTex = null;
function shadowDisc() {
  if (!shadowTex) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); shadowTex = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = -1; return m;
}
