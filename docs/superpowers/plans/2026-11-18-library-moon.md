# 서랍 · 도서관 · 달의 계시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (큐 양이 직접 진행 방식 선택). Steps use checkbox (`- [ ]`).

**Goal:** 책갈피 서랍으로 접대·도서관·계시를 오가고, 도서관(책·덱·사서·기프트)과 달의 계시를 새 UI로 쓸 수 있게 한다.
**Architecture:** `js/ui/nav.js`(서랍), `js/ui/library.js`, `js/ui/moon.js`를 화면 함수 + nav 콜백 방식(`screens.js`와 같음)으로 추가하고 `app.js`가 잇는다. 규칙은 `Game.*`만 부른다. 무대는 3D 담당의 `stage.showLibrarian/cheer`(병행 작업)를 쓰고, 없으면 무시한다.
**Tech Stack:** 정적 HTML/CSS/JS 모듈, Playwright 테스트.
**Spec:** `docs/superpowers/specs/2026-11-18-library-moon-design.md`

## Global Constraints
- 서랍·[설정]은 기본 화면(floors·guests·library·moon intro/result)에만. 전투·퀴즈 진행·결과에서는 숨김.
- 막는 팝업 금지. 덱 6~20장, 같은 책장 2장 한도. 덱 카드는 정답·오답 범위 둘 다 보인다. 세트 효과는 착용 관련만. [착용] 표시는 카드 모서리 안쪽.
- 장착·덱 변경 시 스크롤 위치 유지. 다 모은 책은 목록에서 빠진다. 소각 결과는 80% 이상 불투명 카드.
- 844×390 기본, 390×844 지원. 글꼴 Pretendard·Space Grotesk. 기존 9개 테스트 계속 통과.

## Review Focus
1. 책이 0권일 때 도서관 책 탭 → 빈 상태 안내(오류 없음). 테스트: Task 2.
2. 덱이 6장 미만이 되도록 빼기 → 경고 줄, 접대 화면에서 손님 버튼이 막힘. 테스트: Task 3.
3. 계시 퀴즈 중 다른 화면으로 나가거나 시간이 다 됨 → 시계(타이머)가 남아 돌지 않는다. 테스트: Task 5.
4. 서랍을 연 채 화면 이동 → 서랍이 닫히고 겹치지 않는다. 테스트: Task 1.
5. 단어 데이터가 비었을 때(예시 단어만) → 계시 화면이 빈 화면이 아니다. 테스트: Task 5.

### Task 1: 서랍(nav.js) + app 연결 + 설정 책갈피
- Create `js/ui/nav.js`: `mountNav(root, {current, go})` → 왼쪽 위 `#nav-bm`, `#nav-drawer` 안 `.nav-item[data-go]`(floors·library·moon), 서랍 밖 탭·Esc로 닫기. `NAV_ITEMS` 배열.
- Modify `js/ui/app.js`: nav.library / nav.moon 라우트, 기본 화면마다 mountNav + 설정. 설정 버튼을 오른쪽 위 책갈피 모양으로.
- Test `tests/library.test.mjs`(새): 서랍 열기 → 도서관 → 서랍 → 계시 → 서랍 → 접대(floors). 열린 서랍은 이동 후 닫힘. 전투 화면엔 `#nav-bm` 없음.

### Task 2: 도서관 — 책 탭
- Create `js/ui/library.js`: `renderLibrary(root, stage, nav, tab)`; 하위 탭 `.lib-tab[data-tab]`(books·deck·libs·gifts), 고른 탭은 localStorage `concept-library-libtab`.
- 책 탭: `.book-item[data-guest]`(표지·이름·권 수·풀 목록), `#btn-burn1`, `#btn-burnall` → `Game.books.burn` → `#burn-result`(80% 불투명) `.burn-get` 줄들, [확인]으로 닫음. 빈 상태 `.empty`.
- Test: 책 0권 → `.empty`. pomodoro 책 2권 주고(`__studyGame.acq.addBooks`) 1권 소각(시드 고정) → 결과 줄 ≥1, 권 수 1로.

### Task 3: 도서관 — 덱 탭
- 위 `#deck-slots`(지금 덱 카드, n/20, 6장 미만 `.warn`), 아래 `#deck-pool .pool-card[data-page]`(가진 책장, 넣은 수/한도), 필터 칩 `.chip[data-f][data-v]`(층·종류·비용·희귀도). 카드에 `.rng` 정답·오답 범위.
- 넣기/빼기 `Game.deck.toggle`, 칸 카드는 `{slot:true}`. 스크롤 유지(목록 scrollTop 보존).
- Test: 풀 카드 눌러 넣기 → n+1, 칸 카드 눌러 빼기 → n-1, 스크롤 위치 그대로, 5장 되게 빼면 `.warn` + 접대 손님 버튼 disabled.

### Task 4: 도서관 — 사서·기프트 탭 + 무대 사서
- 사서 탭: `.lib-card[data-lib]`(열린 사서, 다음 해금까지 남은 수), `#btn-party`, 장서복 목록 `.key-card[data-key]`(가진 것만 누를 수 있음, 착용 표시 `.on`). `Game.libs.pick/toggleParty/equipKey`.
- 기프트 탭: 부위 칸 `.slot[data-slot]`, 가진 기프트 `.gift-card[data-gift]`(착용 `.on`), 세트 효과(착용 관련만), 합계(`bonusLabel(giftTotals)`). `Game.libs.equipGift`.
- 무대: 도서관 들어올 때·사서 바꿀 때 `stage.showLibrarian?.(id)`, 장착 바꾸면 `stage.cheer?.()`.
- Test: 장서복 2개 열어 두고 착용 바꾸기 → `.key-card.on` 바뀜, 스크롤 유지. 기프트 하나 주고(`__studyGame.setGifts`) 해제·착용.

### Task 5: 달의 계시 (moon.js)
- `renderMoon(root, stage, nav)`: phase intro → quiz → bridge → result(MoonCore 상태 그대로). quiz는 `#moon-q`, `.moon-opt[data-i]`, `#moon-time` 막대, `#moon-score`. 정답 170ms·오답 650ms 표시 중 시계 멈춤. 시간 0 → `endRound`. 무대는 달빛 분위기(`setFloor({mood:"moon"…})`, 유닛 없음).
- 화면을 떠나면 타이머·rAF 해제(`unmount`).
- Test: 시작 → 정답 몇 개·오답 몇 개 → (남은 건 시간 줄여 끝내기) → bridge → 건너뛰기 → result, `save.moon.date`가 오늘. 다시 들어가면 바로 result. 나간 뒤 rAF 콜백 0.

### Task 6: 겹침 검사·문서
- `tests/overlap-check.mjs`에 도서관 4탭·계시 quiz 화면(가로·세로) 추가: 서랍 버튼·탭·목록·버튼끼리.
- `docs/ui.md` 화면 절 갱신, `docs/HANDOFF.md` 남은 일 갱신.
- 전체 `node tests/run.mjs` 통과.
