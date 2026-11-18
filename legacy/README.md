# legacy/ — 옛 UI 보관소 (2026-11-18)

큐 양 결정으로 옛 화면·외관을 전부 내리고 새로 만들기로 했다. 지우지 않고 여기 보관한다. **게임은 여기 있는 파일을 읽지 않는다.**

| 경로 | 내용 |
|---|---|
| `index.html` | 마지막 옛 게임 전체(`library-20261118zm` 시점). CSS·마크업·화면 코드가 다 들어 있다. 규칙·데이터 부분은 `js/core/`로 옮겨졌다. |
| `assets/ui/battle-stage.js` | 옛 다대다 무대 `BattleStage`(배치, 화살표, 손패 부채꼴, 합 클로즈업). |
| `assets/ui/*.webp,png`, `assets/icons/`, `assets/bg/`, `assets/textures/` | 옛 UI 테두리·아이콘·배경·양피지(CC0, 출처는 `CREDITS.md`). |
| `tests/` | 옛 화면에 묶인 Playwright 테스트와 겹침 검사(`overlap-check.mjs`). 지금 구조에선 돌지 않는다(참고용). |

옛 게임을 그대로 보고 싶으면 저장소 루트에서 `python3 -m http.server 8000` 후 http://localhost:8000/legacy/ .
(책 표지·BGM·단어·폰트는 루트 `assets/`를 같이 쓴다.)
