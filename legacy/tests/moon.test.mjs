import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const innerW=w=>w;
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const URL="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const errs=[];
const ctx=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
const wait=ms=>p.waitForTimeout(ms);
await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
// --- migration tolerates missing / broken save.moon
const mig=await p.evaluate(()=>{ const A=__studyGame.acq, k=A.SAVE_KEY, old=localStorage.getItem(k);
  const raw=JSON.parse(old||"{}"); delete raw.moon; delete raw.moonChunk; localStorage.setItem(k,JSON.stringify(raw)); const s1=A.loadSave();
  raw.moon="junk"; raw.moonChunk=-3; localStorage.setItem(k,JSON.stringify(raw)); const s2=A.loadSave();
  raw.moon={date:"2026-11-17",reveal:12,replay:3,used:true}; raw.moonChunk=2; localStorage.setItem(k,JSON.stringify(raw)); const s3=A.loadSave();
  if(old!=null) localStorage.setItem(k,old); else localStorage.removeItem(k);
  return {a:s1.moon,ac:s1.moonChunk,b:s2.moon,bc:s2.moonChunk,c:s3.moon,cc:s3.moonChunk}; });
ok(mig.a===null&&mig.ac===0&&mig.b===null&&mig.bc===0&&mig.c.reveal===12&&mig.c.used===true&&mig.cc===2,"save migration tolerates missing/broken save.moon",mig);
// --- pure question logic
const logic=await p.evaluate(()=>{ const M=__studyGame.moon, W=M.words(); const out={n:W.length,bad:[],dirs:{w2m:0,m2w:0}};
  for(let t=0;t<200;t++){ const w=W[t%W.length], q=M.buildQ(w,t%2?"w2m":"m2w"); const key=q.dir==="w2m"?"m":"w";
    if(q.options.length!==4||new Set(q.options).size!==4||q.options[q.correctIndex]!==w[key]) out.bad.push([w.w,q.options]);
    const sameP=q.options.filter((o,i)=>i!==q.correctIndex).every(o=>W.find(x=>x[key]===o).pos===w.pos); if(!sameP) out.bad.push(["pos",w.w,q.options]); }
  const r=M.buildRound(M.todaysWords()); r.forEach(q=>out.dirs[q.dir]++); out.roundN=r.length; return out; });
ok(logic.bad.length===0,"every question: 4 distinct choices, answer included, distractors same pos",logic.bad.slice(0,3));
ok(logic.dirs.w2m>=10&&logic.dirs.m2w>=10,"round mixes word→meaning and meaning→word",logic.dirs);
// data source: real moon-words.js loads (3,000 words); sample is used only when MOON_WORDS is absent
const src=await p.evaluate(()=>{ const M=__studyGame.moon; const a={sample:M.isSample(),n:M.words().length,real:Array.isArray(window.MOON_WORDS),bad:M.words().filter(x=>!x.w||!x.m||!x.pos).length};
  const keep=window.MOON_WORDS; delete window.MOON_WORDS; const b={sample:M.isSample(),n:M.words().length}; window.MOON_WORDS=keep; return {a,b,back:M.isSample()}; });
ok(src.a.real&&!src.a.sample&&src.a.n>=3000&&src.a.bad===0&&src.b.sample&&src.b.n>=40&&!src.back,"real moon-words.js (3,000) is used; sample only when it is missing",src);
// deterministic daily set + chunk progression by id order
const det=await p.evaluate(()=>{ const g=__studyGame,M=g.moon; g.save.moon=null; g.save.moonChunk=0; const a=M.todaysWords().map(x=>x.id), b=M.todaysWords().map(x=>x.id); g.save.moonChunk=1; const c=M.todaysWords().map(x=>x.id); g.save.moonChunk=0; return {a0:a[0],a29:a[29],n:a.length,same:a.join()===b.join(),c0:c[0]}; });
ok(det.same&&det.n===30&&det.a0==="w0001"&&det.a29==="w0030"&&det.c0==="w0031","today's set is stable and advances 30 per completed day in id order",det);
// --- lobby button glows when not done today
await p.evaluate(()=>{ const g=__studyGame; g.moon.setNow(()=>new Date("2026-11-18T03:00:00+09:00")); g.save.moon=null; g.save.moonChunk=0; g.setScene("lobby"); }); await wait(500);
const lit0=await p.evaluate(()=>{const b=document.querySelector('#scene-lobby .botnav [data-go="moon"]'); return b&&b.classList.contains("moon-lit")&&!document.querySelector("#moon-btn");});
ok(lit0,"계시 nav item shows the glow dot when today's 계시 not done (no lobby moon icon)");
ok(await p.evaluate(()=>[...document.querySelectorAll("#scene-lobby .botnav .btn")].map(b=>b.textContent.trim()).join("|")==="접대|도서관|계시"),"nav = 접대 · 도서관 · 계시");
// Seoul date: 2026-11-18 23:30 UTC is already 11-19 in Seoul
ok(await p.evaluate(()=>{const M=__studyGame.moon; M.setNow(()=>new Date("2026-11-18T23:30:00Z")); const d=M.today(); M.setNow(()=>new Date("2026-11-18T03:00:00+09:00")); return d==="2026-11-19";}),"date uses Asia/Seoul");
// --- play 계시 through UI: open, start, answer: first 5 wrong, rest right
ok(await p.evaluate(()=>document.querySelector('#scene-lobby .bm-btn').classList.contains("moon-lit")),"책갈피에도 계시 점 표시");
await p.tap('#scene-lobby .bm-btn'); await wait(350);
await p.tap('#scene-lobby .botnav [data-go="moon"]'); await wait(700);
ok(await p.evaluate(()=>document.querySelector("#scene-moon.on #moon-start")!==null),"계시 nav opens 계시 intro (no popup, own scene)");
await p.tap("#moon-start"); await wait(250);
await p.screenshot({path:ROOT+"/shots/moon-quiz-844.png"});
const wrongWords=[];
for(let i=0;i<30;i++){
  const q=await p.evaluate(()=>{const s=__studyGame.moon.state; const q=s.qs[s.i]; return {i:s.i,ci:q.correctIndex,w:q.word.w,dir:q.dir,shown:document.querySelector("#moon-qcard").dataset.dir};});
  const pick=i<5?(q.ci+1)%4:q.ci; if(i<5) wrongWords.push(q.w);
  if(i===2){ /* screenshot a wrong-feedback frame */ }
  await p.tap(`[data-mopt="${pick}"]`);
  if(i===0){ await wait(120); await p.screenshot({path:ROOT+"/shots/moon-wrong-844.png"}); }
  await wait(i<5?720:230);
}
const br=await p.evaluate(()=>{const s=__studyGame.moon.state; return {phase:s.phase,reveal:s.reveal,wrong:s.wrongFromReveal.map(w=>w.w),moon:__studyGame.save.moon};});
ok(br.phase==="bridge"&&br.reveal===25&&br.wrong.length===5&&br.wrong.every(w=>wrongWords.includes(w))&&br.moon===null,"after 계시: 25/30, bridge to 재현시 with exactly the 5 wrong words, nothing saved yet",br);
await p.tap("#moon-replay"); await wait(250);
const rp=await p.evaluate(()=>{const s=__studyGame.moon.state; return {kind:s.kind,n:s.qs.length,words:s.qs.map(q=>q.word.w),limit:s.limit};});
ok(rp.kind==="replay"&&rp.n===5&&rp.words.every(w=>wrongWords.includes(w))&&rp.limit===5*2500,"재현시 contains only today's wrong words, 2.5s each",rp);
for(let i=0;i<5;i++){ const ci=await p.evaluate(()=>{const s=__studyGame.moon.state; return s.qs[s.i].correctIndex;}); await p.tap(`[data-mopt="${i<2?(ci+1)%4:ci}"]`); await wait(i<2?720:230); }
await wait(200);
const sv=await p.evaluate(()=>({moon:__studyGame.save.moon,chunk:__studyGame.save.moonChunk,stored:JSON.parse(localStorage.getItem(__studyGame.acq.SAVE_KEY)).moon,phase:__studyGame.moon.state.phase,r1:document.querySelector("#moon-r-reveal")?.textContent,r2:document.querySelector("#moon-r-replay")?.textContent}));
ok(JSON.stringify(Object.keys(sv.moon))===JSON.stringify(["date","reveal","replay","used"])&&sv.moon.date==="2026-11-18"&&sv.moon.reveal===25&&sv.moon.replay===3&&sv.moon.used===false&&JSON.stringify(sv.stored)===JSON.stringify(sv.moon),"save.moon has exact shape {date,reveal,replay,used:false} and persists",sv);
ok(sv.chunk===1&&sv.phase==="result"&&sv.r1==="25/30"&&sv.r2==="3/5","result shows 계시 25/30, 재현시 3/5; chunk advanced",sv);
await p.screenshot({path:ROOT+"/shots/moon-result-844.png"});
// --- once per day
await p.tap("#moon-done"); await wait(700);
ok(await p.evaluate(()=>!document.querySelector('#scene-lobby .botnav [data-go="moon"]').classList.contains("moon-lit")),"계시 dot disappears after today's 계시");
await p.evaluate(()=>{__studyGame.setScene("shelf");}); await wait(400);
ok(await p.evaluate(()=>!!document.querySelector('#scene-shelf .botnav [data-go="moon"]')),"계시 nav also present on 도서관");
await p.tap('#scene-shelf .bm-btn'); await wait(350);
await p.tap('#scene-shelf .botnav [data-go="moon"]'); await wait(700);
ok(await p.evaluate(()=>!!document.querySelector("#scene-moon #moon-done")&&!document.querySelector("#moon-start")),"reopening same day shows result only (once per day)");
ok(await p.evaluate(()=>{const g=__studyGame; g.moon.setNow(()=>new Date("2026-11-19T08:00:00+09:00")); g.setScene("lobby"); return document.querySelector('#scene-lobby .botnav [data-go="moon"]').classList.contains("moon-lit")&&g.moon.todaysWords()[0].id!=="w0001";}),"next Seoul day: glows again with the next chunk");
// --- skip 재현시 + timeout counts unanswered as wrong
const sk=await p.evaluate(async()=>{ const g=__studyGame,M=g.moon; M.startRound("reveal",M.todaysWords()); const s=M.state; s.used=s.limit+1; await new Promise(r=>setTimeout(r,120)); const st=M.state; const ph=st.phase, wn=st.wrongFromReveal.length; M.skipReplay(); return {ph,wn,moon:g.save.moon}; });
ok(sk.ph==="bridge"&&sk.wn===30&&sk.moon.reveal===0&&sk.moon.replay===0&&sk.moon.date==="2026-11-19","timeout → all unanswered go to 재현시; skipping saves replay 0",sk);
// --- layout at every viewport: quiz + intro + result fit, nothing clipped, buttons tappable
const VP=[[844,390],[740,360],[915,412],[780,412],[667,375],[360,740],[390,844],[412,915],[1440,900]];
const audit=()=>p.evaluate(()=>{ const W=innerWidth,H=innerHeight, sc=document.querySelector("#scene-moon"); const bad=[];
  const els=[...sc.querySelectorAll(".moon-head,.moon-timer,.moon-qcard,.moon-opt,.moon-prompt,.btn,.moon-row,.moon-stats span,.x-btn,.moon-skip")];
  for(const e of els){ const r=e.getBoundingClientRect(); if(!r.width) continue; if(r.left<-.5||r.top<-.5||r.right>W+.5||r.bottom>H+.5) bad.push([e.className,Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]);
    if(e.scrollWidth>e.clientWidth+1&&!e.classList.contains("moon-opt")) bad.push(["xover",e.className,e.scrollWidth,e.clientWidth]); }
  const opts=[...sc.querySelectorAll(".moon-opt")].map(o=>o.getBoundingClientRect()); const small=opts.filter(r=>r.height<44||r.width<120).map(r=>[Math.round(r.width),Math.round(r.height)]);
  const qc=sc.querySelector(".moon-qcard"); const qr=qc&&qc.getBoundingClientRect(); const pr=qc&&qc.querySelector(".moon-prompt").getBoundingClientRect();
  if(qr&&(pr.top<qr.top-1||pr.bottom>qr.bottom+1)) bad.push(["prompt clipped"]);
  // audio toggles must not cover header content
  const at=document.querySelector("#set-bm").getBoundingClientRect(); sc.querySelectorAll(".moon-ttl,.moon-skip,.moon-tnum").forEach(e=>{const r=e.getBoundingClientRect(); if(r.right>at.left&&r.left<at.right&&r.bottom>at.top&&r.top<at.bottom) bad.push(["under audio",e.className]);});
  if(sc.scrollHeight>sc.clientHeight+1) bad.push(["scene scroll",sc.scrollHeight,sc.clientHeight]);
  return {bad,small,n:opts.length}; });
for(const [w,h] of VP){
  await p.setViewportSize({width:w,height:h});
  await p.evaluate(()=>{ const g=__studyGame,M=g.moon; g.setScene("moon"); M.startRound("reveal",M.todaysWords()); const s=M.state; // longest strings stress test
    const W=M.words(); const lw=W.reduce((a,x)=>x.w.length>a.w.length?x:a); s.qs[0]=M.buildQ(lw,"w2m"); M.render(); }); await wait(200);
  const q1=await audit();
  await p.evaluate(()=>{ const M=__studyGame.moon,W=M.words(); const lm=W.reduce((a,x)=>x.m.length>a.m.length?x:a); M.state.qs[0]=M.buildQ(lm,"m2w"); M.render(); }); await wait(120);
  const q2=await audit();
  if(w===390) await p.screenshot({path:ROOT+"/shots/moon-quiz-390.png"});
  if(w===1440) await p.screenshot({path:ROOT+"/shots/moon-quiz-1440.png"});
  await p.evaluate(()=>{ const M=__studyGame.moon; M.state.used=M.state.limit+1; }); await wait(150);
  const qb=await audit();
  await p.evaluate(()=>{ __studyGame.moon.skipReplay(); }); await wait(120);
  const qr=await audit();
  if(w===390) await p.screenshot({path:ROOT+"/shots/moon-result-390.png"});
  await p.evaluate(()=>{ const g=__studyGame; g.save.moon=null; g.moon.close(); }); await wait(600);
  await p.evaluate(()=>__studyGame.moon.open()); await wait(600);
  const qi=await audit();
  if(w===667) await p.screenshot({path:ROOT+"/shots/moon-intro-667.png"});
  await p.evaluate(()=>{ const g=__studyGame; g.save.moon=null; g.setScene("lobby"); }); await wait(500);
  await p.tap("#scene-lobby .bm-btn"); await wait(350);
  const lob=await p.evaluate(()=>{ const bs=[...document.querySelectorAll("#scene-lobby .botnav .btn")]; const R=bs.map(b=>b.getBoundingClientRect());
    const dot=getComputedStyle(bs[2],":after"); const bm=document.querySelector("#scene-lobby .bm-btn").getBoundingClientRect();
    return {n:bs.length,inside:R.every(b=>b.left>=0&&b.top>=0&&b.right<=innerWidth+.5&&b.bottom<=innerHeight+.5),bal:Math.max(...R.map(r=>r.width))-Math.min(...R.map(r=>r.width))<=2,
      clipped:bs.some(b=>b.scrollWidth>b.clientWidth+1),last:R[2].top>R[1].top,dot:dot.content!=="none"&&dot.width==="7px",minH:Math.round(Math.min(...R.map(r=>r.height))),
      bmTL:bm.left<60&&bm.top<=1&&bm.width>=28}; });
  await p.tap("#scene-lobby .nav-scrim",{position:{x:innerW(w)-20,y:100}}); await wait(350);
  lob.closed=await p.evaluate(()=>getComputedStyle(document.querySelector("#scene-lobby .botnav")).visibility==="hidden");
  const all=[...q1.bad,...q2.bad,...qb.bad,...qr.bad,...qi.bad];
  ok(!all.length&&!q1.small.length&&!q2.small.length&&q1.n===4,`no overflow/clipping, choices ≥44px tall ${w}x${h}`,{all:all.slice(0,4),small:[...q1.small,...q2.small]});
  ok(lob.n===3&&lob.inside&&lob.bal&&!lob.clipped&&lob.last&&lob.dot&&lob.minH>=40&&lob.bmTL&&lob.closed,`책갈피 서랍: 좌상단 책갈피, 3칸 세로, 계시 마지막+점, 바깥 탭으로 닫힘 ${w}x${h}`,lob);
}
ok(!errs.length,"no errors",errs);
await b.close(); server.close(); process.exit(fails?1:0);
