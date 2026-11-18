/* 전투 화면 UI(js/ui/battle.js): 화면 조작만으로 승리, [개막] 두 번 방지, 길게 눌러 건너뛰기, 패배 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox","--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o).slice(0,700));};
const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
const go=async(gid="pomodoro")=>{ await p.goto(BASE+"tests/battle.html?guest="+gid); await p.waitForFunction(()=>window.__ready,null,{timeout:20000}); };
/* 한 막: 정답 → 내 주사위마다 카드 → 적 → (개막은 따로) */
async function answer(correct){
  await p.waitForSelector("#question.on",{timeout:8000});
  const q=await p.evaluate(()=>{ const q=Game.battle.question(); return {type:q.type,ci:q.correctIndex,answer:q.answer,n:(q.options||[]).length}; });
  if(q.type==="short"){ await p.fill("#q-short", correct?String(q.answer):"모르겠다"); await p.click("#q-submit"); }
  else await p.click(`.q-opt[data-i="${correct?q.ci:(q.ci+1)%q.n}"]`);
  await p.waitForFunction(()=>Game.battle.state.phase==="assign",null,{timeout:5000});
}
async function assignAll(){
  const dice=await p.evaluate(()=>Game.battle.state.units.filter(u=>u.side==="ally"&&u.hp>0).flatMap(u=>u.dice.map((d,i)=>({u:u.id,i}))));
  for(const d of dice){
    await p.click(`.speed-die[data-unit="${d.u}"][data-die="${d.i}"]`);
    const card=await p.$("#hand .card:not(.disabled)"); if(!card) continue; await card.click();
    const t=await p.$('.speed-die[data-side="enemy"]')||await p.$('.enemy-target'); if(t) await t.click();
  }
}
await go();
await p.evaluate(()=>{ let z=4; Math.random=()=>{z|=0;z=z+0x6D2B79F5|0;let t=Math.imul(z^z>>>15,1|z);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}; });
let scenes=0, doubleChecked=null, skipChecked=null;
while(!(await p.evaluate(()=>window.__end))&&scenes<40){
  scenes++; await answer(true); await assignAll();
  const sc0=await p.evaluate(()=>Game.battle.state.scene), assigned=await p.evaluate(()=>Game.battle.state.units.filter(u=>u.side==="ally").flatMap(u=>u.dice).filter(d=>d.card).length);
  if(scenes===1) ok(assigned>0,"화면 조작으로 카드 배정",{assigned});
  if(scenes===2) await p.evaluate(()=>{ window.__plays=0; window.__held=false; const pl=__stage.play, fn=__stage.finishNow; __stage.play=(ev,o)=>{ if(window.__held&&ev&&ev.kind!=="skip") window.__plays++; return pl(ev,o); }; __stage.finishNow=()=>{ window.__held=true; fn(); }; });
  if(scenes===1){ await p.evaluate(()=>{ const b=document.getElementById("btn-open"); b.click(); b.click(); }); }   /* 연달아 두 번 */
  else await p.click("#btn-open");
  if(scenes===2){ /* 개막 직후 화면 길게 누르기 → 건너뛰기 (연출이 길게 누르기 전에 끝났으면 검사할 것이 없음) */
    await p.mouse.move(422,200); await p.mouse.down(); await p.waitForTimeout(470);
    const layerOn=await p.evaluate(()=>!!document.querySelector("#skip-layer.on")); await p.waitForTimeout(130); await p.mouse.up();
    await p.waitForFunction(()=>window.__end||document.querySelector("#question.on"),null,{timeout:8000}).catch(()=>{});
    skipChecked=await p.evaluate(l=>({layerOn:l,held:window.__held,playsAfter:window.__plays}),layerOn);
  }
  await p.waitForFunction(()=>window.__end||(Game.battle.state&&Game.battle.state.phase==="question"&&document.querySelector("#question.on")),null,{timeout:30000});
  if(scenes===1) doubleChecked=(await p.evaluate(()=>Game.battle.state?Game.battle.state.scene:-1))-sc0;
}
const end=await p.evaluate(()=>window.__end);
ok(end&&end.won===true,"화면 조작만으로 승리 → onEnd(won:true)",{end,scenes});
ok(doubleChecked===1,"[개막] 두 번 눌러도 막은 한 번만 넘어감",{doubleChecked});
ok(skipChecked&&(skipChecked.layerOn?(skipChecked.held&&skipChecked.playsAfter===0):true),"길게 누르면 건너뛰기: 남은 교환 연출 없이 다음 막",{skipChecked});
await p.screenshot({path:join(ROOT,"shots/ui-battle-end.png")});
/* 패배 */
await go("beccaria");
await p.evaluate(()=>{ const X=__studyGame.battleApi.internals(); for(const u of Game.battle.state.units.filter(u=>u.side==="ally")){ X[u.id].cu.hp=1; u.hp=1; } });
await answer(false);
await p.click("#btn-open");
await p.waitForFunction(()=>window.__end,null,{timeout:30000}).catch(()=>{});
const lose=await p.evaluate(()=>window.__end);
ok(lose&&lose.won===false,"사서 전멸 → onEnd(won:false)",lose);
/* 연출이 예외를 던져도 전투가 멈추지 않음 */
await go("beccaria");
await p.evaluate(()=>{ const pl=__stage.play; let n=0; __stage.play=(ev,o)=>{ if(n++===0) return Promise.reject(new Error("연출 실패 시험")); return pl(ev,o); }; });
await answer(true); await assignAll(); await p.click("#btn-open");
const recovered=await p.waitForFunction(()=>window.__end||(Game.battle.state.phase==="question"&&document.querySelector("#question.on")),null,{timeout:20000}).then(()=>true).catch(()=>false);
ok(recovered,"연출 예외가 나도 다음 막으로 진행");
errs.splice(0,errs.length,...errs.filter(e=>!/연출 실패 시험/.test(e)));
/* 가로·세로 스크린샷 (배정 단계) */
for(const [w,h] of [[844,390],[390,844]]){ await p.setViewportSize({width:w,height:h}); await go("beccaria"); await answer(true);
  await p.click(`.speed-die[data-side="ally"]`); await p.waitForTimeout(400); await p.screenshot({path:join(ROOT,`shots/ui-battle-${w}.png`)}); }
await p.setViewportSize({width:844,height:390}); await go("beccaria"); await p.waitForSelector("#question.on"); await p.screenshot({path:join(ROOT,"shots/ui-question-844.png")});
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
