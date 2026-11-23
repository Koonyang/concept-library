# 개념의 서고 — 인수인계 (총괄)

이 대화를 본 적 없는 사람이 저장소만 보고 이어서 개발할 수 있게 쓴 문서다.
규칙 요약은 `CLAUDE.md`, 큐 양이 정한 규칙 전체는 `docs/decisions.md`.

## 1. 프로젝트 개요
- 사용자: 큐 양(대학 신입생, 한국어로 편하게 말함). 인강 노트에서 약한 개념을 뽑아 게임 속 "손님"으로 만들고,
  퀴즈를 풀며 싸워서 복습한다. 모델은 Library of Ruina(접대 층, 손님, 책장, 합, 책 소각, 감정 단계, 빛).
- 지금까지는 봇 4명이 나눠 만들었다: 도서관 총괄(조율·결정 정리), UI/UX 담당, 전투/시스템 담당, 학습내용 담당.
  앞으로는 Claude Code가 이어서 개발한다.
- 정적 사이트. 빌드·번들러·패키지 없음. GitHub Pages가 `main` 브랜치 루트(`/`)를 그대로 올린다.

## 2. 파일 지도

> **2026-11-18 새 UI:** 아래 표·묶음 설명은 옛 구조다. 지금 구조·화면·무대 API·역할은 `docs/ui.md`를 먼저 읽는다.
> 규칙 이름(`FLOORS`, `WEAK_POINTS`, `mbCreate` …)은 `js/core/`에 그대로 있다. 옛 화면 함수는 `legacy/`에만 있다.

`index.html` 안의 주요 묶음(이름으로 검색할 것):
- 데이터: `FLOORS`(층 4개: crime, memory, cognition, criminal-law), `WEAK_POINTS`(손님 12명, 문제 `questions`),
  `KEY_QUESTIONS`(핵심 문제), `COMBAT_PAGES`(책장 33장), `KEY_PAGES`(핵심 책장 = 장서복 7개), `EGO_GIFTS`(33개), `COSMETIC_ITEMS`.
- 수치: `COMBAT`(1:1 수치, 주사위 비율 `COMBAT.pct`, 흐트러짐 배율 `correctStagger`/`keyCorrectStagger`), `MB`(다대다, `MB.ENEMY_MAX=3`, `MB.HP`, `MB.WRONG`; 2026-11-19부터 `SCALE_ENEMY` 없음),
  `ENEMY_STATS`, `DECK_MIN=6`/`DECK_MAX=20`, `DECK_MAX_COPIES=2`, `HAND_MAX=8`, `PARTY_MAX=3`, `LIB_UNLOCK_AT=[0,5,10]`.
- 주사위 변동: `pctEnd`, `pctRange`. 1:1 엔진: `resolveScene`. 다대다 엔진: `mbCreate`, `mbStartScene`, `mbAssign`/`mbUnassign`,
  `mbAnswer`, `mbResolve`, `mbRunResolve`, `mbQuestionCount`, `mbEnemyCap`, `mbCardInfo`. 화면: `renderMulti`.
- 적 그림: `ENEMY_BODY`(손님 적 key → human/machine/puppet), `MB_ARCH_FORM`, `enemyBody`, `GXN_BODY`/`GXN_FORM`/`GXN_EXPR`, `mbEnemyFigure`.
- 책 표지: `bookCoverIndex(guest)`(guest.book 1~8, 없으면 id 해시), `bookCoverSrc`, `bookArt`.
- 저장: `SAVE_KEY="concept-library-game-v1"`, `defaultSave`, `loadSave`, `persist`, `migrateAcq`, `migrateLibrarians`, `sanitizeLibrarians`. 지금 `saveV=2`.
- 화면: `showScene`, `transit`, `renderTitle`, `renderLobby`, `renderBattle`, `renderShelf`, `renderDeckEditor`, `openResult`, `botNav`, `setDrawer`, `syncSettingsBookmark`.
- 달의 계시: `const Moon=(()=>{…})()`.
- 디버그·테스트 핸들: `window.__studyGame`(`battleApi`, `engine`, `data`, `acq`, `gifts`, `libs`, `moon`, `setScene` …).

## 3. 게임 흐름
- 기본 화면 3개(왼쪽 위 책갈피 서랍 `.botnav`): **[접대]**(`lobby`), **[도서관]**(`shelf`: 책·덱 편성·사서/장서복·기프트), **[계시]**(`moon`).
  오른쪽 위 **[설정]** 책갈피(`#set-bm`, BGM/효과음)는 이 기본 화면에만 보인다.
- **접대:** 층을 고르고 손님을 골라 전투. 이긴 손님은 책이 되고(`conqueredIds`), 다시 싸우면 **회상**(`isRecall`)이다.
  책은 소각해서 그 손님의 책장·핵심 책장·기프트를 얻는다(`burnBookOnce`, `BOOK_POOLS`). 다 모은 책은 목록·개수에서 빠진다.
- **전투(다대다가 기본):** 사서 최대 3명(`PARTY_MAX`) 대 적 최대 3명(`MB.ENEMY_MAX`). 한 막(scene)마다:
  속도 주사위 → 문제 1개 → 정답/오답에 따라 주사위 범위 변동 → 손패에서 책장을 주사위에 끼우고 상대 주사위로 끌어다 놓기(합 짝은 가운데 바닥 더미, [전황] 수정구슬로 전체 순서) → [개막] → 합 연출.
  `?multi=0` 또는 `save.multiBattle===false`면 예전 1:1 전투(`multiEnabled()`; `?multi=1`은 저장값보다 우선).
- **성장:** 사서 레벨·경험치는 없다(저장 v2에서 삭제). 성장은 책장, 핵심 책장(=장서복), E.G.O 기프트로만.
  핵심 책장 5개마다 사서가 한 명 늘어난다(`LIB_UNLOCK_AT=[0,5,10]`, 사서 `kyu`, `lib2`, `lib3`). 전투마다 체력은 가득 찬 채 시작.
- **달의 계시:** 하루 한 번 영단어 퀴즈(`MOON_PER_DAY`). 끝나면 `save.moon={date,reveal,replay,used:false}`가 생기고,
  그날 첫 접대에 보너스가 적용되면서 `used=true`가 된다.

## 4. 담당 문서 나눔
- [`docs/battle.md`](battle.md)(전투/시스템): 엔진 구조, `battleApi`, `ev`/`steps` 필드, 다대다·1:1 수치와 배율, 퍼센트 주사위, 저장 형식·버전·이전 저장 처리, 시뮬레이션, 테스트 실행.
- [`docs/ui.md`](ui.md)(UI/UX·3D 무대): 새 화면 구조, 무대 API(`createStage`·`play`·`registerFx`), 전투 화면 조작, 겹침 검사, 테스트, 역할 나눔. 옛 UI 설명은 `legacy/ui-old.md`.
- [`docs/content.md`](content.md)(학습내용): 손님 데이터 형식, 문제·핵심 문제·단어, `ENEMY_BODY`, `guest.book`, 새 손님 추가 순서.
- [`docs/decisions.md`](decisions.md)(총괄): 큐 양이 정한 규칙. 다른 문서와 어긋나면 **decisions.md가 우선**이고, 어긋난 문서를 고친다.

## 5. 현재 상태 (마지막 배포 기준)
최근 배포(`git log origin/main`):
- `zi` 다대다 배치: 캐릭터는 가운데 높이, 아군 왼쪽 끝·적 오른쪽 끝, 가운데 비움, 바닥 원판은 발 아래.
- `zj` 다대다 밸런스(판 길이 보정 규칙 없음), 문제 순서(전부 한 번 → 틀린 것 먼저), 오답 벌점(오답 막 사서 체력 피해 ×1.7, 흐트러짐 ×2),
  사서 레벨 삭제(다대다 사서 157/39, 1:1 100/26 고정), 합 단계 필드 `s.aDie`/`s.bDie`/`s.aResult`/`s.bResult`/`s.blocked`/`s.recovered`.
- `zk` 결과 화면 한 화면 맞춤(844×390), 기프트는 받은 사서만, 대상 선 강조(말풍선이 열린 주사위의 선을 흰 실선으로 맨 위에).
- `zl` 합 클로즈업에서 양쪽 책장 카드 대결(승/패/무승부/방어/회피, "피해 0", "흐트러짐 +N", "N 막음", "재사용", "일방 공격"). 합 1.0초, 최대 1.6초.
- `zm`(최신, `77299d6`) 다대다 숫자 크기: 사서 쪽 ×20 배율 제거. 사서 체력은 `MB.HP.allyHp`(157) × 문제 수 배율
  (`mbQuestionCount/qRef(7)`, 0.85~2로 제한) + 기프트·장서복, 흐트러짐 `allySt`(39). 적은 `MB.SCALE_ENEMY={1:20,2:10,3:7}`(사서 수별)로
  체력·흐트러짐과 적이 받는 피해만 키워 적 하나가 대략 100~300(`mbEnemyScale`, `battleApi.enemyScale(n)`). 적이 주는 피해는 ×1.
- 같은 시기 문서·데이터: `docs/ui.md`, `docs/content.md` 추가, `ab02d81`에서 달의 계시 화면이 단어 형식 `{id, en, ko, pos}`의 `en`/`ko`를 직접 읽게 함. (계시가 빈 화면이었던 적은 없다: `assets/data/moon-words.js` 끝에서 `w`/`m` 별칭을 채운다.)

`zm` 시뮬레이션(전투/시스템 담당 보고; 정답률 70%, 손님마다 200판, 막 수는 중앙값; 사서 혼자 / 셋):
- 명예훼손(문제 14개): 18막 71% / 15막 71%
- 베카리아(7개): 8막 87% / 6막 74%
- 뽀모도로(6개): 6막 95% / 5막 93%
- 전체 승률 혼자 81%, 셋 85%(`zj`는 80% / 84%). 정답률 30%면 혼자 32%, 셋+기프트 24%(목표 35% 이하).
- 막 수가 문제 수의 0.8~1.2배 안에 드는 판은 32~43%.

수치: **2026-11-19 재조정**으로 위 `zm` 수치는 옛것이다. 피해량 = 주사위 값(숨은 배율 없음), 적 하나 3~4방, 사서 100/24(혼자 기준, 사서 수 배율 `MB.HP.allyParty`). 공식과 시뮬 결과는 `docs/battle.md` 2·6절.
- 1:1 사서는 100/26 그대로.

## 6. 남은 일
1. **판 길이 맞춤:** 보정 규칙(우두머리 체력 1 버티기, 연장 피해) 없이 체력만으로 맞춘 결과, 막 수가 문제 수의 0.8~1.2배 안에 드는 판은 약 32~43%다(`zm` 기준)(대부분 ±1막). 큐 양이 보정 규칙을 둘 다 빼기로 했으므로, 더 맞추려면 체력·피해 수치로만 해야 한다.
2. **기믹 추가 유닛:** 분신·소환처럼 적이 3명을 넘어야 하는 기믹은 `gimmick.extraUnits` + `unit.parentId`로 넣기로 했다. UI(`mbParentId`, 상태판 "+N 분신" 칩)는 준비돼 있지만 **엔진에는 아직 없다**.
   지금 `guest.enemyMax`(최대 5)·`manyEnemies`는 임시 안전장치다(`mbEnemyCap`).
3. **기믹 고르기:** 추천한 기믹 10개 중 무엇을 넣을지 큐 양이 아직 고르지 않았다. 고른 다음에 구현.
4. **열린 질문:** 달의 계시 라운드를 시작만 하고 끝내지 않으면 그날 계시를 "쓴" 것으로 칠지. 지금 코드는 라운드를 끝내야 `save.moon`이 생긴다. 큐 양에게 물어서 정할 것.
5. 새 학습 내용(손님) 추가는 `docs/content.md` 순서를 따른다. 유틸·퀴즈 기믹 책장은 2026-11-14 이후 새 강의 내용에만 넣고, 기존 책장은 바꾸지 않는다.

## 7. 작업 방식 팁
- 큐 양은 결과를 라이브 사이트에서 휴대폰 가로로 확인한다. 배포 후 "무엇을 새로고침해서 무엇을 보면 되는지" 짧게 알려 준다.
- 바뀐 점은 사용자 말로 짧게. 큐 양이 정한 규칙은 임의로 바꾸지 말고, 새 결정은 `docs/decisions.md`에 한 줄로 남긴다.

## 8. 문서끼리 어긋난 곳 (총괄 확인)
- 겹침 기준(총괄 결정): 전투 UI끼리 겹침 0건은 배포 조건이다. `fighter-front-ui`(캐릭터 대 앞쪽 UI)는 참고용이라 `tests/overlap-check.mjs`가 개수만 출력하고 실패로 치지 않는다.
- 봇 공용 컴퓨터의 로컬 설정 `.git/info/exclude`가 `*.mjs`를 무시했었다. 새로 clone한 저장소에는 해당 없지만, 그런 환경이면 `git add -f`가 필요하다.
- 참고(어긋남 아님): "캐릭터 크기 그대로"는 `zi`에서 캐릭터를 키우지 않았다는 뜻이다. 깊이 원근(`sc = 0.8 + 0.2×t`, 뒷줄 최대 20% 작게, `br:1`로 어둡게 하지 않음)은 의도된 것이고 `docs/ui.md`(`ec9fa93`)와 맞다.
