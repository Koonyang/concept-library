# 합 연출: 양쪽 책장 판 + 찰나의 슬로우 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 합 중에 양쪽 책장 판이 각 캐릭터 옆을 따라다니고, 단계마다 숫자가 튀어 오르며 0.15초 슬로우와 타격·피격 번쩍임이 나온다.

**Architecture:** 무대(`js/stage/stage.js`)는 단계마다 `onStep(i)`을 부르고 히트스톱을 슬로우로 바꾼다. UI(`js/ui/battle.js`)는 `#clash-panel` 안에 판 2장을 그리고 매 프레임 `stage.unitPoint`로 자리를 잡으며, `onStep`에서 숫자 공개·튀어 오름·번쩍임 클래스를 단다. 규칙(`js/core`)은 건드리지 않는다.

**Tech Stack:** 빌드 없는 ES 모듈, three.js 0.180, Playwright(`playwright-core`) 테스트 `node tests/run.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-19-clash-side-panels-design.md`

## Global Constraints
- 합 길이: 1.0초, 단계당 +0.2초, 최대 1.6초, 빨리 감기 0.35초(`CLASH_MS/STEP_MS/MAX_MS/FAST_MS`) 그대로.
- 슬로우: 맞는 순간 `time.scale = 0.25`를 실제 150ms, 그 뒤 SSR이면 0.4배 300ms, 아니면 1. 빨리 감기면 슬로우 없음.
- 숫자 튀어 오름: 1 → 1.8배 → 1.3배, 약 0.22초. `prefers-reduced-motion`이면 튀어 오름·흔들림 없이 숫자만.
- 글꼴은 Pretendard·Space Grotesk(기존 `--sans`, `--num`)만. 색은 기존 토큰(`--ally`, `--enemy`, `--accent`, `--bad`, `--hp`).
- 전투 UI 겹침 0건(가로 844×390, 세로 390×844). 가로에 한 변경은 세로에도.
- 막는 팝업 금지. 탭=빨리 감기, 길게 누르기=건너뛰기 유지.
- 문서만 바꾸는 커밋은 빌드 표시를 올리지 않는다. 이 작업은 `main`에 배포하지 않는다(작업 브랜치에만 푸시).

## Review Focus
- 3:3에서 합 판이 합에 끼지 않은 다른 유닛 근처에 있을 때 — 다른 유닛의 체력 막대(`.unit-bar`)와 겹치지 않아야 한다(Task 2 겹침 검사 3:3 resolve).
- 일방 공격(받는 쪽 대응 주사위 없음) — 상대 판은 "대응 없음"으로 작게 나와야 하고 오류 없이 진행(Task 2 테스트).
- 주사위 3개짜리 책장 — 판 높이가 커져도 화면 밖으로 나가지 않아야 한다(Task 2 겹침 검사의 "화면 밖" 판정).
- 연출 중 길게 누르기 — 판이 남지 않고 닫혀야 한다(Task 2 테스트).
- 무대가 없는 경우(`ok:false`, `unitPoint`가 null) — 판이 `pointOf` 대체 좌표로 화면 안에 나와야 한다(Task 2는 `pointOf` 재사용으로 처리, 별도 테스트 없음).

---

### Task 1: 무대 — 단계마다 `onStep`, 히트스톱 → 슬로우

**Files:**
- Modify: `js/stage/stage.js` (`playDefault` 맞는 순간 루프 ~355–366, 전용 연출 경로 ~405–414, `debug` ~84)
- Test: `tests/stage.test.mjs` (~80–94 근처에 추가)

**Interfaces:**
- Produces: `stage.play(ev, { fast, final, onHit, onStep })` — `onStep(i)`은 단계 i가 맞는 순간마다(피해 유무와 관계없이) 한 번, `onHit`보다 먼저. 전용 연출 경로에서도 단계마다 부른다.
- Produces: `stage.debug.slow = { n, minScale }` — 슬로우를 건 횟수와 그때 쓴 배율(테스트용).

- [ ] **Step 1: 실패하는 테스트** — `tests/stage.test.mjs`에 추가:
  - `"일반 교환: 단계마다 onStep"`: 단계 2개 이상인 교환으로 `S.play(ev,{onStep:i=>seen.push(i)})` → `seen`이 `[0,1,…,steps.length-1]`과 같음.
  - `"맞는 순간 슬로우 0.25"`: 위 재생 뒤 `S.debug.slow.n === ev.steps.length` 이고 `S.debug.slow.minScale === 0.25`.
  - `"빨리 감기면 슬로우 없음"`: `S.debug.slow` 초기화 후 `{fast:true}` 재생 → `S.debug.slow.n === 0`.
  - 기존 `"일반 교환: 1.6초 안"` 검사는 그대로 통과해야 함.
- [ ] **Step 2: 실패 확인** — `node tests/run.mjs stage` → 새 3개 FAIL.
- [ ] **Step 3: 구현** — 히트스톱 줄을 슬로우로 바꾼다: `fast`가 아니면 `time.scale = 0.25; debug.slow.n++; debug.slow.minScale = 0.25;` 150ms 뒤 `rank >= 3 ? 0.4 : 1`, 그 300ms 뒤 1. `fast`면 `time.scale`을 건드리지 않는다. 루프 안에서 `o.onStep?.(i)`를 `onHit`보다 먼저 try/catch로 부른다. 전용 연출 경로의 `forEach`에서도 각 단계에 `onStep`을 부른다. `debug.slow`는 `{ n: 0, minScale: 1 }`로 시작.
- [ ] **Step 4: 통과 확인** — `node tests/run.mjs stage` → 모두 PASS.
- [ ] **Step 5: 커밋** — `git commit -m "무대: 합 단계마다 알림(onStep), 맞는 순간 짧은 슬로우 모션"`

### Task 2: UI — 양쪽 책장 판, 따라다니기, 숫자 튀어 오름·번쩍임

**Files:**
- Modify: `js/ui/battle.js` (`showClash`/`revealClash`/`hideClash` ~172–199, 프레임 루프 ~293, `runOpen` ~255–289)
- Modify: `js/ui/style.css` (`#clash-panel`·`.cp-*` ~355–377 교체)
- Test: `tests/ui.test.mjs` (~70–79 합 표시 부분), `tests/overlap-check.mjs` (`measure`)

**Interfaces:**
- Consumes: Task 1의 `onStep(i)`.
- Produces(DOM, 테스트·겹침 검사용): `#clash-panel.on` 안에 `.cp-side.l` · `.cp-side.r` 두 장(각 `data-unit`), 대응 없는 쪽은 `.cp-side.none`. 판마다 `.cp-card`(책장 이름), 주사위 줄 `.cp-die[data-i]` 안 `.val`(공개 전 `?`), 결과 `.res`, 판 아래 `.cp-out`. 공개된 줄은 `.shown`, 이긴 줄 `.win`, 진 줄 `.lose`. 맞는 순간 판에 `.hit`(타격) 또는 `.hurt`(피격) 클래스를 약 0.18초. 합 연출 중 `#dice-layer`에 `hidden`.

- [ ] **Step 1: 실패하는 테스트** — `tests/ui.test.mjs`의 합 표시 검사를 바꾼다:
  - `"합 표시: 판 2장"`: `#clash-panel.on .cp-side` 개수 2, 왼쪽 판(`.cp-side.l`)의 `data-unit`이 아군 유닛.
  - `"합 표시: 숫자 공개"`: 어느 `.cp-die.shown .val` 의 글자가 숫자.
  - `"합 표시: 결과 글자"`: 판 글자에 `/(승|패|무승부|막음|회피|대응 없음)/`.
  - 기존 `"내 책장 이름이 합 표시에 나옴"`, `"막이 끝나면 합 표시 닫힘"` 유지.
  - `"합 중 속도 주사위 숨김"`: 합 연출 중 `#dice-layer` 가 `hidden`, 막이 끝나고 배정 단계면 다시 보임.
  - `"판이 캐릭터 옆"`(가로): 왼쪽 판 오른쪽 끝 ≤ 그 유닛 `__stage.unitPoint(id).x` + 4, 오른쪽 판 왼쪽 끝 ≥ 그 유닛 x − 4.
  - `"길게 누르면 판 닫힘"`: 합 시작 후 `#skip-layer` 를 600ms 누름 → 막이 끝난 뒤 `#clash-panel.on` 없음.
  - `tests/overlap-check.mjs` `measure`: `clash-panel` 대신 `.cp-side` 마다 상자 하나(`k:"clash:"+side`, 그룹 각자). resolve 장면 기다림을 `#clash-panel.on .cp-die.shown`이 나올 때까지로.
- [ ] **Step 2: 실패 확인** — `node tests/run.mjs ui overlap-check` → 새 검사 FAIL.
- [ ] **Step 3: 구현 `showClash(ev, isFast)` / `revealClash(i)` / `hideClash()` / `placeClash()`**
  - `showClash`: 판 2장 HTML(위 DOM). 내 쪽이 늘 왼쪽(지금 `allyFirst` 규칙 그대로). 주사위 줄은 지금처럼 종류·범위·재사용·`?`. 피해 문구는 그 단계의 피해를 받은 쪽 판의 `.cp-out`에.
  - `revealClash(i)`: `i`까지 줄 공개(지금 로직). 새로 공개되는 줄 i에: 숫자·결과, `.win/.lose`, 판에 `.hit`/`.hurt`(피해 받은 쪽이 `.hurt`, 상대가 `.hit`; 피해 없으면 이긴 쪽만 `.hit`), 180ms 뒤 클래스 제거. `isFast`면 `.hit/.hurt`·튀어 오름 클래스 없이 숫자만. 인자 없이 부르면 남은 줄 모두 조용히 공개.
  - `runOpen`: `stage.play(…, { onStep: i => revealClash(i), onHit: … })` — 지금 `onHit` 안의 `revealClash(i)`는 빼고 피해 숫자·막대만. 지금의 420ms `setTimeout` 공개는 지운다(무대가 없거나 `onStep`이 안 오면 `play` 끝난 뒤 `revealClash()`가 공개). 합 시작에 `el.dice.hidden = true`, `hideClash()`에서 `false`.
  - `placeClash()`(프레임 루프에서 `placeDice` 다음에 호출, `#clash-panel.on`일 때만): 각 판의 기준점 `pointOf(unit)`. 가로(`innerWidth >= innerHeight`): 왼쪽 판 `right = x − 18`, 오른쪽 판 `left = x + 18`, `top = y − 10`. 세로: 판 폭 `innerWidth/2 − 12`, 왼쪽 판은 `[8, W/2−4]`, 오른쪽 판은 `[W/2+4, W−8]` 안에서 유닛 x를 중심으로, `bottom = y − 8`(머리 위). 공통: `top ≥ barsFloor(left, right) + 6`, 화면 안으로 자르기, 두 판이 겹치면 세로로 아래 판을 밀어냄. 위치는 목표로 35%씩 다가가고 1px 이하는 무시(`setPos`와 같은 방식, 첫 프레임은 바로 목표로).
  - CSS: `#clash-panel`은 `inset:0; pointer-events:none` 투명 층, `.cp-side`가 `position:absolute` 유리판(폭 가로 190px, 세로는 JS가 정함). `.cp-die .val` 기본 15px; `.cp-die.shown.pop .val`에 1→1.8→1.3 keyframes 220ms. `.lose .val` 흐리게 + 좌우 3px 흔들림 160ms. `.cp-side.hit`는 `--accent` 밝은 안쪽 테두리+빛, `.hurt`는 `--bad` 테두리+빛+좌우 5px 흔들림. `@media (prefers-reduced-motion: reduce)`에서 애니메이션 끔.
- [ ] **Step 4: 통과 확인** — `node tests/run.mjs ui overlap-check` → 모두 PASS, 겹침 0.
- [ ] **Step 5: 커밋** — `git commit -m "전투: 합 때 양쪽 책장 판이 캐릭터 옆에 뜨고, 숫자가 튀어 오르며 타격·피격이 번쩍임"`

### Task 3: 문서·전체 확인·검수 링크

**Files:**
- Modify: `docs/decisions.md` (다대다 전투 절), `docs/ui.md` (4절 `play` 줄, 5절 자리·DOM 목록)

- [ ] **Step 1: 문서** — `decisions.md`에 한 줄: `- 2026-11-19 · 합 표시는 양쪽 책장 판이 각 캐릭터 옆에 붙어 따라다닌다(세로는 머리 위). 주사위 값이 나올 때 숫자가 튀어 오르고 0.15초 슬로우(0.25배)와 타격·피격 번쩍임. 합 연출 중 속도 주사위는 숨긴다.` `ui.md` 4절 `play`에 `onStep(i)`·슬로우, 5절에 판 자리와 `.cp-side` DOM.
- [ ] **Step 2: 전체 테스트** — `node tests/run.mjs` → 전부 PASS.
- [ ] **Step 3: 눈으로 확인** — 844×390, 390×844에서 합 중(숫자 공개 직후) 스크린샷을 찍어 직접 본다: 판이 캐릭터 옆(세로는 머리 위), 막대·상태판과 안 겹침, 숫자가 읽힘.
- [ ] **Step 4: 커밋·푸시** — `git push -u origin claude/game-ui-ux-redesign-4l6p7o`.
- [ ] **Step 5: 검수 링크** — 게임 정적 파일(`index.html`, `js/`, `vendor/`, `assets/`, 약 13MB·150개 파일)을 Artifact로 올려 큐 양이 폰·PC에서 바로 해 볼 수 있는 비공개 링크를 보낸다. 올리기가 안 되면 브랜치 이름과 로컬 실행 방법을 대신 보낸다.
