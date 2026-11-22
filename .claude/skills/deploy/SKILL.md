---
name: deploy
description: 개념의 서고를 GitHub Pages(main)에 배포한다 — 전체 테스트·겹침 0건 확인, 844×390·390×844 스크린샷 보기, build 표시 올리기, main 에 합쳐 push, 검수함 갱신까지. "배포해", "배포 시작", "main 에 올려", "라이브에 반영" 같은 요청에 쓴다. 문서만 바뀐 경우에도 쓰되 build 표시는 안 올린다.
---

# 배포 (CLAUDE.md "배포" 절을 한 번에)

큐 양이 배포하라고 했을 때만 main 에 push 한다. 작업 브랜치는 세션 지시를 따른다(보통 `claude/…`).

## 1. 확인 (병렬로)
```
git fetch origin main <작업브랜치>
git log --oneline origin/main..HEAD        # 올릴 커밋
git log --oneline HEAD..origin/main        # main 에 새로 생긴 것 → 있으면 먼저 merge
git status --short                          # 깨끗해야 함
```
- 테스트: `node tests/run.mjs` 전부(약 7분, `run_in_background`). 겹침 검사(overlap-check) 0건이 아니면 배포하지 않는다.
  기다리는 동안 다른 테스트를 띄우거나 브라우저 프로세스를 죽이지 않는다(swiftshader 라 타이밍 검사가 흔들림).
  실패하면 `shots/test-logs/<이름>.log` 를 보고, 흔들림이면 그 테스트만 `node tests/run.mjs <이름>` 으로 한 번 더.
- 화면: `node tools/shot.mjs deploy` → 출력된 PNG(층·도서관·계시·전투 3장면 × 가로·세로)를 Read 로 직접 본다.
  캐릭터·장서복을 고쳤으면 `node tools/shot.mjs faces outfit:<id>` 도.
- 문서만 바뀐 배포(docs/, *.md, .claude/)면 테스트·스크린샷·build 표시를 건너뛴다.

## 2. build 표시
```
node tools/deploy/next-build.mjs --write   # index.html 7번째 줄을 고치고 새 표시를 출력(서울 날짜, a…z, za…)
```
`git log origin/main` 의 `[library-…]` 까지 보고 정하므로 다른 작업자와 겹치지 않는다(먼저 fetch).

## 3. 커밋·합치기·push
- 표시 커밋: 메시지는 한국어, 큐 양 입장에서 바뀐 점을 한 줄로 모으고 끝에 `[library-…]`. 세션 지시의 Co-Authored-By 줄들.
- main 에 합치기(작업 브랜치에서 갈라진 게 없으면 fast-forward):
```
git checkout main && git pull --ff-only origin main && git merge --ff-only <작업브랜치> && git push origin main
git checkout <작업브랜치> && git push origin <작업브랜치>
```
  fast-forward 가 안 되면 `git merge --no-edit <작업브랜치>`(rebase·force push 금지). 충돌이면 멈추고 큐 양에게 묻는다.
- push 는 네트워크 오류일 때만 2·4·8·16초 간격으로 재시도.
- GitHub Pages 반영 1~2분. `js/core/*.js` 는 캐시 버스터가 없으니 확인은 강력 새로고침.

## 4. 검수함 갱신 (꼭)
검수함 https://claude.ai/artifact/9sgvnqxxCFKEZ6g48XKBHs 의 db 를 `ArtifactData` 로(페이지는 다시 올리지 않음):
1. `updates` 를 list 해서 작업 브랜치 문서(`build:"작업 브랜치"`, `live:false`)와 `status/live` 의 version 을 본다.
2. `batch` 한 번으로:
   - `set updates/<표시 뒤 글자들>`(예: `20261123a`) = `{at:<ISO 시각>, date:"MM/DD", build:"library-…", live:true, title, items:[…], check:[…]}`
     — 작업 브랜치 문서의 title·items·check 를 그대로 옮기고 이번에 더 바뀐 것만 보탠다. 사용자 말로, 짧게.
   - `delete updates/<작업 브랜치 문서 id>` (if_version)
   - `update status/live` = `{build, at:"MM/DD"}` (if_version)

## 5. 알리기
큐 양에게: 올라간 표시(`library-…`), 바뀐 점 몇 줄, 확인해 볼 것(검수함 check 와 같게), 라이브 주소 https://koonyang.github.io/concept-library/ .
