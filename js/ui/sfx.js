/* 효과음: 도서관 소리(종이·나무, ElevenLabs로 만든 assets/audio/sfx/*.mp3, 프롬프트는 tools/sfx/prompts.json).
   첫 사용자 입력 뒤에 AudioContext 를 만들고 파일을 받는다(브라우저 규칙). 파일이 아직 없으면 예전 합성음으로 대신한다.
   sfx.tap() clash() hit() book() stagger() wrong() correct(), sfx.setMuted(bool) */
const FILES = { tap: ["tap-1", "tap-2", "tap-3"], correct: ["correct"], wrong: ["wrong"], clash: ["clash"], hit: ["hit"], stagger: ["stagger"], book: ["book"] };
const VOL = { tap: 0.15, correct: 0.8, wrong: 0.9, clash: 0.75, hit: 0.8, stagger: 0.7, book: 0.8 };   // 소리별 크기(탭은 자주 나니 작게)
const bufs = {}; let loading = false, lastTap = -1;
function load(c) {
  if (loading) return; loading = true;
  for (const list of Object.values(FILES)) for (const n of list)
    fetch(new URL(`../../assets/audio/sfx/${n}.mp3`, import.meta.url)).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(a => c.decodeAudioData(a)).then(b => { bufs[n] = b; }).catch(() => {});
}
/* 파일 소리를 낸다. 낼 수 있으면 true(못 내면 호출한 쪽이 합성음으로 대신) */
function play(kind, { rate = 1 } = {}) {
  const c = ac(); if (!c) return true;
  let list = FILES[kind].filter(n => bufs[n]); if (!list.length) return false;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastTap) i = (i + 1) % list.length; if (kind === "tap") lastTap = i;
  const s = c.createBufferSource(), g = c.createGain(); s.buffer = bufs[list[i]];
  s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);   // 같은 소리가 반복돼도 덜 기계적으로
  g.gain.value = VOL[kind]; s.connect(g).connect(master); s.start(); return true;
}
let ctx = null, muted = false, master = null;
function ac() {
  if (muted) return null;
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C || !sfx.primed) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination); load(ctx); }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq, dur, { type = "sine", gain = 0.3, slide = 0, delay = 0 } = {}) {
  const c = ac(); if (!c) return; const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { gain = 0.3, hp = 800, lp = 6000, delay = 0 } = {}) {
  const c = ac(); if (!c) return; const t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), h = c.createBiquadFilter(), l = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; h.type = "highpass"; h.frequency.value = hp; l.type = "lowpass"; l.frequency.value = lp; g.gain.value = gain;
  s.connect(h).connect(l).connect(g).connect(master); s.start(t);
}
export const sfx = {
  primed: false,
  prime() { sfx.primed = true; ac(); },
  setMuted(m) { muted = !!m; if (muted && ctx) ctx.suspend().catch(() => {}); },
  tap() { play("tap") || tone(880, 0.05, { type: "triangle", gain: 0.12 }); },
  correct() { play("correct") || (tone(660, 0.09, { type: "triangle", gain: 0.18 }), tone(990, 0.12, { type: "triangle", gain: 0.16, delay: 0.07 })); },
  wrong() { play("wrong") || tone(220, 0.22, { type: "square", gain: 0.08, slide: 0.6 }); },
  clash() { play("clash") || (noise(0.12, { gain: 0.35, hp: 1500 }), tone(320, 0.18, { type: "triangle", gain: 0.2, slide: 0.5 })); },
  hit() { play("hit") || (noise(0.09, { gain: 0.3, hp: 300, lp: 2500 }), tone(140, 0.14, { type: "sine", gain: 0.3, slide: 0.5 })); },
  stagger() { play("stagger") || tone(500, 0.25, { type: "sawtooth", gain: 0.06, slide: 0.4 }); },
  book() { play("book") || (tone(523, 0.18, { gain: 0.16 }), tone(784, 0.25, { gain: 0.14, delay: 0.1 }), tone(1046, 0.35, { gain: 0.12, delay: 0.2 })); },
};
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => sfx.prime(), { capture: true, passive: true, once: false }));
