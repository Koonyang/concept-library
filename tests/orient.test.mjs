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
async function run(label,opts,stub){
  const ctx=await b.newContext(opts); const p=await ctx.newPage(); const errs=[];
  p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
  await p.addInitScript(stub);
  await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
  await p.tap("#btn-enter").catch(()=>p.click("#btn-enter")); await p.waitForTimeout(900);
  const r=await p.evaluate(()=>({log:window.__log||[],scene:document.querySelector(".scene.on")&&document.querySelector(".scene.on").id,rotateNag:!!document.body.innerText.match(/회전|돌려|rotate/i)}));
  if(label==="android"){ // leave + re-enter fullscreen → re-lock
    await p.evaluate(()=>{ window.__fs=null; document.dispatchEvent(new Event("fullscreenchange")); window.__fs=document.documentElement; document.dispatchEvent(new Event("fullscreenchange")); });
    r.after=await p.evaluate(()=>window.__log);
  }
  await ctx.close(); return {...r,errs};
}
// Android-like: fullscreen + lock succeed
const android=await run("android",{viewport:{width:412,height:915},isMobile:true,hasTouch:true},()=>{
  window.__log=[]; window.__fs=null;
  Object.defineProperty(document,"fullscreenElement",{get:()=>window.__fs,configurable:true});
  Element.prototype.requestFullscreen=function(){ window.__log.push("fs"); window.__fs=this; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); };
  Object.defineProperty(screen,"orientation",{value:{type:"portrait-primary",lock(o){ window.__log.push("lock:"+o); return Promise.resolve(); },addEventListener(){} },configurable:true});
});
ok(android.log[0]==="fs"&&android.log.includes("lock:landscape"),"Android: entry tap requests fullscreen, then locks landscape",android.log);
ok(android.scene==="scene-lobby","Android: game enters lobby normally",android.scene);
ok(android.after.filter(x=>x==="lock:landscape").length>android.log.filter(x=>x==="lock:landscape").length,"Android: re-entering fullscreen re-locks",android.after);
ok(!android.errs.length,"Android: no console errors",android.errs);
// iOS-like: no requestFullscreen, no orientation.lock
const ios=await run("ios",{viewport:{width:390,height:844},isMobile:true,hasTouch:true},()=>{
  window.__log=[]; Element.prototype.requestFullscreen=undefined; Element.prototype.webkitRequestFullscreen=undefined;
  Object.defineProperty(screen,"orientation",{value:{type:"portrait-primary",addEventListener(){}},configurable:true});
});
ok(ios.scene==="scene-lobby"&&!ios.errs.length&&!ios.rotateNag,"iOS: no fullscreen API → silently continues, no nag",ios);
// Failing: both reject/throw
const bad=await run("bad",{viewport:{width:412,height:915},isMobile:true,hasTouch:true},()=>{
  window.__log=[];
  Element.prototype.requestFullscreen=function(){ window.__log.push("fs"); return Promise.reject(new Error("denied")); };
  Object.defineProperty(screen,"orientation",{value:{lock(){ window.__log.push("lock"); throw new Error("NotSupported"); },addEventListener(){}},configurable:true});
});
ok(bad.scene==="scene-lobby"&&!bad.errs.length,"rejected fullscreen / throwing lock are ignored",bad);
// Desktop: no fullscreen requested
const desk=await run("desk",{viewport:{width:1280,height:800}},()=>{
  window.__log=[]; Element.prototype.requestFullscreen=function(){ window.__log.push("fs"); return Promise.resolve(); };
});
ok(!desk.log.includes("fs")&&desk.scene==="scene-lobby","desktop: no fullscreen takeover",desk.log);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
