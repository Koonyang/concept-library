import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:false,deviceScaleFactor:2});
const port=server.address().port;
const sizes=[[667,375],[844,390],[1024,473],[390,844]];
for(const [w,h] of sizes){
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:2});
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://127.0.0.1:"+port+"/"); await p.waitForFunction(()=>window.__studyGame);
  const tag=`${w}x${h}`;
  // 장서복 3개: 사서 1명, 3/5
  await p.evaluate(()=>{const g=__studyGame,s=g.save,K=g.data.KEY_PAGES.map(k=>k.id); s.unlockedKeyIds=K.slice(0,3); s.equippedKeyId=K[0]; g.libs.sync(s); g.setShelfTab("outfit"); g.setScene("shelf");});
  await p.waitForTimeout(600);
  let t=await p.evaluate(()=>({chips:[...document.querySelectorAll(".lp-chip[data-lib]")].map(c=>c.textContent.trim()),lock:!!document.querySelector(".lp-lock"),prog:document.querySelector(".lp-prog")?.textContent.trim(),party:!!document.querySelector("#lp-party")}));
  ok(t.chips.join()==="큐 양"&&t.lock&&t.prog==="장서복 3/5 · 다음 사서"&&!t.party,`${tag} 사서 1명: 칩 1 + 잠금 + 3/5 표시`,t);
  // 장서복 6개: 사서 2 해금
  await p.evaluate(()=>{const g=__studyGame,s=g.save,K=g.data.KEY_PAGES.map(k=>k.id); s.unlockedKeyIds=K.slice(0,6); g.libs.sync(s); g.setScene("shelf");});
  await p.waitForTimeout(500);
  t=await p.evaluate(()=>({chips:[...document.querySelectorAll(".lp-chip[data-lib]")].map(c=>c.textContent.trim()),prog:document.querySelector(".lp-prog")?.textContent.trim()}));
  ok(t.chips.join()==="큐 양,사서 2"&&t.prog==="장서복 6/10 · 다음 사서",`${tag} 사서 2 해금: 6/10`,t);
  // 레이아웃: 칩줄이 카드 안, 미리보기와 안 겹침, 가로 넘침 없음
  const L=await p.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect(); const pk=R(".lib-pick"),card=R("#dress-char"),st=R("#dc-stage"),row=document.querySelector(".lp-row"); return {inCard:pk.left>=card.left-1&&pk.right<=card.right+1&&pk.top>=card.top-1,noOverlap:pk.bottom<=st.top+2,rowFits:row.scrollWidth<=row.clientWidth+1,pageX:document.documentElement.scrollWidth<=innerWidth+1,chipH:R(".lp-chip").height,footFits:(()=>{const f=document.querySelector(".lp-foot");return f.scrollWidth<=f.clientWidth+1})()};});
  ok(L.inCard&&L.noOverlap&&L.rowFits&&L.footFits&&L.pageX&&L.chipH>=26,`${tag} 칩줄 배치`,L);
  // 사서 2 고르기 → 다른 장서복, 큐 양 장서복은 그대로
  const kyuKey=await p.evaluate(()=>__studyGame.save.librarians.kyu.keyPage);
  await p.click('.lp-chip[data-lib="lib2"]'); await p.waitForTimeout(400);
  t=await p.evaluate(()=>{const s=__studyGame.save; return {active:s.activeLibrarianId,eq:s.equippedKeyId,lib2:s.librarians.lib2.keyPage,kyu:s.librarians.kyu.keyPage,on:document.querySelector(".lp-chip.on")?.dataset.lib,name:document.querySelector(".dc-name").textContent,sub:[...document.querySelectorAll(".dtile .dt-sub")].map(x=>x.textContent)};});
  ok(t.active==="lib2"&&t.on==="lib2"&&t.lib2&&t.lib2!==t.kyu&&t.eq===t.lib2&&t.kyu===kyuKey&&t.name.startsWith("사서 2 · ")&&t.sub.includes("큐 양 착용"),`${tag} 사서 2 선택: 자기 장서복, 큐 양 것 표시`,t);
  // 큐 양 장서복을 사서 2가 고르면 맞바꿈
  await p.click(`[data-t="${kyuKey}"]`); await p.waitForTimeout(250); await p.click("#dd-equip"); await p.waitForTimeout(600);
  t=await p.evaluate(()=>{const s=__studyGame.save; return {lib2:s.librarians.lib2.keyPage,kyu:s.librarians.kyu.keyPage};});
  ok(t.lib2===kyuKey&&t.kyu&&t.kyu!==kyuKey,`${tag} 겹치면 맞바꿈`,t);
  // 접대 출전 토글
  await p.click("#lp-party"); await p.waitForTimeout(300);
  t=await p.evaluate(()=>({party:__studyGame.save.party,dot:!!document.querySelector('.lp-chip[data-lib="lib2"] .lp-in'),btn:document.querySelector("#lp-party").textContent}));
  ok(t.party.join()==="kyu,lib2"&&t.dot&&t.btn==="접대 출전",`${tag} 접대 출전 켜기`,t);
  await p.click("#lp-party"); await p.waitForTimeout(300);
  ok((await p.evaluate(()=>__studyGame.save.party.join()))==="kyu",`${tag} 접대 출전 끄기`);
  // 마지막 한 명은 못 뺌
  await p.click('.lp-chip[data-lib="kyu"]'); await p.waitForTimeout(300); await p.click("#lp-party"); await p.waitForTimeout(300);
  ok((await p.evaluate(()=>__studyGame.save.party.join()+"|"+__studyGame.save.activeLibrarianId))==="kyu|kyu",`${tag} 혼자 남은 사서는 못 뺌`);
  await p.click('.lp-chip[data-lib="lib2"]'); await p.waitForTimeout(400);
  await p.screenshot({path:`${ROOT}/shots/libpick-${tag}.png`});
  // 기프트 탭에도 칩줄
  await p.click('[data-stab="gifts"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!!document.querySelector("#dress-char .lp-chip.on[data-lib='lib2']")&&document.querySelector(".dress-side .dress-head").textContent.includes("두 번째 사서")),`${tag} 기프트 탭: 사서 2의 기프트`);
  await ctx.close();
}
ok(errs.length===0,"no page errors",errs);
await b.close(); server.close(); process.exit(fails?1:0);
