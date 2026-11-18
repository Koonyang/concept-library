/* 테스트 공용: 저장소 경로(LIB_ROOT)와 브라우저 찾기.
   LIB_ROOT 가 없으면 이 파일 기준 저장소 맨 위(tests/lib/../..).
   브라우저: CHROME_PATH → /usr/bin/google-chrome → /usr/bin/chromium → macOS Chrome 중 있는 것
             → 없으면 chromium.launch({channel:"chrome"}) → 그것도 안 되면 playwright 기본 chromium
             (npx playwright-core install chromium 으로 받아 둔 것). */
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { resolve } from "path";

export const LIB_ROOT = resolve(process.env.LIB_ROOT || fileURLToPath(new URL("../..", import.meta.url))).replace(/\/+$/, "");
/* 스크린샷 자리 (git 에 안 올림, .gitignore 의 shots/) */
try { mkdirSync(LIB_ROOT + "/shots/overlap", { recursive: true }); } catch (e) {}

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

export function chromePath() {
  return CANDIDATES.find((p) => existsSync(p)) || null;
}

export async function launchBrowser(chromium, opts = {}) {
  const exe = chromePath();
  if (exe) return chromium.launch({ ...opts, executablePath: exe });
  try { return await chromium.launch({ ...opts, channel: "chrome" }); }
  catch (e) { return chromium.launch(opts); }
}
