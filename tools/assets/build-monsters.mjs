/* 적으로 쓸 괴물·동물·로봇·해골 모델 → assets/models/monsters/
   실행: npm run assets:monsters
   - Quaternius 로우폴리(CC0): npm 패키지 @netforge/asset-library-files 의 library/lowpoly/*.glb(meshopt 압축 사본)
     poly.pizza·quaternius.com 은 이 작업 환경에서 막혀 있어 npm 경로를 쓴다. 출처·라이선스는 그 패키지 NOTICE.
   - KayKit Character Pack: Skeletons 1.0(CC0): 지금 캐릭터와 뼈대가 같다 → 동작을 빼고 characters/anims.glb 를 같이 쓴다
   - 동작 이름을 게임 표준 이름으로 바꿔 남긴다: 필수 Idle Run Attack Hit Death, 있으면 Attack2 Block Dodge Cheer. 나머지 클립은 지움.
   - meshopt 를 풀고(브라우저엔 decoder 없음) 텍스처 256px, quantize. 받은 원본은 tools/assets/.cache/ (git 무시) */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, textureCompress, quantize, resample, weld, simplify, cloneDocument } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import { mkdirSync, existsSync, writeFileSync, readdirSync, statSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = join(ROOT, "tools/assets/.cache"), NF = join(CACHE, "netforge"), OUT = join(ROOT, "assets/models/monsters");
export const QUATERNIUS = ("slime_drop slime_green slime_horned slime_pink slime_spiky blob_alien blob_bird blob_ninja blob_orc blob_wizard blob_yeti jelly_flyer " +
  "alien_big demon demon_blue imp goblin orc_brute ninja_brute yeti ghost ghost_skull skull_hopper mushroom_imp mushroom_king monarch fluffy_flyer pebble_flyer " +
  "bat bee armored_bee crab frog dragon dragon_whelp wyvern skeleton skeleton_crew skeleton_grunt zombie zombie_grunt mech mech_heavy robot_flyer robot_large " +
  "robot_walker robot_gunner cat deer fox husky pug shiba stag wolf raptor trex triceratops dino").split(" ");
export const SKELETONS = ["Skeleton_Minion", "Skeleton_Warrior", "Skeleton_Mage", "Skeleton_Rogue"];
const SK_SRC = "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons/Characters/gltf/";
/* 꼭 있어야 하는 건 Idle 뿐. 나머지가 없으면 무대가 코드 동작으로 대신한다(달리기→대기, 공격→앞으로 들이받기, 맞음→흔들기, 쓰러짐→옆으로 눕기) */
export const MAX_BYTES = 300 * 1024;   /* 넘으면 메시를 줄여(simplify) 다시 쓴다 */
const NEED = ["Idle"];
/* 표준 이름 ← 원본 이름(마지막 '|' 뒤). 앞 규칙부터, 표준 이름마다 처음 맞는 하나(Attack2 는 Attack 다음 것) */
const NOT_IDLE = /attack|gun|sword|shoot|pointing/i;
export const CLIP_RULES = [
  ["Idle", [/^idle$/i, /^idle_?(a|neutral|2)?$/i, /^fly(ing)?_?idle$/i, /_idle$/i, /idle/i, /flying$/i, /^fly$/i]],
  ["Run", [/^run$/i, /^running$/i, /run/i, /walk/i, /fly/i, /hop/i, /jump(_loop)?$/i]],
  ["Attack", [/attack/i, /punch/i, /bite/i, /headbutt/i, /weapon/i, /slash/i, /stab/i, /kick/i, /shoot/i]],
  ["Hit", [/hit/i, /recieve/i, /receive/i, /react/i, /damage/i]],
  ["Death", [/death/i, /^die/i, /dead/i]],
  ["Block", [/block/i, /duck/i, /defend/i]],
  ["Dodge", [/dodge/i, /roll/i]],
  ["Cheer", [/^yes$/i, /wave/i, /dance/i, /victory/i, /cheer/i]],
];
/* 규칙으로 안 맞는 모델만 손으로: CLIP_OVERRIDES[name] = { 표준이름: "원본이름" } */
const CLIP_OVERRIDES = {
  skeleton_crew: { Death: "Dea", Attack: "Pun", Attack2: "Swo" },   /* 원본 클립 이름이 잘려 있다 */
};

const base = n => n.split("|").pop();
export function mapClips(name, names) {
  const left = [...new Set(names.map(base))], used = new Set(), out = {};
  const take = (std, src) => { out[std] = src; used.add(src); };
  for (const [std, src] of Object.entries(CLIP_OVERRIDES[name] || {})) if (left.includes(src)) take(std, src);
  for (const [std, res] of CLIP_RULES) {
    if (out[std]) continue;
    for (const re of res) { const hit = left.find(n => !used.has(n) && re.test(n) && !(std === "Idle" && NOT_IDLE.test(n))); if (hit) { take(std, hit); break; } }
    if (std === "Attack" && out.Attack && !out.Attack2) for (const re of res) { const hit = left.find(n => !used.has(n) && re.test(n)); if (hit) { take("Attack2", hit); break; } }
  }
  return out;
}

function dropAnim(a) { for (const s of a.listSamplers()) s.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose(); }

async function main() {
  mkdirSync(CACHE, { recursive: true }); mkdirSync(OUT, { recursive: true });
  if (!existsSync(join(NF, "package/library/lowpoly"))) {
    mkdirSync(NF, { recursive: true });
    const tgz = execSync("npm pack @netforge/asset-library-files --silent", { cwd: NF }).toString().trim().split("\n").pop();
    execSync(`tar xzf ${JSON.stringify(tgz)}`, { cwd: NF });
    console.log("downloaded", tgz);
  }
  for (const c of SKELETONS) {
    const f = join(CACHE, c + ".glb"); if (existsSync(f)) continue;
    const r = await fetch(SK_SRC + c + ".glb"); if (!r.ok) throw new Error(`${c}: HTTP ${r.status}`);
    writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log("downloaded", c);
  }
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const resize = textureCompress({ resize: [256, 256] });
  const report = [], fails = [];
  for (const n of QUATERNIUS) {
    const doc = await io.read(join(NF, "package/library/lowpoly", n + ".glb")), root = doc.getRoot();
    for (const e of root.listExtensionsUsed()) if (/meshopt/i.test(e.extensionName)) e.dispose();
    const anims = root.listAnimations(), map = mapClips(n, anims.map(a => a.getName()));
    const miss = NEED.filter(x => !map[x]);
    if (miss.length) { fails.push(`${n}: 없음 ${miss.join(",")} | 원본: ${[...new Set(anims.map(a => base(a.getName())))].join(",")}`); continue; }
    const keep = new Map(Object.entries(map).map(([std, src]) => [src, std])), done = new Set();
    for (const a of anims) { const std = keep.get(base(a.getName())); if (std && !done.has(std)) { a.setName(std); done.add(std); } else dropAnim(a); }
    await doc.transform(resample(), resize, weld(), prune(), dedup());
    let bin, ratio = 1;
    /* 원본 doc 은 quantize 전 상태로 두고, 크면 복제본을 줄여 본다 */
    /* 면마다 법선이 갈라진(평면 음영) 메시는 꼭짓점이 안 합쳐져 줄지 않는다 → 법선을 지우고 합친 뒤 줄인다.
       법선이 없으면 three GLTFLoader 가 flatShading 으로 그려 같은 각진 모양이 된다 */
    const q = async r => { const d = cloneDocument(doc);
      if (r < 1) { for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setAttribute("NORMAL", null);
        await d.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: r, error: 0.01 }), prune()); } await d.transform(quantize()); return io.writeBinary(d); };
    bin = await q(1);
    for (const r of [0.6, 0.4, 0.25]) { if (bin.byteLength <= MAX_BYTES) break; ratio = r; bin = await q(r); }
    writeFileSync(join(OUT, n + ".glb"), bin);
    if (ratio < 1) map.__simplify = ratio;
    report.push([n, Object.entries(map).map(([s, o]) => s === "__simplify" ? `(메시 ${o}배로 줄임)` : s === o ? s : `${s}←${o}`).join(" ")]);
  }
  for (const c of SKELETONS) {
    const doc = await io.read(join(CACHE, c + ".glb"));
    for (const a of doc.getRoot().listAnimations()) dropAnim(a);
    await doc.transform(resize, weld(), prune(), dedup(), quantize());
    await io.write(join(OUT, c + ".glb"), doc);
    report.push([c, "(동작 없음, characters/anims.glb 공유)"]);
  }
  let total = 0;
  for (const [n, m] of report) { const kb = statSync(join(OUT, n + ".glb")).size / 1024; total += kb; console.log(n.padEnd(18), kb.toFixed(0).padStart(4) + "KB", m); }
  console.log("합계", (total / 1024).toFixed(2) + "MB,", readdirSync(OUT).length, "개");
  writeFileSync(join(ROOT, "assets/models/LICENSE-Quaternius.txt"),
    "Quaternius low poly models (Ultimate Monsters, animals, robots, etc.)\nCreated by Quaternius (https://quaternius.com)\nLicense: Creative Commons Zero, CC0 1.0 Universal — http://creativecommons.org/publicdomain/zero/1.0/\n" +
    "Source used: npm package @netforge/asset-library-files (library/lowpoly, optimized copies of the Poly Pizza uploads by Quaternius; its NOTICE records each as CC0).\n" +
    "Also: KayKit Character Pack: Skeletons 1.0 by Kay Lousberg, CC0 (https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0).\n" +
    "Modified for this game: animations renamed/reduced, textures resized to 256x256, meshopt removed, quantized.\n");
  if (fails.length) { console.error("동작 짝이 없는 모델(CLIP_OVERRIDES 에 채우기):\n" + fails.join("\n")); process.exit(1); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
