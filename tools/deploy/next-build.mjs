/* 다음 배포 표시 정하기: node tools/deploy/next-build.mjs [--write]
   index.html 7번째 줄 <meta name="build" content="library-YYYYMMDD?"> 과 git log origin/main 의 [library-…] 중
   가장 큰 것을 보고, 오늘(서울) 날짜면 다음 글자(a…z, za…zz, zza…), 날짜가 바뀌었으면 library-<오늘>a.
   --write 면 index.html 을 고친다. 출력: 새 표시 한 줄(예: library-20261122a). 먼저 git fetch origin main 할 것 */
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { resolve } from "path";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const HTML = resolve(ROOT, "index.html");
const RE = /library-(\d{8})([a-z]+)/;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
const next = s => s.endsWith("z") ? s + "a" : s.slice(0, -1) + String.fromCharCode(s.charCodeAt(s.length - 1) + 1);
/* 같은 날짜 안의 순서: 짧은 것이 먼저(z < za), 같은 길이는 글자 순 */
const cmp = (a, b) => a[1] !== b[1] ? a[1].localeCompare(b[1]) : a[2].length !== b[2].length ? a[2].length - b[2].length : a[2].localeCompare(b[2]);

const html = readFileSync(HTML, "utf8");
const seen = [];
const m0 = html.match(RE); if (m0) seen.push(m0);
let log = "";
try { log = execSync("git log origin/main --format=%s -200", { cwd: ROOT, encoding: "utf8" }); } catch (e) { console.error("[next-build] git log origin/main 실패 — index.html 만 봄"); }
for (const line of log.split("\n")) { const m = line.match(/\[(library-\d{8}[a-z]+)\]/); if (m) seen.push(m[1].match(RE)); }
const last = seen.sort(cmp).pop();
const tag = !last || last[1] !== today ? `library-${today}a` : `library-${today}${next(last[2])}`;
if (process.argv.includes("--write")) {
  if (!/<meta name="build" content="library-[^"]*">/.test(html)) { console.error("[next-build] index.html 에 build meta 가 없음"); process.exit(1); }
  writeFileSync(HTML, html.replace(/<meta name="build" content="library-[^"]*">/, `<meta name="build" content="${tag}">`));
}
console.log(tag);
