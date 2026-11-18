/* 겹침 검사(새 UI): 전투 UI끼리(속도 주사위·체력/흐트러짐 막대·화살표·손패·[개막]·상태판·문제) 겹침 0건이어야 통과. 화면별 개수를 출력. node tests/overlap-check.mjs */
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
const party3=`(()=>{ const G=__studyGame, s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"]; G.libs.sync(s);
  G.libs.equipKey(s,"lib2","archivist"); G.libs.equipKey(s,"lib3","classical-robe"); G.libs.setParty(s,["kyu","lib2","lib3"]); Game.persist(); })()`;
const solo=`(()=>{ const G=__studyGame, s=G.save; G.libs.setParty(s,["kyu"]); Game.persist(); })()`;
/* 화면의 전투 UI 상자를 모아 서로 다른 요소끼리 겹치는 쌍을 센다 */
const measure=`(()=>{ const R=e=>{ const r=e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; }, vis=e=>{ const s=getComputedStyle(e); return s.display!=="none"&&s.visibility!=="hidden"&&e.getBoundingClientRect().width>0; };
  const boxes=[];
  document.querySelectorAll(".unit-bar").forEach(e=>vis(e)&&boxes.push({k:"bar:"+e.dataset.unit,g:"bars",...R(e)}));
  document.querySelectorAll(".die-row").forEach(e=>vis(e)&&boxes.push({k:"dice:"+e.dataset.unit,g:"dice:"+e.dataset.unit,...R(e)}));
  for(const id of ["hand","btn-open","status","question","learn"]){ const e=document.getElementById(id); if(e&&vis(e)) boxes.push({k:id,g:id,...R(e)}); }
  /* 화살표: 곡선 위 점 몇 개를 작은 상자로(이어지는 주사위와는 비교 안 함) */
  document.querySelectorAll("#target-arrows path").forEach((p,i)=>{ const L=p.getTotalLength(); for(const t of [0.25,0.5,0.75]){ const q=p.getPointAtLength(L*t); boxes.push({k:"arrow"+i+"@"+t,g:"arrow",x:q.x-2,y:q.y-2,w:4,h:4}); } });
  const hits=[]; for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){ const a=boxes[i], b=boxes[j]; if(a.g===b.g) continue; if(a.g==="arrow"&&b.g.startsWith("dice")||b.g==="arrow"&&a.g.startsWith("dice")) continue; if(a.g==="arrow"&&b.g==="arrow") continue;
    const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x), oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y); if(ox>2&&oy>2) hits.push(a.k+" × "+b.k); }
  const W=innerWidth,H=innerHeight, out=boxes.filter(b=>b.g!=="arrow"&&(b.x<-1||b.y<-1||b.x+b.w>W+1||b.y+b.h>H+1)).map(b=>b.k+" 화면 밖");
  return {n:boxes.length,hits:hits.concat(out)}; })()`;
async function scene(gid, setup, phase, fullHand){
  /* 사서 구성은 다시 불러오면 장서복 검사로 줄어들 수 있으니, 같은 페이지에서 설정한 뒤 전투를 새로 띄운다 */
  await p.goto(BASE+"tests/battle.html?guest="+gid); await p.waitForFunction(()=>window.__ready,null,{timeout:20000});
  await p.evaluate(setup); await p.evaluate(async()=>{ window.__battle.unmount(); Game.battle.leave(); window.__battle=await window.__mount(); });
  await p.waitForSelector("#question.on");
  const nU=await p.evaluate(()=>Game.battle.state.units.length); if(setup===party3&&nU!==6) { fails++; console.log("FAIL 3:3 이 아님",nU); }
  if(phase!=="question"){ const ci=await p.evaluate(()=>Game.battle.question().correctIndex); await p.evaluate(ci=>{ const b=document.querySelector(`.q-opt[data-i="${ci}"]`); if(b) b.click(); else Game.battle.answer(true); },ci);
    if(fullHand) await p.evaluate(()=>{ const X=__studyGame.battleApi.internals(), a=Game.battle.state.units.find(u=>u.side==="ally"); X[a.id].handIds=["turn-page","margin-guard","silence","breathe","focus-line","page-echo","cover-slam","stamp-seal"]; });
    /* 첫 사서 주사위 하나에 카드를 놓아 화살표도 생기게 */
    await p.evaluate(()=>{ const B=Game.battle.state, a=B.units.find(u=>u.side==="ally"), e=B.units.find(u=>u.side==="enemy"); const c=Game.battle.hand(a.id).find(c=>Game.battle.usable(a.id,c).usable); if(c) Game.battle.assign(a.id,0,c,{unit:e.id,die:e.dice.length?0:null}); });
    await p.click(`.speed-die[data-side="ally"]`); }
  await p.waitForTimeout(500); return p.evaluate(measure);
}
let total=0;
for(const [w,h] of [[844,390],[390,844]]) for(const [pn,setup] of [["1:3",solo],["3:3",party3]]) for(const [ph,full] of [["question",false],["assign",false],["assign-hand8",true]]){
  if(pn==="1:3"&&ph==="assign-hand8") continue;
  await p.setViewportSize({width:w,height:h});
  const r=await scene("beccaria",setup,ph.startsWith("assign")?"assign":"question",full);
  total+=r.hits.length; console.log(`${r.hits.length?"FAIL":"PASS"} ${w}x${h} ${pn} ${ph}: overlaps ${r.hits.length} (상자 ${r.n})`+(r.hits.length?" — "+r.hits.slice(0,6).join(", "):""));
  if(r.hits.length) await p.screenshot({path:join(ROOT,`shots/overlap/${w}-${pn.replace(":","v")}-${ph}.png`)});
}
console.log("fighter-front-ui: 참고용(이번 검사에서 세지 않음)");
ok(total===0,"전투 UI 겹침 0건",{total});
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
