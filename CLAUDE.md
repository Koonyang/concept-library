# 개념의 서고 (concept-library)

Library of Ruina에서 영감을 받은 **공부용 웹 게임**이다. 사용자(큐 양, 대학 신입생)가 인강에서 약한 개념을
"손님(guest)"으로 만들고, 사서(플레이어)가 퀴즈를 맞히며 주사위 합으로 싸워 손님을 책으로 만든다.
빌드 도구 없는 정적 사이트. 배포는 GitHub Pages(`main` 브랜치 루트).

**2026-11-18 새 UI: 로우폴리 3D 전투 무대.** 옛 화면은 `legacy/`에 보관(게임은 안 읽음). 세 층으로 나뉜다:
`js/core/`(규칙·데이터·엔진·저장, 전역 `Game`, 화면 없음) / `js/stage/`(three.js 무대, 규칙 모름) / `js/ui/`(DOM 화면, `Game`과 무대를 부름).
화면·무대 설명은 `docs/ui.md`, 역할 나눔(전투·학습내용·3D 무대·UI)은 `docs/ui.md` 7절.
- `js/core/data.js` 층·손님·문제·책장·핵심 책장·기프트·수치 / `engine.js` 1:1 엔진·채점·책 표지 경로 / `save.js` 저장·책·덱 /
  `battle.js` 다대다 엔진 / `moon.js` 달의 계시 규칙(`MoonCore`) / `api.js` `Game`·`__studyGame`. 일반 `<script>` 순서대로 싣는다(전역 공유).

- 저장소: https://github.com/Koonyang/concept-library
- 라이브: https://koonyang.github.io/concept-library/

## 꼭 지킬 규칙 (큐 양이 정함, 전체 목록은 docs/decisions.md)
1. **빠른 템포, 막는 팝업 금지.** 확인창·모달 대신 화면 안에서 바로 바뀌게. 연출은 탭=빨리 감기, 길게 누르기=건너뛰기.
2. **모바일 가로가 기본.** 기준 844×390. 세로(390×844)도 지원하되, 따로 말이 없으면 가로에 한 변경을 세로에도 똑같이 한다.
3. **미니멀하지만 싸구려처럼 보이지 않는 UI.** 세리프/궁서체 금지, 모던 산세리프(Pretendard·Space Grotesk).
4. **전투 정보 UI끼리 겹치면 안 된다**(주사위, 체력·흐트러짐 막대, 대상 화살표, 손패, [개막] 버튼, 상태판).
   무대·캐릭터는 배경층이라 화면 맨 아래까지 깔리고 UI 뒤로 가도 된다. 캐릭터 크기는 키우지 말고 여백으로 정리한다.
5. 새 에셋(그림·소리 등)은 출처·라이선스를 `CREDITS.md`, `LICENSES.md`에 적는다.
6. 큐 양이 정한 규칙을 바꿀 때는 먼저 물어본다. docs/decisions.md에 없는 새 결정은 그 파일에 한 줄로 추가한다.

## 실행
```
python3 -m http.server 8000   # 저장소 루트에서. 그다음 http://localhost:8000/
```
- 옛 게임은 http://localhost:8000/legacy/ 에서 그대로 볼 수 있다.
- 전투는 다대다(`Game.battle`). 1:1 엔진(`resolveScene`)은 코어에 남아 있지만 화면은 없다.
- 저장: `localStorage["concept-library-game-v1"]`(`SAVE_KEY`). 콘솔 디버그 핸들: `window.__studyGame`
  (`battleApi`, `engine`, `data`, `gifts`, `libs`, `moon` …).

## 테스트
- Playwright(`playwright-core`) + 시스템 Chrome으로 로컬 서버를 띄워 화면을 찍고 검사한다.
- 작업 중엔 `node tests/run.mjs --changed`(origin/main 이후 바뀐 파일에 맞는 테스트만, `--dry` 면 고르기만). 배포 전엔 전부.
- 화면 확인: `node tools/shot.mjs [floors|library|moon|battle|assign|aim|resolve|faces|outfit:<id>|deploy] [--size land|port|both]` → `shots/shot/*.png` 를 Read. 일회용 Playwright 스크립트를 새로 쓰지 말고 이것부터.
- 테스트: `npm install` 후 `node tests/run.mjs`(= `npm test`): core, libs, mbdata, sim, assets, stage, ui, app, library, moon, landscape, overlap-check(기본 2개씩 동시 실행, 약 7분). 옛 화면 테스트는 `legacy/tests/`(참고용, 안 돔). 3D는 `--use-gl=swiftshader`로 그려 느리다. 골라 돌리기 `node tests/run.mjs core mbdata`. 브라우저는 `tests/lib/browser.mjs`가 찾는다(`CHROME_PATH` 우선). 자세한 건 `docs/battle.md`.
- 밸런스 시뮬레이션: `npm run sim`(`tools/sim/balance.mjs`), 체력표 `npm run sim:hp`(`tools/sim/hp.mjs`).
- 겹침 검사 `tests/overlap-check.mjs`(새 UI 기준): 전투 UI끼리(주사위·체력/흐트러짐 막대·화살표·손패·[개막]·상태판·문제) 겹침은 0건이어야 하고, 하나라도 있으면 배포하지 않는다. 무대·캐릭터는 배경층이라 세지 않는다. 배포 전 844×390·390×844 스크린샷을 직접 눈으로 본다.
- 캐릭터 에셋 다시 만들기: `npm run assets:characters`(KayKit 원본을 받아 줄임).

## 배포
스킬 **`/deploy`**(`.claude/skills/deploy/SKILL.md`)를 따른다: 전체 테스트·겹침 0건 → `node tools/shot.mjs deploy` 스크린샷 보기 →
`node tools/deploy/next-build.mjs --write`(index.html build 표시를 서울 날짜 기준 다음 글자로) → main 에 합쳐 push → 검수함 갱신.
- 커밋 메시지는 한국어, 사용자 입장에서 바뀐 점, 끝에 `[library-…]`. 문서만 바꿀 때는 표시를 올리지 않는다.
- **검수함**(큐 양이 대화를 자주 지워서 꼭 한다): https://claude.ai/artifact/9sgvnqxxCFKEZ6g48XKBHs 의 db(`ArtifactData`).
  작업 브랜치에 올린 변경은 `updates/<id>`={…, build:"작업 브랜치", live:false} 로 먼저 적어 두고, 배포 때 라이브 문서로 옮긴다. 형식은 스킬에.

## 문서
- `docs/HANDOFF.md` — 전체 개요, 파일 지도, 게임 흐름, 현재 상태, 남은 일 (먼저 읽기)
- `docs/decisions.md` — 큐 양이 정한 규칙 전부 (주제별, 날짜)
- [`docs/battle.md`](docs/battle.md) — 전투 엔진·수치·저장 형식·시뮬레이션 (전투/시스템)
- `docs/ui.md` — 새 UI·3D 무대·전투 화면·테스트·역할 (UI/UX·3D 무대)
- `docs/superpowers/` — 이번 새 UI 설계(specs)와 작업 계획(plans)
- `legacy/README.md` — 보관한 옛 화면·에셋·테스트
- `docs/content.md` — 손님·문제·단어 데이터 자세한 설명 (학습내용)
- 새 강의 넣기: 스킬 `/add-lecture`(`.claude/skills/add-lecture/SKILL.md`) + 빠른 검사 `npm run check:content [손님id]`
