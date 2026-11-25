# 적 모델 다양화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앞으로 만드는 적이 `guest.enemies[i].model` 한 줄로 괴물·동물·로봇·유령·슬라임·해골·꼭두각시 모델을 고를 수 있게 한다. 지금 있는 적의 모습은 그대로.

**Architecture:** 빌드 스크립트가 Quaternius(npm 사본)·KayKit 해골 GLB를 줄이고 **동작 이름을 게임 표준 이름으로 바꿔** `assets/models/monsters/`에 둔다. 무대(`js/stage/`)의 순수 데이터 표 `monsters.js`가 고를 수 있는 모델 목록이고, `characters.js`가 그 모델을 전투에 나올 때만 받아 같은 figure 인터페이스(`act/height/update/dispose`)로 감싼다. 코어는 `e.model`을 유닛에 실어 넘기기만 한다.

**Tech Stack:** 정적 사이트, three.js(vendor), gltf-transform(빌드), meshoptimizer(빌드 시 압축 풀기, node_modules에 이미 있음), Playwright 테스트(`tests/run.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-25-monster-models-design.md`

## Global Constraints
- 기존 손님·적의 모습은 한 픽셀도 바뀌지 않는다: `model`이 없으면 지금 `lookOf` 경로 그대로.
- 사용 모델: 검수 64종 중 `wolf_cartoon` 제외 63종(Quaternius 59 + KayKit 해골 4) + 코드 꼭두각시 6종.
- 크기 상한: 모델 기본 키 `h ≤ 1.9`(= 사람 TARGET_H), 폭(x·z 중 큰 값) `≤ 1.4`. 우두머리 1.1배·따르는 적 0.9배 스케일은 지금과 같음. raptor·trex·triceratops 는 다른 네 발 짐승보다 키 한 단계 크게.
- 파일: 모델 하나 ≤ 300KB, 텍스처 256px.
- 꼭두각시 막대·실 높이 ≤ 키 + 0.5.
- 막는 팝업 금지, 연출이 멈추면 안 됨(없는 동작은 대신 동작으로). 겹침 검사 0건.
- 새 에셋 출처는 `CREDITS.md`·`LICENSES.md`, 새 결정은 `docs/decisions.md`에 한 줄.
- 커밋 메시지 한국어, 사용자 입장. 배포 표시는 이 작업에선 올리지 않는다(배포는 따로 `/deploy`).

## Review Focus
1. 모르는 `model` id / 파일 로드 실패 → 콘솔 경고 후 지금 방식 사람 모델로 서야 한다(전투가 멈추면 안 됨). Task 3 테스트.
2. 짝 없는 동작(막기·피하기·환호) 요청 → `act()`가 promise를 제때(≤ 0.8초) 풀어야 한다(무대가 `await` 함). Task 2 테스트.
3. `setUnits`가 모델 받는 중에 다시 불림(층 이동·재시작) → 늦게 끝난 쪽이 덮어쓰지 않는다(기존 `unitsSeq` 규칙). Task 3 테스트.
4. KayKit 해골 머리에 입 메우기(`flattenMouth`)가 잘못 적용 → 사람 5종에만. Task 2 테스트.
5. 큰 모델(용·메카·트리케라톱스)이 세로 화면(390×844)에서 UI와 겹침 → Task 5 겹침 검사 `--monsters`.

---

### Task 1: 몬스터 에셋 빌드

**Files:**
- Create: `tools/assets/build-monsters.mjs`
- Modify: `package.json` (scripts `"assets:monsters": "node tools/assets/build-monsters.mjs"`)
- Create: `assets/models/monsters/*.glb` (빌드 결과, 커밋)
- Modify: `tests/assets.test.mjs`, `CREDITS.md`, `LICENSES.md`, `assets/models/LICENSE-Quaternius.txt`(새)

**Interfaces:**
- Produces: `assets/models/monsters/<id>.glb` — 애니메이션 이름이 표준 이름: 필수 `Idle, Run, Attack, Hit, Death`, 선택 `Attack2, Block, Dodge, Cheer`. 그 밖 클립은 지움.
  KayKit 해골은 `assets/models/monsters/Skeleton_{Minion,Warrior,Mage,Rogue}.glb`, 애니메이션 없음(기존 `characters/anims.glb` 공유, `build-characters.mjs`와 같은 처리).
- Produces: `export const CLIP_RULES` (build-monsters.mjs) — 표준 이름 → 원본 이름 정규식 순서 목록(테스트·문서가 참조).

- [ ] **Step 1: 실패하는 테스트** — `tests/assets.test.mjs`에 추가:
  - `assets/models/monsters/`에 Quaternius 59개 + 해골 4개 = 63개 glb (목록은 Task 2 `MONSTERS` 표가 아니라 여기선 파일 수와 이름 집합으로: wolf_cartoon 없음).
  - Quaternius 파일마다 애니메이션 이름 집합 ⊇ `["Idle","Run","Attack","Hit","Death"]`, 표준 이름 외 클립 없음.
  - 해골 4개는 애니메이션 0개.
  - 각 파일 ≤ 300KB, 텍스처 이미지 ≤ 256px(glb JSON의 images → 버퍼에서 PNG 헤더 폭).
  - `extensionsRequired`에 `EXT_meshopt_compression` 없음(브라우저에 decoder 없음).
- [ ] **Step 2:** `node tests/run.mjs assets` → FAIL(폴더 없음).
- [ ] **Step 3: `build-monsters.mjs` 작성**
  - 원본: `npm pack @netforge/asset-library-files` 를 `tools/assets/.cache/netforge/`에 풀기(있으면 건너뜀), `library/lowpoly/<name>.glb` 59개. 이름 목록(고정):
    `slime_drop slime_green slime_horned slime_pink slime_spiky blob_alien blob_bird blob_ninja blob_orc blob_wizard blob_yeti jelly_flyer alien_big demon demon_blue imp goblin orc_brute ninja_brute yeti ghost ghost_skull skull_hopper mushroom_imp mushroom_king monarch fluffy_flyer pebble_flyer bat bee armored_bee crab frog dragon dragon_whelp wyvern skeleton skeleton_crew skeleton_grunt zombie zombie_grunt mech mech_heavy robot_flyer robot_large robot_walker robot_gunner cat deer fox husky pug shiba stag wolf raptor trex triceratops dino`
  - KayKit 해골 4개: `https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons/Characters/gltf/<Name>.glb` 를 캐시에 받기.
  - 읽기: `NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({"meshopt.decoder": MeshoptDecoder})`, 읽은 뒤 meshopt 확장 dispose.
  - 클립 이름은 `Armature|Name`처럼 `|` 앞이 붙어 있다 → 마지막 `|` 뒤만 본다. 같은 이름이 두 벌(zombie처럼)이면 하나만.
  - `CLIP_RULES`(앞에 있는 정규식부터, 표준 이름마다 첫 일치 하나):
    `Idle: /^idle$|^idle_?(a|neutral)?$|^flying$|^fly$|idle/i`(단 /attack|gun|sword|shoot/ 제외) ·
    `Run: /^run$|run|walk|fly|hop|jump$/i` · `Attack: /attack|punch|bite|headbutt|weapon|slash|stab|kick|shoot/i` · `Attack2`: Attack 규칙의 두 번째 일치 ·
    `Hit: /hit|recieve|react|damage/i` · `Death: /death|die/i` · `Block: /block|duck|defend/i` · `Dodge: /dodge|roll|jump$/i` · `Cheer: /yes|wave|dance|victory|cheer/i`.
    필수 하나라도 없으면 그 모델 이름과 원본 클립 목록을 출력하고 **실패 종료**(손으로 예외 표 `CLIP_OVERRIDES[name] = {Idle:"원본이름",…}`를 채워 해결).
  - 남길 클립은 이름을 표준 이름으로 `setName`, 나머지 dropAnim(`build-characters.mjs`의 함수 재사용: export 해서 import하거나 같은 내용 복사).
  - 변환: `resample(), textureCompress({resize:[256,256]}), weld(), prune(), dedup(), quantize()` (meshopt 다시 켜지 않음).
  - 끝에 모델별 `id 크기KB 짝(표준←원본)` 표와 합계를 출력.
  - `assets/models/LICENSE-Quaternius.txt` 작성(CC0, Quaternius, 출처 npm 패키지·NOTICE 요지, "수정: 애니메이션 이름 바꿈·줄임, 텍스처 256").
- [ ] **Step 4:** `npm run assets:monsters` → 63개 생성, 실패 없음. `node tests/run.mjs assets` → PASS. 300KB 넘는 파일이 있으면 그 모델만 `textureCompress({resize:[128,128]})` 또는 `simplify` 없이 quantize 강도 조정으로 맞춘다.
- [ ] **Step 5:** `CREDITS.md`(Quaternius 항목, KayKit Skeletons 항목: URL·용도·빌드 스크립트), `LICENSES.md`(CC0 두 줄) 갱신.
- [ ] **Step 6: Commit** — `git add tools/assets/build-monsters.mjs package.json assets/models/monsters assets/models/LICENSE-Quaternius.txt tests/assets.test.mjs CREDITS.md LICENSES.md && git commit -m "적으로 쓸 괴물·동물·로봇·해골 모델 63종 들여옴(아직 게임에서 안 씀)"`

---

### Task 2: 몬스터 표와 figure

**Files:**
- Create: `js/stage/monsters.js` (순수 데이터, three import 없음 — node에서도 import)
- Modify: `js/stage/characters.js`
- Test: `tests/stage.test.mjs`

**Interfaces:**
- Consumes: Task 1 파일·표준 클립 이름.
- Produces (`monsters.js`):
  ```js
  export const MONSTER_KINDS = ["slime","monster","undead","robot","ghost","animal","puppet"];
  export const MONSTERS = { [id]: { file, kind, h, rotY?, tint: "body"|number, kaykit?: true, puppet?: {base, skin} } };
  export const isMonster = id => Object.prototype.hasOwnProperty.call(MONSTERS, id);
  ```
  id = 파일 이름(Quaternius 소문자 그대로, 해골은 `skeleton_minion|skeleton_warrior|skeleton_mage|skeleton_rogue`로 소문자 id, file 은 `Skeleton_Minion.glb` 등). 꼭두각시 6종은 Task 4에서 이 표에 추가.
  `h`: 작은 날것·벌레(bat bee armored_bee fluffy_flyer pebble_flyer jelly_flyer imp crab frog) 1.3, 네 발 짐승(cat deer fox husky pug shiba stag wolf) 1.4, raptor·trex·triceratops 1.65, 큰 것(yeti orc_brute mech mech_heavy dragon wyvern alien_big mushroom_king robot_large) 1.85, 나머지 1.6. 모두 ≤ 1.9.
  `tint`: slime_*·blob_* 는 `"body"`, 나머지 `0.15`.
- Produces (`characters.js`):
  ```js
  export function loadMonsters(ids: string[]): Promise<void>   // 처음 보는 id만 받음, 실패해도 reject 안 함
  export function monsterReady(id: string): boolean
  ```
  `makeFigure(look)`: `look.monster`가 있고 `monsterReady(look.monster)`면 몬스터 figure, 아니면 기존 경로.
  몬스터 figure는 기존과 같은 인터페이스. `F.height = 실제 맞춘 키`, `F.current` 는 **무대가 요청한 이름**(`"Cheer"`, `"Hit_A"` 등) 그대로.

- [ ] **Step 1: 실패하는 테스트** (`tests/stage.test.mjs`, 새 묶음 "몬스터 figure"):
  - `MONSTERS` 키 수 = 63(꼭두각시 전), 모든 `h ≤ 1.9`, `MONSTER_KINDS`에 든 kind만.
  - `await loadMonsters(["slime_pink","dragon","skeleton_warrior"])` 후 각 `makeFigure({monster:id, palette:PALETTES.crimson, scale:1})`:
    `F.placeholder === false`, 바운딩 박스 키 ≈ `MONSTERS[id].h`(±0.05), x·z 폭 ≤ 1.4, `F.height === 박스 키`.
  - `F.act("Block_Hit",{once:true})`, `F.act("Cheer",{once:true})`, `F.act("Dodge_Backward",{once:true})` 가 각각 800ms 안에 resolve, 이후 `F.current`가 요청한 이름.
  - `F.act("1H_Melee_Attack_Stab",{once:true})` 동안 믹서에 `Attack` 또는 `Attack2` 액션이 돌고 있다.
  - slime_pink 를 palette crimson·teal 로 두 번 만들면 몸 재질 색이 서로 다르다(색 바꾸기).
  - 해골 머리: `Skeleton_Warrior` 원본 머리 지오메트리 `userData.mouthless` 가 없다(입 메우기 미적용).
- [ ] **Step 2:** `node tests/run.mjs stage` → FAIL.
- [ ] **Step 3: `monsters.js` 작성** (위 표 값 그대로).
- [ ] **Step 4: `characters.js`에 몬스터 figure**
  - 경로 `new URL("../../assets/models/monsters/", import.meta.url)`. 캐시 `mons = new Map(id → {scene, clips})`, 진행 중 promise 공유.
  - KayKit 해골(`kaykit:true`): `loadCharacters()`를 먼저 기다린 뒤 모델만 받고 `clips`(기존 공유 클립)로 `realFigure`와 같은 방식. `flattenMouth`는 호출하지 않는다. `WEAPONS`에 해골 모델 이름별 무기 메시를 추가(모델 안 메시 이름을 보고 칼/지팡이/단검 하나씩), 크기는 `TARGET_H` 대신 `MONSTERS[id].h`.
  - Quaternius: `SkeletonUtils.clone`, 재질 `phongOf`, `Box3`로 키를 `h`에 맞추고 폭이 1.4를 넘으면 폭 기준으로 더 줄임, 바닥 y=0·가운데 정렬, `rotY` 적용.
  - 색: `tint==="body"`면 각 메시 재질을 복제해 `color = palette.accent`를 0.25만큼 흰색 쪽으로(`realFigure`의 cloth 색과 같은 식), 텍스처 있으면 곱. 숫자면 원래 색을 `palette.accent` 쪽으로 그 비율만큼 lerp. 복제한 재질은 `userData.ownMat = true`.
  - `act(name, o)` 짝: `Idle→Idle`, `Running_A→Run`, 공격 이름(`/Attack|Spellcast/`)→ 호출마다 `Attack`/`Attack2` 번갈아(없으면 `Attack`), `Hit_A|Hit_B→Hit`, `Block_Hit→Block||Hit`, `Dodge_Backward→Dodge||Hit`, `Death_A→Death`, `Cheer→Cheer||null`.
    짝이 `null`이면: `once`면 0.45초 동안 몸을 살짝 튀기는 흔들기(holder 자식 y·rotation.z, `update(dt)`에서) 후 resolve, 아니면 `Idle`. 재생·크로스페이드·finished 처리는 `realFigure.act`와 같은 방식.
  - `dispose()`는 `realFigure`와 같음. `hand()`는 몸 앞 빈 Object3D(높이 0.5×키)를 돌려준다(지금 무대는 안 쓰지만 인터페이스 유지).
  - `makeFigure`의 손님 장신구 자리: 몬스터면 `y = 0.55 × F.height/1.9`, `x = max(0.32, 폭/2 + 0.05)` (몸에 묻히지 않게). 테스트: dragon 의 장신구 x ≥ 폭/2.
- [ ] **Step 5:** `node tests/run.mjs stage` → PASS.
- [ ] **Step 6: Commit** — `"무대가 괴물·동물·로봇 모델을 세울 수 있게 함(동작 짝짓기, 슬라임 색 바꾸기)"`

---

### Task 3: 적 데이터 `model` → 무대

**Files:**
- Modify: `js/core/battle.js:214` (유닛에 `model`), `js/stage/looks.js` (`lookOf`), `js/stage/stage.js:283-300` (`setUnits`에서 미리 받기)
- Test: `tests/core.test.mjs`, `tests/stage.test.mjs`

**Interfaces:**
- Consumes: Task 2 `isMonster`, `loadMonsters`, `monsterReady`, `MONSTERS`.
- Produces: 적 유닛 필드 `model: string|null`(코어, 규칙엔 안 씀). `lookOf(enemyUnit, guest)` → `model` 이 `isMonster`면 `{monster:id, model:"Rogue", palette, accessory, scale, librarian:false}`(model 은 실패 시 대신할 사람 모델 = 지금 규칙으로 고른 것), 아니면 지금과 똑같은 객체.

- [ ] **Step 1: 실패하는 테스트**
  - core: `guest.enemies[0].model = "slime_pink"`로 만든 전투의 `e1.model === "slime_pink"`, model 없는 적은 `model === null`; 기존 손님 전투의 모든 적 유닛이 `model === null`.
  - stage: `lookOf({side:"enemy",model:"dragon",leader:true,body:"human"}, {archetype:"knight",palette:"steel"})`의 `monster==="dragon"`, `model==="Knight"`, `scale===1.1`; `model:"없는것"`이면 `monster`가 없고 콘솔 경고 1회; `model` 없는 입력은 이전 결과와 deepEqual(기존 경로 고정).
  - stage: `setUnits`에 dragon 적이 있으면 그 figure 가 `placeholder:false`이고 몬스터 figure(높이 ≠ 1.9 정도로 판별 or `F.monster === "dragon"` 필드 추가).
  - stage: 몬스터 파일 경로를 404로 막은 상태(`page.route`)에서 `setUnits` → 사람 모델로 서고, 전투 `play` 한 번이 끝까지 돈다.
  - stage: `setUnits(A)`(몬스터 포함) 직후 바로 `setUnits(B)` → 최종 figures 는 B의 유닛만.
- [ ] **Step 2:** `node tests/run.mjs core stage` → FAIL.
- [ ] **Step 3: 구현**
  - battle.js 유닛 push에 `model:(e&&typeof e.model==="string")?e.model:null`. `docs/battle.md` 유닛 필드 설명에 한 줄.
  - looks.js `lookOf`: 적 분기 끝에서 `unit.model`이 있으면 `isMonster` 검사 → 위 Produces 대로, 모르면 `console.warn("[stage] 모르는 적 모델:", id)`(id당 1회).
  - stage.js `setUnits`: `await loadCharacters()` 다음, 적 look 중 `monster` id들을 모아 `await loadMonsters(ids)`; 그 뒤 `my !== unitsSeq`면 return(기존 규칙). 받지 못한 id는 `makeFigure`가 자동으로 사람 모델 경로.
  - 몬스터 figure 에 `F.monster = id` 필드.
- [ ] **Step 4:** `node tests/run.mjs core stage` → PASS.
- [ ] **Step 5: Commit** — `"새 적 데이터에 model 을 적으면 그 괴물 모델로 나옴(기존 적은 그대로)"`

---

### Task 4: 꼭두각시 6종 (코드로 만듦)

**Files:**
- Create: `js/stage/puppet.js`
- Modify: `js/stage/monsters.js`(꼭두각시 6종 추가), `js/stage/characters.js`(puppet 분기)
- Test: `tests/stage.test.mjs`

**Interfaces:**
- Consumes: Task 2 figure 경로(KayKit 같은 뼈대 → 기존 `clips`).
- Produces: `MONSTERS` 에 `puppet_knight, puppet_barbarian, puppet_mage, puppet_rogue, puppet_hooded, puppet_skeleton` — `{kind:"puppet", h:1.75, puppet:{base:"Knight"|"Barbarian"|"Mage"|"Rogue"|"Rogue_Hooded"|"skeleton_minion"}}`.
  `puppet.js`: `export function dressPuppet(obj: Object3D, k: number, palette, THREE): { update(dt): void, dispose(): void }`.

- [ ] **Step 1: 실패하는 테스트** — puppet_knight figure:
  - 옷(`/Cape|Hat|Helmet|Hood/`) 외 메시 재질 색이 나무색 범위(R>G>B, 명도 0.45~0.8)로 바뀜, 옷은 palette.accent 기반.
  - 머리 위 막대 그룹이 있고 그 최고 y ≤ `F.height + 0.5`.
  - 실 `LineSegments`(또는 가는 원기둥) 3~5개, 두 프레임 사이 손 뼈를 움직이면(Attack 재생 후 `update(0.2)`) 실 끝점이 따라 바뀐다.
  - 어깨·팔꿈치·무릎 뼈에 구슬 메시가 붙어 있다(6개 이상).
  - `F.act("Hit_A",{once:true})` 정상 resolve(같은 뼈대라 원래 클립).
  - 꼭두각시 6종 포함 `MONSTERS` 수 = 69.
- [ ] **Step 2:** `node tests/run.mjs stage` → FAIL.
- [ ] **Step 3: 구현** — `characters.js`: puppet 항목이면 바탕 모델로 `realFigure`(해골이면 해골 경로) 만든 뒤 무기 메시 숨김, `dressPuppet` 호출, figure `update`에 그 `update` 연결, `dispose`에 연결. `puppet.js`: 나무색 `#c8a27a`(skin `"wood"`)를 기본으로, 얼굴은 같은 색 평면(머리 메시 재질 색 통일 = 가면처럼), 머리 뼈 위 십자 막대(가로 0.6·세로 0.4, 높이 키+0.35), 막대 끝 → 머리·두 손 뼈·(있으면) 두 무릎 월드 위치로 실, 매 `update`에 끝점 갱신. 구슬: 반지름 0.05/k, 색 어두운 나무.
- [ ] **Step 4:** `node tests/run.mjs stage` → PASS. `node tools/shot.mjs outfit:novice` 처럼 기존 장면이 그대로인지 한 장 확인.
- [ ] **Step 5: Commit** — `"조종 실 달린 꼭두각시 적 6종(코드로 만듦)"`

---

### Task 5: 화면 확인·겹침·카탈로그

**Files:**
- Modify: `tools/shot.mjs`(장면 `monsters`), `tests/overlap-check.mjs`(`--monsters`)
- Create: `tools/assets/catalog.mjs`, `docs/monsters/<kind>.png`

**Interfaces:**
- Consumes: Task 2~4 전부.
- Produces: `node tools/shot.mjs monsters` — `tests/battle.html?guest=beccaria` 를 띄우기 전에 `__studyGame.data` 의 그 손님 enemies 에 model 을 넣는다: 우두머리 `dragon`, 나머지 차례로 `slime_pink, puppet_mage, robot_large`(3:3이 되게). 844×390·390×844.
  `node tools/assets/catalog.mjs` — 분류별로 `MONSTERS` 전부를 등불 조명·사람 기사 반투명 비교로 격자 렌더(id 라벨) → `docs/monsters/<kind>.png`.

- [ ] **Step 1:** shot `monsters` 장면 추가 → `node tools/shot.mjs monsters` 실행, `shots/shot/monsters-*.png` 두 장을 Read 로 직접 본다: 모델이 서 있고, 방향이 사서 쪽, 크기가 사람 적과 비슷, 주사위·막대가 머리 위에 제자리.
- [ ] **Step 2:** 방향이 반대·옆인 모델이 있으면 `MONSTERS[id].rotY`로 고친다. 카탈로그를 돌려(Step 3) 전 모델을 같은 각도로 보고 함께 고친다.
- [ ] **Step 3:** `catalog.mjs` 작성(검수 때 쓴 렌더 방식: 한 렌더러에 scissor 격자, 반투명 Knight 비교, `PALETTES.crimson`) → `docs/monsters/*.png` 생성, Read 로 확인.
- [ ] **Step 4:** `overlap-check.mjs`에 `--monsters`(shot 과 같은 주입) → `node tests/overlap-check.mjs --monsters` 0건. 기본 실행도 0건.
- [ ] **Step 5: Commit** — `"괴물 적 화면 확인 장면·모델 카탈로그 그림 추가"`

---

### Task 6: 콘텐츠 검사·스킬·문서

**Files:**
- Modify: `tools/content/check.mjs`, `.claude/skills/add-lecture/SKILL.md`, `docs/content.md`, `docs/ui.md`, `docs/decisions.md`, `docs/HANDOFF.md`(남은 일/현재 상태 한 줄)
- Test: `tests/mbdata.test.mjs` 또는 check 스크립트 자체 실행

**Interfaces:**
- Consumes: `MONSTERS`, `MONSTER_KINDS` (node 에서 `import("../../js/stage/monsters.js")`).

- [ ] **Step 1: 실패하는 검사** — 임시로 손님 하나의 적에 `model:"없는것"`을 넣은 상태에서 `npm run check:content <그 손님>`이 그 id를 오류로 보고하게(지금은 통과해 버림 → 실패 확인), 확인 뒤 임시 변경은 되돌림.
- [ ] **Step 2:** `check.mjs`: `e.model` 이 있으면 `isMonster` 아닐 때 오류, 한 손님 무리 안에서 같은 model 이 두 번 넘게면 경고.
- [ ] **Step 3:** `npm run check:content` 전체 통과(기존 데이터엔 model 없음).
- [ ] **Step 4: 문서**
  - add-lecture SKILL.md 템플릿 적 항목에 `model:"..."`(선택) 한 줄, "적 모델 고르기" 소절: `docs/monsters/*.png` 보고 고르기, 기준(개념·이름 뜻과 어울리게 / 우두머리는 크고 눈에 띄는 것 / 한 무리에서 겹치지 않게 / 실존 인물은 사람 그대로 = model 생략), 분류별 id 목록.
  - content.md: `enemies[].model` 필드 설명.
  - ui.md 무대 캐릭터 절: 몬스터 figure·동작 짝·꼭두각시·로딩.
  - decisions.md: `2026-11-25 적 모델 다양화: 기존 적은 그대로, 새로 만드는 적이 model 로 괴물·동물·로봇·유령·슬라임·해골·꼭두각시를 고른다. 우두머리도 가능.`
- [ ] **Step 5:** `node tests/run.mjs --changed` 전부 PASS.
- [ ] **Step 6: Commit + push** — `"새 강의 적에 괴물 모델 고르는 법(검사·스킬·문서)"` → `git push -u origin claude/game-ui-ux-redesign-4l6p7o`. 검수함 db 에 `updates/<id>` = `{…, build:"작업 브랜치", live:false}` 기록(deploy 스킬 형식).
