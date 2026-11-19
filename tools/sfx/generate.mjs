// ElevenLabs 효과음 생성: npm run sfx -- [이름...] [--again]  (이름 없으면 전부, --again 은 받은 원본으로 다듬기만)
// 키는 환경 변수 ELEVENLABS_API_KEY(xi-api-key 헤더). 클라우드 세션에서는 프록시가 키를 넣어 주므로 아무 값이나 둔다.
// 받은 소리는 ffmpeg로 앞뒤 무음을 자르고 크기를 맞춰 assets/audio/sfx/<이름>.mp3 로 저장한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const prompts = JSON.parse(readFileSync(join(root, "tools/sfx/prompts.json"), "utf8"));
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const names = args.length ? args : Object.keys(prompts).filter(k => !k.startsWith("_"));
const out = join(root, "assets/audio/sfx"); mkdirSync(out, { recursive: true });
const key = process.env.ELEVENLABS_API_KEY || "proxy-injected";
const rawDir = join(root, "tools/sfx/raw"); mkdirSync(rawDir, { recursive: true });   // 받은 원본(.gitignore). --again 이면 원본으로 다시 다듬기만 한다
const again = process.argv.includes("--again");
for (const n of names) {
  const p = prompts[n]; if (!p) { console.error("없는 이름:", n); process.exitCode = 1; continue; }
  const raw = join(rawDir, `${n}.mp3`);
  if (!again) {
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation", { method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": key },
      body: JSON.stringify({ text: p.text, duration_seconds: p.seconds, prompt_influence: 0.6 }) });
    if (!r.ok) { console.error(n, r.status, await r.text()); process.exitCode = 1; continue; }
    writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  }
  // 원본 최고 크기를 재고, 그보다 40dB(앞)/55dB(뒤) 작은 곳까지를 무음으로 보고 자른 뒤 최고 크기를 -3dB(또는 peak)로 맞춘다
  const peakOf = (af) => parseFloat((spawnSync("ffmpeg", ["-hide_banner", "-i", raw, ...(af ? ["-af", af + ",volumedetect"] : ["-af", "volumedetect"]), "-f", "null", "-"])
    .stderr.toString().match(/max_volume: (-?[\d.]+) dB/) || [])[1] || "0");
  const peak = peakOf("");
  const trim = `silenceremove=start_periods=1:start_threshold=${(peak - 40).toFixed(0)}dB:detection=peak,areverse,silenceremove=start_periods=1:start_threshold=${(peak - 55).toFixed(0)}dB:detection=peak,afade=t=in:d=0.05,areverse,afade=t=in:d=0.004${p.lowpass ? `,lowpass=f=${p.lowpass},lowpass=f=${p.lowpass}` : ""}${p.highpass ? `,highpass=f=${p.highpass},highpass=f=${p.highpass}` : ""}`;
  const gain = (p.peak ?? -3) - peak;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", `${trim},volume=${gain.toFixed(1)}dB`,
    "-ac", "1", "-ar", "44100", "-b:a", "96k", join(out, `${n}.mp3`)]);
  console.log("만듦:", n, `(+${gain.toFixed(1)}dB)`);
}
