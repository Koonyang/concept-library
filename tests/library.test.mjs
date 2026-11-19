/* 서랍·도서관(책·덱·사서·기프트) 화면: 이동, 소각, 덱 편성, 장착, 스크롤 유지 */
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
const home=async()=>{ await p.goto(BASE); await p.waitForSelector('#ui[data-screen="floors"]',{timeout:20000}); };
const openNav=async()=>{ await p.click("#nav-bm"); await p.waitForSelector("#nav-drawer.open"); };
await p.goto(BASE); await p.evaluate(()=>localStorage.clear()); await home();
/* ---------- Task 1: 서랍 ---------- */
await openNav(); const items=await p.$$eval(".nav-item",e=>e.map(x=>x.dataset.go));
ok(JSON.stringify(items)==='["floors","library","moon"]',"서랍 항목 접대·도서관·계시",items);
await p.click('.nav-item[data-go="library"]'); await p.waitForSelector('#ui[data-screen="library"]');
ok(!(await p.$("#nav-drawer.open")),"이동하면 서랍 닫힘");
await openNav(); await p.click('.nav-item[data-go="moon"]'); await p.waitForSelector('#ui[data-screen="moon"]');
await openNav(); await p.mouse.click(700,200); await p.waitForTimeout(250);
ok(!(await p.$("#nav-drawer.open")),"서랍 밖을 누르면 닫힘");
await openNav(); await p.click('.nav-item[data-go="floors"]'); await p.waitForSelector('#ui[data-screen="floors"]');
await p.click('.floor-card[data-floor="memory"]'); await p.waitForSelector('#ui[data-screen="guests"]');
ok(!!(await p.$("#nav-bm")),"손님 화면에도 서랍 버튼");
await p.click('.guest-card[data-guest="pomodoro"]'); await p.waitForSelector('#ui[data-screen="battle"]');
ok(!(await p.$("#nav-bm"))&&!(await p.$("#btn-set")),"전투 화면엔 서랍·설정 없음");
/* ---------- Task 2: 책 탭 ---------- */
const lib=async(tab)=>{ await home(); await openNav(); await p.click('.nav-item[data-go="library"]'); await p.waitForSelector('#ui[data-screen="library"]'); if(tab){ await p.click(`.lib-tab[data-tab="${tab}"]`); await p.waitForSelector(`.lib-tab[data-tab="${tab}"].on`); } };
await p.evaluate(()=>localStorage.clear()); await lib("books");
ok(!!(await p.$(".lib-pane .empty")),"책이 없으면 빈 상태 안내");
await p.evaluate(()=>{ const G=__studyGame; G.acq.addBooks(G.save,"pomodoro",2); Game.persist(); });
await lib("books");
await p.evaluate(()=>{ let z=7; Math.random=()=>{z|=0;z=z+0x6D2B79F5|0;let t=Math.imul(z^z>>>15,1|z);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}; });
const n0=await p.$eval('.book-item[data-guest="pomodoro"] .cnt',e=>e.textContent);
await p.click('.book-item[data-guest="pomodoro"]'); await p.click("#btn-burn1"); await p.waitForSelector("#burn-result");
const gets=await p.$$eval("#burn-result .burn-get",e=>e.length);
ok(gets>=1,"1권 소각 → 결과 카드에 얻은 것",{gets});
await p.click("#burn-ok"); const n1=await p.$eval('.book-item[data-guest="pomodoro"] .cnt',e=>e.textContent).catch(()=>"없음");
ok(n0.includes("2")&&n1.includes("1"),"권 수 2 → 1",{n0,n1});
/* ---------- Task 3: 덱 탭 ---------- */
await p.evaluate(()=>__studyGame.giveAllPages()); await lib("deck");
const cnt=async()=>p.$eval("#deck-count",e=>+e.textContent.match(/\d+/)[0]);
const d0=await cnt();
await p.$eval("#deck-pool",e=>{ e.scrollTop=e.scrollHeight; }); const st0=await p.$eval("#deck-pool",e=>e.scrollTop);
const cards=await p.$$("#deck-pool .pool-card:not(.full)"); await cards[cards.length-1].click(); const d1=await cnt(); const st1=await p.$eval("#deck-pool",e=>e.scrollTop);
ok(d1===d0+1,"풀 카드 눌러 덱에 넣기",{d0,d1});
ok(Math.abs(st1-st0)<4,"넣어도 목록 스크롤 그대로",{st0,st1});
ok(await p.$eval("#deck-pool .pool-card .rng",e=>/~/.test(e.textContent)&&/정답/.test(e.textContent)&&/오답/.test(e.textContent)),"카드에 정답·오답 범위");
await p.click("#deck-slots .slot-card"); ok(await cnt()===d0,"칸 카드 눌러 빼기");
while(await cnt()>5) await p.click("#deck-slots .slot-card");
ok(!!(await p.$("#deck-count.warn")),"6장 미만이면 경고");
await p.click('.chip[data-f="type"][data-v="방어"]'); const types=await p.$$eval("#deck-pool .pool-card",e=>e.map(x=>x.dataset.types));
ok(types.length>0&&types.every(t=>t.includes("방어")),"종류 필터",{n:types.length});
await openNav(); await p.click('.nav-item[data-go="floors"]'); await p.click('.floor-card[data-floor="memory"]'); await p.waitForSelector('#ui[data-screen="guests"]');
ok(await p.$eval('.guest-card[data-guest="pomodoro"]',e=>e.disabled),"덱 5장이면 접대 버튼 막힘");
await p.evaluate(()=>{ __studyGame.setDeckPages(Game.deck.owned().slice(0,8)); });
/* ---------- Task 4: 사서·기프트 ---------- */
await p.evaluate(()=>{ const s=__studyGame.save; s.unlockedKeyIds=["novice","reading-room"]; __studyGame.libs.sync(s); Game.persist(); });
await lib("libs");
const keyOn0=await p.$eval(".key-card.on",e=>e.dataset.key);
await p.click('.key-card[data-key="reading-room"]'); const keyOn1=await p.$eval(".key-card.on",e=>e.dataset.key);
ok(keyOn0!=="reading-room"&&keyOn1==="reading-room","장서복 착용 바꾸기",{keyOn0,keyOn1});
ok(await p.evaluate(()=>Game.libs.keyOf("kyu").id)==="reading-room","저장에 반영");
await p.evaluate(()=>{ __studyGame.setGifts([Game.data.EGO_GIFTS[0].id],{}); });
await lib("gifts");
const gid=await p.evaluate(()=>Game.data.EGO_GIFTS[0].id);
await p.click(`.gift-card[data-gift="${gid}"]`); ok(!!(await p.$(`.gift-card[data-gift="${gid}"].on`)),"기프트 착용");
await p.click(`.gift-card[data-gift="${gid}"]`); ok(!(await p.$(`.gift-card[data-gift="${gid}"].on`)),"기프트 해제");
for(const [w,h] of [[844,390],[390,844]]){ await p.setViewportSize({width:w,height:h}); for(const t of ["books","deck","libs","gifts"]){ await lib(t); await p.waitForTimeout(250); await p.screenshot({path:join(ROOT,`shots/lib-${t}-${w}.png`)}); } }
await p.setViewportSize({width:844,height:390});
/* @@NEXT@@ */
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
