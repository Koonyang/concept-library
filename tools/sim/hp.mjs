/* 다대다 실제 체력·흐트러짐·주사위 수: node tools/sim/hp.mjs  (GUESTS=쉼표 목록, 기본 defamation-truth,beccaria,pomodoro; 사서 1명·3명) */
import { chromium } from "playwright-core";
import { createServer } from "http";import { readFileSync, existsSync } from "fs";import { extname, join, normalize } from "path";
import { LIB_ROOT, launchBrowser } from "../../tests/lib/browser.mjs";
const ROOT=LIB_ROOT;
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!existsSync(a)){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":extname(a)===".html"?"text/html; charset=utf-8":"application/octet-stream"});r.end(readFileSync(a))});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"],headless:true});
const p=await b.newPage(); await p.goto("http://127.0.0.1:"+server.address().port+"/?multi=1");await p.waitForFunction(()=>window.__studyGame&&__studyGame.battleApi);
console.log(await p.evaluate((GUESTS)=>{ const G=__studyGame,A=G.battleApi,s=G.save,L=[]; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"]; G.libs.sync(s); G.libs.equipKey(s,"lib2","archivist"); G.libs.equipKey(s,"lib3","classical-robe");
 for(const n of [1,3]) for(const gid of GUESTS){ G.libs.setParty(s,["kyu","lib2","lib3"].slice(0,n)); A.create(gid); const B=A.mb.battle; L.push("party"+n+" "+gid+" Q"+A.questionCount(gid)+" | "+B.units.map(u=>(u.key||u.libId)+"("+(u.side==="enemy"?"q"+A.internals()[u.id].e.q.length+(u.leader?",우두머리":""):"사서")+") HP "+u.maxHp+" / 흐트 "+u.maxStagger+" / 주사위 "+(u.side==="enemy"?A.internals()[u.id].S.speedDice:2)).join(" · ")); }
 return L.join("\n"); },(process.env.GUESTS||"defamation-truth,beccaria,pomodoro").split(",")));
await b.close(); server.close();
