# 개념의 서고 — 전투/시스템 인수인계

전투 엔진(1:1, 다대다)과 저장 데이터, 밸런스, 테스트·시뮬 실행법. 화면 쪽은 `docs/ui.md`, 학습내용(손님·문제·적 무리 데이터)은 `docs/content.md`, 전체 그림·결정 기록은 `CLAUDE.md`, `docs/HANDOFF.md`, `docs/decisions.md` 를 본다.
규칙 코드는 `js/core/`(`data.js`·`engine.js`·`save.js`·`battle.js`·`moon.js`·`api.js`, 화면 없음, 일반 `<script>` 로 전역 공유). 공개 API 는 `api.js` 의 `Game`(3절). 아래 위치는 **함수/상수 이름**으로 적는다(줄번호는 자주 바뀜). 무대 그리기는 3D 무대 `js/stage/stage.js`(옛 `BattleStage` 는 `legacy/`).

## 1. 확정 규칙 (바꾸려면 큐 양 확인)

| 규칙 | 내용 | 코드 |
|---|---|---|
| 주사위 변동은 퍼센트 | 정답: 사서 주사위 양 끝 × (1 + right 0.20, 핵심 문제 keyRight 0.30) + 감정 단계 × emotionPer 0.05, 손님 −guestRight 0.20. 오답: 사서 −wrong 0.20(핵심 −keyWrong 0.30), 핵심 문제 오답일 때만 손님 +guestKeyWrong 0.20. 반올림, 변동 최소 1, 하한 1 | `COMBAT.pct`, `pctEnd`, `pctRange`, `playerDieRange`, `guestDieRange` |
| 정답 흐트러짐 배율 | 정답이면 사서→적 흐트러짐 피해 ×1.25(핵심 ×1.75). 적→사서는 ×1. 1:1·다대다 같음 | `COMBAT.correctStagger`, `COMBAT.keyCorrectStagger`, `resolveScene`(stMul) |
| 적 최대 3명 | 기본 `MB.ENEMY_MAX`=3. `guest.enemyMax`(1~5) 또는 `guest.manyEnemies===true`(→`MB.maxEnemies` 5)만 예외. 넘치면 우두머리는 남기고 나머지를 앞에서부터. 빠진 적의 문제는 남은 적에게 | `mbEnemyCap`, `mbCreate` |
| 기믹 추가 유닛(예정) | 분신·소환은 `gimmick.extraUnits`, 각 유닛 `parentId`(본체 id)로 연결. 상태판은 본체 줄에만 표기 | `mbParentId`, `mbGimmickExtras`, `mbIsExtraUnit`, `mbExtrasOf` |
| 문제 순서 | 처음엔 모든 문제를 한 번씩(살아 있는 적의 문제 먼저, 죽은 적의 문제는 산 적이 대신 냄) → 그다음 틀린 문제부터(틀린 순서) → 나머지 순환. 바로 앞 막과 같은 문제 반복 없음 | `mbNextQid`, `mbQOwner`, `mbPickQuestion`, `mb.qs` |
| 오답 막 벌점 | 다대다 전용. 오답 막에 사서가 받는 피해 체력 ×`MB.WRONG.hp`(2.3), 흐트러짐 ×`MB.WRONG.st`(2). `COMBAT.pct` 는 건드리지 않음 | `MB.WRONG`, `resolveScene`(pTaken) |
| 레벨 없음 | 사서 레벨·경험치 제거. 성장은 책장·핵심 책장(장서복)·기프트만. 1:1 사서 HP 100·흐트러짐 26 고정(+기프트·장서복) | `COMBAT.playerStartHp`, `COMBAT.playerStagger`, `playerStaggerMax`, `effectiveMaxHp` |
| PACE 꺼짐 | 판 길이 보정 hold(우두머리 버팀)·drain(양쪽 체력 감소)는 따로 켜는 스위치, 둘 다 기본 `false`. 밸런스는 HP만으로 | `MB.PACE`, `mbPaceHold`, `mbPaceDrain` |
| 피해 = 주사위 값 | (2026-11-19) 숨은 배율 없음. 체력 피해 = `max(1, floor(값 × TIER[상성] × 이름 있는 보정))`. 보정은 상성 TIER(흐트러진 동안 치명 ×2), 사서→적 기프트·장서복 `dmgPct`, 적→사서 오답 막 `MB.WRONG`, 방어에 막히면 차이만. 정답/오답은 주사위 범위(`COMBAT.pct`)로, 흐트러짐은 정답 배율·`staggerPct`. 체력·흐트러짐도 주사위 단위(예전 `MB.SCALE_ENEMY` 1명 20·2명 10·3명 7 없앰) | `resolveScene`, `hitUnit`, `mbResolveNext` |
| A안: 적 하나 3~4방 | 사서가 적을 때린 한 방(체력 피해) 중앙값 ≈ 그 적 최대 체력의 25~30%, 체력이 가득한 적이 한 방에 쓰러지는 비율 ≤5%. 숫자 크기는 사서 쪽 너프로 맞춤(사서 157/39 → 100/24, 사서 수 배율 `allyParty`) | `MB.HP`, `tools/sim/balance.mjs`(한 방 중앙·한 방 사망 열) |

## 2. 엔진 구조

### 1:1 (기존 접대)
- 한 막 = `runScene(o)` → 합 풀기는 `resolveScene(o)`. 화면은 `renderBattle`, 결과는 `showWin`/`showLose`.
- `resolveScene({P,G,pDice,gDice,correct,isKey,rng,mods,emotion, dmgScale?,pScale?,pTaken?,stMul?,pRangeFn?,gRangeFn?})` → `steps[]`.
  두 쪽 주사위를 포인터로 맞붙인다. 공격 대 공격은 큰 쪽이 그 값만큼 때림, 방어는 차이만큼 줄여 받거나(지면) 상대 흐트러짐(이기면), 회피는 공격 주사위를 상대로 이기면 흐트러짐 회복, 이기거나 **비기면 주사위가 남아** 다음 상대 주사위와 다시 합(`keeps`, 다음 단계 `reused`), 지면 깨진다.
  상대 주사위가 떨어질 때 남아 있던 회피는 `steps.heldP`/`steps.heldG`(책장 안 주사위 번호, 없으면 null)로 돌려준다. `o.pHeld`/`o.gHeld`(번호)를 주면 그쪽은 그 회피 주사위 하나만으로 처음부터 `reused` 로 맞선다(책장의 다른 주사위는 안 굴림).
  각 step: `{pd:{type,roll,reused,keeps}|null, gd:{…}|null, outcome:"P"|"G"|"tie"|"none", events:[{kind:"hit"|"stag"|"recover",target:"P"|"G",hp,st,newStag,…}], newStag:[], pRange, gRange, pIdx, gIdx, snap}`.
  `pTaken` 은 다대다 오답 막만 넘긴다. `dmgScale`/`pScale` 은 옵션으로만 남아 있고 지금은 아무도 안 넘긴다(=1).
- 피해 계산: `hitUnit`(저항 `TIER`·`resTier`), `stagOnly`, `recoverSt`. 손님 키트: `guestCombat`(`ARCH_COMBAT` + `GUEST_COMBAT` + `GUEST_SCALE`).

### 다대다 (기본 모드, `?multi=0` 이면 1:1)
막 순서: `question` → `assign` → `resolve` → 다음 막 또는 `end`. 상태는 `mb`(전역), 공개 모양은 `window.__studyGame.battle`(= `mb.battle`).

| 단계 | 함수 |
|---|---|
| 설정값 | `MB` (`HP`, `DICE`, `PACE`, `WRONG`, `ENEMY_MAX`, 속도 등), 기믹 훅 `MB_HOOKS` |
| 체력 | `mbQuestionCount`, `mbEnemyHpTotal`, `mbEnemyQ`, `mbEnemyCtx`, `mbAllyStats`, `enemyStats` |
| 만들기 | `mbCreate`(사서·적 유닛, 적 수 상한 `mbEnemyCap`, 몸 `enemyBody`/`ENEMY_BODY`), `mbQuestionPool`, 적 유닛 `model`(= `enemies[i].model`, 겉모습 전용, 없으면 null) |
| 막 시작 | `mbStartScene`(주사위 굴림 `mbRollDice`, 적 목표 `mbRelink`, 문제 `mbPickQuestion`/`mbNextQid`/`mbPrepQ`) |
| 문제 | `mbAnswer`(정답이면 감정 `mbCharge`), 화면 쪽 `mbAnswerUI`, `mbShowQuestion` |
| 배치 | `mbAssign`, `mbUnassign`, `mbIsClash`, `mbUsable`, `mbCardInfo`, `mbQState` |
| 풀기 | `mbResolveBegin` → `mbResolveNext`(교환 하나: `resolveScene` 호출 → 단계 필드 붙이기) → `mbResolveEnd`. 한 번에: `mbResolve`. 연출 포함: `mbRunResolve`(교환마다 `BattleStage.clash(ev,{fast})` Promise 를 기다림) |
| 끝 | `mbFinish`(승: 책 획득·첫 정복 기록, 패: phase lose) |
| 화면 연결 | `beginMultiReception`, `mbRefresh`, `mbStageOpts`, `mbPaintStats`, `mbStatRow`, `mbShowStepEvents` |

### 다대다 체력 공식 (`MB.HP`, 지금 값)
모든 숫자는 주사위 단위(숨은 배율 없음, 2026-11-19).
- 사서: `hp = round(allyHp × clamp(문제 수 / qRef, qMin, qMax) × allyParty[사서 수−1]) + 기프트·장서복 hp`, `st = round(allySt × allyParty[사서 수−1])`. allyHp 100, allySt 24, allyParty [1, 1.25, 1.55], qRef 7, qMin 0.85, qMax 2. (전: 157 / 39, 사서 수 배율 없음)
- 적 무리 전체 = `enemyHpPerQ[weakness] × 문제 수 × party[사서 수−1] × (1 + floorStep × 층 순서)`. enemyHpPerQ {1:4, 2:4, 3:4.4}, party [1, 1.2, 1.25], floorStep 0.05. (전: {1:2.07, 2:2.07, 3:2.28}, [1, 2.05, 3.2], 그 위에 ×SCALE_ENEMY)
- 적 하나: `hp = max(minHp 6, round(전체 × 그 적의 문제 수 / 전체 문제 수))`, 흐트러짐 = `max(minSt 4, round(hp × leaderSt 1.1 | followerSt 0.7))`.
- 적 주사위: 손님 키트 값을 `MB.DICE.scale[weakness] × partyScale[사서 수−1] / GUEST_SCALE[weakness]` 로 다시 맞춤(scale {1:1.15, 2:1.15, 3:1.32}, partyScale [0.55, 0.9, 1.25] (전 [1, 1.1, 1.2]), 큰 공격 ×bigScale 0.9). 주사위 수: 우두머리 `leaderDice[w] + partyLeader`, 부하 `1 + partyFollower`.

### 기믹 책장·상태 (2026-11-23)
책장(사서 `COMBAT_PAGES`·적 `GUEST_COMBAT[손님].pages/big`)에 선택 필드를 붙이면 숫자 말고 효과가 생긴다. 정의·처리는 `js/core/battle.js` 머리(`MB_STATUS`, `mbGive`, `mbStatusStart/End`, `mbPowerOn`)와 `mbResolveNext`.
- `fx:[{on, give, n, to}|{on, light}]` — 교환 하나가 끝난 뒤 발동. `on`: `use`(굴림) · `hit`(상대 체력 피해) · `win`/`lose`(합 승패). `to:"self"` 면 자기, 아니면 상대.
- `power:{when, n, add}` — 조건이 맞으면 그 책장 주사위 모두 +add. `when`: `emotion`(감정 n 이상) · `lastFoe`(살아 있는 상대 하나) · `foeBleed`(상대 출혈).
- `counter:true` — 반격(사서만). 대상을 두지 않고(`ready()` 통과, 끌기 안 됨) 막 시작에 "남은 회피" 자리에 놓여, 그 사서를 일방 공격하는 교환에만 맞선다(`ev.counter`).
- 상태 `u.status=[{id,stacks,pending}]`(최대 10): 출혈 `bleed`(바로, 공격 주사위를 굴릴 때마다 그만큼 체력 −, 1/3 감소, 막 끝 1/3 감소) · 다음 막에 켜지는 것: 마비 `para`(주사위 n개 최솟값) · 힘 `str`/허약 `feeble`(공격 주사위 ±) · 보호 `prot`/무방비 `frag`(맞을 때 체력 피해 ±, `hitUnit` 의 `m.flat`) · 신속 `haste`/속박 `bind`(속도 주사위 ±, 최소 1).
- 교환 이벤트에 `ev.fx=[{unit,kind:"bleed",hp}|{unit,kind:"give",status,n}|{unit,kind:"light",n}]`. API: `Game.battle.status(uid)`, `statusInfo`, `give(uid,id,n)`, `isCounter(uid,i)`, `cardInfo` 의 `counter`·`gimmick`.

## 3. 공개 API `Game` (`js/core/api.js`)

새 UI는 `window.Game` 만 부른다. 부른 다음 `Game.save`, `Game.battle.state`(= `mb.battle`) 를 읽어 그린다.
옛 `window.__studyGame.battleApi`(아래 3-3)는 **테스트·시뮬용으로 남김**(`tools/sim`, `tests/mbdata`·`sim` 등이 쓴다). 새 화면은 쓰지 않는다.

### 3-1. `Game.battle` (다대다 접대)
| 이름 | 인자 → 반환 |
|---|---|
| `begin(guestId, {rng, party}?)` | 접대 시작(덱 검사·접대 기록 `reception`·1막 시작·저장) → `{ok:true, battle}` 또는 `{ok:false, why}` |
| `answer(correct)` | 이번 막 답(bool). 문제 단계가 아니면 false. 주관식 판정은 `Game.checkShort` 로 먼저 |
| `question()` | 이번 막 문제 객체(단계와 상관없이) \| null |
| `questionInfo()` | **문제 단계일 때만** `{q, fromUnit, isKey}`: 문제, 그 문제를 낸 적 유닛 id(`battle.question.fromUnit`), 핵심 문제 여부(`mb.cur.isKey`). 아니면 null |
| `lightOf(unitId)` | `{light, maxLight, emotion}`(손패 위 빛·감정 표시용, 배치·해제에 따라 바뀜). 전투가 없거나 없는 유닛이면 null. 적은 모두 0 |
| `assign(unitId, dieIdx, cardId, {unit, die\|null})` | → `{ok, clash}` 또는 `{ok:false, reason:"phase"\|"unit"\|"die"\|"card"\|"not-in-hand"\|"emotion"\|"light"\|"target"\|"target-die"}` |
| `unassign(unitId, dieIdx)` | → bool (카드 손패로, 빛 환불) |
| `resolve({holdNextScene}?)` | 막을 한 번에 끝까지 → 교환 이벤트 배열(4절). 끝나지 않았으면 다음 막을 연다(`holdNextScene` 이면 안 엶). 배치 단계가 아니면 null |
| `stepBegin()` | 개막을 한 교환씩: 배치 단계면 진행 객체 `R`, 아니면(문제 단계 등) null |
| `stepNext(R)` | 교환 하나를 처리하고 그 이벤트 `ev` 를 돌려준다(상태는 이미 반영). `kind:"skip"`(흐트러짐·사망으로 못 움직인 주사위)도 나오니 화면은 건너뛴다. 더 없으면 null. 화면은 `ev` 를 `stage.play(ev,{fast})` 에 넘기고 기다린다 |
| `stepEnd(R)` | 막 마무리(승패 판정·막 끝 훅). 끝나지 않았으면 다음 막을 연다. 결과는 `resolve()` 와 같다(테스트로 확인) |
| `settle()` | 승패가 난 뒤 한 번: 회상 기록·사서별 E.G.O 기프트 판정·체력 회복·저장 → `{won, guestId, isRecall, bookGain, books, gifts:[{libId, libName, item}], correct, total, explanation}`. 두 번 불러도 같은 객체 |
| `leave()` | 전투 비움 |
| `cardInfo(cid, uid)` / `usable(uid, cid)` / `hand(uid)` / `isClash(u, i)` / `unit(id)` | 카드 표시 정보 / 사용 가능 `{usable, reason}` / 손패 id / 합 여부 / 유닛 |
| `enemyBody(gid, e)` / `nextGuest(gid)` / `hooks` | 적 몸 / 다음 손님 / `MB_HOOKS` |
| `state` / `outcome` / `log` / `reception` | `mb.battle` / "win"\|"lose"\|null / 기록 / 접대 기록 |

### 3-2. 그 밖의 `Game.*`
| 이름 | 내용 |
|---|---|
| `Game.checkShort(input, q)` | 주관식 채점(`engine.js` `checkShort` 그대로). `q.answer`·`q.accept[]` 와 비교, 대소문자·공백·기호 무시, 답을 포함한 짧은 문장도 정답(숫자 경계 확인). 빈 답 false |
| `Game.data.floorStage(floorId)` | 층 무대 겉모습 `{mood, accent, props[]}`. `FLOORS[].stage` 한 줄에서 읽고 빈 칸은 기본값(`lamp`, `#d9a35a`, `["candles","bookpile"]`). 없는 층도 기본값. 무대 `S.setFloor()` 에 그대로 넘긴다 |
| `Game.data.*` | `FLOORS`, `WEAK_POINTS`, `GUEST_BY`, `COMBAT_PAGES`, `PAGE_BY`, `KEY_PAGES`, `EGO_GIFTS`, `KEY_QUESTIONS`, `BOOK_POOLS`, 수치(`DECK_MIN` 등), `bookCoverSrc` … |
| `Game.books` / `Game.deck` / `Game.libs` | 책 소각·보유 / 덱 편성 / 사서·장서복·기프트 착용 |
| `Game.moon`, `Game.moonBonus()` | 달의 계시(`MoonCore`) |
| `Game.save`, `Game.persist()`, `Game.setAudio(o)`, `Game.reset()` | 저장 |

### 3-3. `__studyGame.battleApi` (테스트·시뮬용으로 남김)

| 이름 | 인자 → 반환 |
|---|---|
| `enable(on)` / `enabled()` | 다대다 켜기(저장) → bool |
| `begin(guestId, {rng}?)` | `Game.battle.begin` 과 같고 `battle` 을 돌려줌(실패면 null) |
| `create(guestId, {rng, party}?)` | 덱 검사 없이 만들고 1막 시작 → `battle` |
| `startScene()` / `nextScene()` | 다음 막(시뮬용 `nextScene` 은 끝났으면 null) → `battle` |
| `answer(correct)` | 이번 막 답 |
| `assign(…)` / `unassign(…)` | `Game.battle` 과 같음 |
| `resolve()` / `resolveOnly()` | 막 풀기 / 다음 막을 열지 않고 풀기 → 교환 이벤트 배열 |
| `resolveBegin()` / `resolveNext(R)` / `resolveEnd(R)` | 한 교환씩(코어 그대로. `resolveEnd` 는 다음 막을 열지 않음) |
| `usable(uid, cid)` / `cardInfo(cid, uid)` | 카드 사용 가능 여부·범위 등 |
| `isClash(u, i)` / `relink()` / `setEnemyTarget(eid, k, target)` | 합 여부 / 적 목표 다시 / 적 목표 지정(테스트) |
| `setRng(fn)` | 난수 교체 |
| `hand(uid)` / `cardOf(cid)` / `internals()` / `mb` / `outcome` / `current` | 손패 id / 카드 / `mb.x`(유닛별 내부: `cu`, `mods`, `handIds`, `diePages`, `e`, `S`) / 전체 상태 / "win"\|"lose"\|null / `mb.cur`(`{q, isKey}`) |
| `questionCount(gid)` / `enemyCap(gid)` / `enemyHpTotal(gid, n)` | 문제 수 / 적 수 상한 / 무리 체력 |
| `allyStats(mods, gid, n?)` / `enemyStats(guest, e, idx, ctx)` | 사서 `{hp, st}`(n 사서 수, 없으면 지금 판의 사서 수) / 적 스탯. (`enemyScale` 은 2026-11-19 삭제) |
| `ENEMY_BODY`, `enemyBody(gid, e)`, `ENEMY_STATS` | 적 몸 표 / 몸 결정 / 적 key 별 덮어쓰기 |
| `MB`, `hooks` | 설정값, `MB_HOOKS` |
| `libMods`, `libStartLight`, `libStartEmotion`, `libLightRegen`, `libDeckIds` | 사서별 기프트·장서복 효과 |
| `settle()` | `Game.battle.settle` 과 같음 |

### 3-4. 훅 (`Game.battle.hooks.이름.push((mb, payload) => {})`, `battleApi.hooks` 와 같은 것)
| 훅 | payload |
|---|---|
| `onSceneStart` | `{scene}` |
| `onAnswer` | `{correct, id, isKey, fromUnit}` |
| `onAssign` | `{unit, die, card, target:{unit,die}, prev, clash}` |
| `onUnassign` | `{unit, die, card, refund}` |
| `onClash` | 합 교환 이벤트 `ev` (아래) |
| `onSceneEnd` | `{scene, events, pace}` |

## 4. 교환 이벤트 `ev` — 무대 `stage.play(ev, {fast})` 가 받는다

새 화면은 `Game.battle.stepBegin()` → `stepNext(R)` 로 교환 하나를 얻을 때마다 그 `ev` 를 3D 무대 `stage.play(ev,{fast})`(`js/stage/stage.js`, Promise)에 넘겨 기다리고, 맞는 순간에 막대·숫자를 갱신한다. 다 끝나면 `stepEnd(R)`. 엔진(코어)은 화면을 모르고 교환마다 상태를 먼저 반영해 둔다.
(legacy: 옛 UI 는 `mbRunResolve` 가 교환마다 `BattleStage.clash(ev,{fast})`(`legacy/` 의 `assets/ui/battle-stage.js`)를 부르고 Promise 를 기다렸다. 지금 코어에는 없음.)

교환 이벤트 `ev`:
- **대상 잇기**(`mbRelink`, 배치·해제마다): 적 주사위를 원래 대상으로 되돌린 뒤, 배치한 순서대로 ① 적 주사위를 노린 내 주사위가 그 주사위보다 빠르면 끌어와 합.
  ② 몸을 노린 내 주사위(`target.die=null`)는 그 적에게 **합이 안 잡힌 주사위 중 나보다 느린 것**이 있으면 그 주사위로 대상을 바꿔 끌어와 합(나를 노리던 것 → 빠른 것 순).
  없으면(모두 합 중이거나 나보다 빠르거나 흐트러짐) 몸에 일방 공격(2026-11-23, 라오루 규칙).
- `kind`: `"clash"`(서로 노린 두 주사위) | `"one-sided"` | `"skip"`(흐트러짐·사망으로 못 움직임. `stepNext`·`resolve` 결과에도 나옴)
- `a`: `{unit, die, card, values:[굴린 값…], expr, side?, body?, form?, leader?}` — 먼저 움직인(빠른) 주사위
- `b`: 같은 모양 | `null`(일방 공격), `target`: 맞는 유닛 id
- `reused:true`: **회피 재사용 교환**(2026-11-19). 합으로 남은 회피는 그 막이 끝날 때까지 그 유닛의 `x.heldEvade=[{die,idx}]`에 남는다.
  합 상대가 없는 공격(일방 공격)이 그 유닛을 노리면 남은 회피(첫 번째)가 `b`(`b.reused:true`, 그 회피를 놓았던 주사위 칸·카드)로 맞서 `kind:"clash"` 가 된다.
  이기거나 비기면 계속 남고(다음 교환에도), 지면 깨져 빠진다. 흐트러지면 쓰지 못한다. 그 유닛 자신의 주사위와 서로 노린 합은 원래 합 그대로. 막 시작·끝에 비운다.
- `result`: `{staggered:[새로 흐트러진 id], dead:[쓰러진 id]}`, `expr`: `{유닛id: "idle"|"win"|"hurt"|"shock"}`
- 예전 필드: `by, speed, ally, allyDie, enemy, enemyDie, allyCard, enemyCard, win:"ally"|"enemy"|"tie"|null, snap`
- `steps[]`: `resolveScene` step 필드(위) +
  - `aVal`, `bVal`, `winner:"a"|"b"|"tie"`, `dmg:{unit, hp, stagger}|null`(실제 적용 값 = 주사위 값 × 이름 있는 보정), `expr`
  - `aDie` / `bDie`: `{type(참격/관통/타격/방어/회피), min, max(이번에 실제 적용된 범위), value, idx(책장 안 몇 번째 주사위, 0부터), reused(회피 재사용)}` | `null`
  - `aResult` / `bResult`: `"win"|"lose"|"draw"|"block"|"evade"|"none"`. 방어가 공격을 이기면 `"block"`, 회피가 이기면 `"evade"`, 비기면 둘 다 `"draw"`, 일방 공격은 공격자 `"win"`·받는 쪽 `null`
  - `blocked`: 방어 주사위가 공격을 상대했을 때 줄어든 체력 피해(방어가 이기거나 비기면 공격 전부, 지면 방어 값 몫). 공격한 쪽 보정 그대로(사서 공격 ×(1+dmgPct), 오답 막 적 공격 ×WRONG.hp). 해당 없으면 0
  - `recovered`: 회피 성공 시 회복한 흐트러짐(주사위 값 그대로). 아니면 0

## 5. 저장 데이터
- 키 `SAVE_KEY` = `"concept-library-game-v1"`(바꾸지 않음), 기본값 `defaultSave`, 불러오기 `loadSave`, 쓰기 `persist`.
- `saveV: 2` — 사서 레벨 제거. `loadSave` 가 예전 `level`, `xp`, `exp`, `maxHp` 를 **변환 없이 삭제**하고 `saveV=2`. 다른 진행(정복, 책, 기프트, 장서복 등)은 그대로.
- 그 밖의 버전 필드: `acqV`(책 획득, `migrateAcq`), `libV`(사서별 기프트, `migrateLibrarians`/`sanitizeLibrarians`). 다대다 끄기 `multiBattle:false`.

## 6. 밸런스 기준과 최신 시뮬 결과
기준(큐 양): 정답률 70% 사서 혼자(기프트 없음) 승률 약 75~90%, 정답률 30% 혼자 ≤35%, 사서 셋 + 기프트 보통 30% ≤35%·70% 이김, 막 수 ≈ 손님 문제 수.
2026-11-19 A안 추가: 적 하나는 평균 3~4방 — 사서 한 방 중앙 ≈ 그 적 최대 체력 25~30%, 꽉 찬 적 한 방 사망 ≤5%.

2026-11-19 `node tools/sim/balance.mjs`, 손님마다 200판(한 줄 = 11손님 × 200판). 한 방 중앙 = 사서가 적을 때린 체력 피해 하나 ÷ 그 적 최대 체력의 중앙값, 방/막 = 막마다 사서가 적에게 맞힌 방 수:

| 기프트(사서당) | 사서 | 정답률 | 승률% | 평균 막 | 막/문제 중앙 | 0.8~1.2% | 한 방 중앙% | 꽉 찬 적 한 방 사망% | 방/막 |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 1 | 30% | 15 | 9.2 | 1.14 | 40 | 25 | 1.6 | 0.44 |
| 0 | 1 | 70% | 77 | 11.8 | 1.57 | 22 | 28 | 3.0 | 0.64 |
| 0 | 1 | 100% | 100 | 9.2 | 1.17 | 47 | 31 | 4.3 | 0.88 |
| 0 | 2 | 30% | 26 | 7.0 | 0.86 | 42 | 20 | 0.4 | 0.79 |
| 0 | 2 | 70% | 84 | 7.1 | 0.93 | 43 | 27 | 0.7 | 1.26 |
| 0 | 2 | 100% | 100 | 5.0 | 0.67 | 22 | 30 | 0.8 | 1.83 |
| 0 | 3 | 30% | 29 | 5.9 | 0.83 | 42 | 20 | 0.3 | 0.99 |
| 0 | 3 | 70% | 85 | 5.4 | 0.71 | 32 | 25 | 0.7 | 1.65 |
| 0 | 3 | 100% | 100 | 3.7 | 0.50 | 6 | 31 | 0.9 | 2.40 |
| 4 | 3 | 30% | 31 | 6.0 | 0.83 | 41 | 20 | 0.3 | 1.00 |
| 4 | 3 | 70% | 86 | 5.5 | 0.71 | 32 | 25 | 0.9 | 1.63 |
| 4 | 3 | 100% | 100 | 3.8 | 0.50 | 5 | 31 | 0.7 | 2.39 |

전체 한 방 중앙 27%(사분위 13~47%), 꽉 찬 적 한 방 사망 1.2%.
정답률 70% 손님별(중앙 막/문제 수, 승률): 혼자 — defamation-truth 24/14 65%, beccaria 11/7 86%, pomodoro 10/6 93%, metacognition(weakness 3) 8/6 39%. 셋 — 12/14 81%, 5/7 81%, 4/6 90%.
실제 숫자(`node tools/sim/hp.mjs`): beccaria 혼자 사서 100/24, 적 8/9·12/8·8/6. 셋이면 사서 155/37, 적 10~15. defamation-truth 혼자 사서 200/24, 적 9~32.

**A안과 막 수가 같이 안 맞는 이유(구조).** 막 수 ≈ 3.5방 × 적 수 ÷ 막당 맞히는 방 수. 사서 혼자는 시작 덱 절반이 방어·회피이고 빛이 막당 1 회복이라 막당 0.6방 정도 → A안을 지키면 막 수/문제 수 ≈ 1.5. 사서 셋은 막당 1.6방이라 ≈ 0.7. 적 체력을 반대로 움직이면 한 방 비율이 25~30% 를 벗어난다. 둘 다 맞추려면 규칙 쪽(혼자일 때 적 수·주사위 수, 시작 덱 구성 등)을 바꿔야 해서 손대지 않았다.
사서 체력이 적보다 여전히 큰 것(혼자 100 대 적 8~13)도 같은 구조: 적은 막당 사서를 1.7번 맞히고 사서는 0.6번 맞혀서, 승률을 지키려면 사서 체력 ≈ 적 하나의 8~10배가 필요하다.

## 7. 시뮬 실행
```
npm install                              # playwright-core
node tools/sim/balance.mjs               # 표 출력 (30초 남짓). 한 방 중앙%·꽉 찬 적 한 방 사망%·방/막 열 포함
N=100 CFG='[[0,1]]' node tools/sim/balance.mjs
HPO='{"enemyHpPerQ":{"1":4.2,"2":4.2,"3":4.6},"allyParty":[1,1.3,1.6]}' node tools/sim/balance.mjs   # 값 바꿔 보기 (코드 수정 없이)
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
- 전투 쪽 주요 테스트: `mbdata`(체력 공식·1:1 값·문제 순서·벌점·피해 = 주사위 값 × 이름 있는 보정·A안 한 방 중앙 25~30%·한 방 사망 ≤5%·저장 v2·간이 시뮬 승률), `mbresolve`(교환 이벤트·합 단계 필드 경우마다·Promise 흐름), `multibattle`(유닛 필드·한 막 진행), `hpstatus`, `evade`, `emotion`, `unassign`, `sim`(1:1 시뮬). 겹침: `overlap-check.mjs`(10화면). 전투 UI끼리 겹침(주사위·체력/흐트러짐 바·화살표·손패·[개막]·상태 패널)은 0건이어야 하고 하나라도 있으면 실패한다. 캐릭터와 앞쪽 UI 겹침(`fighter-front-ui`)은 참고용으로 출력만 하고 실패로 치지 않는다(무대·캐릭터는 배경이라는 결정, `docs/decisions.md`).

## 9. 배포
1. `git pull --rebase origin main`(다른 봇이 동시에 올림)
2. `node tests/run.mjs` 전부 통과 + 겹침 10화면 blocking 0 (`fighter-front-ui` 는 참고용)
3. `index.html` 을 바꿨으면 빌드 마커 `<meta name="build" content="library-YYYYMMDDX">` 를 main 의 마지막 다음 글자로(같은 날 a, b, … z, za, zb …). 푸시 **직전** main 마커를 다시 확인해 겹치지 않게. 문서·테스트만이면 마커 그대로
4. `git push origin <브랜치>:main` → GitHub Pages(https://koonyang.github.io/concept-library/)에서 `curl -s "…/?cb=$(date +%s)" | grep library-` 로 마커 확인(1~2분)

## 10. 남은 일
- `gimmick.extraUnits`(분신·소환) 실제 생성 로직: 상태판 표시(`mbExtrasOf` 등)만 있고 엔진에서 유닛을 만들지 않음. 연결은 `parentId`.
- 손님별 막별 조건(기믹) 문서 `docs/gimmicks.md` 작성과 구현(`MB_HOOKS` 로 붙이는 형태 예정).
- 1:1 은 레벨 제거 후 HP 100/26 고정 — 1:1 밸런스 재점검은 안 함.

## 11. 알려진 문제
- `moon.test.mjs` 의 "책갈피 서랍 … 바깥 탭으로 닫힘 1440x900" 은 컴퓨터가 바쁠 때 350ms 안에 안 닫혀 가끔 실패(타이밍). 혼자 다시 돌리면 통과.
- 정답률 70% 에서 막÷문제 수가 0.8~1.2 인 판은 30~43% 정도가 한계(±1막이 ±15% 라 분산이 큼). 중앙값은 0.93~1.14. PACE 를 켜면 올라가지만 큐 양 결정으로 꺼 둠.
