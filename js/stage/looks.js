/* 유닛 → 겉모습(어떤 모델, 무슨 색, 무슨 장신구, 크기). 규칙과 무관한 그림 데이터. */
/* 손님 palette 8종 (옛 UI GUEST_PALETTES 값 그대로) */
export const PALETTES = {
  amber:  { cloth:"#2a2214", deep:"#0e0b08", accent:"#c4a35a", light:"#e6d3a3", metal:"#8f6b2a", glow:"#fff0c0" },
  steel:  { cloth:"#1a2230", deep:"#0a0c12", accent:"#8aa0b8", light:"#d5e2ee", metal:"#6a7a8a", glow:"#cfe3ff" },
  violet: { cloth:"#241830", deep:"#0c0812", accent:"#a888c4", light:"#e6d3f0", metal:"#6a4a8a", glow:"#e0c4ff" },
  rust:   { cloth:"#2a1810", deep:"#100806", accent:"#c47048", light:"#e8b898", metal:"#8a4a28", glow:"#ffc8a0" },
  verdant:{ cloth:"#14241c", deep:"#08100c", accent:"#6ebd96", light:"#c8ead8", metal:"#3a6a50", glow:"#d5ffe8" },
  bone:   { cloth:"#2a2824", deep:"#12110f", accent:"#d8c8a8", light:"#f3e6c0", metal:"#8a8070", glow:"#fff6e0" },
  crimson:{ cloth:"#2a1216", deep:"#12080a", accent:"#c45c4a", light:"#f0b0a4", metal:"#8a3028", glow:"#ffc0b0" },
  teal:   { cloth:"#102028", deep:"#070c10", accent:"#5aa0a8", light:"#b8e0e4", metal:"#2a6068", glow:"#c8f0f4" },
};
export const ARCH_MODEL = { knight:"Knight", fixer:"Rogue", scholar:"Mage", mage:"Mage", beast:"Barbarian", puppet:"Rogue_Hooded" };
/* 따르는 적은 몸(body: human/machine/puppet, 코어 enemyBody)으로 모델을 골라 우두머리와 다르게 보이게 */
export const BODY_MODEL = { human:"Rogue", machine:"Knight", automaton:"Knight", puppet:"Rogue_Hooded" };
export const LIB_MODEL = { kyu:"Mage", lib2:"Knight", lib3:"Rogue" };
export const LIB_PALETTE = { kyu:"teal", lib2:"steel", lib3:"bone" };
/* 모델마다 보일 손 무기(나머지 무기 메시는 숨김). 사서는 왼손에 책. */
export const WEAPONS = {
  Knight: ["1H_Sword"], Mage: ["1H_Wand"], Barbarian: ["2H_Axe"], Rogue: ["Knife"], Rogue_Hooded: ["Knife"],
};
export const LIB_BOOK = { Mage: "Spellbook_open" };   /* 모델에 책이 있으면 그것, 없으면 코드로 만든 책 */
export const MAGIC_MODELS = new Set(["Mage"]);          /* 공격 동작을 마법(Spellcast_Shoot)으로 */

/* 복장 뼈 이름(장서복 look.props[].bone) → 모델 뼈. back 은 가슴 뼈에 붙이고 뒤로 민다 */
export const OUTFIT_BONES = { head: "head", back: "chest", "hand.l": "handslot.l", "hand.r": "handslot.r" };
export const OUTFIT_MODELS = ["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"];

/* 사서의 장착 장서복(코어 Game.libs.keyOf). 코어가 없거나 오류면 null */
function keyPageOf(libId) {
  try { const L = typeof window !== "undefined" && window.Game && window.Game.libs; return (L && L.keyOf && L.keyOf(libId)) || null; } catch (e) { return null; }
}

/* lookOf(unit, guest, keyPage?) → {model, palette, accessory|null, scale, librarian, outfit?}
   사서는 장착 장서복의 look(선택: model·cloth·body·show·hide·props, docs/ui.md 9절)을 합친다. look 이 없으면 outfit 도 없다 */
export function lookOf(unit, guest, keyPage) {
  if (unit.side === "ally") {
    const id = unit.libId || "kyu";
    const base = { model: LIB_MODEL[id] || "Mage", palette: PALETTES[LIB_PALETTE[id]] || PALETTES.teal, accessory: null, scale: 1.0, librarian: true };
    const kp = keyPage === undefined ? keyPageOf(id) : keyPage, L = kp && kp.look;
    if (!L || typeof L !== "object") return base;
    if (L.model && OUTFIT_MODELS.includes(L.model)) base.model = L.model;
    else if (L.model) console.warn("[stage] 모르는 복장 모델:", L.model);
    base.outfit = { cloth: L.cloth || null, body: L.body || null, show: [].concat(L.show || []), hide: [].concat(L.hide || []),
      props: [].concat(L.props || []).filter(q => q && q.name) };
    return base;
  }
  const g = guest || {};
  const lead = ARCH_MODEL[g.archetype] || "Rogue_Hooded";
  let model = unit.leader ? lead : (BODY_MODEL[unit.body] || "Rogue");
  if (!unit.leader && model === lead) model = lead === "Barbarian" ? "Rogue" : "Barbarian";
  return { model, palette: PALETTES[g.palette] || PALETTES.crimson,
    accessory: g.accessory || null, scale: unit.leader ? 1.1 : 0.9, librarian: false };
}
