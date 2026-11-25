// 학습 데이터 빠른 검사: npm run check:content [손님id...]
// 브라우저 없이 js/core/*.js 를 읽어 손님·문제·적·책장·장서복·기프트 규칙을 확인한다(몇 초).
// 손님 id 를 주면 그 손님만 자세히, 없으면 전부. 틀린 곳만 한 줄씩 출력하고, 있으면 종료 코드 1.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const store = {};
const ctx = { console, Math, Date, JSON,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, querySelector() { return null; } } };
ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
for (const f of ["assets/data/moon-words.sample.js", "js/core/data.js", "js/core/engine.js", "js/core/save.js", "js/core/battle.js", "js/core/moon.js", "js/core/api.js"])
  vm.runInContext(readFileSync(join(root, f), "utf8"), ctx, { filename: f });
/* 적 겉모습 model 목록(순수 데이터 ES 모듈). package.json 에 type 이 없어 경고가 나므로 data URL 로 읽는다 */
const { isMonster } = await import("data:text/javascript;charset=utf-8," + encodeURIComponent(readFileSync(join(root, "js/stage/monsters.js"), "utf8")));
const D = vm.runInContext(`({FLOORS,WEAK_POINTS,KEY_QUESTIONS,COMBAT_PAGES,KEY_PAGES,BOOK_POOLS,EGO_GIFTS,EGO_GIFT_RULES,GUEST_COMBAT,ENEMY_BODY,MB,acqAudit,checkShort,keyQsOf})`, ctx);

/* 허용 값 (js/stage/looks.js, js/stage/props.js 와 맞춘다) */
const ARCH = ["knight", "scholar", "beast", "puppet", "fixer", "mage"];
const PALETTE = ["amber", "steel", "violet", "rust", "verdant", "bone", "crimson", "teal"];
const ACCESSORY = ["lantern", "chain", "hourglass", "quill", "mirror", "watch", "banner", "gear", "cage", "orb"];
const PROP_KIT = ["scales", "candles", "hourglass", "globe", "clock", "bookpile", "scroll", "lantern", "chain", "quill", "mirror", "watch", "banner", "gear", "cage", "orb"];
const DIE = ["참격", "관통", "타격", "방어", "회피"];
const PERK = ["none", "light", "emotion", "recover", "hp10", "stagger10"];
const BONES = ["head", "back", "hand.l", "hand.r"];
const BODIES = ["human", "machine", "puppet"];

const errs = [], warns = [];
const bad = (where, msg) => errs.push(`✗ ${where}: ${msg}`);
const warn = (where, msg) => warns.push(`△ ${where}: ${msg}`);
const only = process.argv.slice(2);
const guests = only.length ? D.WEAK_POINTS.filter(g => only.includes(g.id)) : D.WEAK_POINTS;
only.filter(id => !D.WEAK_POINTS.some(g => g.id === id)).forEach(id => bad(id, "WEAK_POINTS에 없는 손님"));

/* 전체: id 중복, 층 */
const dup = (list, label) => { const seen = new Set(); list.forEach(x => { if (seen.has(x)) bad(label, `id 중복 "${x}"`); seen.add(x); }); };
dup(D.FLOORS.map(f => f.id), "FLOORS"); dup(D.WEAK_POINTS.map(g => g.id), "WEAK_POINTS");
dup(D.COMBAT_PAGES.map(p => p.id), "COMBAT_PAGES"); dup(D.KEY_PAGES.map(k => k.id), "KEY_PAGES"); dup(D.EGO_GIFTS.map(x => x.id), "EGO_GIFTS");
dup(D.WEAK_POINTS.flatMap(g => (g.enemies || []).map(e => e.key)), "적 key");
for (const f of D.FLOORS) {
  if (!f.name || !f.subject || !f.motto) bad(`층 ${f.id}`, "name·subject·motto 중 빠진 것");
  if (f.stage) {
    if (!["lamp", "moon"].includes(f.stage.mood)) bad(`층 ${f.id}`, `stage.mood "${f.stage.mood}" (lamp|moon)`);
    (f.stage.props || []).forEach(p => PROP_KIT.includes(p) || bad(`층 ${f.id}`, `stage.props 모르는 소품 "${p}"`));
  } else warn(`층 ${f.id}`, "stage 없음 → 기본 무대");
}

/* 손님별 */
for (const g of guests) {
  const W = `손님 ${g.id}`;
  for (const k of ["floorId", "concept", "subject", "weakness", "archetype", "palette", "accessory", "explanation"]) if (g[k] == null || g[k] === "") bad(W, `${k} 없음`);
  if (!D.FLOORS.some(f => f.id === g.floorId)) bad(W, `floorId "${g.floorId}" 층 없음`);
  if (![1, 2, 3].includes(g.weakness)) bad(W, `weakness ${g.weakness} (1|2|3)`);
  if (!ARCH.includes(g.archetype)) bad(W, `archetype "${g.archetype}"`);
  if (!PALETTE.includes(g.palette)) bad(W, `palette "${g.palette}"`);
  if (!ACCESSORY.includes(g.accessory)) bad(W, `accessory "${g.accessory}"`);
  if (!(Number.isInteger(g.book) && g.book >= 1 && g.book <= 8)) warn(W, `book ${g.book} → 표지를 id 해시로 고름(1~8 권장)`);

  /* 문제 */
  const qs = g.questions || [], ks = D.KEY_QUESTIONS[g.id] || g.keyQuestions || [];
  if (!qs.length) bad(W, "questions 없음");
  if (!ks.length) warn(W, "핵심 문항(KEY_QUESTIONS) 없음 → 마지막 mc를 핵심으로 씀");
  qs.forEach((q, i) => { if (q.id !== `${g.id}-q${i}`) bad(W, `일반 문항 ${i}번 id "${q.id}" (기대 "${g.id}-q${i}")`); });
  ks.forEach((q, i) => { if (q.id !== `${g.id}-k${i}`) bad(W, `핵심 문항 ${i}번 id "${q.id}" (기대 "${g.id}-k${i}")`); if (!q.hard) bad(W, `${q.id} hard:true 없음`); });
  for (const q of [...qs, ...ks]) {
    const Q = `${W} ${q.id}`;
    if (!q.prompt) bad(Q, "prompt 없음");
    if (q.type === "mc") { if (!Array.isArray(q.options) || q.options.length !== 4) bad(Q, "mc 보기는 4개"); if (!(q.correctIndex >= 0 && q.correctIndex < (q.options || []).length)) bad(Q, `correctIndex ${q.correctIndex}`); if (new Set(q.options).size !== (q.options || []).length) bad(Q, "보기 중복"); }
    else if (q.type === "ox") { if (JSON.stringify(q.options) !== '["O","X"]') bad(Q, 'ox options는 ["O","X"]'); if (![0, 1].includes(q.correctIndex)) bad(Q, "ox correctIndex 0(O)|1(X)"); }
    else if (q.type === "short") { if (!q.answer) bad(Q, "short answer 없음"); else { if (!D.checkShort(q.answer, q)) bad(Q, "answer가 checkShort를 통과 못 함"); (q.accept || []).forEach(a => D.checkShort(a, q) || bad(Q, `accept "${a}" 통과 못 함`)); } }
    else bad(Q, `type "${q.type}" (mc|ox|short)`);
  }
  if (qs.length) { const ox = qs.filter(q => q.type === "ox"), o = ox.filter(q => q.correctIndex === 0).length; if (ox.length >= 4 && (o === 0 || o === ox.length)) warn(W, `O/X 정답이 한쪽으로만 몰림 (O ${o} / X ${ox.length - o})`); }

  /* 적 */
  const en = g.enemies || [], cap = g.enemyMax ? Math.min(D.MB.maxEnemies, g.enemyMax) : g.manyEnemies === true ? D.MB.maxEnemies : D.MB.ENEMY_MAX;
  if (!en.length) bad(W, "enemies 없음");
  if (en.length > cap) bad(W, `적 ${en.length}명 > 상한 ${cap} (기믹은 큐 양이 고른 뒤에만)`);
  const leaders = en.filter(e => e.leader);
  if (leaders.length !== 1) bad(W, `우두머리(leader:true) ${leaders.length}명 (정확히 1명)`); else if (!en[0].leader) bad(W, "우두머리는 enemies 첫 칸");
  const all = [...qs, ...ks].map(q => q.id), owner = {};
  for (const e of en) {
    const E = `${W} 적 ${e.key}`;
    if (!e.key || !e.name || !e.topic) bad(E, "key·name·topic 중 빠진 것");
    if (!BODIES.includes(e.body) && !BODIES.includes(D.ENEMY_BODY[e.key])) bad(E, "ENEMY_BODY(js/core/battle.js)에 몸 등록 안 됨");
    if (!(e.q || []).length) bad(E, "맡은 문항(q) 없음");
    if (e.model != null && !isMonster(e.model)) bad(E, `없는 적 모델 "${e.model}" (js/stage/monsters.js, 그림 docs/monsters/)`);
    for (const id of e.q || []) { if (!all.includes(id)) bad(E, `없는 문항 "${id}"`); if (owner[id]) bad(E, `문항 "${id}"가 ${owner[id]}에도 있음`); owner[id] = e.key; }
  }
  all.filter(id => !owner[id]).forEach(id => bad(W, `문항 "${id}"를 맡은 적이 없음`));
  { const n = {}; en.forEach(e => { if (e.model) n[e.model] = (n[e.model] || 0) + 1; }); Object.entries(n).filter(([, c]) => c > 2).forEach(([m, c]) => warn(W, `적 모델 "${m}"를 ${c}명이 씀(한 무리에서 겹치지 않게)`)); }

  /* 적 책장 */
  const gc = g.combat || D.GUEST_COMBAT[g.id];
  if (!gc) bad(W, "GUEST_COMBAT(js/core/engine.js) 없음");
  else { if (!Array.isArray(gc.names) || gc.names.length < 3) bad(W, "GUEST_COMBAT.names 3개 필요"); if (!gc.bigName) bad(W, "GUEST_COMBAT.bigName 없음"); [gc.atk, gc.alt].forEach(t => t && !DIE.includes(t) && bad(W, `GUEST_COMBAT 주사위 "${t}"`)); }

  /* 책 풀·책장·장서복·기프트 */
  const pool = D.BOOK_POOLS[g.id];
  if (!pool || !pool.length) bad(W, "BOOK_POOLS 없음");
  else {
    pool.forEach(e => { if (!["page", "key"].includes(e.k)) bad(W, `풀 항목 k "${e.k}"`); if (!(e.w > 0)) bad(W, `풀 ${e.id} 가중치 w`); });
    if (!pool.some(e => e.k === "key")) bad(W, "풀에 장서복(k:\"key\")이 없음");
  }
  for (const p of D.COMBAT_PAGES.filter(p => p.sourceGuest === g.id)) {
    const P = `${W} 책장 ${p.id}`;
    if (!pool || !pool.some(e => e.k === "page" && e.id === p.id)) bad(P, "이 손님 BOOK_POOLS에 없음");
    if (p.floorId !== g.floorId) bad(P, `floorId "${p.floorId}" ≠ 손님 층`);
    if (!(p.cost >= 0) || !Array.isArray(p.dice) || !p.dice.length) bad(P, "cost·dice 확인");
    (p.dice || []).forEach(d => { if (!DIE.includes(d.type)) bad(P, `주사위 type "${d.type}"`); if (!(d.min >= 1 && d.max >= d.min)) bad(P, `주사위 ${d.min}~${d.max}`); });
    if (!["N", "R", "SR", "SSR"].includes(p.rarity)) warn(P, `rarity "${p.rarity}"`);
  }
  for (const e of (pool || []).filter(e => e.k === "key")) {
    const k = D.KEY_PAGES.find(k => k.id === e.id); if (!k) continue;
    const K = `${W} 장서복 ${k.id}`;
    if (!PERK.includes(k.perk)) bad(K, `perk "${k.perk}"`);
    if (!k.look) warn(K, "look 없음 → 사서 기본 모습");
    else {
      if (k.look.model) bad(K, `look.model 은 더 쓰지 않음(사서 얼굴이 바뀜) — top 을 쓰세요`);
      if (k.look.top && !["Knight", "Barbarian", "Mage", "Rogue"].includes(k.look.top)) bad(K, `look.top "${k.look.top}" (Knight|Barbarian|Mage|Rogue)`);
      (k.look.props || []).forEach(p => { if (!PROP_KIT.includes(p.name)) bad(K, `look 소품 "${p.name}"`); if (!BONES.includes(p.bone)) bad(K, `look 뼈 "${p.bone}"`); });
    }
  }
  const gifts = D.EGO_GIFTS.filter(x => x.guestId === g.id);
  if (gifts.length !== 3) warn(W, `에고 기프트 ${gifts.length}개 (보통 3개)`);
  gifts.forEach(x => { if (!D.EGO_GIFT_RULES.slots.includes(x.slot)) bad(`${W} 기프트 ${x.id}`, `slot "${x.slot}"`); });
  dup(gifts.map(x => x.slot), `${W} 기프트 부위`);
}

/* 고아 책장·장서복 (save.js acqAudit) */
const a = D.acqAudit();
a.orphans.forEach(o => bad("acqAudit", `어느 손님 풀에도 없는 ${o}`)); a.bad.forEach(o => bad("acqAudit", `풀의 잘못된 항목 ${o}`));

warns.forEach(w => console.log(w)); errs.forEach(e => console.log(e));
console.log(`\n손님 ${guests.length}명 검사 · 오류 ${errs.length} · 주의 ${warns.length}`);
process.exitCode = errs.length ? 1 : 0;
