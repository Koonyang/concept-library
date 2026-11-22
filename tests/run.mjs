/* 테스트 전부: node tests/run.mjs [이름 일부 ...]
   바뀐 파일에 맞는 것만: node tests/run.mjs --changed [기준, 기본 origin/main] (커밋 안 한 변경 포함), --dry 면 고르기만 하고 안 돌림
   tests/*.test.mjs 와 tests/overlap-check.mjs(겹침 검사, 10화면)를 병렬로 돌리고 요약.
   환경변수: LIB_ROOT(기본 저장소 맨 위), CHROME_PATH, JOBS(동시 실행 수, 기본 2), TEST_TIMEOUT(초, 기본 900),
            NO_OVERLAP=1(겹침 검사 빼기). 로그는 shots/test-logs/<이름>.log, 스크린샷은 shots/ (git 에 안 올림) */
import { readdirSync, mkdirSync, createWriteStream, existsSync } from "fs";
import { spawn, execSync } from "child_process";
import { join } from "path";
import { LIB_ROOT } from "./lib/browser.mjs";

const TESTS = join(LIB_ROOT, "tests");
const LOGS = join(LIB_ROOT, "shots", "test-logs");
mkdirSync(join(LIB_ROOT, "shots", "overlap"), { recursive: true });
mkdirSync(LOGS, { recursive: true });

/* 바뀐 파일 → 돌릴 테스트(이름 일부). 표에 없는 파일이면 전부. 문서·그림만 바뀌면 없음 */
const AFFECTS = [
  [/^(docs\/|legacy\/|shots\/|\.claude\/|[^/]+\.md$|tools\/(sfx|content|deploy)\/|tools\/shot\.mjs$)/, []],
  [/^js\/core\/moon\.js$|^js\/ui\/moon\.js$|^assets\/data\//, ["moon", "core", "app"]],
  [/^js\/core\//, ["*"]],
  [/^js\/stage\//, ["stage", "ui", "app", "library", "assets", "overlap"]],
  [/^js\/ui\/library\.js$/, ["library", "app", "overlap"]],
  [/^js\/ui\/(battle\.js|style\.css)$/, ["ui", "app", "library", "moon", "overlap"]],
  [/^js\/ui\//, ["app", "landscape", "library", "moon"]],
  [/^(assets\/(models|audio|fonts)|vendor)\//, ["assets", "app"]],
  [/^tools\/sim\//, ["sim"]],
  [/^tools\/assets\//, ["assets", "stage"]],
  [/^index\.html$|^manifest\.json$/, ["app", "landscape", "core"]],
  [/^tests\/lib\/|^tests\/run\.mjs$/, ["*"]],
  [/^tests\/perf\.mjs$/, []],
  [/^tests\/(battle|stage)\.html$/, ["ui", "stage", "overlap"]],
];
function changedFilters(base) {
  const sh = c => { try { return execSync(c, { cwd: LIB_ROOT, encoding: "utf8" }); } catch (e) { return ""; } };
  const list = [...new Set((sh(`git diff --name-only ${base}...HEAD`) + sh("git diff --name-only HEAD") + sh("git ls-files --others --exclude-standard")).split("\n").filter(Boolean))];
  const want = new Set();
  for (const f of list) {
    const hit = AFFECTS.find(([re]) => re.test(f));
    const t = !hit && f.match(/^tests\/([a-z-]+)(\.test)?\.mjs$/); if (t) { want.add(t[1]); continue; } (hit ? hit[1] : ["*"]).forEach(x => want.add(x));
  }
  console.log(`[changed] ${base} 이후 바뀐 파일 ${list.length}개 → ${want.has("*") ? "전부" : [...want].join(" ") || "돌릴 테스트 없음"}`);
  return want.has("*") ? [] : want.size ? [...want] : null;
}
let filters = process.argv.slice(2).filter(a => a !== "--dry");
const ci = filters.indexOf("--changed");
if (ci >= 0) { const base = filters[ci + 1] && !filters[ci + 1].startsWith("-") ? filters[ci + 1] : "origin/main"; filters = changedFilters(base); if (!filters) process.exit(0); }
let files = readdirSync(TESTS).filter((f) => f.endsWith(".test.mjs")).sort();
if (!process.env.NO_OVERLAP && existsSync(join(TESTS, "overlap-check.mjs"))) files.unshift("overlap-check.mjs");   /* 가장 오래 걸리니 먼저 시작 */
if (filters.length) files = files.filter((f) => filters.some((x) => f.includes(x)));
const JOBS = Math.max(1, +(process.env.JOBS || 2));   /* 3D(swiftshader) 테스트는 무거워 동시에 많이 돌리면 타이밍 검사가 흔들린다 */
const TIMEOUT = 1000 * +(process.env.TEST_TIMEOUT || 900);

function run(f) {
  return new Promise((done) => {
    const t0 = Date.now(), log = createWriteStream(join(LOGS, f.replace(/\.mjs$/, "") + ".log"));
    const ch = spawn(process.execPath, [join(TESTS, f)], { cwd: LIB_ROOT, env: { ...process.env, LIB_ROOT } });
    let out = "";
    const keep = (d) => { log.write(d); out += d; if (out.length > 200000) out = out.slice(-100000); };
    ch.stdout.on("data", keep); ch.stderr.on("data", keep);
    const timer = setTimeout(() => { keep(`\n[run] timeout ${TIMEOUT / 1000}s\n`); ch.kill("SIGKILL"); }, TIMEOUT);
    ch.on("close", (code) => {
      clearTimeout(timer); log.end();
      const fails = out.split("\n").filter((l) => /^FAIL\b|^ISSUE\b|Error:/.test(l)).slice(0, 8);
      done({ f, ok: code === 0, code, s: Math.round((Date.now() - t0) / 1000), fails });
    });
  });
}

const queue = files.slice(), results = [];
async function lane() { while (queue.length) { const f = queue.shift(); const r = await run(f); results.push(r);
  console.log(`${r.ok ? "PASS" : "FAIL"} ${f} (${r.s}s)`); if (!r.ok) r.fails.forEach((l) => console.log("     " + l.slice(0, 300))); } }
console.log(`LIB_ROOT=${LIB_ROOT}  ${files.length} files, ${JOBS} at a time`);
if (process.argv.includes("--dry")) { console.log(files.join(" ")); process.exit(0); }   /* 돌리지 않고 고른 것만 보기 */
await Promise.all(Array.from({ length: Math.min(JOBS, files.length) }, lane));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed${bad.length ? " — failed: " + bad.map((r) => r.f).join(", ") : ""}`);
console.log(`logs: ${LOGS}`);
process.exit(bad.length ? 1 : 0);
