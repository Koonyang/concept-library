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
    await p.waitForSelector("#skip-layer.on",{timeout:3000}).catch(()=>{});   /* 층이 켜진 뒤 눌러야 길게 누르기가 잡힌다(느린 환경 경쟁 방지) */
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
/* 합 중: 양쪽 책장 판(각 캐릭터 옆) · 주사위 값 공개 · 결과 · 속도 주사위 숨김 */
await go("beccaria"); await answer(true); await assignAll();
const myCard=await p.evaluate(()=>{ const a=Game.battle.state.units.find(u=>u.side==="ally"); const d=a.dice.find(d=>d.card); return d&&Game.battle.cardInfo(d.card,a.id).name; });
await p.evaluate(()=>{ window.__cpTexts=[]; const cp=document.getElementById("clash-panel"); new MutationObserver(()=>window.__cpTexts.push(cp.textContent)).observe(cp,{childList:true,subtree:true,characterData:true}); });
await p.click("#btn-open");
const cs=await p.waitForFunction(()=>{ const e=document.querySelector("#clash-panel.on"); if(!e) return null; const v=e.querySelector(".cp-die.shown .val"); if(!v||!/\d/.test(v.textContent)) return null;
  const sides=[...e.querySelectorAll(".cp-side")], L=e.querySelector(".cp-side.l"), R=e.querySelector(".cp-side.r"), u=id=>Game.battle.state.units.find(x=>x.id===id);
  const pt=id=>id&&__stage.unitPoint(id), lr=L.getBoundingClientRect(), rr=R.getBoundingClientRect();
  return { n:sides.length, lSide:u(L.dataset.unit)?.side, text:e.textContent, diceHidden:document.getElementById("dice-layer").hidden,
    lLeft:lr.left, lRight:lr.right, lPt:pt(L.dataset.unit), rLeft:rr.left, rRight:rr.right, rPt:pt(R.dataset.unit), rNone:R.classList.contains("none")||L.classList.contains("none") }; },null,{timeout:15000,polling:50}).then(h=>h.jsonValue()).catch(()=>null);
ok(cs&&cs.n===2&&cs.lSide==="ally","합 표시: 판 2장(내 쪽 왼쪽)",cs);
ok(cs&&/(승|패|무승부|막음|회피|대응 없음)/.test(cs.text),"합 표시: 결과 글자",cs&&cs.text.slice(0,200));
ok(cs&&cs.diceHidden===true,"합 중 속도 주사위 숨김",cs&&cs.diceHidden);
ok(cs&&cs.lPt&&(cs.lLeft+cs.lRight)/2<cs.lPt.x&&(cs.rNone||cs.rPt&&(cs.rLeft+cs.rRight)/2>cs.rPt.x),"판이 캐릭터 옆(가로): 내 판 가운데는 캐릭터 왼쪽, 상대 판은 오른쪽",cs);
const seen=await p.waitForFunction(n=>!n||window.__cpTexts.some(t=>t.includes(n))?true:null,myCard,{timeout:15000}).then(()=>true).catch(()=>false);
ok(seen,"내 책장 이름이 합 표시에 나옴",{myCard});
await p.waitForFunction(()=>Game.battle.state.phase==="question"||window.__end,null,{timeout:30000});
ok(!(await p.$("#clash-panel.on")),"막이 끝나면 합 표시 닫힘");
if(!(await p.evaluate(()=>window.__end))){ await answer(true); ok(await p.evaluate(()=>!document.getElementById("dice-layer").hidden),"막이 끝나면 속도 주사위 다시 보임"); }
/* 길게 누르면 판이 남지 않음 */
await go("beccaria"); await answer(true); await assignAll(); await p.click("#btn-open");
await p.waitForSelector("#clash-panel.on",{timeout:15000});
{ const sk=await p.$("#skip-layer"), bb=await sk.boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up(); }
await p.waitForFunction(()=>Game.battle.state.phase!=="resolve"||window.__end,null,{timeout:20000}).catch(()=>{});
await p.waitForTimeout(300);
ok(!(await p.$("#clash-panel.on"))&&!(await p.$("#clash-panel .cp-side")),"길게 누르면 판 닫힘");
/* 주사위 없는 적(흐트러짐)의 몸을 누르는 자리는 투명해야 함(회색 사각형 버그) */
await go("beccaria");
const etBg=await p.evaluate(()=>{ const b=document.createElement("button"); b.className="enemy-target"; document.getElementById("dice-layer").appendChild(b); const c=getComputedStyle(b); const r={bg:c.backgroundColor,img:c.backgroundImage,border:c.borderTopWidth}; b.remove(); return r; });
ok((etBg.bg==="rgba(0, 0, 0, 0)"||etBg.bg==="transparent")&&etBg.img==="none"&&etBg.border==="0px","적 몸 누르는 자리: 배경·테두리 없음",etBg);
/* 책장을 안 고른 상태에서 적 주사위를 누르면 그 적이 쓸 책장 정보 */
await go("beccaria"); await answer(true);
const ed=await p.evaluate(()=>{ const e=Game.battle.state.units.find(u=>u.side==="enemy"&&u.dice.length), d=e.dice[0], c=Game.battle.cardInfo(d.card,e.id);
  return {unit:e.id,name:c.name,min:c.dice[0].min,max:c.dice[0].max,speed:d.speed}; });
await p.click(`.speed-die[data-unit="${ed.unit}"][data-die="0"]`);
const info=await p.waitForSelector("#enemy-info.on",{timeout:3000}).then(h=>h.textContent()).catch(()=>"");
ok(info.includes(ed.name)&&info.includes(`${ed.min}~${ed.max}`)&&info.includes(String(ed.speed))&&!info.includes("노림"),"적 주사위 → 책장 이름·범위·속도(대상 글은 없음)",{info:info.slice(0,160),ed});
/* 대상은 글 대신 그 주사위의 선을 실선으로(하나만), 끝은 대상의 몸통 */
{ await p.waitForTimeout(150); const f=await p.evaluate(()=>{ const ps=[...document.querySelectorAll("#target-arrows path.enemy.focus")], u=document.getElementById("enemy-info").dataset.unit, d=Game.battle.state.units.find(x=>x.id===u).dice[+document.getElementById("enemy-info").dataset.die];
    const end=ps[0]&&ps[0].getAttribute("d").trim().split(/[ MQ]+/).filter(Boolean).slice(-2).map(Number), cs=ps[0]&&getComputedStyle(ps[0]);
    /* 적 → 나: 노린 내 주사위(머리 위에 있으면), 아니면 몸통 */
    const chip=d.target&&d.target.die!=null&&document.querySelector(`#dice-layer .speed-die[data-k="${d.target.unit}:${d.target.die}"]`), cr=chip&&chip.getBoundingClientRect();
    const body=cr&&cr.width?{x:cr.left+cr.width/2,y:cr.top+cr.height/2,die:true}:d.target&&window.__stage.unitPoint(d.target.unit,"body");
    return {n:ps.length,end,body,dash:cs&&cs.strokeDasharray,others:document.querySelectorAll("#target-arrows path.enemy:not(.focus)").length}; });
  ok(f.n===1&&f.end&&f.body&&f.body.die&&Math.hypot(f.end[0]-f.body.x,f.end[1]-f.body.y)<4&&(f.dash==="none"||!f.dash),"누른 적 주사위의 대상 선만 실선, 끝은 노린 내 주사위(없으면 몸통)",f); }
ok(await p.evaluate(()=>Game.battle.state.units.filter(u=>u.side==="ally").flatMap(u=>u.dice).every(d=>!d.card)),"정보만 보고 배정은 안 함");
await p.mouse.click(422,330); await p.waitForTimeout(200);
ok(!(await p.$("#enemy-info.on")),"다른 데 누르면 닫힘");
/* 일방 공격 화살표는 대상 몸통으로(2026-11-23): 적 주사위 하나에 합 하나 + 같은 적 주사위를 노린 일방 공격 → 화살표 끝 = 그 적의 몸통.
   몸통 자리(enemy-target)에 끌어다 놓으면 주사위가 아니라 몸(die:null)을 노림 */
await go("beccaria"); await answer(true);
const aim=await p.evaluate(()=>{ const B=Game.battle.state, G=Game.battle, a=B.units.find(u=>u.side==="ally");
  const e=B.units.filter(u=>u.side==="enemy").flatMap(u=>u.dice.map((d,i)=>({u:u.id,i,d}))).find(x=>x.d.target&&x.d.target.unit===a.id&&x.d.target.die!=null);
  if(!e) return null; const card=()=>G.hand(a.id).find(c=>G.usable(a.id,c).usable), j=e.d.target.die, k=a.dice.findIndex((d,i)=>i!==j);
  G.assign(a.id,j,card(),{unit:e.u,die:e.i}); if(k>=0) G.assign(a.id,k,card(),{unit:e.u,die:e.i}); window.__battle.render();
  /* 더 빠른 쪽이 그 적 주사위를 끌어가므로 어느 쪽이 합인지는 주사위 값에 따라 다름: 하나는 합, 하나는 일방 공격이면 됨 */
  const cl=[j,k].filter(i=>i>=0&&G.isClash(a.id,i)).length; return {enemy:e.u,clash:cl===1,one:k>=0&&cl===1}; });
await p.waitForTimeout(400);
if(aim&&aim.one){
  const geo=await p.evaluate(en=>{ const body=window.__stage.unitPoint(en,"body"), head=window.__stage.unitPoint(en);
    const ends=[...document.querySelectorAll("#target-arrows path.ally")].map(q=>q.getAttribute("d").trim().split(/[ MQ]+/).filter(Boolean).slice(-2).map(Number));
    const t=document.querySelector(`.enemy-target[data-unit="${en}"]`).getBoundingClientRect();
    return {body,head,ends,tc:{x:t.left+t.width/2,y:t.top+t.height/2},stack:document.querySelectorAll("#dice-stack .st-row").length}; },aim.enemy);
  ok(aim.clash&&geo.stack>=1,"합 짝은 바닥 더미로",{aim,stack:geo.stack});
  ok(geo.ends.length>=1&&geo.ends.every(([x,y])=>Math.hypot(x-geo.body.x,y-geo.body.y)<4)&&geo.body.y>geo.head.y+20,"일방 공격 화살표 끝 = 대상 몸통(머리 위보다 아래)",geo);
  ok(Math.hypot(geo.tc.x-geo.body.x,geo.tc.y-geo.body.y)<4,"몸통 누르는 자리 가운데 = 몸통",geo);
  /* 화살표는 3D 무대가 캐릭터 뒤에 그림: SVG 는 숨기고(자리만), 무대 화살표 수 = path 수, 캐릭터 메시는 화살표(1) 다음 순서(2) */
  const lay=await p.evaluate(()=>{ const sv=document.getElementById("target-arrows"), S=window.__stage; let ch=0, bad=0;
    S.scene.getObjectByName("units").traverse(n=>{ if(n.isMesh&&!n.material.transparent){ ch++; if(n.renderOrder<=1) bad++; } });
    return {hidden:getComputedStyle(sv).visibility==="hidden",paths:sv.querySelectorAll("path").length,stage:S.debug.arrows,ch,bad}; });
  ok(lay.hidden&&lay.paths>0&&lay.stage===lay.paths&&lay.ch>0&&lay.bad===0,"화살표는 캐릭터 뒤(무대가 그림, 캐릭터가 덮음)",lay);
} else ok(false,"합+일방 공격 장면을 못 만듦",aim);
/* 끌어다 몸통에 놓기: 적 주사위가 모두 나보다 빠르면 몸에 일방 공격(die:null), 합 안 잡힌 느린 주사위가 있으면 그것과 합(라오루 규칙) */
for(const fast of [true,false]){ await go("beccaria"); await answer(true);
  const a=await p.evaluate(fast=>{ const B=Game.battle.state, G=Game.battle, a=B.units.find(u=>u.side==="ally"), e=B.units.find(u=>u.side==="enemy"&&u.hp>0&&u.dice.length), c=G.hand(a.id).find(c=>G.usable(a.id,c).usable);
    a.dice[0].speed=fast?1:50; e.dice.forEach(d=>{ d.speed=fast?99:2; }); G.assign(a.id,0,c,null); window.__battle.render(); return {unit:a.id,enemy:e.id}; },fast);
  await p.waitForTimeout(300);
  const from=await (await p.$(`.speed-die[data-unit="${a.unit}"][data-die="0"]`)).boundingBox(), to=await (await p.$(`.enemy-target[data-unit="${a.enemy}"]`)).boundingBox();
  await p.mouse.move(from.x+from.width/2,from.y+from.height/2); await p.mouse.down();
  for(let s=1;s<=8;s++){ await p.mouse.move(from.x+from.width/2+(to.x+to.width/2-from.x-from.width/2)*s/8,from.y+from.height/2+(to.y+to.height/2-from.y-from.height/2)*s/8); await p.waitForTimeout(20); }
  await p.mouse.up(); await p.waitForTimeout(200);
  const t=await p.evaluate(u=>({t:Game.battle.state.units.find(x=>x.id===u).dice[0].target,clash:Game.battle.isClash(u,0)}),a.unit);
  if(fast) ok(t.t&&t.t.unit===a.enemy&&t.t.die==null&&!t.clash,"몸통에 끌어다 놓기(적이 더 빠름) → 그 적의 몸에 일방 공격",t);
  else ok(t.t&&t.t.unit===a.enemy&&t.t.die!=null&&t.clash,"몸통에 끌어다 놓기(내가 더 빠름) → 그 적의 느린 주사위와 합",t); }
/* 누가 누군지(2026-11-23): 체력바 번호 = 발밑 번호(무대에 선 순서, 우두머리 1), 체력바를 누르면 그 캐릭터 발밑 고리가 반짝 */
await go("beccaria"); await answer(true); await p.waitForTimeout(300);
{ const nb=await p.evaluate(()=>{ const S=window.__stage, out=[];
    document.querySelectorAll(".unit-bar").forEach(b=>{ const f=S.figures.get(b.dataset.unit), n=f&&f.ring&&f.ring.getObjectByName("ring-number");
      out.push({u:b.dataset.unit,bar:+b.querySelector(".no").textContent,ring:n?n.userData.n:null}); }); return out; });
  ok(nb.length>=2&&nb.every(x=>x.bar===x.ring),"체력바 번호 = 발밑 번호",nb);
  const bar=await p.$('.unit-bar.enemy:not(.dead)'), uid=await bar.getAttribute("data-unit"); await bar.click(); await p.waitForTimeout(350);
  const fl=await p.evaluate(u=>{ const f=window.__stage.figures.get(u); return {flash:window.__stage.debug.flash,op:f.ring.material.opacity,base:f.ringOp,sc:f.ring.scale.x,ping:document.querySelector(`.unit-bar[data-unit="${u}"]`).classList.contains("ping")}; },uid);
  ok(fl.flash===uid&&(fl.op>fl.base||fl.sc>1.01)&&fl.ping,"체력바를 누르면 그 캐릭터 발밑 고리가 반짝",fl);
  await p.waitForTimeout(800); const back=await p.evaluate(u=>{ const f=window.__stage.figures.get(u); return {op:f.ring.material.opacity,base:f.ringOp,sc:f.ring.scale.x}; },uid);
  ok(back.op===back.base&&back.sc===1,"반짝임은 0.9초 뒤 원래대로",back); }
/* 가로·세로 스크린샷 (배정 단계) */
for(const [w,h] of [[844,390],[390,844]]){ await p.setViewportSize({width:w,height:h}); await go("beccaria"); await answer(true);
  await p.click(`.speed-die[data-side="ally"]`); await p.waitForTimeout(400); await p.screenshot({path:join(ROOT,`shots/ui-battle-${w}.png`)}); }
await p.setViewportSize({width:844,height:390}); await go("beccaria"); await p.waitForSelector("#question.on"); await p.screenshot({path:join(ROOT,"shots/ui-question-844.png")});
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
