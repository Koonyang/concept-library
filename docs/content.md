# 개념의 서고 — 학습내용 인수인계

학습내용 담당이 맡았던 손님·문제·책장·장서복·어휘 데이터를 이어받을 사람을 위한 문서입니다. 전투 수치·엔진은 [docs/battle.md](battle.md), 화면·연출은 [docs/ui.md](ui.md), 저장소 규칙과 배포는 [docs/HANDOFF.md](HANDOFF.md)와 루트 `CLAUDE.md`를 보세요. 결정의 배경은 [docs/decisions.md](decisions.md)에 있습니다.

대상은 맥락 없이 새 강의를 손님으로 넣는 사람입니다. 아래에 적은 필드 이름은 모두 `index.html`과 `assets/data/`에 실제로 있는 이름입니다. 없는 필드를 만들지 말고, 강의 노트가 애매하면 큐 양에게 물으세요.

## 1. 데이터가 있는 곳

거의 모든 학습 데이터는 `index.html` 안의 상수입니다. 빌드 단계는 없습니다.

| 상수 / 파일 | 역할 |
|---|---|
| `FLOORS` | 층. 접대 로비에서 손님을 묶는 단위 |
| `WEAK_POINTS` | 손님(강의 하나). 표시 이름은 `concept`, 층은 `floorId` |
| `GUEST_BY` | `WEAK_POINTS`를 `id`로 찾는 표 |
| `KEY_QUESTIONS` | 핵심 문항(`-k0`, `-k1` …). `keyQsOf(g)`가 `g.keyQuestions`가 있으면 그걸, 없으면 이 표를 씀 |
| `COMBAT_PAGES` / `PAGE_BY` | 사서가 쓰는 전투 책장. 손님 책(`BOOK_POOLS`)에서 나옴 |
| `KEY_PAGES` / `KEY_BY` | 장서복(핵심 책장). 효과(`perk`)와 이름 |
| `OUTFITS` | 장서복 `id`별 옷 그림(색·장식 SVG) |
| `KEY_LOOK` | 장서복 `id`별 짧은 외형 설명 |
| `BOOK_POOLS` | 손님 책을 소각하면 나오는 책장·장서복과 가중치 `w` |
| `EGO_GIFTS` / `EGO_BY` | 에고 기프트. 손님마다 `guestId`로 묶임 |
| `GUEST_COMBAT` / `ARCH_COMBAT` | 적이 쓰는 책장 이름·주사위 뼈대 (`guestCombat()`) |
| `ENEMY_BODY` | 적 `key` → 몸 종류 |
| `LIB_UNLOCK_AT` | 장서복 개수로 사서 해금 |
| `assets/data/moon-words.js` | `window.MOON_WORDS`. 달의 계시 어휘 |
| `assets/data/moon-words.sample.js` | 예시 폴백(`window.MOON_WORDS_SAMPLE`). 실제 파일이 없을 때만 씀 |
| `assets/books/book-1.webp` … `book-8.webp` | 손님 책 표지 |

화면 그리기 함수 이름과 파일 배치는 [docs/ui.md](ui.md)를 보세요.

## 2. 층

`FLOORS` 순서 그대로 로비에 나옵니다. 손님은 `floorId`가 그 층의 `id`와 같으면 그 층에 붙습니다.

```js
const FLOORS = [
  { id:"crime", name:"범죄학의 층", subject:"범죄학의 기초", motto:"처벌은 복수가 아니라 예방이라는 오래된 문장들." },
  { id:"memory", name:"기억의 층 · 예시", subject:"학습법 (예시)", motto:"잊힐 때까지 기다리는 책장." },
  { id:"cognition", name:"인지의 층 · 예시", subject:"학습법 (예시)", motto:"알고 있는지, 아직 모르는지를 보는 창." },
  { id:"criminal-law", name:"형법의 층", subject:"형법", motto:"진실과 공익이 함께 설 때, 적시한 말은 벌하지 않는다." }
];
```

`memory`와 `cognition`은 학습법 **예시** 층입니다. 2026-11-14 이후의 새 강의는 예시 층에 넣지 말고, 예시 층 **뒤에** 새 층을 추가하세요. `criminal-law`(형법의 층)가 그 방식의 선례입니다. 층 필드는 `id`, `name`, `subject`, `motto`뿐입니다.

## 3. 손님 (`WEAK_POINTS`)

손님 오브젝트에는 `name`이나 `floor` 필드가 없습니다. 이름은 `concept`, 층은 `floorId`입니다.

| 필드 | 뜻 |
|---|---|
| `id` | 영문 케밥. 문제·적·풀의 접두어 |
| `floorId` | `FLOORS[].id` |
| `concept` | 화면에 보이는 이름 |
| `subject` | 과목 이름(층 `subject`와 맞추는 편) |
| `weakness` | 난이도 `1`·`2`·`3`. 적 체력·주사위 배율에 쓰임(숫자는 [docs/battle.md](battle.md)) |
| `archetype` | `GUEST_ARCHETYPES`: `knight` `scholar` `beast` `puppet` `fixer` `mage` |
| `palette` | `GUEST_PALETTES` 키: `amber` `steel` `violet` `rust` `verdant` `bone` `crimson` `teal` |
| `accessory` | `GUEST_ACCESSORIES`: `lantern` `chain` `hourglass` `quill` `mirror` `watch` `banner` `gear` `cage` `orb` |
| `book` | 표지 번호 `1`–`8`. 없거나 범위 밖이면 `id` 해시로 고름 (`bookCoverIndex`) |
| `sourceNote` | 출처 한 줄(선택). 예: `"형법 · 명예에 관한 죄 (11/18)"` |
| `explanation` | 손님 시트에 나오는 해설 |
| `questions` | 일반 문항 배열 |
| `enemies` | 적 무리 |
| `keyQuestions` | 있으면 `KEY_QUESTIONS[id]`보다 우선(지금은 쓰는 손님이 없음) |
| `combat` | 있으면 `guestCombat()`이 `GUEST_COMBAT` 위에 덮어씀(지금은 없음) |
| `enemyMax` / `manyEnemies` | 적 수 상한 예외. 아래 6절 |

예시 — `defamation-truth`(명예훼손과 제310조), 형법의 층:

```js
{
  id:"defamation-truth", floorId:"criminal-law", concept:"명예훼손과 제310조",
  subject:"형법", weakness:2, archetype:"puppet", palette:"verdant",
  accessory:"lantern", book:6,
  sourceNote:"형법 · 명예에 관한 죄 (11/18)",
  explanation:"…",
  questions:[ /* q0–q11 */ ],
  enemies:[ /* 변론인·소문꾼·고발자 */ ]
}
```

책 표지(`assets/books/book-N.webp`, `BOOK_COVER_N=8`):

1. 별자리·달
2. 눈 삼각형
3. 생명의 나무
4. 번개
5. 톱니·열쇠
6. 파도·삼지창
7. 불새
8. 미로·방패

9번은 워터마크를 깨끗이 지울 수 없어 빠진 상태입니다(`index.html` 주석). 새 표지를 만들지 말고 1–8 가운데 고르세요.

적 외형 `form`은 손님 필드가 아닙니다. `enemyForm(guest, e, S)`이 적 책장·주사위에서 자동으로 정합니다. 우선순위는 코드 주석과 같습니다: `e.form`이 있으면 그대로 → 우두머리이고 `weakness >= 3`이면 `"chaos"` → 책장 절반 이상에 `effect`/`text`가 있으면 `"knowledge"` → 공격 주사위 비율 ≥ 0.9이면 `"basic"`, 방어·회피 비율 ≥ 0.5이면 `"ritual"` → 그다음 `MB_ARCH_FORM`(fixer·knight·beast → `basic`, scholar·mage → `knowledge`, puppet → `ritual`). 값은 `"basic"` `"ritual"` `"knowledge"` `"chaos"`입니다.

## 4. 책장, 핵심 책장, 장서복

### 사서 책장 (`COMBAT_PAGES`)

사서가 덱에 넣는 카드입니다. **이미 있는 책장 내용은 고치지 마세요.** 새 손님용으로만 새 항목을 추가합니다.

```js
{id:"reasonable-belief", name:"상당한 이유", cost:2, emotion:0,
 dice:[{type:"방어",min:4,max:8}],
 text:"…", rarity:"R", floorId:"criminal-law", subject:"형법",
 sourceGuest:"defamation-truth", flavor:"…"}
```

주사위 `type`은 `참격` `관통` `타격` `방어` `회피`. 기본 책장은 `starter:true`이고 `floorId:null`입니다. `acqAudit()`는 기본이 아닌 책장·장서복이 적어도 한 손님의 `BOOK_POOLS`에 있는지, 풀의 `id`가 실존하는지를 검사합니다.

### 소각 풀 (`BOOK_POOLS`)

```js
"defamation-truth":[
  {k:"page",id:"reasonable-belief",w:10},
  {k:"page",id:"public-interest",w:10},
  {k:"page",id:"defendant-burden",w:6},
  {k:"key",id:"classical-robe",w:4},
  {k:"key",id:"truth-robe",w:4}
]
```

`k`는 `"page"`(책장) 또는 `"key"`(장서복), `w`는 가중치입니다.

### 장서복 (`KEY_PAGES` + `OUTFITS`)

장서복이 곧 핵심 책장입니다. **새 손님은 장서복을 정확히 하나 새로 만드세요.** 풀에 이미 있는 장서복을 함께 넣는 것은 가능합니다(명예훼손은 새 `truth-robe`와 기존 `classical-robe`를 같이 넣음). 예전 손님은 장서복을 공유하는 경우가 있습니다(`classical-robe`, `panopticon-coat` 등). 기본 착장 `novice`는 처음부터 열려 있고 풀에 넣지 않습니다.

`KEY_PAGES` 필드: `id`, `name`, `text`, `perk`, `coat`. 지금 `perk`는 `"none"` `"light"` `"emotion"` `"recover"` `"hp10"` `"stagger10"`. `coat` 숫자는 현재 0–6로 적혀 있지만, 옷 그림은 `OUTFITS[id]`와 설명 `KEY_LOOK[id]`로 그립니다.

```js
{id:"truth-robe", name:"진실과 공익의 법복",
 text:"진실을 비추는 등불을 든다. 접대 시작 빛 +1.",
 perk:"light", coat:6}

OUTFITS["truth-robe"] = {
  coat:["#3a2440","#1e1024","#0a050c"],  // 옷 그라데이션 3색
  cape:["#5a1e2e","#14060c"],            // 망토 2색
  trim:"#e8e2f0",
  decor:()=>`<!-- 몸 장식 SVG -->`,
  hat:()=>`<!-- 모자 SVG -->`
}
```

사서 해금은 `unlockedKeyIds.length`와 `LIB_UNLOCK_AT = [0, 5, 10]`입니다. 장서복 5개면 두 번째 사서(`lib2`), 10개면 세 번째(`lib3`). `libUnlockedCount()`가 계산합니다.

### 에고 기프트 (`EGO_GIFTS`)

지금 손님은 각자 기프트 3개를 갖습니다. 필드: `id`, `guestId`, `name`, `slot`, `art`, `text`, `perk`. `slot`은 `EGO_GIFT_RULES.slots` — `"머리"` `"눈"` `"얼굴"` `"목"` `"가슴"` `"손"` `"등"` `"발"`. 예: `{ id:"truth-public-scale", guestId:"defamation-truth", name:"진실과 공익의 저울", slot:"머리", art:"scale", text:"…", perk:{ hp:1 } }`. 드롭·세트 보너스 숫자는 [docs/battle.md](battle.md)를 보세요.

### 적 책장 (`GUEST_COMBAT`)

적이 합에 쓰는 책장 이름은 여기(또는 `g.combat`)에 둡니다. 뼈대와 주사위 기본값은 `ARCH_COMBAT[archetype]`, 배율은 `GUEST_SCALE[weakness]`입니다. 필요한 이름만 적고, 수치 조정은 전투 문서를 따릅니다.

```js
"defamation-truth":{
  names:["허위의 소문","가벼운 전력 들추기","진실이라 우기기"],
  bigName:"입증 책임 떠넘기기", atk:"타격", alt:"참격"
}
```

## 5. 문제

일반 문항은 손님의 `questions`, 핵심 문항은 `KEY_QUESTIONS[손님id]`(또는 `g.keyQuestions`)에 둡니다.

- 일반: `<guestId>-q<n>` (`n`은 0부터). 예: `defamation-truth-q6`
- 핵심: `<guestId>-k<n>` (`n`은 0부터). 예: `defamation-truth-k0`. `hard:true`를 붙입니다.

`mbQuestionPool()`은 일반과 핵심을 합쳐 한 판의 문제 풀을 만듭니다. 핵심은 손님의 큰 공격 책장과 묶여 있습니다.

| `type` | 필드 | 채점 |
|---|---|---|
| `"mc"` | `prompt`, `options`(4지선다), `correctIndex` | 보기 인덱스 |
| `"ox"` | `prompt`, `options:["O","X"]`, `correctIndex` | `0`이 O, `1`이 X |
| `"short"` | `prompt`, `answer`, `accept`(동의어 배열, 선택) | `checkShort()` — 공백·문장부호·대소문자 무시, `answer`와 `accept` 허용 |

**판례 O/X 표**에서는 O = 유죄 / 피고인에게 불리, X = 무죄(불성립·조각) / 피고인에게 유리로 씁니다.

```js
{ id:"defamation-truth-q3", type:"ox",
  prompt:"판례: 사실이 아닌데 다른 사람을 '동성애자'라고 적시하면 명예훼손이 성립한다.",
  options:["O","X"], correctIndex:0 }  // 성립 → O
{ id:"defamation-truth-q5", type:"ox",
  prompt:"판례: 어떤 사람을 '돌싱'(과거 혼인 전력이 있음)이라고 적시한 것만으로 명예훼손이 성립한다.",
  options:["O","X"], correctIndex:1 }  // 불성립 → X
```

구성요건·조문처럼 판례 결론이 아닌 O/X는 문장 자체가 맞으면 O, 틀리면 X입니다(예: `defamation-truth-q8` 군형법 유추적용 → O).

핵심 주관식 예:

```js
{id:"defamation-truth-k1", type:"short", hard:true,
 prompt:"형법 제310조가 상관 명예훼손(제64조 제3항)에 유추적용되는 법률의 이름은?",
 answer:"군형법",
 accept:["군 형법","군형법 제64조 제3항","군형법64조3항","군형법 제64조"]}
```

모든 일반·핵심 문항 `id`는 적 한 명의 `q`에만 들어가야 합니다. 빠지거나 겹치면 안 됩니다.

## 6. 적 무리

```js
enemies:[
  { key:"defamation-advocate", name:"제310조의 변론인",
    topic:"310조 입증·증명", leader:true,
    q:["defamation-truth-q6","defamation-truth-q7","defamation-truth-q8",
       "defamation-truth-k0","defamation-truth-k1"] },
  { key:"defamation-rumormonger", name:"허위의 소문꾼",
    topic:"허위 인식·사실 적시 판례",
    q:["defamation-truth-q0",/* …q1–q5… */,"defamation-truth-q10"] },
  { key:"defamation-accuser", name:"공익을 내건 고발자",
    topic:"상당한 이유·공익 범주",
    q:["defamation-truth-q9","defamation-truth-q11"] }
]
```

규칙:

- 우두머리(`leader:true`)를 배열 첫 칸에 둡니다. 한 명만 우두머리입니다.
- 손님당 적은 **최대 3명**. 지금 엔진 기본 상한은 `MB.ENEMY_MAX`(3)입니다. 넘기면 `mbEnemyCap()`이 우두머리는 남기고 앞에서부터 자르며, 잘린 적의 문제는 남은 적에게 넘깁니다.
- 3명을 넘기는 것은 기믹뿐이고, 큐 양이 그 손님에 기믹을 고른 뒤에만 만듭니다. 지금은 `guest.enemyMax`(1–5) 또는 `guest.manyEnemies===true`(상한 `MB.maxEnemies`=5)로만 예외가 열립니다. 계획된 `gimmick.extraUnits` / `unit.parentId`는 UI가 분신 칩으로 그릴 준비만 되어 있고, 엔진에는 아직 없습니다([docs/ui.md](ui.md), [docs/battle.md](battle.md)).
- 적 한 명 = 노트 소주제 하나(`topic`). 그 적이 맡은 문항이 `q`입니다.
- 적 체력은 그 적이 맡은 문제 수(`e.q.length`)에 비례합니다. 공식은 전투 엔진 몫이니 [docs/battle.md](battle.md)를 보세요.

몸(`body`)은 `human`(사람), `machine`(장치·계산), `puppet`(착각·환상·함정)입니다. `enemyBody()` 우선순위: `e.body` → `ENEMY_BODY[e.key]` → 손님 `archetype==="puppet"`이면 `puppet` → `MB_FLOOR_BODY`(crime·criminal-law → `human`, cognition → `machine`, memory → `puppet`) → 손님 `id` 해시. 새 적은 `ENEMY_BODY` 표에 `key`를 꼭 넣으세요. 표는 `index.html`의 `const ENEMY_BODY`입니다.

```js
const ENEMY_BODY={};
for(const [b,ks] of Object.entries({
  human:["beccaria-author", /* … */ "defamation-advocate","defamation-accuser"],
  machine:["tc-fine-collector", /* … */ "meta-mirror"],
  puppet:["beccaria-rack-ghost", /* … */ "defamation-rumormonger"]
})) for(const k of ks) ENEMY_BODY[k]=b;
```

명예훼손 예: 변론인·고발자는 `human`, 소문꾼은 `puppet`.

## 7. 달의 계시 어휘

실제 데이터는 `assets/data/moon-words.js`입니다. `index.html`이 이 파일을 읽고, 없거나 비면 `moon-words.sample.js`를 씁니다.

```js
// 형식: {id, en, ko(대표 뜻 하나), pos: n|v|adj|adv|phr}
window.MOON_WORDS = [
  {id:"w0001", en:"consensus", ko:"합의", pos:"n"},
  // …
];
```

지금은 3000개(`w0001`–`w3000`), 하루 분량은 배열 순서대로 `MOON_PER_DAY`(30)개입니다. `ko`에는 대표 뜻 하나만 적습니다.

`Moon.words()`는 `{id, en, ko, pos}`를 읽습니다(예전 `w`/`m` 형식도 읽힘). 예시 파일도 같은 `en`/`ko` 형식입니다.

## 8. 새 강의를 손님으로 넣는 순서

1. 강의 노트를 읽고, 애매한 부분은 큐 양에게 묻는다. 기존 손님의 책장·장서복·문제·적 데이터는 편집하지 않는다.
2. 새 과목이면 `FLOORS`에 층을 **예시 층 뒤에** 추가한다. 기존 층 `id`를 바꾸지 않는다.
3. `WEAK_POINTS`에 손님을 추가한다. `id`, `floorId`, `concept`, `subject`, `weakness`, `archetype`, `palette`, `accessory`, `book`(1–8), `explanation`, 필요하면 `sourceNote`.
4. 일반 문항(`-q0`부터)과 핵심 문항(`KEY_QUESTIONS`, `-k0`부터. 보통 mc 하나 + short 하나)을 쓴다. 판례 O/X 표는 5절 규칙을 따른다.
5. `enemies`를 만든다. 우두머리 먼저, 최대 3명, 소주제당 한 명, 모든 문항 `id`를 정확히 한 적의 `q`에 넣는다. `ENEMY_BODY`에 `key`와 몸을 등록한다.
6. `GUEST_COMBAT`에 적 책장 이름을 넣는다.
7. 새 `COMBAT_PAGES`를 추가하고(기존 책장은 수정하지 않음) `BOOK_POOLS[손님id]`에 넣는다.
8. 장서복을 **하나** 새로 만든다: `KEY_PAGES` + `OUTFITS` + `KEY_LOOK`, 그리고 그 손님 풀에 `{k:"key", id, w}`.
9. 기프트는 기존 손님을 따라 3개(`EGO_GIFTS`, `guestId` 연결, 부위는 `slot` 중복 없이).
10. 기믹(`manyEnemies` / `enemyMax` / 장래 `gimmick`)은 큐 양이 이 손님에 쓰자고 한 뒤에만, 그리고 새 콘텐츠에만 넣는다.
11. 테스트를 돌리고, 배포는 9절을 따른다.

## 9. 테스트와 배포

저장소 루트에서 테스트를 한 번에 돌립니다.

```bash
node tests/run.mjs
```

`LIB_ROOT`의 기본값은 저장소 루트입니다. 테스트 목록과 밸런스 시뮬(`tools/`)은 [docs/battle.md](battle.md)와 `tests/`를 보세요. 화면 겹침·가로세로는 [docs/ui.md](ui.md)입니다. 학습 데이터 쪽에서는 특히 `acqAudit()`(고아 책장·장서복 없음), 문제 `id`가 적 `q`에 빠짐없이 들어가는지, 주관식 `checkShort`가 `answer`/`accept`를 받는지 확인하면 됩니다.

배포 요지(자세한 절차는 [docs/HANDOFF.md](HANDOFF.md)):

1. `git fetch` 후 `origin/main` 위에 rebase한다. 다른 담당(특히 전투의 배포 표시)과 겹치지 않게 한다.
2. **게임 코드를 올리는 커밋만** `index.html`의 `<meta name="build" content="library-YYYYMMDDx">`를 올린다. 같은 날이면 main에 있는 마지막 글자의 다음 글자(z 다음은 za, zb, …). 날짜가 바뀌면 다시 `a`부터. 커밋 제목 끝에 `[library-…]`를 붙인다.
3. **문서만 고친 커밋은 배포 표시를 올리지 않는다.**
4. `main`에 푸시하면 GitHub Pages(https://koonyang.github.io/concept-library/)로 나간다.
5. 배포 후 `curl`로 페이지의 `build` 메타가 방금 올린 표시와 같은지 확인한다.

## 10. 규칙

- 이미 있는 책장(`COMBAT_PAGES`)과 그 내용, 이미 있는 손님의 풀·문제·적을 고치지 않는다.
- 기믹은 새 콘텐츠에만, 그리고 큐 양이 그 기믹을 고른 뒤에만 넣는다.
- 강의 노트가 불분명하거나 판례 결론이 여러 갈래면 추측하지 말고 큐 양에게 묻는다.
- 원작(Library of Ruina / Limbus Company) 에셋은 쓰지 않는다. 출처는 `CREDITS.md`, `LICENSES.md`.
