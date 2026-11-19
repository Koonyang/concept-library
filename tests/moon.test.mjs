/* 달의 계시 화면: 시작 → 퀴즈(정답·오답) → 재현시 다리 → 건너뛰기 → 결과, 다시 들어오면 결과, 떠나면 타이머 정리 */
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
await p.goto(BASE); await p.evaluate(()=>localStorage.clear()); await p.goto(BASE); await p.waitForSelector('#ui[data-screen="floors"]',{timeout:20000});
const toMoon=async()=>{ await p.click("#nav-bm"); await p.waitForSelector("#nav-drawer.open"); await p.click('.nav-item[data-go="moon"]'); await p.waitForSelector('#ui[data-screen="moon"]'); };
await toMoon();
ok(!!(await p.$("#moon-start")),"시작 화면에 [시작]");
const words=await p.$eval(".moon-intro",e=>e.textContent);
ok(/\d+\s*단어/.test(words),"오늘 단어 수 안내",words.slice(0,80));
await p.click("#moon-start"); await p.waitForSelector("#moon-q");
ok(!(await p.$("#nav-bm")),"퀴즈 중엔 서랍 없음");
/* 3개 정답, 2개 오답 */
for(let i=0;i<5;i++){ const ci=await p.evaluate(()=>Game.moon.current().correctIndex); const pick=i<3?ci:(ci+1)%4;
  await p.click(`.moon-opt[data-i="${pick}"]`); await p.waitForFunction(n=>Game.moon.state.i>=n||Game.moon.state.phase!=="quiz",i+1); await p.waitForTimeout(i<3?200:700); }
ok(await p.$eval("#moon-score",e=>e.textContent.includes("3")),"점수 3");
await p.evaluate(()=>{ window.__moonUI&&window.__moonUI.timeUp(); });   /* 남은 시간을 0으로 */
await p.waitForSelector("#moon-bridge",{timeout:5000});
ok(true,"시간이 끝나면 재현시 다리");
await p.click("#moon-skip"); await p.waitForSelector("#moon-result");
const sv=await p.evaluate(()=>({...JSON.parse(localStorage.getItem("concept-library-game-v1")).moon,today:Game.moon.today()}));
ok(sv&&sv.reveal===3&&sv.date===sv.today,"저장에 오늘 계시 점수",sv);
ok(!!(await p.$("#nav-bm")),"결과 화면엔 서랍 다시 보임");
await p.click("#nav-bm"); ok(await p.$eval('.nav-item[data-go="moon"] em',e=>e.textContent).catch(()=>"")==="완료","서랍에 계시 완료 표시");
await p.click('.nav-item[data-go="floors"]'); await p.waitForSelector('#ui[data-screen="floors"]');
await toMoon(); ok(!!(await p.$("#moon-result")),"다시 들어가면 바로 결과");
/* 서고의 편린: 재현시를 건너뛰었으니 계시에서 틀리거나 못 푼 단어(전체-3)가 모두 편린 → 오늘 묶음에 안 나옴 → 골라서 정화 */
const sh=await p.evaluate(()=>{ const ids=new Set(Game.save.moonShards), t=Game.moon.todaysWords(); return {n:ids.size,total:Game.save.moonLast.total,today:t.length,overlap:t.filter(w=>ids.has(Game.moon.keyOf(w))).length}; });
ok(sh.n===sh.total-3&&sh.today===Math.min(30,sh.total)&&sh.overlap===0,"편린: 못 맞힌 단어가 쌓이고, 오늘 묶음엔 빠지고 다음 단어로 채움",sh);
await p.click("#moon-shards"); await p.waitForSelector(".shard-list");
ok(await p.$$eval(".shard",l=>l.length)===sh.n&&await p.$eval("#shard-purify",e=>e.disabled),"편린 목록: 카드 수 = 편린 수, 고르기 전엔 [정화] 꺼짐");
const two=await p.$$(".shard"); await two[0].click(); await two[1].click();
ok(await p.$eval("#shard-n",e=>e.textContent)==="2"&&!(await p.$eval("#shard-purify",e=>e.disabled)),"두 개 고르면 [정화] 켜짐");
await p.click("#shard-purify"); await p.waitForSelector("#moon-q");
ok(await p.$eval(".moon-top .kind",e=>e.textContent)==="정화"&&await p.evaluate(()=>Game.moon.state.qs.length)===2,"정화 = 고른 단어만 재현시");
{ const ci=await p.evaluate(()=>Game.moon.current().correctIndex); await p.click(`.moon-opt[data-i="${ci}"]`); await p.waitForTimeout(250);
  const c2=await p.evaluate(()=>Game.moon.current().correctIndex); await p.click(`.moon-opt[data-i="${(c2+1)%4}"]`); }
await p.waitForSelector("#moon-purified",{timeout:5000});
const pf=await p.evaluate(()=>({n:Game.save.moonShards.length,moon:Game.save.moon}));
ok(pf.n===sh.n-1&&pf.moon.reveal===sv.reveal&&pf.moon.replay===sv.replay,"정화: 맞힌 1개만 편린에서 빠지고 오늘 점수는 그대로",pf);
await p.click("#moon-done"); await p.waitForSelector("#moon-result");
/* 퀴즈 중 나가면 타이머 정리 */
await p.evaluate(()=>{ const s=Game.save; s.moon=null; Game.persist(); });
await p.click("#nav-bm"); await p.click('.nav-item[data-go="floors"]'); await toMoon(); await p.click("#moon-start"); await p.waitForSelector("#moon-q");
await p.evaluate(()=>window.__app.nav.floors()); await p.waitForTimeout(300);
const leak=await p.evaluate(()=>window.__moonTicks||0); await p.waitForTimeout(500); const leak2=await p.evaluate(()=>window.__moonTicks||0);
ok(leak2===leak,"나가면 계시 시계가 멈춤",{leak,leak2});
for(const [w,h] of [[844,390],[390,844]]){ await p.setViewportSize({width:w,height:h}); await p.evaluate(()=>{ Game.save.moon=null; Game.persist(); }); await p.evaluate(()=>window.__app.nav.moon()); await p.waitForTimeout(400); await p.screenshot({path:join(ROOT,`shots/moon-intro-${w}.png`)});
  await p.click("#moon-start"); await p.waitForSelector("#moon-q"); await p.waitForTimeout(300); await p.screenshot({path:join(ROOT,`shots/moon-quiz-${w}.png`)}); await p.evaluate(()=>window.__app.nav.floors()); }
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
