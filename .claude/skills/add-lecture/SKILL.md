---
name: add-lecture
description: 큐 양이 준 인강·강의 노트(텍스트, 사진, PDF)를 읽고 약한 개념을 손님으로 만들어 게임 데이터에 넣는다 — 층, 손님, 문제(일반·핵심), 적 무리, 적 책장, 사서 책장, 소각 풀, 장서복, 에고 기프트까지. "새 강의 넣어줘", "이 내용으로 손님 만들어", "강의 추가", "책장/적 만들어" 같은 요청에 쓴다.
---

# 새 강의 → 손님 넣기

이 문서만 따르면 된다. `docs/content.md`는 처음부터 읽지 말고, 아래에 없는 것이 필요할 때 그 절만 연다(`grep -n` 후 해당 줄만).
예시 손님은 `defamation-truth`(형법의 층). 막히면 그 손님 데이터를 그대로 본뜬다.

## 0. 먼저 큐 양에게 확인 (한 번에 모아서)
노트를 읽은 뒤, 아래 중 **노트로 정할 수 없는 것만** 한 메시지로 묻는다. 정할 수 있으면 묻지 않는다.
- 어느 층(기존 층 / 새 과목이면 새 층 이름)
- 노트가 애매하거나 판례 결론이 갈리는 곳(추측해서 문제로 만들지 않는다)
- 기믹(적 4명 이상 등)은 큐 양이 먼저 말했을 때만. 기본은 적 최대 3명.

## 1. 노트 → 설계 (코드 쓰기 전에 머릿속으로)
- 손님 1명 = 강의 하나(또는 약한 개념 하나). `weakness`: 쉬움 1 / 보통 2 / 어려움 3.
- 소주제 2–3개를 뽑는다 → 적 1명씩. 가장 중요한 소주제가 **우두머리**(첫 칸, `leader:true`).
- 문제: 일반 8–12개(`-q0`부터) + 핵심 2개(`-k0` mc, `-k1` short, `hard:true`). 적 체력이 맡은 문제 수에 비례하니 적끼리 2–7개로 나눈다.
- 이름 짓기: 손님 `concept`는 개념 이름 그대로. 적·책장·장서복·기프트 이름은 개념을 의인화한 짧은 한국어("허위의 소문꾼", "상당한 이유").

## 2. 고칠 곳 (이 순서, 기존 손님 데이터는 절대 수정하지 않는다)
| # | 파일 | 상수 | 넣는 것 |
|---|---|---|---|
| 1 | `js/core/data.js` | `FLOORS` | 새 과목일 때만. 예시 층(memory·cognition) **뒤에** |
| 2 | `js/core/data.js` | `WEAK_POINTS` | 손님 + `questions` + `enemies` |
| 3 | `js/core/engine.js` | `KEY_QUESTIONS` | `"<id>":[k0, k1]` |
| 4 | `js/core/engine.js` | `GUEST_COMBAT` | 적 책장 이름 |
| 5 | `js/core/battle.js` | `ENEMY_BODY` | 적 `key`를 human / machine / puppet 목록에 추가 |
| 6 | `js/core/data.js` | `EGO_GIFTS` | 기프트 3개(부위 겹치지 않게) |
| 7 | `js/core/data.js` | `COMBAT_PAGES` | 새 사서 책장 2–3장 |
| 8 | `js/core/data.js` | `KEY_PAGES` | 새 장서복 **정확히 1벌**(`look` 포함) |
| 9 | `js/core/data.js` | `BOOK_POOLS` | 위 책장들 + 장서복 |

각 상수의 마지막 항목 뒤에 붙인다. 위치는 `grep -n "^const 상수" 파일`로 찾고, 그 근처만 읽는다.

## 3. 템플릿 (복사해서 채운다)
```js
// 1) FLOORS (새 층일 때만). mood: lamp(등불 서고) | moon(달빛 열람실). props는 PROP_KIT에서 2개
{ id:"<floor>", name:"<과목>의 층", subject:"<과목>", motto:"<한 문장>", stage:{ mood:"lamp", accent:"#c4705a", props:["scales","scroll"] } },

// 2) WEAK_POINTS
{
  id:"<guest>", floorId:"<floor>", concept:"<개념 이름>", subject:"<과목>", weakness:2,
  archetype:"scholar",   // knight scholar beast puppet fixer mage
  palette:"teal",        // amber steel violet rust verdant bone crimson teal (같은 층 손님과 다르게)
  accessory:"quill",     // lantern chain hourglass quill mirror watch banner gear cage orb
  book:3,                // 표지 1별자리 2눈삼각 3생명나무 4번개 5톱니열쇠 6파도 7불새 8미로방패
  sourceNote:"<과목> · <단원> (MM/DD)",
  explanation:"<손님 시트 해설 2–4문장>",
  questions:[
    { id:"<guest>-q0", type:"mc", prompt:"…", options:["…","…","…","…"], correctIndex:0 },
    { id:"<guest>-q1", type:"ox", prompt:"…", options:["O","X"], correctIndex:1 },
    { id:"<guest>-q2", type:"short", prompt:"…", answer:"…", accept:["…"] }
  ],
  enemies:[
    { key:"<guest>-<who>", name:"…", topic:"<소주제>", leader:true, q:["<guest>-q0","<guest>-k0","<guest>-k1"] },
    { key:"<guest>-<who2>", name:"…", topic:"<소주제>", model:"slime_pink", q:["<guest>-q1","<guest>-q2"] }   // model 은 선택: 아래 "적 모델 고르기"
  ]
},

// 3) KEY_QUESTIONS
"<guest>":[
  {id:"<guest>-k0",type:"mc",hard:true,prompt:"…",options:["…","…","…","…"],correctIndex:2},
  {id:"<guest>-k1",type:"short",hard:true,prompt:"…",answer:"…",accept:["띄어쓰기 다른 표기","약칭"]}
],

// 4) GUEST_COMBAT — names 3개(약→강), bigName은 핵심 문제와 묶인 큰 공격. atk/alt: 참격 관통 타격
"<guest>":{names:["…","…","…"],bigName:"…",atk:"타격",alt:"참격"},

// 6) EGO_GIFTS — slot: 머리 눈 얼굴 목 가슴 손 등 발. perk는 단위 1개: {hp:1} | {staggerPct:1} | {dmgPct:1} (1단위 = EGO_GIFT_RULES.unit)
{ id:"<gift>", guestId:"<guest>", name:"…", slot:"머리", art:"scale", text:"<개념과 이어지는 한 줄>", perk:{ hp:1 } },

// 7) COMBAT_PAGES — rarity N/R/SR/SSR, 주사위 type 참격 관통 타격 방어 회피. 비용·주사위는 같은 층 책장 수준으로
{id:"<page>",name:"…",cost:1,emotion:0,dice:[{type:"방어",min:4,max:8}],text:"…",rarity:"R",floorId:"<floor>",subject:"<과목>",sourceGuest:"<guest>",flavor:"…"},

// 8) KEY_PAGES — perk: light(시작 빛+1) emotion(감정1로 시작) recover(매 턴 빛+1) hp10 stagger10. coat는 마지막 번호+1
//    look: model Knight|Barbarian|Mage|Rogue|Rogue_Hooded, props[].name은 PROP_KIT, bone head|back|hand.l|hand.r (자세히: docs/ui.md 9절)
{id:"<key>",name:"…의 장서복",text:"<한 줄>. 접대 시작 빛 +1.",perk:"light",coat:7,look:{cloth:"#3a5a8a",body:"#5a8c88",props:[{name:"quill",bone:"head",scale:0.4}]}},

// 9) BOOK_POOLS — 책장 w 6–10, 장서복 w 4
"<guest>":[ {k:"page",id:"<page>",w:10}, {k:"page",id:"<page2>",w:6}, {k:"key",id:"<key>",w:4} ],
```

### 적 모델 고르기 (`enemies[].model`, 선택 · 2026-11-25)
적은 사람이 아니어도 된다. `model` 을 적으면 그 모델로, 안 적으면 지금처럼 사람(archetype·몸으로 고름). **기존 손님 적에는 넣지 않는다**(큐 양: 앞으로 만드는 적만).
- 그림 보고 고르기: `docs/monsters/<분류>.png` (slime·monster·undead·robot·ghost·animal·puppet). id 목록은 `js/stage/monsters.js` `MONSTERS`.
- 기준: 이름·소주제 뜻과 어울리게(예: "벼락치기의 밤"→zombie, "끼어드는 알림"→bee, "원형 감옥의 간수"→외눈 robot_large) /
  우두머리는 크고 눈에 띄는 것 / 한 무리 안에서 겹치지 않게(같은 model 3명 이상이면 검사 경고) / 실존 인물·사람이어야 말이 되는 적은 `model` 생략.
- 슬라임(slime_*, blob_*)은 몸이 손님 `palette` 색으로 바뀐다 → 같은 모델도 손님마다 다르게 보인다.
- 꼭두각시(puppet_knight·barbarian·mage·rogue·hooded·skeleton): 착각·환상·조종당하는 개념에 어울린다.
- `npm run check:content <손님id>` 가 없는 model id 를 잡는다.

## 4. 문제 쓰는 규칙
- **판례 O/X**: O = 유죄·성립(피고인에게 불리), X = 무죄·불성립·조각(유리). 프롬프트를 `판례: `로 시작.
- 판례가 아닌 O/X는 문장이 맞으면 O. O와 X를 섞는다(한쪽으로 몰리면 검사가 경고).
- mc 보기 4개, 오답 보기는 노트에 나오는 헷갈리는 개념으로. 정답 위치(`correctIndex`)를 섞는다.
- short `accept`에는 띄어쓰기·조문 번호 붙인 표기·약칭을 넣는다(공백·문장부호·대소문자는 자동 무시).
- 노트에 없는 사실로 문제를 만들지 않는다.

## 5. 검사 (이 순서, 앞 단계가 통과해야 다음)
1. `npm run check:content <guest>` — 몇 초. ✗ 줄을 전부 고칠 때까지 반복. △는 의도한 것인지 확인.
2. `npm run check:content` — 전체(고아 책장·장서복, id 중복).
3. `GUESTS=<guest> N=100 npm run sim` — 승률이 같은 `weakness` 손님들과 비슷한지. 크게 어긋나면 문제 수 배분이나 책장 수치를 조정하고 보고.
4. `node tests/run.mjs core mbdata library` — 브라우저 테스트(몇 분). 실패하면 로그 `shots/test-logs/`.
- 데이터만 바꿨으면 겹침 검사·스크린샷은 생략해도 된다(화면 코드를 건드렸을 때만).

## 6. 마무리
- `docs/decisions.md`에 새로 정한 것이 있으면 한 줄(날짜 KST). 층·손님 목록이 문서에 있으면(`docs/HANDOFF.md`) 한 줄 추가.
- 배포는 루트 `CLAUDE.md` "배포" 절(빌드 표시 올리기, 한국어 커밋, `[library-…]`).
- 큐 양에게 보고: 손님 이름·층, 적(이름·소주제·문제 수), 문제 수(일반/핵심), 새 책장·장서복·기프트 이름, 검사 결과, 노트에서 애매해서 뺀 내용.
