/* 접대: 상단 층 전환 바를 왼쪽 층 카드 안으로 넣고, 손님 목록이 세로·가로로 더 넓게 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0;
const ok=(c,m,x)=>{ console.log((c?"PASS ":"FAIL ")+m+(x!==undefined?" "+JSON.stringify(x):"")); if(!c) fails++; };
const box=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom}; };
const overlap=(a,b,pad=0)=>a&&b&&a.x+pad<b.r&&b.x+pad<a.r&&a.y+pad<b.b&&b.y+pad<a.b;
const vis=e=>{ if(!e) return false; const s=getComputedStyle(e); if(s.display==="none"||s.visibility==="hidden"||+s.opacity===0) return false; const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; };

for(const [w,h] of [[844,390],[390,844]]){
  const land=w>h;
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:2})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  await p.goto(BASE);
  await p.waitForFunction(()=>window.__studyGame);
  await p.evaluate(()=>__studyGame.setScene("lobby"));
  await p.waitForTimeout(500);

  const layout=await p.evaluate(()=>{
    const q=s=>document.querySelector(s);
    const box=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1)}; };
    const vis=e=>{ if(!e) return false; const s=getComputedStyle(e); if(s.display==="none"||s.visibility==="hidden"||+s.opacity===0) return false; const r=e.getBoundingClientRect(); return r.width>1&&r.height>1; };
    const mid=q(".lobby-grid > .col.mid");
    const nav=q("#floor-nav");
    const hero=q(".floor-hero");
    const guests=q(".guests");
    const dots=q("#scene-lobby .fn-dots");
    const prev=q("#fn-prev");
    const next=q("#fn-next");
    const title=q("#floor-nav .fn-name");
    const cap=q(".floor-hero .cap");
    const art=q(".floor-art");
    const thumb=q("#floor-thumb");
    const leftBm=q(".bm-btn");
    const setBm=q("#set-bm");
    const midKids=[...(mid?mid.children:[])].map(e=>e.id||e.className.split(/\s+/)[0]);
    const overflow=el=>{
      if(!el) return null;
      const r=el.getBoundingClientRect();
      return {x:r.x<-1, y:r.y<-1, r:r.right>innerWidth+1, b:r.bottom>innerHeight+1, off:r.right>innerWidth+1||r.bottom>innerHeight+1||r.x<-1||r.y<-1};
    };
    const hit=(a,b,pad=1)=>a&&b&&a.x+pad<b.r&&b.x+pad<a.r&&a.y+pad<b.b&&b.y+pad<a.b;
    const boxes={nav:box(nav),hero:box(hero),guests:box(guests),dots:box(dots),prev:box(prev),next:box(next),title:box(title),cap:box(cap),art:box(art),leftBm:box(leftBm),setBm:box(setBm)};
    return {
      midKids,
      navInsideHero: !!(nav&&hero&&hero.contains(nav)),
      dotsInsideHero: !!(dots&&hero&&hero.contains(dots)),
      artInsideHero: !!(art&&hero&&hero.contains(art)),
      thumbInsideArt: !!(thumb&&art&&art.contains(thumb)),
      capInsideHero: !!(cap&&hero&&hero.contains(cap)),
      navText:(nav&&nav.innerText||"").replace(/\s+/g," ").trim(),
      capText:(cap&&cap.innerText||"").replace(/\s+/g," ").trim(),
      vis:{nav:vis(nav),hero:vis(hero),guests:vis(guests),dots:vis(dots),prev:vis(prev),next:vis(next),leftBm:vis(leftBm),setBm:vis(setBm),art:vis(art)},
      boxes,
      overflow:{hero:overflow(hero),guests:overflow(guests),nav:overflow(nav),prev:overflow(prev),next:overflow(next),leftBm:overflow(leftBm),setBm:overflow(setBm)},
      hits:{
        prevLeftBm:hit(boxes.prev,boxes.leftBm,2),
        nextSetBm:hit(boxes.next,boxes.setBm,2),
        leftSet:hit(boxes.leftBm,boxes.setBm,2),
        navLeftBm:hit(boxes.nav,boxes.leftBm,2),
        navSetBm:hit(boxes.nav,boxes.setBm,2),
        heroLeftBm:hit(boxes.hero,boxes.leftBm,2),
        heroSetBm:hit(boxes.hero,boxes.setBm,2),
        guestsHero: land?false:null
      },
      land: innerWidth>innerHeight,
      W:innerWidth,H:innerHeight
    };
    function land(){return innerWidth>innerHeight}
  });

  ok(!layout.midKids.includes("floor-nav") && !layout.midKids.includes("fn-dots"),
    `${w} mid no longer hosts the top floor bar`, layout.midKids);
  ok(layout.midKids.length===1 && layout.midKids[0]==="floor-swipe",
    `${w} mid only has floor-swipe`, layout.midKids);
  ok(layout.navInsideHero && layout.dotsInsideHero,
    `${w} floor-nav and dots live inside the floor card`, {nav:layout.navInsideHero,dots:layout.dotsInsideHero});
  ok(layout.artInsideHero && layout.thumbInsideArt && layout.capInsideHero,
    `${w} art/caption stay in the floor card`, {art:layout.artInsideHero,thumb:layout.thumbInsideArt,cap:layout.capInsideHero});
  ok(/범죄학의 층/.test(layout.navText) && layout.vis.prev && layout.vis.next && layout.vis.dots,
    `${w} switcher text and buttons still visible`, {t:layout.navText,v:layout.vis});
  ok(/범죄학의 기초/.test(layout.capText),
    `${w} floor card still shows the subject`, layout.capText);
  ok(layout.vis.leftBm && layout.vis.setBm,
    `${w} nav and settings bookmarks visible on lobby`, layout.vis);

  const hits=layout.hits;
  ok(!hits.prevLeftBm && !hits.nextSetBm && !hits.leftSet && !hits.navLeftBm && !hits.navSetBm && !hits.heroLeftBm && !hits.heroSetBm,
    `${w} no bookmark/control overlap`, hits);

  const ov=Object.entries(layout.overflow).filter(([,v])=>v&&v.off);
  ok(ov.length===0, `${w} no overflow off-screen`, ov);

  const hb=layout.boxes.hero, gb=layout.boxes.guests;
  if(land){
    ok(hb && hb.w <= 844*0.36, `${w} floor card is much narrower than before (~340px)`, hb);
    ok(gb && gb.w >= 540, `${w} guest list is wider than before (~476px)`, gb);
    ok(hb && gb && Math.abs(hb.y-gb.y)<=4 && Math.abs(hb.h-gb.h)<=8,
      `${w} guest list shares the full height of the floor card`, {hero:hb,guests:gb});
    ok(gb && gb.h >= 300, `${w} guest list is taller than before (~254px)`, gb);
    ok(hb && gb && hb.r <= gb.x+1, `${w} card is left of the guest list`, {hr:hb.r,gx:gb.x});
  }else{
    ok(hb && gb && hb.b <= gb.y+2, `${w} guest list sits under the floor card`, {hb:hb&&hb.b,gy:gb&&gb.y});
    ok(gb && gb.h >= 620, `${w} guest list is taller than before (~590px)`, gb);
    ok(hb && hb.h <= 160, `${w} portrait floor card stays compact`, hb);
  }

  // controls still change the floor
  const before=await p.evaluate(()=>document.querySelector("#floor-nav .fn-name")?.textContent);
  await p.tap("#fn-next");
  await p.waitForTimeout(500);
  const after=await p.evaluate(()=>document.querySelector("#floor-nav .fn-name")?.textContent);
  ok(after && after!==before, `${w} next-floor button still works`, {before,after});
  ok(await p.evaluate(()=>!!document.querySelector(".floor-hero #floor-nav") && !!document.querySelector(".floor-hero .cap")),
    `${w} after switch, nav is still inside the card`);
  await p.tap("#fn-prev");
  await p.waitForTimeout(500);

  await p.screenshot({path:`shots/receptionscroll-${w}.png`});
  if(errs.length) ok(false, `${w} page errors`, errs);
  await p.context().close();
}
await b.close(); server.close();
console.log(fails?"FAILS "+fails:"ALL PASS");
process.exit(fails?1:0);
