/* 앱 한 바퀴(index.html): 층 → 손님 → 전투 → 결과 → 층, 층마다 무대 분위기, 오류 없음 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".json":"application/json",".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox","--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o).slice(0,700));};
const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await p.goto(BASE); await p.evaluate(()=>localStorage.clear()); await p.goto(BASE);
await p.waitForSelector('#ui[data-screen="floors"]',{timeout:20000});
const nFloors=await p.$$eval(".floor-card",e=>e.length);
ok(nFloors===4,"층 카드 4개",{nFloors});
await p.click('.floor-card[data-floor="memory"]');
await p.waitForSelector('#ui[data-screen="guests"]');
ok(await p.evaluate(()=>window.__app.stage.debug.mood)==="moon","기억의 층 → 달빛 무대");
await p.click('#btn-back');
await p.waitForSelector('#ui[data-screen="floors"]');
await p.click('.floor-card[data-floor="crime"]');
await p.waitForSelector('#ui[data-screen="guests"]');
const nGuests=await p.$$eval(".guest-card",e=>e.length);
ok(nGuests===6,"범죄학 층 손님 6명",{nGuests});
ok(await p.evaluate(()=>window.__app.stage.debug.mood)==="lamp","범죄학 층 → 등불 무대");
await p.click('.guest-card[data-guest="beccaria"]');
await p.waitForSelector('#ui[data-screen="battle"]');
/* 전투: 정답 → 배정 → 개막 반복 (길게 눌러 연출 건너뛰기) */
let scenes=0;
while(!(await p.$('#ui[data-screen="result"]'))&&scenes<40){
  scenes++;
  await p.waitForSelector("#question.on",{timeout:30000});
  const q=await p.evaluate(()=>{ const q=Game.battle.question(); return {type:q.type,ci:q.correctIndex,answer:q.answer}; });
  if(q.type==="short"){ await p.fill("#q-short",String(q.answer)); await p.click("#q-submit"); } else await p.click(`.q-opt[data-i="${q.ci}"]`);
  const dice=await p.evaluate(()=>Game.battle.state.units.filter(u=>u.side==="ally"&&u.hp>0).flatMap(u=>u.dice.map((d,i)=>({u:u.id,i}))));
  for(const d of dice){ await p.click(`.speed-die[data-unit="${d.u}"][data-die="${d.i}"]`); const c=await p.$("#hand .card:not(.disabled)"); if(!c) continue; await c.click(); const t=await p.$('.speed-die[data-side="enemy"]')||await p.$('.enemy-target'); if(t) await t.click(); }
  await p.click("#btn-open"); await p.mouse.move(422,200); await p.mouse.down(); await p.waitForTimeout(500); await p.mouse.up();
  await p.waitForFunction(()=>document.querySelector('#ui[data-screen="result"]')||document.querySelector("#question.on"),null,{timeout:30000});
}
ok(!!(await p.$('#ui[data-screen="result"]')),"결과 화면",{scenes});
ok(!!(await p.$('#result img[src$="book-7.webp"]')),"결과에 베카리아 책 표지");
await p.screenshot({path:join(ROOT,"shots/app-result-844.png")});
/* 이겨서 책을 얻었으면 결과에서 바로 도서관 책 탭으로(그 손님 책 선택) */
ok(!!(await p.$("#btn-burn")),"결과에 [도서관에서 소각]");
await p.click("#btn-burn"); await p.waitForSelector('#ui[data-screen="library"] .lib-tab[data-tab="books"].on');
ok(!!(await p.$('.book-item.sel[data-guest="beccaria"]'))&&!!(await p.$("#btn-burn1:not([disabled])")),"책 탭에서 베카리아 책이 골라져 있고 바로 소각 가능");
await p.evaluate(()=>window.__app.nav.floors());
await p.waitForSelector('#ui[data-screen="floors"]');
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem("concept-library-game-v1")).conqueredIds.includes("beccaria")),"저장에 베카리아가 책이 됨");
for(const [w,h] of [[844,390],[390,844]]){ await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(300); await p.screenshot({path:join(ROOT,`shots/app-floors-${w}.png`)});
  await p.click('.floor-card[data-floor="crime"]'); await p.waitForSelector('#ui[data-screen="guests"]'); await p.waitForTimeout(300); await p.screenshot({path:join(ROOT,`shots/app-guests-${w}.png`)}); await p.click("#btn-back"); await p.waitForSelector('#ui[data-screen="floors"]'); }
ok(errs.length===0,"오류 없음",errs);
/* 2026-11-27: 크롬 카메라 구멍(흰 띠) 진단 — ?diag 일 때만 화면 크기·안전 영역 표시, 평소엔 없음. 페이지는 어두운 테마라고 알림(color-scheme) */
{ await p.goto(BASE); await p.waitForFunction(()=>window.__app,null,{timeout:30000});
  const plain=await p.evaluate(()=>({diag:!!document.getElementById("diag"),cs:(document.querySelector('meta[name="color-scheme"]')||{}).content||null}));
  await p.goto(BASE+"?diag"); await p.waitForFunction(()=>window.__app,null,{timeout:30000}); await p.waitForTimeout(300);
  const d=await p.evaluate(()=>{ const el=document.getElementById("diag"); return el?{text:el.textContent,pe:getComputedStyle(el).pointerEvents}:null; });
  ok(!plain.diag&&plain.cs==="dark","평소엔 진단 없음, color-scheme=dark",plain);
  ok(d&&/inner/.test(d.text)&&/safe/.test(d.text)&&/screen/.test(d.text)&&d.pe==="none","?diag: 화면·안전 영역 값 표시(터치 막지 않음)",d); }
/* 2026-11-27: 홈 화면 앱으로 설치 가능(크롬 검사 오류 없음, 테스트 브라우저의 시크릿 모드 오류만 뺌) */
{ await p.goto(BASE.replace("127.0.0.1","localhost")); await p.waitForTimeout(2000);
  const c=await p.context().newCDPSession(p); const r=await c.send("Page.getInstallabilityErrors");
  const errs=(r.installabilityErrors||[]).map(e=>e.errorId).filter(id=>id!=="in-incognito");
  ok(errs.length===0,"앱으로 설치 가능(manifest·아이콘)",r.installabilityErrors); }
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
