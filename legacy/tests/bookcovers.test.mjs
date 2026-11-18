import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(+(process.env.PORT||0),"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
mkdirSync(ROOT+"/shots",{recursive:true});
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
function imgInfo(sel){
  return `(()=>{const imgs=[...document.querySelectorAll(${JSON.stringify(sel)})];
    return imgs.map(i=>({src:(i.getAttribute("src")||""),w:i.naturalWidth,h:i.naturalHeight,ok:i.complete&&i.naturalWidth>0,box:i.getBoundingClientRect()}));})()`;
}
for(const [w,h] of [[844,390],[390,844]]){
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  const meta=await p.evaluate(()=>{
    const G=__studyGame;
    const guests=G.data.WEAK_POINTS.map(g=>({id:g.id,book:g.book,src:G.bookCoverSrc(g),idx:G.bookCoverIndex(g)}));
    const hashOnly=G.bookCoverSrc({id:"new-guest-xyz"});
    const bad9=G.bookCoverIndex({id:"limits",book:9});
    return {N:G.BOOK_COVER_N,guests,hashOnly,bad9,beccaria:G.bookCoverSrc(G.data.WEAK_POINTS.find(g=>g.id==="beccaria"))};
  });
  const bad=[];
  if(meta.N!==8) bad.push("BOOK_COVER_N "+meta.N);
  if(!/book-7\.webp$/.test(meta.beccaria)) bad.push("beccaria cover "+meta.beccaria);
  const limits=meta.guests.find(g=>g.id==="limits");
  if(!limits||limits.idx!==3) bad.push("limits cover "+JSON.stringify(limits));
  if(meta.bad9===9) bad.push("book 9 not rejected");
  if(!/assets\/books\/book-[1-8]\.webp$/.test(meta.hashOnly)) bad.push("hash fallback "+meta.hashOnly);
  const expect={beccaria:7,"three-conditions":4,bentham:2,legality:8,deterrence:5,limits:3,pomodoro:5,"active-recall":1,"spaced-repetition":3,metacognition:2,"defamation-truth":6};
  for(const [id,n] of Object.entries(expect)){
    const g=meta.guests.find(x=>x.id===id);
    if(!g||g.idx!==n) bad.push(`assign ${id} got ${g&&g.idx} want ${n}`);
  }

  await p.evaluate(()=>{ const G=__studyGame,s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
  await p.waitForTimeout(800);
  await p.evaluate(()=>__studyGame.showWin());
  await p.waitForTimeout(400);
  // wait for result book image
  await p.waitForSelector(".rb-book img.bk-cover");
  const winImgs=await p.evaluate(()=>{const imgs=[...document.querySelectorAll(".rb-book img.bk-cover")];
    return imgs.map(i=>({src:i.getAttribute("src")||"",w:i.naturalWidth,h:i.naturalHeight,ok:i.complete&&i.naturalWidth>0,
      box:((r)=>[r.x,r.y,r.width,r.height])(i.getBoundingClientRect())}));});
  if(!winImgs.length||!winImgs.every(x=>x.ok)) bad.push("win imgs "+JSON.stringify(winImgs));
  if(winImgs.some(x=>!/book-7\.webp$/.test(x.src))) bad.push("win src "+JSON.stringify(winImgs.map(x=>x.src)));
  if(winImgs.some(x=>x.box[0]<0||x.box[1]<0||x.box[0]+x.box[2]>w+1||x.box[1]+x.box[3]>h+1)) bad.push("win overflow "+JSON.stringify(winImgs.map(x=>x.box)));
  await p.screenshot({path:`shots/bookcovers-win-${w}.png`});

  // shelf
  await p.evaluate(()=>{
    const G=__studyGame;
    G.acq.addBooks(G.save,"beccaria",3);
    G.acq.addBooks(G.save,"pomodoro",2);
    G.setShelfTab("books");
    G.selectBook("beccaria");
    G.setScene("shelf");
  });
  await p.waitForSelector(".bk-art img.bk-cover");
  await p.waitForTimeout(300);
  const shelfImgs=await p.evaluate(()=>{const imgs=[...document.querySelectorAll(".bk-art img.bk-cover")];
    return imgs.map(i=>({src:i.getAttribute("src")||"",w:i.naturalWidth,ok:i.complete&&i.naturalWidth>0,
      box:((r)=>[r.x,r.y,r.width,r.height])(i.getBoundingClientRect())}));});
  if(!shelfImgs.length||!shelfImgs.every(x=>x.ok)) bad.push("shelf imgs "+JSON.stringify(shelfImgs));
  if(shelfImgs.some(x=>!/book-7\.webp$/.test(x.src))) bad.push("shelf src "+JSON.stringify(shelfImgs.map(x=>x.src)));
  if(shelfImgs.some(x=>x.box[0]<0||x.box[1]<0||x.box[0]+x.box[2]>w+1||x.box[1]+x.box[3]>h+1)) bad.push("shelf overflow "+JSON.stringify(shelfImgs.map(x=>x.box)));
  await p.screenshot({path:`shots/bookcovers-shelf-${w}.png`});

  // burn
  const btn=await p.$("[data-burn]");
  if(!btn) bad.push("no burn button");
  else {
    await btn.click();
    await p.waitForSelector("#burn-ov.on .burn-book img.bk-cover",{timeout:5000});
    await p.waitForTimeout(400);
    const burnImgs=await p.evaluate(()=>{const imgs=[...document.querySelectorAll("#burn-ov .burn-book img.bk-cover")];
      return imgs.map(i=>({src:i.getAttribute("src")||"",w:i.naturalWidth,ok:i.complete&&i.naturalWidth>0,
        box:((r)=>[r.x,r.y,r.width,r.height])(i.getBoundingClientRect())}));});
    if(!burnImgs.length||!burnImgs.every(x=>x.ok)) bad.push("burn imgs "+JSON.stringify(burnImgs));
    if(burnImgs.some(x=>!/book-7\.webp$/.test(x.src))) bad.push("burn src "+JSON.stringify(burnImgs.map(x=>x.src)));
    if(burnImgs.some(x=>x.box[0]<0||x.box[1]<0||x.box[0]+x.box[2]>w+1||x.box[1]+x.box[3]>h+1)) bad.push("burn overflow "+JSON.stringify(burnImgs.map(x=>x.box)));
    await p.screenshot({path:`shots/bookcovers-burn-${w}.png`});
  }

  await p.evaluate(()=>{ document.querySelector("#burn-ov")?.classList.remove("on"); document.querySelector("#burn-ov")?.remove(); });
  // object-fit contain + 원본 비율 유지 (잘림 없음). 1·6번도 서고에서 확인
  const fitCheck=await p.evaluate(()=>{
    const sel=".rb-book .bk-cover, .bk-art .bk-cover, .burn-book .bk-cover, .char-book .bk-cover";
    return [...document.querySelectorAll(sel)].filter(i=>i.offsetParent!==null||i.getBoundingClientRect().width).map(i=>{
      const cs=getComputedStyle(i), box=i.getBoundingClientRect(), nat=i.naturalWidth/i.naturalHeight, used=box.height?box.width/box.height:0;
      const par=i.closest(".rb-book,.bk-art,.char-book,.burn-book,.bk-wrap");
      return {src:(i.getAttribute("src")||"").split("/").pop(), fit:cs.objectFit, ov:par?getComputedStyle(par).overflow:"?", nat:+nat.toFixed(3), used:+used.toFixed(3), diff:+Math.abs(nat-used).toFixed(3),
        clip:cs.clipPath, w:Math.round(box.width), h:Math.round(box.height)};
    });
  });
  for(const x of fitCheck){
    if(x.fit!=="contain") bad.push("object-fit "+JSON.stringify(x));
    if(x.diff>0.04) bad.push("ratio clipped "+JSON.stringify(x));
    if(x.ov==="hidden") bad.push("overflow hidden "+JSON.stringify(x));
  }

  for(const id of ["active-recall","defamation-truth"]){
    await p.evaluate((id)=>{ const G=__studyGame; G.acq.addBooks(G.save,id,1); G.setShelfTab("books"); G.selectBook(id); G.setScene("shelf"); },id);
    await p.waitForSelector(".bk-art img.bk-cover"); await p.waitForTimeout(250);
    const info=await p.evaluate(()=>{const i=document.querySelector(".bk-art img.bk-cover"); const box=i.getBoundingClientRect(); const nat=i.naturalWidth/i.naturalHeight, used=box.height?box.width/box.height:0;
      return {src:i.getAttribute("src"), fit:getComputedStyle(i).objectFit, nat:+nat.toFixed(3), used:+used.toFixed(3), diff:+Math.abs(nat-used).toFixed(3), nw:i.naturalWidth, nh:i.naturalHeight};});
    const want=id==="active-recall"?1:6;
    if(!new RegExp(`book-${want}\\.webp$`).test(info.src||"")) bad.push(id+" src "+info.src);
    if(info.fit!=="contain"||info.diff>0.04) bad.push(id+" clipped "+JSON.stringify(info));
    await p.screenshot({path:`shots/bookcovers-${id}-${w}.png`});
  }

  // .char-book 스타일(쓰러짐 책) 잘림 여부 — 다대다 기본값은 건드리지 않고 마크업만 얹어 확인
  const char=await p.evaluate(()=>{
    const G=__studyGame;
    const guest=G.data.WEAK_POINTS.find(g=>g.id==="active-recall");
    const d=document.createElement("div");
    d.className="char-book";
    d.setAttribute("data-test","char-book");
    d.style.cssText="opacity:1;animation:none;position:fixed;left:50%;top:50%;bottom:auto;transform:translate(-50%,-50%) scale(1);z-index:500;pointer-events:none";
    d.innerHTML=G.bookArt(guest);
    document.getElementById("game").appendChild(d);
    const i=d.querySelector("img.bk-cover");
    if(!i) return {noimg:true};
    return new Promise(res=>{
      const done=()=>{
        const box=i.getBoundingClientRect(), nat=i.naturalWidth/i.naturalHeight, used=box.height?box.width/box.height:0;
        res({src:i.getAttribute("src"), fit:getComputedStyle(i).objectFit, ov:getComputedStyle(d).overflow, nat:+nat.toFixed(3), used:+used.toFixed(3), diff:+Math.abs(nat-used).toFixed(3),
          off:box.left< -1||box.top< -1||box.right>innerWidth+1||box.bottom>innerHeight+1, w:Math.round(box.width), h:Math.round(box.height), nw:i.naturalWidth});
      };
      if(i.complete&&i.naturalWidth) done(); else i.onload=done;
    });
  });
  if(char.noimg) bad.push("char-book missing "+JSON.stringify(char));
  else {
    if(char.fit!=="contain"||char.diff>0.04||char.ov==="hidden"||char.off) bad.push("char-book clip "+JSON.stringify(char));
    await p.screenshot({path:`shots/bookcovers-char-${w}.png`});
  }

  if(errs.length) bad.push("pageerror "+errs.join(" | "));
  console.log(bad.length?"FAIL":"PASS",w,h,bad.join("; ")||("covers "+meta.guests.map(g=>g.id+":"+g.idx).join(",")));
  if(bad.length) process.exitCode=1;
  await p.context().close();
}
await b.close(); server.close();
