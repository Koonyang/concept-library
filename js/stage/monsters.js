/* 적 모델 표(2026-11-25 적 모델 다양화). 순수 데이터라 three 를 import 하지 않는다 — node(tools/content/check.mjs)에서도 읽는다.
   새 적 데이터에 guest.enemies[i].model = "<id>" 를 적으면 그 모델로 나온다. 없으면 지금처럼 사람 모델(looks.js lookOf).
   id → { file: assets/models/monsters/ 안 파일, kind: 분류, h: 기본 키(사람 TARGET_H 1.9 이하), rotY?: 앞 방향 보정(라디안),
          tint: "body"(몸 전체를 손님 팔레트 색으로) | 숫자(원래 색을 손님 색 쪽으로 이만큼 물들임),
          kaykit?: true(지금 캐릭터와 같은 뼈대 → characters/anims.glb 동작을 그대로),
          puppet?: { base }(파일 없이 바탕 모델에 꼭두각시 칠·막대·실, js/stage/puppet.js) }
   동작: 빌드(tools/assets/build-monsters.mjs)가 이름을 Idle·Run·Attack·Attack2·Hit·Death·Block·Dodge·Cheer 로 바꿔 둔다. 없는 건 무대가 코드 동작으로 대신.
   그림으로 고르기: docs/monsters/<kind>.png */
export const MONSTER_KINDS = ["slime", "monster", "undead", "robot", "ghost", "animal", "puppet"];

const T = 0.15;   /* 원래 색을 손님 색으로 물들이는 정도 */
const q = (kind, h, extra) => Object.assign({ kind, h, tint: T }, extra || {});
const slime = h => q("slime", h, { tint: "body" });
const SMALL = 1.3, BEAST = 1.45, DINO = 1.75, BIG = 1.85, MID = 1.6;

const TABLE = {
  /* 슬라임·블롭: 몸색을 손님 팔레트로 바꾼다 */
  slime_drop: slime(1.3), slime_green: slime(1.3), slime_horned: slime(1.45), slime_pink: slime(1.3), slime_spiky: slime(1.4),
  blob_alien: slime(1.5), blob_bird: slime(1.45), blob_ninja: slime(1.4), blob_orc: slime(1.45), blob_wizard: slime(1.55), blob_yeti: slime(1.5),
  /* 괴물 */
  alien_big: q("monster", BIG), demon: q("monster", MID), demon_blue: q("monster", MID), imp: q("monster", SMALL), goblin: q("monster", MID),
  orc_brute: q("monster", BIG), ninja_brute: q("monster", MID), yeti: q("monster", BIG), mushroom_imp: q("monster", 1.35), mushroom_king: q("monster", BIG),
  monarch: q("monster", MID), fluffy_flyer: q("monster", SMALL), pebble_flyer: q("monster", SMALL), jelly_flyer: q("monster", SMALL),
  bee: q("monster", SMALL), armored_bee: q("monster", SMALL), crab: q("monster", SMALL), frog: q("monster", SMALL),
  dragon: q("monster", BIG), dragon_whelp: q("monster", MID), wyvern: q("monster", BIG), skull_hopper: q("monster", 1.4),
  /* 해골·언데드 (KayKit 해골 4종은 사람과 같은 뼈대) */
  skeleton_minion: q("undead", 1.75, { file: "Skeleton_Minion.glb", kaykit: true }), skeleton_warrior: q("undead", 1.8, { file: "Skeleton_Warrior.glb", kaykit: true }),
  skeleton_mage: q("undead", 1.8, { file: "Skeleton_Mage.glb", kaykit: true }), skeleton_rogue: q("undead", 1.75, { file: "Skeleton_Rogue.glb", kaykit: true }),
  skeleton: q("undead", MID), skeleton_crew: q("undead", MID), skeleton_grunt: q("undead", MID), zombie: q("undead", MID), zombie_grunt: q("undead", MID),
  /* 유령 */
  ghost: q("ghost", 1.5), ghost_skull: q("ghost", 1.5),
  /* 로봇·기계 */
  mech: q("robot", BIG), mech_heavy: q("robot", BIG), robot_flyer: q("robot", 1.4), robot_large: q("robot", BIG), robot_walker: q("robot", MID), robot_gunner: q("robot", MID),
  /* 동물 (raptor·trex·triceratops 는 한 단계 크게, 큐 양 검수) */
  bat: q("animal", SMALL), cat: q("animal", BEAST), deer: q("animal", BEAST), fox: q("animal", BEAST), husky: q("animal", BEAST), pug: q("animal", BEAST),
  shiba: q("animal", BEAST), stag: q("animal", BEAST), wolf: q("animal", BEAST), raptor: q("animal", DINO), trex: q("animal", DINO), triceratops: q("animal", DINO), dino: q("animal", MID),
  /* 꼭두각시: 파일 없이 코드로 만든다(js/stage/puppet.js). base = 바탕 사람 모델(KayKit) 또는 해골 */
  puppet_knight: q("puppet", 1.75, { puppet: { base: "Knight" } }), puppet_barbarian: q("puppet", 1.75, { puppet: { base: "Barbarian" } }),
  puppet_mage: q("puppet", 1.75, { puppet: { base: "Mage" } }), puppet_rogue: q("puppet", 1.75, { puppet: { base: "Rogue" } }),
  puppet_hooded: q("puppet", 1.75, { puppet: { base: "Rogue_Hooded" } }), puppet_skeleton: q("puppet", 1.7, { puppet: { base: "skeleton_minion" } }),
};
for (const [id, m] of Object.entries(TABLE)) if (!m.file && !m.puppet) m.file = id + ".glb";
export const MONSTERS = TABLE;
export const isMonster = id => typeof id === "string" && Object.prototype.hasOwnProperty.call(MONSTERS, id);
