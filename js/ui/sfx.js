/* 효과음: 파일 없이 WebAudio 로 합성한다. 첫 사용자 입력 뒤에만 AudioContext 를 만든다(브라우저 규칙).
   sfx.tap() clash() hit() book() stagger() wrong() correct(), sfx.setMuted(bool) */
let ctx = null, muted = false, master = null;
function ac() {
  if (muted) return null;
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C || !sfx.primed) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
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
  tap() { tone(880, 0.05, { type: "triangle", gain: 0.12 }); },
  correct() { tone(660, 0.09, { type: "triangle", gain: 0.18 }); tone(990, 0.12, { type: "triangle", gain: 0.16, delay: 0.07 }); },
  wrong() { tone(220, 0.22, { type: "square", gain: 0.08, slide: 0.6 }); },
  clash() { noise(0.12, { gain: 0.35, hp: 1500 }); tone(320, 0.18, { type: "triangle", gain: 0.2, slide: 0.5 }); },
  hit() { noise(0.09, { gain: 0.3, hp: 300, lp: 2500 }); tone(140, 0.14, { type: "sine", gain: 0.3, slide: 0.5 }); },
  stagger() { tone(500, 0.25, { type: "sawtooth", gain: 0.06, slide: 0.4 }); },
  book() { tone(523, 0.18, { gain: 0.16 }); tone(784, 0.25, { gain: 0.14, delay: 0.1 }); tone(1046, 0.35, { gain: 0.12, delay: 0.2 }); },
};
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => sfx.prime(), { capture: true, passive: true, once: false }));
