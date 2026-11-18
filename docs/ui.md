# 개념의 서고 — UI/UX · 3D 무대 인수인계 (2026-11-18 새 UI)

옛 UI 설명은 `legacy/ui-old.md`, 옛 화면 코드는 `legacy/`. 설계는 `docs/superpowers/specs/2026-11-18-3d-stage-design.md`,
작업 계획은 `docs/superpowers/plans/2026-11-18-3d-stage.md`.

## 1. 꼭 지킬 규칙 (큐 양이 정함)
- 휴대폰 가로가 기본(844×390). 세로(390×844)도 지원한다. 가로에 한 변경은 세로에도 똑같이 한다.
- Project Moon 에셋 금지. 전투 방식만 따르고 생김새는 우리 것이다. 새 에셋은 `CREDITS.md`·`LICENSES.md`에 적는다.
- 막는 팝업 금지. 연출은 탭 = 빨리 감기, 길게 누르기 = 건너뛰기. 결과 안내는 80% 이상 불투명한 검은 화면이나 카드로 보인다.
- 글꼴은 Pretendard·Space Grotesk만 쓴다. 세리프·궁서체 금지.
- 전투 UI끼리 겹침 0건이어야 배포한다(주사위, 체력·흐트러짐 막대, 대상 화살표, 손패, [개막], 상태판, 문제 패널). 무대·캐릭터는 배경층이라 UI 뒤로 가도 된다.

## 2. 층 구조
```
index.html            <canvas id="stage"> + <div id="ui">, importmap(three), 코어 <script>들, js/ui/app.js(module)
js/core/*             규칙·데이터·엔진·저장 (전역 Game). 화면 없음 — docs/battle.md
js/stage/*            3D 무대 (규칙 모름)
  stage.js            createStage(canvas) → Stage
  moods.js            분위기 MOODS {lamp 등불 서고, moon 달빛 열람실}
  props.js            공용 소품 PROP_KIT, buildProp(name, accent)
  looks.js            유닛 → 모델·색·장신구 (lookOf)
  characters.js       KayKit 모델 로드·복제·동작, 실패하면 자리표시 도형
  fx.js               불꽃·섬광·고리·조각·책 낙하, registerFx(pageId, fn)
js/ui/*               DOM 화면
  app.js              진입점: 무대 만들고 화면 오가기, 설정(BGM·효과음), BGM
  screens.js          층 고르기·손님 고르기·결과
  battle.js           전투 화면 mountBattle(root, stage, guestId, {onEnd})
  sfx.js              WebAudio 합성 효과음
  style.css           토큰(:root) + 화면별 스타일
vendor/three/         three.js 0.180.0 (MIT), GLTFLoader·SkeletonUtils
assets/models/characters/  KayKit Adventurers 5종 + anims.glb (tools/assets/build-characters.mjs 로 만듦)
```

## 3. 화면
`#ui[data-screen]`: `floors` → `guests` → `battle` → `result` → (다시 접대 | 다음 손님 | 층으로).
- 층을 고르면 `stage.setFloor(Game.data.floorStage(id))`. 층 겉모습은 `FLOORS[].stage {mood, accent, props}` 한 줄이다(`docs/content.md`). `accent`가 UI의 `--accent`도 된다.
- 설정(오른쪽 위)은 층·손님 화면에만 있다. 배경음은 기본 꺼짐이다(`save.bgmMuted`).

## 4. 무대 API (`js/stage/stage.js`)
| 호출 | 하는 일 |
|---|---|
| `await createStage(canvas)` | WebGL 실패면 `ok:false`인 빈 무대(모든 호출이 아무것도 안 함, `play`는 바로 끝남) |
| `setFloor({mood, accent, props})` | 팔각 단, 책장 9개(책 색 = 분위기 + accent), 소품은 가장자리 슬롯 6곳 |
| `await setUnits(units, guest)` | `Game.battle.state.units` 그대로. 사서는 왼쪽, 적은 오른쪽(우두머리 가운데·조금 크게), 발밑 편 색 고리 |
| `await play(ev, {fast, onHit, final})` | 교환 하나 연출(ev 모양은 `docs/battle.md` 4절). 합 1.0초(+단계당 0.2초, 최대 1.6초), fast 0.35초. 맞는 순간(40%)부터 단계마다 `onHit(i)`. 쓰러진 적은 조각으로 흩어지고 책(손님 표지)이 떨어진다 |
| `finishNow()` | 진행 중 연출을 바로 끝냄(길게 누르기) |
| `unitPoint(id)` | 유닛 머리 위 화면 좌표(CSS px). UI가 주사위·숫자를 붙인다 |
| `setStaggered(id, on)` | 머리 위 별 고리 |
| `registerFx(pageId, async ctx => …)` | 그 책장만의 전용 연출. 없으면 등급 연출: N 기본, R 불꽃 2배, SR 클로즈업+어둡게, SSR 크게 어둡게+클로즈업+감속+고리. 적 카드는 큰 일격(`big`)이 SR |

성능: 픽셀 비율 ≤ 1.5, 느린 기기는 1.0까지 자동으로 내림, 실시간 그림자 없음, 책은 InstancedMesh, 연출 빛은 1개를 돌려 씀. 참고 측정 `node tests/perf.mjs`.

## 5. 전투 화면 (`js/ui/battle.js`)
- 자리(가로): 막대는 위 왼쪽(사서)·위 오른쪽(적), 상태판·오답 해설은 위 가운데, 속도 주사위는 머리 위(막대·상태판 아래로, 다른 유닛 주사위와 안 겹치게 밀어냄), 손패는 아래 가운데, [개막]은 아래 오른쪽, 문제 패널은 아래.
- 세로: 막대 위 두 줄, 상태판·해설 그 아래, 무대 가운데, 손패·[개막]·문제는 아래.
- 조작: 문제를 풀고 → 내 주사위 → 카드 → 적 주사위(주사위 없는 적은 몸)를 누른다. 노릴 적이 하나면 카드만 눌러도 놓인다. 놓인 주사위를 다시 누르면 뺀다.
- [개막] → `Game.battle.stepBegin/stepNext/stepEnd`로 교환마다 `stage.play`. 진행 중에는 입력이 잠기고, 화면을 탭하면 빨리 감기, 450ms 넘게 누르면 남은 교환을 연출 없이 처리한다.
- DOM id·클래스(테스트와 겹침 검사가 씀): `.unit-bar[data-unit]`, `.die-row`, `.speed-die[data-unit][data-die][data-side]`, `.enemy-target`, `#target-arrows`, `#hand .card[data-card]`, `#btn-open`, `#status`, `#learn`, `#question .q-opt[data-i]` / `#q-short` `#q-submit`, `#skip-layer`.

## 6. 테스트
- `node tests/run.mjs`: core, libs, mbdata, sim, assets, stage, ui, app, overlap-check. 전부 통과해야 배포한다.
- `tests/battle.html?guest=<id>`: 전투만 띄우는 페이지. `tests/stage.html`: 무대만 띄우는 페이지.
- 겹침 검사 `node tests/overlap-check.mjs`: 844×390·390×844 × (사서 1:적 3, 3:3) × (문제, 배정, 손패 8장). 겹치면 `shots/overlap/`에 스크린샷.
- Chromium은 `--use-gl=swiftshader`로 3D를 그린다(느리다). 배포 전 844×390·390×844 스크린샷을 직접 본다.

## 7. 역할 (2026-11-18 큐 양 결정)
| 역할 | 파일 |
|---|---|
| 전투/시스템 | `js/core/battle.js·engine.js·save.js·api.js`, `tools/sim`, `docs/battle.md` |
| 학습내용 | `js/core/data.js`의 층·손님·문제·책장, `FLOORS[].stage` 값, `docs/content.md` |
| 3D 무대 | `js/stage/*`, `assets/models/`, `tools/assets/`, `vendor/three/` |
| UI/UX | `js/ui/*`, `index.html`, `tests/overlap-check.mjs`, 이 문서 |

서로 맞춰야 하는 곳: 교환 이벤트 `ev`(전투가 만들고 무대가 연출하고 UI가 넘김), 층 무대 이름(학습내용이 값을 정하고 무대가 이름 목록을 관리), `data.js`(전투·학습내용이 같이 씀).

## 8. 남은 일
- 도서관(책 소각·덱 편성·사서·장서복·기프트)과 달의 계시 화면은 아직 없다. 규칙은 `Game.books / deck / libs / moon`에 있다.
- 전용 연출을 줄 SR·SSR 책장은 큐 양이 아직 고르지 않았다(지금은 등급 연출만 나온다).
- 옛 1:1 전투 화면은 없다(엔진만 남음).
