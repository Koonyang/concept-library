import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const URL="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
const wait=ms=>p.waitForTimeout(ms);
await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
for (const [w,h] of [[360,740],[390,844],[412,915],[844,390],[740,360],[1440,900]]){
  await p.setViewportSize({width:w,height:h}); await p.evaluate(()=>__studyGame.setScene("lobby")); await wait(500);
  const m=await p.evaluate(()=>[...document.querySelectorAll(".guest-card .bust")].map(b=>{const B=b.getBoundingClientRect(),a=b.firstElementChild.getBoundingClientRect();return {dx:+((a.left+a.width/2)-(B.left+B.width/2)).toFixed(1),dy:+((a.top+a.height/2)-(B.top+B.height/2)).toFixed(1),aw:Math.round(a.width),bw:Math.round(B.width)};}));
  ok(m.length&&m.every(x=>Math.abs(x.dx)<=1&&Math.abs(x.dy)<=1),`portraits centered ${w}x${h}`,m.slice(0,2));
  await p.screenshot({path:ROOT+`/shots/guest-center-${w}.png`});
}
ok(!errs.length,"no errors",errs);
await b.close(); server.close(); process.exit(fails?1:0);
