# Credits & Licenses

개념의 서고 uses third-party game assets that are free to use under the licenses below.
No Library of Ruina / Project Moon assets are included.

## cron — Old Parchment Paper
- License: CC0 1.0 Universal
- URL: https://opengameart.org/content/old-parchment-paper
- Used for (old UI, archived): combat page / paper card texture (`legacy/assets/textures/parchment.webp`)

## Kenney.nl — Fantasy UI Borders
- License: CC0 1.0 Universal
- URL: https://kenney.nl/assets/fantasy-ui-borders
- Also: https://opengameart.org/content/fantasy-ui-borders
- Used for (old UI, archived): ornamental UI frames (`legacy/assets/ui/`)

## Kenney.nl — Board Game Icons
- License: CC0 1.0 Universal
- URL: https://kenney.nl/assets/board-game-icons
- Also: https://opengameart.org/content/board-game-icons
- Used for (old UI, archived): UI icons (`legacy/assets/icons/`)

## 4theliberty — Abbey Library of Saint Gallen
- License: CC0 1.0 Universal
- URL: https://commons.wikimedia.org/wiki/File:AbbeyLibrary-SaintGallen.jpg
- Used for (old UI, archived): lobby, title, and battle backgrounds (`legacy/assets/bg/`)

## Kay Lousberg — KayKit Character Pack: Adventurers 1.0
- License: CC0 1.0 Universal
- URL: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (also https://kaylousberg.itch.io/kaykit-adventurers)
- Used for: 3D characters and animations (`assets/models/characters/`, built by `tools/assets/build-characters.mjs`: animations split into `anims.glb`, textures 256×256). License text: `assets/models/LICENSE-KayKit.txt`

## Kay Lousberg — KayKit Character Pack: Skeletons 1.0
- License: CC0 1.0 Universal
- URL: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 (also https://kaylousberg.itch.io/kaykit-skeletons)
- Used for: skeleton enemy models (`assets/models/monsters/Skeleton_*.glb`, built by `tools/assets/build-monsters.mjs`: animations removed — they share `characters/anims.glb` — textures 256×256). License text: `assets/models/LICENSE-Quaternius.txt`

## Quaternius — low poly monsters, animals, robots, slimes
- License: CC0 1.0 Universal
- URL: https://quaternius.com (per-model uploads at https://poly.pizza/u/Quaternius); files taken from the npm package `@netforge/asset-library-files` (`library/lowpoly/`), whose NOTICE lists each model as Quaternius / CC0
- Used for: enemy models (`assets/models/monsters/`, built by `tools/assets/build-monsters.mjs`: animations renamed to the game's names and reduced, meshopt removed, textures 256×256, a few meshes simplified). License text: `assets/models/LICENSE-Quaternius.txt`

## 개념의 서고 — app icons (made for this game)
- License: same as this project (made in-repo, no third-party art)
- Used for: home-screen app icons (`assets/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`), drawn with a small Python/PIL script: dark stage, crimson valance, glowing open book

## three.js — three.js authors
- License: MIT
- URL: https://github.com/mrdoob/three.js (npm three@0.180.0)
- Used for: 3D stage rendering (`vendor/three/`, license text `vendor/three/LICENSE`)

## Pretendard — Kil Hyung-jin
- License: SIL Open Font License 1.1
- URL: https://github.com/orioncactus/pretendard
- Used for: body / UI text (Korean + Latin), variable font, dynamic subsets
- Files: `assets/fonts/pretendard/*.woff2`, `assets/fonts/fonts.css`, license text in `assets/fonts/LICENSE-Pretendard.txt`

## Space Grotesk — Florian Karsten
- License: SIL Open Font License 1.1
- URL: https://github.com/floriankarsten/space-grotesk
- Used for: headings, numerals, labels (Latin), variable font
- Files: `assets/fonts/space-grotesk-latin-wght-normal.woff2`, `assets/fonts/space-grotesk-latin-ext-wght-normal.woff2`, license text in `assets/fonts/LICENSE-SpaceGrotesk.txt`
- The SIL OFL 1.1 text is at https://openfontlicense.org/open-font-license-official-text/

Attribution is not required by CC0, but it is gratefully given. Pretendard and Space Grotesk are included under the OFL 1.1 (fonts are not sold by themselves; no Reserved Font Name is modified).
- 효과음 (assets/audio/sfx/*.mp3): ElevenLabs Sound Effects로 생성(https://elevenlabs.io). 종이·나무 등 도서관 소리(정답은 핑거스냅). 프롬프트는 `tools/sfx/prompts.json`, 다시 만들기 `npm run sfx`.
- BGM (assets/audio/bgm.mp3): 사용자 제공 음원, 태그 없음 (re-encoded 128kbps, loop crossfade).
- 전투 BGM (assets/audio/bgm-reception.mp3): 큐 양 제공 음원 "turning the heavy page" (끝 무음을 잘라 반복, 128kbps).
- 손님 책 표지 (assets/books/book-1.webp … book-8.webp): 큐 양 제공 (owner-provided covers).
