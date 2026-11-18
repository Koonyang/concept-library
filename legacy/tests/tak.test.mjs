import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";import { readFileSync, existsSync, writeFileSync } from "fs";import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".webp":"image/webp",".png":"image/png",".woff2":"font/woff2"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!existsSync(a)){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a))});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"],headless:true});
const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[];p.on("pageerror",e=>errs.push(String(e)));p.on("console",m=>(m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||""))&&errs.push(m.text()));
await p.goto("http://127.0.0.1:"+server.address().port+"/?multi=0"); /* 1:1 손패→문제 흐름의 탁 소리 검사 */await p.waitForFunction(()=>window.__studyGame);
await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForFunction(()=>window.__studyGame);
// offline render
const arr=await p.evaluate(async()=>Array.from(await __studyGame.SFX.renderTakOffline()));
let peak=0;arr.forEach(v=>peak=Math.max(peak,Math.abs(v)));
const sr=44100;const win=n=>{let s=0;for(let i=0;i<n;i++)s+=arr[i]**2;return Math.sqrt(s/n)};
const seg=(a,b)=>{let s=0;for(let i=Math.floor(a*sr);i<Math.floor(b*sr);i++)s+=arr[i]**2;return Math.sqrt(s/((b-a)*sr))};
console.log("peak",peak.toFixed(3),"rms 10-40ms",seg(.01,.04).toFixed(3),"rms 100-150ms",seg(.1,.15).toFixed(4),"rms 300-600ms",seg(.3,.6).toFixed(5));
// last sample above -60dB
let last=0;arr.forEach((v,i)=>{if(Math.abs(v)>.001)last=i});console.log("audible until ms",(last/sr*1000).toFixed(0));
const buf=Buffer.alloc(44+arr.length*2);buf.write("RIFF",0);buf.writeUInt32LE(36+arr.length*2,4);buf.write("WAVEfmt ",8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(sr,24);buf.writeUInt32LE(sr*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write("data",36);buf.writeUInt32LE(arr.length*2,40);
arr.forEach((v,i)=>buf.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(v*32767))),44+i*2));writeFileSync(ROOT+"/shots/tak-preview.wav",buf);
// live trigger
await p.evaluate(()=>{__studyGame.setScene("lobby");__studyGame.beginReception(document.querySelector("[data-guest]").dataset.guest)});
await p.waitForTimeout(800);
await p.mouse.click(200,400); // user gesture -> prime/resume
const st1=await p.evaluate(()=>({n:__studyGame.SFX.takCount}));
const pageId=await p.evaluate(()=>document.querySelector("#hand .cc:not(.off)").dataset.page);
await p.evaluate(id=>__studyGame.choosePage(id),pageId);
await p.waitForTimeout(120);
const st2=await p.evaluate(()=>({n:__studyGame.SFX.takCount,stamp:!!document.querySelector(".tak-stamp"),phase:document.querySelector("#qpanel.on")?"question":"?"}));
console.log("before",st1,"after choose",st2);
await p.screenshot({path:ROOT+"/shots/tak.png"});
await p.waitForTimeout(700);console.log("stamp gone",!(await p.evaluate(()=>!!document.querySelector(".tak-stamp"))));
// muted: no count
await p.evaluate(()=>{__studyGame.SFX.setSfxMuted(true)});const m=await p.evaluate(()=>{__studyGame.SFX.tak();return __studyGame.SFX.takCount});console.log("muted count",m);
// pass path via fresh fight
console.log("errs",errs);await b.close();server.close();
