# 개념의 서고 — UI/UX 인수인계

UI/UX 담당이 맡았던 화면·연출 부분을 이어받을 사람을 위한 문서입니다. 전투 규칙·데이터는 전투/시스템 담당, 문제·책 내용은 학습내용 담당 문서를 보세요.

## 1. 꼭 지킬 규칙 (큐 양이 정한 것)

- **가로 폰이 기본.** 큐 양은 주로 휴대폰 가로로 플레이한다. 모든 화면은 가로에서 먼저 맞추고, 세로도 지원한다. 따로 말이 없으면 가로에 한 변경은 세로에도 똑같이 한다.
- 기준 해상도: 가로 `844×390`, 세로 `390×844` (아이폰 12~14급). 가로 미디어쿼리는 `(orientation:landscape) and (max-height:500px)`.
- **원작(Library of Ruina / Limbus Company) 에셋 금지.** 그림·아이콘·폰트·소리 전부. 들여온 에셋은 `CREDITS.md`, `LICENSES.md`에 출처를 적는다.
- **팝업 금지, 빠른 템포.** 확인창·모달 대신 화면 안에서 바로 바뀌게. 연출은 탭하면 빨리 감기, 길게 누르면 건너뛰기.
- **무대와 캐릭터는 배경층이다.** 전투 UI 뒤에 가려져도 된다. 서로 겹치면 안 되는 건 전투 UI끼리다: 주사위, 체력/흐트러짐 바, 대상 화살표, 손패, [개막] 버튼, 상태 패널, 합 책장 카드. 겹침 검사(아래 5절)가 이걸 잡는다.
- 큐 양이 마음에 들어 한 연출은 묻지 않고 바꾸지 않는다.
- UI는 주사위·결과를 직접 계산하지 않는다. 전투 엔진이 준 필드를 그대로 그린다(없을 때만 예전 필드로 대신).

## 2. 파일 구조

- `index.html` — 게임 전체(CSS + 마크업 + JS 한 파일, 약 7,500줄). 빌드 없음. 그냥 열면 돌아감.
  - 1~1850줄 근처: CSS. 가로/세로 미디어쿼리는 각 블록 바로 뒤에 붙어 있다.
  - `const FLOORS`, `WEAK_POINTS`, `COMBAT`, `COMBAT_PAGES`, `KEY_PAGES`, `EGO_GIFTS` …: 데이터(전투·학습 담당 영역).
  - `resolveScene` 등 1:1 전투 규칙, `mb*` 함수들: 다대다 전투(전투 담당 영역, UI 쪽은 `renderMulti`, `mbStatRow`, `mbPaintStats`, `mbRunResolve`, `mbShowStepEvents`, `mbHighlightUnit`).
  - `render*` 함수들: 화면 그리기(UI 영역).
- `assets/ui/battle-stage.js` — 다대다 전투 무대(`BattleStage`). 파일 맨 위 주석에 API 전체가 있다.
- `assets/bg`, `assets/books`(책 표지 8장), `assets/icons`, `assets/textures`, `assets/ui`(패널·금테 이미지), `assets/fonts`(Pretendard, Space Grotesk), `assets/audio`.
- `assets/reserve/` — 지금은 안 쓰는 보관 코드(치장·뽑기). 지우지 말 것.
- 저장: `localStorage["concept-library-game-v1"]`, `loadSave`/`persist`. 저장 모양이 바뀌면 `migrate*`/`sanitize*`에서 옛 저장이 깨지지 않게 한다(예: level/xp가 없어도 됨).

## 3. 화면

`showScene(name)`으로 바꾸고, 화면 사이 이동은 `transit(next, fn)`(0.42초 책장 넘김).

| scene | 그리는 함수 | 내용 |
|---|---|---|
| `title` | `renderTitle` | 시작 화면 |
| `lobby` | `renderLobby` | 접대(층 고르기, 손님 목록, 층 점 `#floor-nav`/`.fn-dots`, 손님 시트 `openGuestSheet`) |
| `battle` | `renderBattle`(1:1), `renderMulti`(다대다) | 전투 |
| `shelf` | `renderShelf` → `renderShelfBooks`/`renderShelfDeck`/`renderDress` | 도서관: 책, 덱 편집(`renderDeckEditor`), 사서 치장·기프트 |
| `deck` | `renderDeckEditor` | 덱 편집 |
| `moon` | `Moon.render` | 달의 계시(오늘의 단어 퀴즈) |
| `credits` | `renderCredits` | 크레딧 |

- **메뉴:** 화면 왼쪽 위 책갈피 버튼(`.bm-btn`)이 서랍(`.botnav`: 접대·도서관·계시)을 연다. `botNav`, `setDrawer`. 가로·세로 같음.
- **설정 책갈피** `#set-bm`은 기본 화면에만 있고 전투 중에는 `#game.set-away`로 숨긴다(`syncSettingsBookmark`).
- **결과 화면** `openResult`/`showWin`/`showLose`: 한 화면에 다 들어가야 한다. 안내 문구("회상을 마쳤다" 등)는 책 제목 아래(가로는 왼쪽 칸), 오른쪽은 보상 줄만. 기프트는 받은 사서만 줄로, 아무도 못 받으면 "이번엔 기프트가 떨어지지 않았다" 한 줄. 사서 레벨 UI는 없다(성장은 책장·핵심 책장·기프트).
- 알림은 `toast`, 학습 알림은 `learnToast`(팝업 아님).

## 4. 다대다 전투 무대 (`BattleStage`)

자세한 시그니처는 `assets/ui/battle-stage.js` 맨 위 주석. 요점만:

- `mount(host)` 한 번, 배치 단계마다 `render(battle, {hands, cards, figure, onUnassign, avoid})`.
- `onAssign(unitId, dieIdx, cardId, target)` / `onUnassign(unitId, dieIdx)`. 조작: 내 주사위 → 손패 카드 → 적 주사위(또는 끌기). 놓은 주사위나 화살표를 탭하면 해제. 감정 조건이 안 되는 카드(`cardInfo.usable`, `emotionReq`)는 흐리게 "감정 n+".
- `await clash(ev, {fast})` — 합 하나 전체 연출. 끝나면 풀리는 Promise. `ev.steps[]`의 `aDie`/`bDie`(`{type,min,max,value,idx,reused}`), `aResult`/`bResult`(`win|lose|draw|block|evade|none`), `blocked`, `recovered`, `expr`를 쓴다. 없으면 `winner`·`pd`/`gd`로 대신.
  - 합 하나 1.0초, 주사위 칸 하나 더할 때마다 +0.3초, 최대 1.6초. `fast`면 0.3초.
  - 책장 카드 대결: 아군 책장 왼쪽, 적 책장 오른쪽(세로는 캐릭터 아래). 쓰는 칸 강조, 종류·범위·값 크게, 도장은 승/패/무승부/방어/회피, 부가 표시는 "피해 0", "흐트러짐 +N", "N 막음", "재사용", "일방 공격".
  - 카메라가 들어간 동안 `.battle-stage.bs-cam-on` → 손패·개막·상태판 숨김.
- `unitPoint(id)` 피해 숫자 위치, `relayout()` 바깥 요소가 바뀐 뒤 자리 다시 잡기, `battleApi.refresh()` 상태판 다시 그리기, `battleApi.enemyCap(gid)` 장면당 적 수.
- **배치:** 아군 slot 0 앞줄·1·2 뒷줄, 적 slot 0~2 앞줄·3·4 뒷줄. 뒷줄도 어둡게 하지 않는다(`br:1`). 크기는 깊이값 `t`에 따라 `sc = 0.8 + 0.2×t`로 뒤쪽이 조금만 작아진다(`battle-stage.js`의 자리 계산). 캐릭터 기본 크기는 zi 이후 바꾸지 않았다. 가로는 아군 왼쪽·적 오른쪽, 가운데 비움. 캐릭터는 손패·상태판 위 가운데 띠에 몸·이름·머리 막대까지 전부 보이게, 바닥 원판은 발 아래.
- **아래쪽 자리:** 손패(부채꼴, 모든 카드의 이름·코스트·주사위가 보이고 한 장만 들림) + 가운데 아래 `#btn-mb-go`("개막", 금색 책갈피, 준비되면 빛남). 상태판 `#mb-stat-ally` 왼쪽 아래, `#mb-stat-enemy` 오른쪽 아래(최대 3줄, `unit.parentId`가 있는 분신은 "+N 분신" 칩). 줄을 탭하면 그 유닛 `.mb-hl`.
- **대상 선:** 기본 점선(가늘게), 주사위 정보 말풍선이 열린 동안 그 주사위의 선을 흰 실선(화살촉)으로 위에 그림. 서로를 노리는 주사위는 "합" 한 줄로 합쳐진다.
- 무대 배경(`assets/bg/library-battle.webp`)은 화면 끝까지 까는 배경층이다.
- 1:1 전투는 `?multi=0`. 기본은 다대다.

## 4-1. 달의 계시

- `Moon` 모듈(`index.html` 끝부분). 단어는 `assets/data/moon-words.js`의 `window.MOON_WORDS`, 없으면 `moon-words.sample.js`의 `window.MOON_WORDS_SAMPLE`.
- 단어 형식은 `{id, en, ko, pos}`. `Moon` 안의 `words()`가 읽을 때 `w`/`m`을 같은 객체에 채워 쓴다(예전 형식도 읽힘).

## 5. 테스트와 확인

테스트는 지금 **저장소 밖** `/workspace/lib-tests`(봇 공용 컴퓨터)에 있다. Playwright(`playwright-core`) + 시스템 Chrome(`/usr/bin/google-chrome`)로 로컬 서버를 띄워 화면을 찍고 검사한다.

```
cd /workspace/lib-tests
LIB_ROOT=/path/to/repo node overlap-check.mjs      # 겹침 검사(fighter-front-ui 포함). 0개여야 함
LIB_ROOT=/path/to/repo node landscape.test.mjs     # 가로 화면들
LIB_ROOT=/path/to/repo node orient.test.mjs        # 가로/세로 전환
```

UI 쪽 주요 테스트: `overlap-check`(지금 들어 있는 `fighter-front-ui` 항목은 캐릭터와 앞면 UI 겹침을 잡는데, 위 규칙상 실패해도 막는 기준은 아니다), `landscape`, `orient`, `fanhand`, `battlestage`, `clashcards`, `clashpromise`, `arrowhi`, `resultfit`, `hpstatus`, `unassign`, `settings`, `scroll`/`scrollkeep`/`deckscroll`/`receptionscroll`, `sheet`, `dress`, `bookcovers`, `center`. 스크린샷은 `$LIB_ROOT/shots/`에 떨어진다(저장소에 올리지 않음).

- 배포 전에 **스크린샷을 직접 눈으로 본다.** 테스트가 통과해도 화면이 어긋난 적이 있다(zh, 되돌림).
- 새 화면을 만들면 844×390과 390×844 둘 다 찍어 본다.

## 6. 배포

- 저장소: https://github.com/Koonyang/concept-library , GitHub Pages: https://koonyang.github.io/concept-library/
- `main`에 올리면 바로 배포. 올리기 전 `git pull --rebase origin main`.
- `index.html` 7번째 줄 `<meta name="build" content="library-YYYYMMDD?">`를 올릴 때마다 바꾼다(같은 날은 a, b, … z, za, zb … 순서, 담당끼리 겹치지 않게).
- 커밋 메시지는 한국어로, 바뀐 점을 사용자 입장에서 적고 끝에 `[library-…]` 표시.

## 7. 남은 일 / 알아 둘 것

- 엔진에 `unit.parentId`, `gimmick.extraUnits`는 아직 없다. UI는 있으면 분신 칩으로, 없어도 깨지지 않게 되어 있다.
- 장면당 적은 최대 3(기믹 예외 최대 5).
- 전투의 다음 밸런스(`zm`: 사서 157/39, 적 100~300)가 들어오면 상태판 숫자 폭이 넘치지 않는지 한 번 볼 것.
