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
/* @@NEXT@@ */
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
