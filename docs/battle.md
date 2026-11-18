# 개념의 서고 — 전투/시스템 인수인계

전투 엔진(1:1, 다대다)과 저장 데이터, 밸런스, 테스트·시뮬 실행법. 화면 쪽은 `docs/ui.md`, 학습내용(손님·문제·적 무리 데이터)은 `docs/content.md`, 전체 그림·결정 기록은 `CLAUDE.md`, `docs/HANDOFF.md`, `docs/decisions.md` 를 본다.
코드는 거의 전부 `index.html` 한 파일 안의 `<script>`. 아래 위치는 **함수/상수 이름**으로 적는다(줄번호는 자주 바뀜). 무대 그리기는 `assets/ui/battle-stage.js`(`BattleStage`).

## 1. 확정 규칙 (바꾸려면 큐 양 확인)

| 규칙 | 내용 | 코드 |
|---|---|---|
| 주사위 변동은 퍼센트 | 정답: 사서 주사위 양 끝 × (1 + right 0.20, 핵심 문제 keyRight 0.30) + 감정 단계 × emotionPer 0.05, 손님 −guestRight 0.20. 오답: 사서 −wrong 0.20(핵심 −keyWrong 0.30), 핵심 문제 오답일 때만 손님 +guestKeyWrong 0.20. 반올림, 변동 최소 1, 하한 1 | `COMBAT.pct`, `pctEnd`, `pctRange`, `playerDieRange`, `guestDieRange` |
| 정답 흐트러짐 배율 | 정답이면 사서→적 흐트러짐 피해 ×1.25(핵심 ×1.75). 적→사서는 ×1. 1:1·다대다 같음 | `COMBAT.correctStagger`, `COMBAT.keyCorrectStagger`, `resolveScene`(stMul) |
| 적 최대 3명 | 기본 `MB.ENEMY_MAX`=3. `guest.enemyMax`(1~5) 또는 `guest.manyEnemies===true`(→`MB.maxEnemies` 5)만 예외. 넘치면 우두머리는 남기고 나머지를 앞에서부터. 빠진 적의 문제는 남은 적에게 | `mbEnemyCap`, `mbCreate` |
| 기믹 추가 유닛(예정) | 분신·소환은 `gimmick.extraUnits`, 각 유닛 `parentId`(본체 id)로 연결. 상태판은 본체 줄에만 표기 | `mbParentId`, `mbGimmickExtras`, `mbIsExtraUnit`, `mbExtrasOf` |
| 문제 순서 | 처음엔 모든 문제를 한 번씩(살아 있는 적의 문제 먼저, 죽은 적의 문제는 산 적이 대신 냄) → 그다음 틀린 문제부터(틀린 순서) → 나머지 순환. 바로 앞 막과 같은 문제 반복 없음 | `mbNextQid`, `mbQOwner`, `mbPickQuestion`, `mb.qs` |
| 오답 막 벌점 | 다대다 전용. 오답 막에 사서가 받는 피해 체력 ×`MB.WRONG.hp`(1.7), 흐트러짐 ×`MB.WRONG.st`(2). `COMBAT.pct` 는 건드리지 않음 | `MB.WRONG`, `resolveScene`(pTaken) |
| 레벨 없음 | 사서 레벨·경험치 제거. 성장은 책장·핵심 책장(장서복)·기프트만. 1:1 사서 HP 100·흐트러짐 26 고정(+기프트·장서복) | `COMBAT.playerStartHp`, `COMBAT.playerStagger`, `playerStaggerMax`, `effectiveMaxHp` |
| PACE 꺼짐 | 판 길이 보정 hold(우두머리 버팀)·drain(양쪽 체력 감소)는 따로 켜는 스위치, 둘 다 기본 `false`. 밸런스는 HP만으로 | `MB.PACE`, `mbPaceHold`, `mbPaceDrain` |
| 적만 숫자 스케일 | 적 체력·흐트러짐과 적이 받는 피해(적 흐트러짐 회복 포함)에 `MB.SCALE_ENEMY[사서 수]` = {1:20, 2:10, 3:7}. 사서 쪽은 배율 없음(적이 주는 피해 ×1). 주사위 값은 카드 표기 그대로 → 균형은 배율과 무관, 적 숫자만 대략 100~300 | `MB.SCALE_ENEMY`, `mbEnemyScale`, `mbEnemyScaleNow` |

## 2. 엔진 구조

### 1:1 (기존 접대)
- 한 막 = `runScene(o)` → 합 풀기는 `resolveScene(o)`. 화면은 `renderBattle`, 결과는 `showWin`/`showLose`.
- `resolveScene({P,G,pDice,gDice,correct,isKey,rng,mods,emotion, dmgScale?,pScale?,pTaken?,stMul?,pRangeFn?,gRangeFn?})` → `steps[]`.
  두 쪽 주사위를 포인터로 맞붙인다. 공격 대 공격은 큰 쪽이 그 값만큼 때림, 방어는 차이만큼 줄여 받거나(지면) 상대 흐트러짐(이기면), 회피는 이기면 흐트러짐 회복하고 **주사위가 남아** 다음 상대와 다시 합(`keeps`, 다음 단계 `reused`).
  각 step: `{pd:{type,roll,reused,keeps}|null, gd:{…}|null, outcome:"P"|"G"|"tie"|"none", events:[{kind:"hit"|"stag"|"recover",target:"P"|"G",hp,st,newStag,…}], newStag:[], pRange, gRange, pIdx, gIdx, snap}`.
  `dmgScale`/`pScale`/`pTaken` 은 다대다만 넘긴다(1:1 은 모두 1).
- 피해 계산: `hitUnit`(저항 `TIER`·`resTier`), `stagOnly`, `recoverSt`. 손님 키트: `guestCombat`(`ARCH_COMBAT` + `GUEST_COMBAT` + `GUEST_SCALE`).

### 다대다 (기본 모드, `?multi=0` 이면 1:1)
막 순서: `question` → `assign` → `resolve` → 다음 막 또는 `end`. 상태는 `mb`(전역), 공개 모양은 `window.__studyGame.battle`(= `mb.battle`).

| 단계 | 함수 |
|---|---|
| 설정값 | `MB` (`HP`, `DICE`, `PACE`, `SCALE_ENEMY`, `WRONG`, `ENEMY_MAX`, 속도 등), 기믹 훅 `MB_HOOKS` |
| 체력 | `mbQuestionCount`, `mbEnemyHpTotal`, `mbEnemyQ`, `mbEnemyCtx`, `mbAllyStats`, `enemyStats`, `mbEnemyScale` |
| 만들기 | `mbCreate`(사서·적 유닛, 적 수 상한 `mbEnemyCap`, 몸 `enemyBody`/`ENEMY_BODY`), `mbQuestionPool` |
| 막 시작 | `mbStartScene`(주사위 굴림 `mbRollDice`, 적 목표 `mbRelink`, 문제 `mbPickQuestion`/`mbNextQid`/`mbPrepQ`) |
| 문제 | `mbAnswer`(정답이면 감정 `mbCharge`), 화면 쪽 `mbAnswerUI`, `mbShowQuestion` |
| 배치 | `mbAssign`, `mbUnassign`, `mbIsClash`, `mbUsable`, `mbCardInfo`, `mbQState` |
| 풀기 | `mbResolveBegin` → `mbResolveNext`(교환 하나: `resolveScene` 호출 → 단계 필드 붙이기) → `mbResolveEnd`. 한 번에: `mbResolve`. 연출 포함: `mbRunResolve`(교환마다 `BattleStage.clash(ev,{fast})` Promise 를 기다림) |
| 끝 | `mbFinish`(승: 책 획득·첫 정복 기록, 패: phase lose) |
| 화면 연결 | `beginMultiReception`, `mbRefresh`, `mbStageOpts`, `mbPaintStats`, `mbStatRow`, `mbShowStepEvents` |

### 다대다 체력 공식 (`MB.HP`, 지금 값)
- 사서: `hp = round(allyHp × clamp(문제 수 / qRef, qMin, qMax)) + 기프트·장서복 hp`, `st = allySt`. allyHp 157, allySt 39, qRef 7, qMin 0.85, qMax 2. 배율 없음.
- 적 무리 전체(배율 전) = `enemyHpPerQ[weakness] × 문제 수 × party[사서 수−1] × (1 + floorStep × 층 순서)`. enemyHpPerQ {1:2.07, 2:2.07, 3:2.28}, party [1, 2.05, 3.2], floorStep 0.05.
- 적 하나: `hp = max(minHp, round(전체 × 그 적의 문제 수 / 전체 문제 수)) × SCALE_ENEMY[사서 수]`, 흐트러짐 = `max(minSt, round(배율 전 hp × leaderSt 1.1 | followerSt 0.7)) × 같은 배율`.
- 적 주사위: 손님 키트 값을 `MB.DICE.scale[weakness] × partyScale[사서 수−1] / GUEST_SCALE[weakness]` 로 다시 맞춤(scale {1:1.15, 2:1.15, 3:1.32}, partyScale [1, 1.1, 1.2], 큰 공격 ×bigScale 0.9). 주사위 수: 우두머리 `leaderDice[w] + partyLeader`, 부하 `1 + partyFollower`.

## 3. `__studyGame.battleApi` (테스트·UI·시뮬용)

| 이름 | 인자 → 반환 |
|---|---|
| `enable(on)` / `enabled()` | 다대다 켜기(저장) → bool |
| `begin(guestId, {rng}?)` | 화면 포함 다대다 접대 시작 → `battle` |
| `create(guestId, {rng, party}?)` | 화면 없이 만들고 1막 시작 → `battle` |
| `startScene()` / `nextScene()` | 다음 막(시뮬용 `nextScene` 은 끝났으면 null) → `battle` |
| `answer(correct)` / `answerUI(correct)` | 이번 막 답 (엔진만 / 화면 흐름) |
| `assign(unitId, dieIdx, cardId, {unit, die\|null})` | → `{ok, clash}` 또는 `{ok:false, reason:"phase"\|"unit"\|"die"\|"card"\|"not-in-hand"\|"emotion"\|"light"\|"target"\|"target-die"}` |
| `unassign(unitId, dieIdx)` | → bool (카드 손패로, 빛 환불) |
| `resolve({animate}?)` | 막 풀기(기본 동기) |
| `resolveOnly()` | 동기로 막 전부 → 교환 이벤트 배열 |
| `resolveBegin()` / `resolveNext(R)` / `resolveEnd(R)` / `resolving()` | 한 교환씩 / 진행 중 Promise |
| `usable(uid, cid)` / `cardInfo(cid, uid)` | 카드 사용 가능 여부·범위 등 |
| `isClash(u, i)` / `relink()` / `refresh()` / `setEnemyTarget(eid, k, target)` | 합 여부 / 적 목표 다시 / 화면 갱신 / 적 목표 지정(테스트) |
| `setRng(fn)` | 난수 교체 |
| `hand(uid)` / `cardOf(cid)` / `internals()` / `mb` / `outcome` / `current` | 손패 id / 카드 / `mb.x`(유닛별 내부: `cu`, `mods`, `handIds`, `diePages`, `e`, `S`) / 전체 상태 / "win"\|"lose"\|null / 이번 문제 |
| `questionCount(gid)` / `enemyCap(gid)` / `enemyHpTotal(gid, n)` | 문제 수 / 적 수 상한 / 무리 체력(배율 전) |
| `allyStats(mods, gid)` / `enemyScale(n)` / `enemyStats(guest, e, idx, ctx)` | 사서 `{hp, st}` / `SCALE_ENEMY[n]` / 적 스탯 |
| `ENEMY_BODY`, `enemyBody(gid, e)`, `ENEMY_STATS` | 적 몸 표 / 몸 결정 / 적 key 별 덮어쓰기 |
| `MB`, `hooks` | 설정값, `MB_HOOKS` |
| `libMods`, `libStartLight`, `libStartEmotion`, `libLightRegen`, `libDeckIds` | 사서별 기프트·장서복 효과 |

### 훅 (`battleApi.hooks.이름.push((mb, payload) => {})`)
| 훅 | payload |
|---|---|
| `onSceneStart` | `{scene}` |
| `onAnswer` | `{correct, id, isKey, fromUnit}` |
| `onAssign` | `{unit, die, card, target:{unit,die}, prev, clash}` |
| `onUnassign` | `{unit, die, card, refund}` |
| `onClash` | 합 교환 이벤트 `ev` (아래) |
| `onSceneEnd` | `{scene, events, pace}` |

## 4. `BattleStage.clash(ev, {fast})` 계약과 이벤트 필드

엔진은 교환마다 상태를 먼저 반영하고 `BattleStage.clash(ev,{fast})` 를 부른 뒤 Promise 를 기다린다(안 돌려주면 `MB.stepMs` 만큼). 그리는 쪽 사용법은 `assets/ui/battle-stage.js` 맨 위 주석.

교환 이벤트 `ev`:
- `kind`: `"clash"`(서로 노린 두 주사위) | `"one-sided"` | (`resolveOnly` 결과에는 `"skip"` 도: 흐트러짐·사망으로 못 움직임)
- `a`: `{unit, die, card, values:[굴린 값…], expr, side?, body?, form?, leader?}` — 먼저 움직인(빠른) 주사위
- `b`: 같은 모양 | `null`(일방 공격), `target`: 맞는 유닛 id
- `result`: `{staggered:[새로 흐트러진 id], dead:[쓰러진 id]}`, `expr`: `{유닛id: "idle"|"win"|"hurt"|"shock"}`
- 예전 필드: `by, speed, ally, allyDie, enemy, enemyDie, allyCard, enemyCard, win:"ally"|"enemy"|"tie"|null, snap`
- `steps[]`: `resolveScene` step 필드(위) +
  - `aVal`, `bVal`, `winner:"a"|"b"|"tie"`, `dmg:{unit, hp, stagger}|null`(실제 적용 값, 배율 포함), `expr`
  - `aDie` / `bDie`: `{type(참격/관통/타격/방어/회피), min, max(이번에 실제 적용된 범위), value, idx(책장 안 몇 번째 주사위, 0부터), reused(회피 재사용)}` | `null`
  - `aResult` / `bResult`: `"win"|"lose"|"draw"|"block"|"evade"|"none"`. 방어가 공격을 이기면 `"block"`, 회피가 이기면 `"evade"`, 비기면 둘 다 `"draw"`, 일방 공격은 공격자 `"win"`·받는 쪽 `null`
  - `blocked`: 방어 주사위가 공격을 상대했을 때 줄어든 체력 피해(방어가 이기거나 비기면 공격 전부, 지면 방어 값 몫). 막은 쪽 기준 배율: 적이 막으면 ×SCALE_ENEMY, 사서가 막으면 ×1. 해당 없으면 0
  - `recovered`: 회피 성공 시 회복한 흐트러짐(사서 ×1, 적 ×SCALE_ENEMY). 아니면 0

## 5. 저장 데이터
- 키 `SAVE_KEY` = `"concept-library-game-v1"`(바꾸지 않음), 기본값 `defaultSave`, 불러오기 `loadSave`, 쓰기 `persist`.
- `saveV: 2` — 사서 레벨 제거. `loadSave` 가 예전 `level`, `xp`, `exp`, `maxHp` 를 **변환 없이 삭제**하고 `saveV=2`. 다른 진행(정복, 책, 기프트, 장서복 등)은 그대로.
- 그 밖의 버전 필드: `acqV`(책 획득, `migrateAcq`), `libV`(사서별 기프트, `migrateLibrarians`/`sanitizeLibrarians`). 다대다 끄기 `multiBattle:false`.

## 6. 밸런스 기준과 최신 시뮬 결과
기준(큐 양): 정답률 70% 사서 혼자(기프트 없음) 승률 약 80%, 사서 셋 약 84%, 정답률 30% 사서 셋 + 기프트 보통 ≤35%, 막 수 ≈ 손님 문제 수.

zm(2026-11-18) `node tools/sim/balance.mjs`, 손님마다 200판:

| 기프트(사서당) | 사서 | 정답률 | 승률% | 평균 막 | 막/문제 중앙 | 0.8~1.2% |
|---|---|---|---|---|---|---|
| 0 | 1 | 30% | 32 | 8.9 | 1.14 | 40 |
| 0 | 1 | 70% | 81 | 8.6 | 1.14 | 30 |
| 0 | 1 | 100% | 99 | 6.4 | 0.79 | 32 |
| 0 | 3 | 30% | 24 | 7.6 | 1.00 | 53 |
| 0 | 3 | 70% | 84 | 7.2 | 0.93 | 43 |
| 4 | 3 | 30% | 23 | 7.7 | 1.00 | 54 |
| 4 | 3 | 70% | 85 | 7.1 | 0.93 | 42 |

정답률 70% 손님별(중앙 막/문제 수, 승률): 혼자 — defamation-truth 18/14 71%, beccaria 8/7 87%, pomodoro 6/6 95%. 셋 — 15/14 71%, 6/7 74%, 5/6 93%.
실제 숫자(`node tools/sim/hp.mjs`): beccaria 혼자 사서 157/39, 적 120/140·120/80·120/80. 셋이면 적 91~140.

## 7. 시뮬 실행
```
npm install                              # playwright-core
node tools/sim/balance.mjs               # 표 출력 (1~3분)
N=100 CFG='[[0,1]]' node tools/sim/balance.mjs
HPO='{"enemyHpPerQ":{"1":2.2,"2":2.2,"3":2.4}}' node tools/sim/balance.mjs   # 값 바꿔 보기 (코드 수정 없이)
node tools/sim/hp.mjs                    # 손님별 실제 체력·흐트러짐·주사위 수
```
- AI는 단순(사서 주사위마다 쓸 수 있는 가장 센 카드, 그 주사위를 노린 적 주사위와 합 → 사서를 노린 적 주사위 → 체력 낮은 적). 사람·더 공격적인 AI 는 30% 승률이 더 높게 나온 적이 있다(약 0.47). 시드 고정.
- `CFG` 의 첫 값은 기프트 수(0 없음 / 4 보통 / 8 많음+세트), 둘째는 사서 수.

## 8. 테스트
```
npm install
npx playwright-core install chromium     # 시스템 Chrome 이 없을 때만
node tests/run.mjs                       # 전부(겹침 검사 포함). npm test 도 같음
node tests/run.mjs mbdata mbresolve      # 이름 일부로 골라서
NO_OVERLAP=1 node tests/run.mjs          # 겹침 검사 빼고(빠름)
JOBS=2 node tests/run.mjs                # 동시 실행 수 (기본 4)
```
- `LIB_ROOT`(기본 저장소 맨 위)의 `index.html` 을 테스트마다 로컬 서버로 띄운다. 브라우저는 `tests/lib/browser.mjs`: `CHROME_PATH` → `/usr/bin/google-chrome` → `/usr/bin/chromium` → macOS Chrome → `channel:"chrome"` → playwright 기본 chromium.
- 스크린샷·로그는 `shots/`(git 에 안 올림), 로그 `shots/test-logs/<이름>.log`.
- 지금 테스트 파일은 `tests/*.test.mjs` 38개 + `tests/overlap-check.mjs` = 39개(UI·학습내용 담당 것 포함). 새 테스트는 `tests/` 에 `이름.test.mjs` 로 넣으면 `run.mjs` 가 자동으로 집는다. 맨 위에서 `import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs"` 를 쓰고 `executablePath` 는 적지 않는다.
- 전투 쪽 주요 테스트: `mbdata`(체력 공식·1:1 값·문제 순서·벌점·스케일·저장 v2·간이 시뮬 승률), `mbresolve`(교환 이벤트·합 단계 필드 경우마다·Promise 흐름), `multibattle`(유닛 필드·한 막 진행), `hpstatus`, `evade`, `emotion`, `unassign`, `sim`(1:1 시뮬). 겹침: `overlap-check.mjs`(10화면, issues 0 이어야 함).

## 9. 배포
1. `git pull --rebase origin main`(다른 봇이 동시에 올림)
2. `node tests/run.mjs` 전부 통과 + 겹침 10화면 issues 0
3. `index.html` 을 바꿨으면 빌드 마커 `<meta name="build" content="library-YYYYMMDDX">` 를 main 의 마지막 다음 글자로(같은 날 a, b, … z, za, zb …). 푸시 **직전** main 마커를 다시 확인해 겹치지 않게. 문서·테스트만이면 마커 그대로
4. `git push origin <브랜치>:main` → GitHub Pages(https://koonyang.github.io/concept-library/)에서 `curl -s "…/?cb=$(date +%s)" | grep library-` 로 마커 확인(1~2분)

## 10. 남은 일
- `gimmick.extraUnits`(분신·소환) 실제 생성 로직: 상태판 표시(`mbExtrasOf` 등)만 있고 엔진에서 유닛을 만들지 않음. 연결은 `parentId`.
- 손님별 막별 조건(기믹) 문서 `docs/gimmicks.md` 작성과 구현(`MB_HOOKS` 로 붙이는 형태 예정).
- 1:1 은 레벨 제거 후 HP 100/26 고정 — 1:1 밸런스 재점검은 안 함.

## 11. 알려진 문제
- `moon.test.mjs` 의 "책갈피 서랍 … 바깥 탭으로 닫힘 1440x900" 은 컴퓨터가 바쁠 때 350ms 안에 안 닫혀 가끔 실패(타이밍). 혼자 다시 돌리면 통과.
- 정답률 70% 에서 막÷문제 수가 0.8~1.2 인 판은 30~43% 정도가 한계(±1막이 ±15% 라 분산이 큼). 중앙값은 0.93~1.14. PACE 를 켜면 올라가지만 큐 양 결정으로 꺼 둠.
