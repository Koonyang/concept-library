# 개념의 서고 (concept-library)

Library of Ruina에서 영감을 받은 **공부용 웹 게임**이다. 사용자(큐 양, 대학 신입생)가 인강에서 약한 개념을
"손님(guest)"으로 만들고, 사서(플레이어)가 퀴즈를 맞히며 주사위 합으로 싸워 손님을 책으로 만든다.
빌드 도구 없는 정적 사이트. 배포는 GitHub Pages(`main` 브랜치 루트).

**2026-11-18 UI 전면 교체 중.** 옛 화면·외관은 전부 내리고 `legacy/`에 보관했다(게임은 안 읽음). 규칙·데이터·전투 엔진·저장은
`js/core/`(화면 없음)로 떼었고, `index.html`은 코어만 싣는 빈 껍데기다. 새 UI는 `Game`(`js/core/api.js`)만 불러 그린다.
- `js/core/data.js` 층·손님·문제·책장·핵심 책장·기프트·수치 / `engine.js` 1:1 엔진·채점·책 표지 경로 / `save.js` 저장·책·덱 /
  `battle.js` 다대다 엔진 / `moon.js` 달의 계시 규칙(`MoonCore`) / `api.js` `Game`·`__studyGame`. 일반 `<script>` 순서대로 싣는다(전역 공유).

- 저장소: https://github.com/Koonyang/concept-library
- 라이브: https://koonyang.github.io/concept-library/

## 꼭 지킬 규칙 (큐 양이 정함, 전체 목록은 docs/decisions.md)
1. **Project Moon(Library of Ruina·Limbus Company) 에셋 금지.** 그림·아이콘·폰트·소리 전부. 큐 양이 직접 준 그림은 써도 된다.
   새 에셋은 출처·라이선스를 `CREDITS.md`, `LICENSES.md`에 적는다.
2. **빠른 템포, 막는 팝업 금지.** 확인창·모달 대신 화면 안에서 바로 바뀌게. 연출은 탭=빨리 감기, 길게 누르기=건너뛰기.
3. **모바일 가로가 기본.** 기준 844×390. 세로(390×844)도 지원하되, 따로 말이 없으면 가로에 한 변경을 세로에도 똑같이 한다.
4. **미니멀하지만 싸구려처럼 보이지 않는 UI.** 세리프/궁서체 금지, 모던 산세리프(Pretendard·Space Grotesk).
5. **전투 정보 UI끼리 겹치면 안 된다**(주사위, 체력·흐트러짐 막대, 대상 화살표, 손패, [개막] 버튼, 상태판).
   무대·캐릭터는 배경층이라 화면 맨 아래까지 깔리고 UI 뒤로 가도 된다. 캐릭터 크기는 키우지 말고 여백으로 정리한다.
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
- 테스트: `npm install` 후 `node tests/run.mjs`(= `npm test`). 지금은 규칙 테스트 4개(`core`, `libs`, `mbdata`, `sim`)만 있다. 옛 화면 테스트·겹침 검사는 `legacy/tests/`(참고용, 안 돔). 골라 돌리기 `node tests/run.mjs core mbdata`. 브라우저는 `tests/lib/browser.mjs`가 찾는다(`CHROME_PATH` 우선). 자세한 건 `docs/battle.md`.
- 밸런스 시뮬레이션: `npm run sim`(`tools/sim/balance.mjs`), 체력표 `npm run sim:hp`(`tools/sim/hp.mjs`).
- 겹침 검사(새 UI에 맞춰 다시 만들 것, 옛 것은 `legacy/tests/overlap-check.mjs`): 전투 UI끼리(주사위·체력/흐트러짐 바·화살표·손패·[개막]·상태판) 겹침은 0건이어야 하고, 하나라도 있으면 배포하지 않는다. 캐릭터와 앞쪽 UI를 보는 `fighter-front-ui`는 참고용이다. `tests/overlap-check.mjs`가 개수만 따로 출력하고 실패로 치지 않는다(무대·캐릭터는 배경층). 배포 전 844×390·390×844 스크린샷을 직접 눈으로 본다.

## 배포
1. `git pull --rebase origin main`
2. `index.html` 7번째 줄 `<meta name="build" content="library-YYYYMMDD?">`의 표시를 다음 빈 글자로 올린다.
   같은 날은 a…z 다음 za, zb …(예: `library-20261118zm` 다음은 `zn`). 날짜가 바뀌면 `library-<새 날짜>a`.
   `git log origin/main`에서 가장 최근 `[library-…]`를 확인하고, 다른 작업자와 같은 글자를 쓰지 않는다.
3. 커밋 메시지는 한국어, 사용자 입장에서 바뀐 점을 적고 끝에 `[library-…]`. 문서만 바꿀 때는 표시를 올리지 않는다.
4. `git push origin main` → GitHub Pages가 1~2분 뒤 반영. `js/core/*.js`는 캐시 버스터가 없으니 확인할 때 강력 새로고침.

## 문서
- `docs/HANDOFF.md` — 전체 개요, 파일 지도, 게임 흐름, 현재 상태, 남은 일 (먼저 읽기)
- `docs/decisions.md` — 큐 양이 정한 규칙 전부 (주제별, 날짜)
- [`docs/battle.md`](docs/battle.md) — 전투 엔진·수치·저장 형식·시뮬레이션 (전투/시스템)
- `docs/ui.md` — 옛 UI 설명(`legacy/`). 1절 규칙만 새 UI에도 적용
- `legacy/README.md` — 보관한 옛 화면·에셋·테스트
- `docs/content.md` — 손님·문제·단어 데이터, 새 손님 추가 순서 (학습내용)
