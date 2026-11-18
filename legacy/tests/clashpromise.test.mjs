/* BattleStage.clash(ev,{fast}) → Promise: 카메라 다가감·부딪침·빠짐, 손패/버튼 숨김, 탭 빨리 감기, 길게 눌러 건너뛰기 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(+(process.env.PORT||0),"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
let fails=0; const ok=(c,m,x)=>{ console.log((c?"PASS ":"FAIL ")+m+(x!==undefined?" "+JSON.stringify(x):"")); if(!c) fails++; };
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
for(const [w,h] of [[844,390],[390,844]]){
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>{ const G=__studyGame,s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
  await p.waitForTimeout(1200); await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(800);
  await p.evaluate(()=>{
    const vis=sel=>{ const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e); return c.visibility!=="hidden"&&c.display!=="none"&&+c.opacity>0; };
    window.__vis=()=>({hand:vis(".bs-fan"),btn:vis("#btn-mb-go"),on:!!document.querySelector(".battle-stage.bs-cam-on")});
    const a=__studyGame.battleApi.mb.battle.units.find(u=>u.side==="ally").id;
    window.__ev={
      neu1:{kind:"clash",a:{unit:a,die:0,card:{dice:[{type:"slash"}]},values:[4]},b:{unit:"e1",die:0,card:{dice:[{type:"참격"}]},values:[2]},steps:[{aVal:4,bVal:2,winner:"a",dmg:{unit:"e1",hp:1,stagger:1}}],result:{staggered:[],dead:[]}},
      neu3:{kind:"clash",a:{unit:"e1",die:0,card:{dice:[{type:"관통"},{type:"타격"},{type:"참격"}]}},b:{unit:a,die:1,card:{dice:[{type:"guard"}]}},steps:[{winner:"a"},{winner:"b"},{winner:"tie"}],result:{}},
      one:{kind:"one-sided",a:{unit:"e2",die:0,card:{dice:[{type:"blunt"}]}},b:null,steps:[{winner:"a",dmg:{unit:a,hp:2,stagger:1}}],result:{}},
      old:{kind:"clash",ally:a,allyDie:0,enemy:"e1",enemyDie:0,win:"ally",by:{unit:a,die:0},steps:[]}};
    window.__run=(k,o)=>{ const t0=performance.now(); const pr=BattleStage.clash(__ev[k],o); window.__isP=pr instanceof Promise; window.__p=pr.then(()=>Math.round(performance.now()-t0)); return __isP; };
  });
  const before=await p.evaluate(()=>__vis());
  ok(before.hand&&before.btn&&!before.on,`${w}x${h} 시작 전 손패·버튼 보임`,before);
  // 1) 새 모양 한 합
  ok(await p.evaluate(()=>__run("neu1")),`${w}x${h} clash 는 Promise`);
  await p.waitForTimeout(250); const mid=await p.evaluate(()=>({...__vis(),focus:document.querySelector(".bs").classList.contains("focus")}));
  const t1=await p.evaluate(()=>__p); await p.waitForTimeout(30); const after=await p.evaluate(()=>__vis());
  ok(!mid.hand&&!mid.btn&&mid.on&&mid.focus,`${w}x${h} 카메라 중 손패·버튼 숨김`,mid);
  ok(t1>=800&&t1<=1150,`${w}x${h} 한 합 ≈ clashMs`,t1);
  ok(after.hand&&after.btn&&!after.on,`${w}x${h} 끝나면 다시 보임`,after);
  // 2) steps 3개 → 길어지되 1.6초 이하
  await p.evaluate(()=>__run("neu3")); const t3=await p.evaluate(()=>__p);
  ok(t3>t1+200&&t3<=1700,`${w}x${h} steps 3개 길이`,t3);
  // 3) 일방 (b:null)
  await p.evaluate(()=>__run("one")); await p.waitForTimeout(200); const om=await p.evaluate(()=>({...__vis(),fl:document.querySelector(".bs-unit.ally.flinch")!=null||true}));
  const to=await p.evaluate(()=>__p); ok(to>=800&&to<=1150&&om.on,`${w}x${h} 일방 공격도 같은 흐름`,{to,om});
  // 4) 예전 모양
  await p.evaluate(()=>__run("old")); const tOld=await p.evaluate(()=>__p); ok(tOld>=800&&tOld<=1150,`${w}x${h} 예전 이벤트 모양`,tOld);
  // 5) 탭 = 빨리 감기
  await p.evaluate(()=>{ window.__sk=0; BattleStage.onSkip=()=>__sk++; __run("neu1"); }); await p.waitForTimeout(150);
  const R=await p.evaluate(()=>{ const r=document.querySelector(".bs").getBoundingClientRect(); return {x:r.left+r.width*.5,y:r.top+30}; });
  await p.touchscreen.tap(R.x,R.y); const tTap=await p.evaluate(()=>__p); const sk=await p.evaluate(()=>__sk);
  ok(tTap<650&&sk===1,`${w}x${h} 탭하면 빨리 끝남 + onSkip`,{tTap,sk});
  await p.waitForTimeout(50); ok((await p.evaluate(()=>__vis())).hand,`${w}x${h} 빨리 감은 뒤 손패 보임`);
  // 6) 길게 누르기 = 남은 합 모두 즉시
  await p.evaluate(()=>__run("neu3")); await p.waitForTimeout(100);
  await p.mouse.move(R.x,R.y); await p.mouse.down(); await p.waitForTimeout(520); await p.mouse.up();
  const tHold=await p.evaluate(()=>__p);
  await p.evaluate(()=>__run("neu1")); const tNext=await p.evaluate(()=>__p); const v2=await p.evaluate(()=>__vis());
  ok(tHold<700&&tNext<40&&!v2.on,`${w}x${h} 길게 누르면 지금·다음 합 즉시`,{tHold,tNext,v2});
  // 배치 단계로 다시 그리면 건너뛰기 풀림
  await p.evaluate(()=>BattleStage.render(__studyGame.battleApi.mb.battle)); await p.evaluate(()=>__run("neu1")); const tBack=await p.evaluate(()=>__p);
  ok(tBack>=800,`${w}x${h} 배치 단계 render 후 건너뛰기 풀림`,tBack);
  // 7) fast 옵션
  await p.evaluate(()=>__run("neu1",{fast:true})); await p.waitForTimeout(60); const fv=await p.evaluate(()=>__vis()); const tf=await p.evaluate(()=>__p);
  ok(tf<=400&&!fv.on,`${w}x${h} {fast:true} 카메라 없이 짧게`,{tf,fv});
  // 8) 예전 흐름: focus(ev) 로 맞춘 뒤 clash → 카메라 그대로, 끝나면 focus(null)
  await p.evaluate(()=>{ BattleStage.focus(__ev.old); }); await p.waitForTimeout(400);
  const fo=await p.evaluate(()=>({...__vis()})); await p.evaluate(()=>__run("old")); const tExt=await p.evaluate(()=>__p);
  const still=await p.evaluate(()=>document.querySelector(".bs").classList.contains("focus"));
  await p.evaluate(()=>BattleStage.focus(null)); await p.waitForTimeout(400); const fo2=await p.evaluate(()=>__vis());
  ok(fo.on&&!fo.hand&&still&&tExt<700&&fo2.hand&&fo2.btn&&!fo2.on,`${w}x${h} 예전 focus 흐름도 그대로`,{fo,tExt,still,fo2});
  // 기다리지 않는 호출도 문제없음
  await p.evaluate(()=>{ BattleStage.clash(__ev.neu1); BattleStage.clash(__ev.one); }); await p.waitForTimeout(1450);   /* clashMs 1000 + 카메라 빠짐 320 */
  ok(!(await p.evaluate(()=>__vis())).on,`${w}x${h} 기다리지 않고 연달아 불러도 끝나면 정리`);
  // 9) 실제 합 진행 버튼 흐름 (예전 mbRunResolve) 이 오류 없이 끝남
  await p.evaluate(()=>{ BattleStage.onSkip=null; }); 
  const go=await p.$("#btn-mb-go"); if(go){ await go.click().catch(()=>{}); }
  await p.waitForTimeout(6000);
  ok(!errs.length,`${w}x${h} 페이지 오류 없음`,errs);
  await p.screenshot({path:`shots/clashpromise-${w}.png`});
  await p.close();
}
await b.close(); server.close();
console.log(fails?`${fails} FAIL`:"ALL PASS"); if(fails) process.exitCode=1;
