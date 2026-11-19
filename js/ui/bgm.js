/* 배경음: 곡을 바꿀 때 뚝 끊지 않고 페이드 아웃 → 페이드 인.
   곡마다 <audio> 하나씩(돌려 쓰기). Web Audio 의 GainNode 로 소리 크기를 부드럽게 바꾼다
   (iOS 는 audio.volume 을 무시하므로). Web Audio 가 없으면 audio.volume 을 조금씩 바꾼다.
   bgm.play(src) · bgm.stop() */
const VOL = 0.45, OUT = 0.6, IN = 0.9;   /* 크기, 페이드 아웃·인 시간(초) */
let ctx = null, cur = null;               /* cur: {src, el, gain} */
const tracks = new Map();

function context() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  try { ctx = new C(); } catch (e) { ctx = null; }
  return ctx;
}
function track(src) {
  let t = tracks.get(src); if (t) return t;
  const el = new Audio(src); el.loop = true; el.preload = "auto";
  t = { src, el, gain: null, timer: 0, stopAt: 0 };
  const c = context();
  if (c) { try { t.gain = c.createGain(); t.gain.gain.value = 0; c.createMediaElementSource(el).connect(t.gain).connect(c.destination); el.volume = 1; } catch (e) { t.gain = null; } }
  if (!t.gain) el.volume = 0;
  tracks.set(src, t); return t;
}
/* to 크기까지 sec 초 동안 부드럽게 */
function ramp(t, to, sec, delay = 0) {
  clearInterval(t.timer); t.timer = 0;
  if (t.gain) { const g = t.gain.gain, now = ctx.currentTime + delay;
    g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(to, now + sec); return; }
  const from = t.el.volume, t0 = performance.now() + delay * 1000;
  t.timer = setInterval(() => { const k = Math.min(1, Math.max(0, (performance.now() - t0) / (sec * 1000)));
    t.el.volume = from + (to - from) * k; if (k >= 1) { clearInterval(t.timer); t.timer = 0; } }, 30);
}
function fadeOut(t) {
  ramp(t, 0, OUT); clearTimeout(t.stopAt);
  t.stopAt = setTimeout(() => { if (cur !== t) t.el.pause(); }, OUT * 1000 + 80);
}

export const bgm = {
  play(src) {
    const c = context(); if (c && c.state === "suspended") c.resume().catch(() => {});
    if (cur && cur.src === src) { if (cur.el.paused) { cur.el.play().catch(() => {}); } ramp(cur, VOL, IN); clearTimeout(cur.stopAt); return; }
    const prev = cur, next = track(src); cur = next;
    clearTimeout(next.stopAt); clearTimeout(next.startAt);
    if (prev) fadeOut(prev);
    if (!next.el.paused) { ramp(next, VOL, IN); return; }   /* 줄어들던 곡으로 바로 돌아오면 그 자리에서 다시 키운다 */
    /* 앞 곡이 다 줄어든 뒤 새 곡을 처음부터 0 에서 키운다 */
    const wait = prev && !prev.el.paused ? OUT : 0;
    if (next.gain) next.gain.gain.setValueAtTime(0, ctx.currentTime); else next.el.volume = 0;
    next.startAt = setTimeout(() => { if (cur !== next) return; try { next.el.currentTime = 0; } catch (e) {}
      next.el.play().catch(() => {}); ramp(next, VOL, IN); }, wait * 1000);
  },
  stop() { if (cur) { clearTimeout(cur.startAt); fadeOut(cur); cur = null; } },
};
/* 테스트용: 곡마다 지금 크기와 재생 여부 */
export const __debug = () => [...tracks.values()].map(t => ({ src: t.src.split("/").pop(), v: +(t.gain ? t.gain.gain.value : t.el.volume).toFixed(2), playing: !t.el.paused, ctx: ctx && ctx.state }));
