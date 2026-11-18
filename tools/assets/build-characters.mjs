/* KayKit Character Pack: Adventurers 1.0 (CC0, Kay Lousberg) → 게임용으로 줄인 캐릭터 파일
   실행: npm run assets:characters
   - 원본 5개를 tools/assets/.cache/ 에 받는다(있으면 건너뜀, git 무시)
   - anims.glb: Knight 에서 ANIMS 클립만 남기고 메시를 지운 파일(모든 캐릭터가 같은 뼈대 Rig_Medium 이라 그대로 붙는다)
   - <Name>.glb: 애니메이션 전부 제거, 텍스처 256×256, prune·dedup
   결과: assets/models/characters/ */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, textureCompress, quantize, resample, weld } from "@gltf-transform/functions";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = join(ROOT, "tools/assets/.cache"), OUT = join(ROOT, "assets/models/characters");
const SRC = "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/";
export const CHARS = ["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"];
export const ANIMS = ["Idle","Running_A","1H_Melee_Attack_Slice_Diagonal","1H_Melee_Attack_Stab","2H_Melee_Attack_Chop","Spellcast_Shoot","Block","Block_Hit","Dodge_Backward","Hit_A","Hit_B","Death_A","Cheer"];
mkdirSync(CACHE, { recursive: true }); mkdirSync(OUT, { recursive: true });

for (const c of CHARS) {
  const f = join(CACHE, c + ".glb");
  if (existsSync(f)) continue;
  const r = await fetch(SRC + c + ".glb");
  if (!r.ok) throw new Error(`${c}: HTTP ${r.status}`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  console.log("downloaded", c);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
/* 애니메이션을 지울 때 채널·샘플러·키프레임 accessor 까지 함께 지운다(안 그러면 prune 뒤에도 남음) */
function dropAnim(a){ for (const s of a.listSamplers()) s.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose(); }
const resize = textureCompress({ resize: [256, 256] });   /* sharp 없이: 크기만 줄이고 형식은 그대로(PNG) */

/* 애니메이션 파일 */
{
  const doc = await io.read(join(CACHE, "Knight.glb"));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!ANIMS.includes(a.getName())) dropAnim(a);
  for (const n of root.listNodes()) if (n.getMesh()) n.setMesh(null);
  for (const s of root.listSkins()) for (const n of root.listNodes()) if (n.getSkin() === s) n.setSkin(null);
  await doc.transform(resample(), prune(), dedup(), quantize());
  const got = root.listAnimations().map(a => a.getName());
  if (got.length !== ANIMS.length) throw new Error("anims missing: " + ANIMS.filter(x => !got.includes(x)));
  await io.write(join(OUT, "anims.glb"), doc);
}
/* 캐릭터 파일 */
for (const c of CHARS) {
  const doc = await io.read(join(CACHE, c + ".glb"));
  for (const a of doc.getRoot().listAnimations()) dropAnim(a);
  await doc.transform(resize, weld(), prune(), dedup(), quantize());
  await io.write(join(OUT, c + ".glb"), doc);
}
writeFileSync(join(ROOT, "assets/models/LICENSE-KayKit.txt"),
  "KayKit : Adventurers Character Pack (1.0)\nCreated/distributed by Kay Lousberg (www.kaylousberg.com)\nLicense: Creative Commons Zero, CC0 1.0 Universal — http://creativecommons.org/publicdomain/zero/1.0/\nSource: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0\nModified for this game: animations stripped/split into anims.glb, textures resized to 256x256.\n");
console.log("done", OUT);
