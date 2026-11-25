/* 꼭두각시 적(2026-11-25 큐 양 "꼭두각시 적군도 잊지 말고"): 사람·해골 모델(같은 뼈대 → 원래 동작 그대로)에
   나무색 칠 + 머리 위 조종 십자 막대 + 막대에서 머리·두 손·가슴으로 내려오는 실 + 어깨·팔꿈치·무릎 구슬.
   dressPuppet(holder, obj, height) → { update(), dispose() }  holder = figure 겉 그룹(바닥 y=0), obj = 뼈가 든 모델 */
import * as THREE from "three";

const WOOD = new THREE.Color("#c8a27a"), WOOD_DARK = new THREE.Color("#6b4a2e"), STRING = new THREE.Color("#e8dcc4");
const CLOTH = /Cape|Hat|Helmet|Hood|Cloak/;
const WEAPON = /Sword|Shield|Axe|Mug|Wand|Staff|Spellbook|Crossbow|Knife|Throwable|Arrow|Blade|Bow/;
const BAR_UP = 0.35;            /* 막대 높이 = 키 + 이것(설계: 키 + 0.5 이하) */
const BEAD_R = 0.05;
const STRING_TO = ["head", "handslotl", "handslotr", "chest"];          /* GLTFLoader 는 뼈 이름의 점을 지운다 */
const BEAD_ON = ["upperarml", "upperarmr", "lowerarml", "lowerarmr", "lowerlegl", "lowerlegr"];
/* 실이 막대의 어느 끝에서 내려오는지(막대 좌표, x=좌우 z=앞뒤) */
const STRING_FROM = { head: [0, 0, 0.2], handslotl: [0.3, 0, 0], handslotr: [-0.3, 0, 0], chest: [0, 0, -0.2] };

export function dressPuppet(holder, obj, height) {
  const bone = n => obj.getObjectByName(n) || obj.getObjectByName(n.replace(/([lr])$/, ".$1"));
  /* 칠: 옷은 손님 색 그대로, 나머지(얼굴·몸)는 나무색 → 표정 없는 가면처럼. 무기는 숨김 */
  obj.traverse(n => {
    if (!n.isMesh) return;
    if (WEAPON.test(n.name)) { n.visible = false; return; }
    if (CLOTH.test(n.name)) return;
    n.material = n.material.clone(); n.userData.ownMat = true;
    n.material.color.copy(WOOD); if (n.material.map) n.material.map = null; n.material.needsUpdate = true;
  });
  const mats = [], geos = [];
  const mat = (c, kind) => { const m = kind === "line" ? new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.8 }) : new THREE.MeshPhongMaterial({ color: c, shininess: 12, flatShading: true }); mats.push(m); return m; };
  const geo = g => { geos.push(g); return g; };
  /* 조종 막대 */
  const bar = new THREE.Group(); bar.userData.puppetBar = true; bar.position.y = height + BAR_UP;
  const barMat = mat(WOOD_DARK);
  const b1 = new THREE.Mesh(geo(new THREE.BoxGeometry(0.62, 0.045, 0.045)), barMat), b2 = new THREE.Mesh(geo(new THREE.BoxGeometry(0.045, 0.045, 0.42)), barMat);
  bar.add(b1, b2); holder.add(bar);
  /* 실 */
  const strMat = mat(STRING, "line"), strings = [];
  for (const name of STRING_TO) {
    const b = bone(name); if (!b) continue;
    const g = geo(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const L = new THREE.LineSegments(g, strMat); L.userData.puppetString = true; L.frustumCulled = false; holder.add(L);
    strings.push({ L, b, from: new THREE.Vector3(...STRING_FROM[name]) });
  }
  /* 관절 구슬(뼈에 붙임, 뼈 배율을 되돌려 크기를 맞춘다) */
  holder.updateMatrixWorld(true);
  const beadGeo = geo(new THREE.IcosahedronGeometry(BEAD_R, 0)), beadMat = mat(WOOD_DARK), ws = new THREE.Vector3(), hs = new THREE.Vector3();
  holder.getWorldScale(hs);
  for (const name of BEAD_ON) { const b = bone(name); if (!b) continue; b.getWorldScale(ws);
    const m = new THREE.Mesh(beadGeo, beadMat); m.userData.puppetBead = true; m.scale.setScalar(hs.x / (ws.x || 1)); b.add(m); }
  const v = new THREE.Vector3(), head = bone("head");
  function update() {
    holder.updateMatrixWorld(true);
    /* 막대는 머리를 따라 살짝 흔들린다 */
    if (head) { head.getWorldPosition(v); holder.worldToLocal(v); bar.position.x += (v.x - bar.position.x) * 0.3; bar.position.z += (v.z - bar.position.z) * 0.3; }
    for (const s of strings) {
      const a = s.L.geometry.attributes.position;
      a.setXYZ(0, bar.position.x + s.from.x, bar.position.y, bar.position.z + s.from.z);
      s.b.getWorldPosition(v); holder.worldToLocal(v); a.setXYZ(1, v.x, v.y, v.z); a.needsUpdate = true;
    }
  }
  update();
  return { update, dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); } };
}
