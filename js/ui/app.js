/* 앱 진입점: 무대를 만들고 화면을 오간다. 층 → 손님 → 전투 → 결과.
   window.__app = {stage, go} (테스트·디버그용) */
import { createStage } from "../stage/stage.js";
import { mountBattle } from "./battle.js";
import { renderFloors, renderGuests, renderResult } from "./screens.js";
import { sfx } from "./sfx.js";
import { mountNav } from "./nav.js";
import { renderLibrary } from "./library.js";
import { renderMoon } from "./moon.js";

const G = window.Game, root = document.getElementById("ui");
const stage = await createStage(document.getElementById("stage"));
let battle = null, floorId = null, shownFloor = null, sub = null;   /* sub: 계시처럼 타이머가 있는 화면의 {unmount} */

/* ---------- 소리 ---------- */
const BGM = { lobby: "assets/audio/bgm.mp3", battle: "assets/audio/bgm-reception.mp3" };
const audio = new Audio(); audio.loop = true; audio.volume = 0.45;
let bgmWant = "lobby";
const bgmOn = () => G.save.bgmMuted === false;            /* 기본 꺼짐 */
function playBgm(kind) { bgmWant = kind || bgmWant; if (!bgmOn()) { audio.pause(); return; }
  const src = BGM[bgmWant]; if (!audio.src.endsWith(src)) audio.src = src; audio.play().catch(() => {}); }
sfx.setMuted(!!G.save.sfxMuted);

/* ---------- 가로 고정 (큐 양 결정: 기본 켜짐) ----------
   브라우저는 전체 화면일 때만 방향을 고정할 수 있어서, 휴대폰(터치)에서 첫 탭에 전체 화면 + 가로 고정을 요청한다.
   홈 화면에 설치한 앱은 manifest 의 orientation: landscape 로 이미 가로. 설정에서 끌 수 있다(이 기기에만 저장). */
const LAND_KEY = "concept-library-landscape";
function landOn() { try { return localStorage.getItem(LAND_KEY) !== "off"; } catch (e) { return true; } }
function setLand(on) { try { localStorage.setItem(LAND_KEY, on ? "on" : "off"); } catch (e) {} }
const touchDevice = () => matchMedia("(pointer: coarse)").matches;
const standalone = () => matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
async function lockLandscape() {
  if (!landOn() || !touchDevice() || standalone()) return;
  try { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" }); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape"); } catch (e) {}
}
document.addEventListener("pointerup", function first() { document.removeEventListener("pointerup", first, true); lockLandscape(); }, true);

/* ---------- 설정 (기본 화면에서만, 화면 안에서 펼침) ---------- */
const setBtn = document.createElement("div"); setBtn.id = "settings";
function paintSettings(open) {
  setBtn.innerHTML = `<button id="btn-set" type="button" aria-expanded="${!!open}" aria-label="설정">설정</button>${open ? `<div class="set-panel">
    <button type="button" data-k="bgm" aria-pressed="${bgmOn()}">배경음 ${bgmOn() ? "켜짐" : "꺼짐"}</button>
    <button type="button" data-k="sfx" aria-pressed="${!G.save.sfxMuted}">효과음 ${G.save.sfxMuted ? "꺼짐" : "켜짐"}</button>
    <button type="button" data-k="land" aria-pressed="${landOn()}">가로 고정 ${landOn() ? "켜짐" : "꺼짐"}</button></div>` : ""}`;
}
setBtn.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "btn-set") { paintSettings(b.getAttribute("aria-expanded") !== "true"); return; }
  if (b.dataset.k === "bgm") { G.setAudio({ bgm: !bgmOn() }); playBgm(); }
  if (b.dataset.k === "sfx") { G.setAudio({ sfx: !!G.save.sfxMuted }); sfx.setMuted(!!G.save.sfxMuted); }
  if (b.dataset.k === "land") { setLand(!landOn()); if (!landOn()) { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {} } }
  sfx.tap(); paintSettings(true);
});
function withSettings() { paintSettings(false); root.appendChild(setBtn); }
/* 기본 화면 공통: 서랍 + 설정 */
function chrome(current) { mountNav(root, { current, go: k => nav[k]() }); withSettings(); }
function leaveSub() { if (sub) { sub.unmount(); sub = null; } }

/* ---------- 이동 ---------- */
function showFloor(id) { if (shownFloor === id) return; shownFloor = id; stage.setFloor(G.data.floorStage(id)); }
function leaveBattle() { leaveSub(); if (battle) { battle.unmount(); battle = null; } G.battle.leave(); }
const nav = {
  floors() { leaveBattle(); stage.setUnits([], null); renderFloors(root, nav); chrome("floors"); playBgm("lobby"); if (floorId) showFloor(floorId); },
  preview(id) { showFloor(id); },
  floor(id) { floorId = id; try { localStorage.setItem("concept-library-floor", id); } catch (e) {} sfx.tap(); showFloor(id); renderGuests(root, id, nav); chrome("floors"); },
  library(tab, pick) { leaveBattle(); sfx.tap(); if (floorId) showFloor(floorId); renderLibrary(root, stage, nav, tab, pick); chrome("library"); playBgm("lobby"); },   /* pick: 책 탭에서 미리 고를 손님 id */
  moon() { leaveBattle(); sfx.tap(); stage.setUnits([], null); shownFloor = null; stage.setFloor({ mood: "moon", accent: "#a99be0", props: ["orb", "bookpile"] });
    sub = renderMoon(root, stage, nav, { chrome: on => { const n = root.querySelector("#nav"); if (on && !n) chrome("moon"); if (!on) { n && n.remove(); setBtn.remove(); } } }); playBgm("lobby"); },
  async battle(gid) {
    leaveBattle(); sfx.tap(); const g = G.data.GUEST_BY[gid]; floorId = g.floorId; showFloor(floorId); playBgm("battle");
    root.innerHTML = "";
    battle = await mountBattle(root, stage, gid, { onEnd: r => { battle && battle.unmount(); battle = null; renderResult(root, r, nav); playBgm("lobby"); } });
  },
};

let saved = null; try { saved = localStorage.getItem("concept-library-floor"); } catch (e) {}
floorId = G.data.FLOORS.some(f => f.id === saved) ? saved : G.data.FLOORS[0].id;
showFloor(floorId);
nav.floors();
document.addEventListener("pointerdown", () => playBgm(), { once: true });
window.__app = { stage, nav };
