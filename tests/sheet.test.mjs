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
for(const [w,h] of [[360,740],[390,844],[412,915]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
  await p.goto("http://127.0.0.1:"+server.address().port+"/?multi=0"); /* 1:1 접대 진입 검사 */ await p.waitForFunction(()=>window.__studyGame);
  const open=async(gid)=>{ await p.evaluate(()=>__studyGame.setScene("lobby")); await p.waitForTimeout(200); await p.locator(gid?`[data-guest="${gid}"]`:"[data-guest]").first().tap(); await p.waitForTimeout(700); };
  const isOpen=()=>p.evaluate(()=>document.querySelector("#guest-sheet").classList.contains("on"));
  for(const gid of ["three-conditions","limits"]){
    await open(gid);
    ok(await isOpen(),`${w}x${h} ${gid}: sheet opens`);
    const g=await p.evaluate(()=>{const r=document.querySelector("#sheet-close").getBoundingClientRect();const t=document.querySelector("#guest-sheet h3").getBoundingClientRect();
      const cx=r.left+r.width/2,cy=r.top+r.height/2; const hit=document.elementFromPoint(cx,cy);
      const corners=[[r.left+2,r.top+2],[r.right-2,r.top+2],[r.left+2,r.bottom-2],[r.right-2,r.bottom-2]].map(([x,y])=>{const e=document.elementFromPoint(x,y);return !!e&&!!e.closest("#sheet-close");});
      return {w:r.width,h:r.height,cx,cy,right:innerWidth-r.right,top:r.top,hitOk:!!hit.closest("#sheet-close"),corners,overlapTitle:!(t.right<r.left||t.left>r.right||t.bottom<r.top||t.top>r.bottom),text:document.querySelector("#sheet-close").innerText.trim(),hasSvg:!!document.querySelector("#sheet-close svg")};});
    ok(g.w>=48&&g.h>=48&&g.hitOk&&g.corners.every(Boolean)&&!g.overlapTitle&&g.hasSvg&&g.text==="","X button >=48x48, hittable on all corners, no title overlap, svg only",g);
    await p.touchscreen.tap(g.cx,g.cy); await p.waitForTimeout(700);
    ok(!(await isOpen()),`${w}x${h} ${gid}: tap at X coordinates closes the sheet`);
  }
  // backdrop
  await open(); const sb=await p.evaluate(()=>{const r=document.querySelector("#guest-sheet").getBoundingClientRect();return r.top;});
  await p.touchscreen.tap(w/2,Math.max(30,sb/2)); await p.waitForTimeout(700);
  ok(!(await isOpen()),`${w}x${h}: tap on dimmed backdrop closes`,{sheetTop:sb});
  // swipe down on handle (pointer events via mouse)
  await open(); let hb=await p.evaluate(()=>{const r=document.querySelector("#sheet-grab .sheet-handle").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
  await p.mouse.move(hb.x,hb.y); await p.mouse.down(); await p.mouse.move(hb.x,hb.y+40,{steps:4}); await p.mouse.move(hb.x,hb.y+140,{steps:6}); await p.mouse.up(); await p.waitForTimeout(700);
  ok(!(await isOpen()),`${w}x${h}: swipe down on the grab handle closes`);
  // short drag does not close
  await open(); hb=await p.evaluate(()=>{const r=document.querySelector("#sheet-grab .sheet-handle").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
  await p.mouse.move(hb.x,hb.y); await p.mouse.down(); await p.mouse.move(hb.x,hb.y+30,{steps:4}); await p.mouse.up(); await p.waitForTimeout(600);
  ok(await isOpen(),`${w}x${h}: a short drag (<64px) snaps back, sheet stays open`);
  // touch swipe on sheet body at scrollTop 0 using CDP touch
  const cdp=await ctx.newCDPSession(p);
  const sheetBox=await p.evaluate(()=>{const r=document.querySelector("#guest-sheet").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+90}});
  const tp=(type,y)=>cdp.send("Input.dispatchTouchEvent",{type,touchPoints:type==="touchEnd"?[]:[{x:sheetBox.x,y}]});
  await tp("touchStart",sheetBox.y); for(let i=1;i<=8;i++){await tp("touchMove",sheetBox.y+i*20);} await tp("touchEnd",0); await p.waitForTimeout(700);
  ok(!(await isOpen()),`${w}x${h}: touch swipe-down on the sheet closes`);
  if(w===390){ await open("bentham"); await p.screenshot({path:ROOT+"/shots/30-guest-sheet-x-390.png"}); }
  // resist pop X
  await p.evaluate(()=>{__studyGame.setScene("lobby");__studyGame.beginReception("pomodoro");}); await p.waitForTimeout(900);
  await p.evaluate(()=>document.querySelector("#gst-char").click()); await p.waitForTimeout(300);
  const rp=await p.evaluate(()=>{const r=document.querySelector("#rp-close").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};});
  await p.touchscreen.tap(rp.x,rp.y); await p.waitForTimeout(400);
  ok(rp.w>=48&&rp.h>=48&&!(await p.evaluate(()=>document.querySelector("#resist-pop").classList.contains("on"))),`${w}x${h}: resist-pop X closes (>=48px)`,rp);
  await ctx.close();
}
console.log("errors:",errs.length,errs.slice(0,3)); console.log("fails:",fails);
await b.close(); server.close(); process.exit(fails?1:0);
