import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { extname, join, normalize } from "path";

const ROOT=LIB_ROOT;
const SHOT=join(ROOT,"shots");
mkdirSync(SHOT,{recursive:true});
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(+(process.env.PORT||0),"127.0.0.1",r));
const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox","--disable-dev-shm-usage"]});

let fails=0;
const ok=(c,n,o)=>{ if(!c) fails++; console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o)); };

const ALLY="#c4a35a", ENEMY="#e06a55", HI="#f7fbff";

async function open(w,h){
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi&&window.BattleStage);
  await p.evaluate(()=>{
    const G=__studyGame,s=G.save;
    s.unlockedKeyIds=[...G.data.KEY_PAGES.map(k=>k.id),"pad-a","pad-b","pad-c"];
    G.libs.sync(s);
    G.libs.equipKey(s,"lib2","archivist");
    G.libs.equipKey(s,"lib3","classical-robe");
    G.libs.setParty(s,["kyu","lib2","lib3"]);
    G.battleApi.begin("beccaria");
  });
  await p.waitForSelector(".bs-unit.enemy .bs-die",{timeout:8000});
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ try{ __studyGame.battleApi.answerUI(true); }catch(e){} });
  await p.waitForTimeout(600);
  await p.waitForFunction(()=>__studyGame.battle&&__studyGame.battle.phase==="assign",{timeout:8000});
  await p.waitForTimeout(400);
  return {p,errs};
}

async function assignOne(p){
  const card=await p.$("#hand .cc:not(.off), .hand .cc:not(.off)");
  if(card){ const box=await card.boundingBox(); if(box) await p.touchscreen.tap(box.x+box.width/2, box.y+box.height*.55); await p.waitForTimeout(250); }
  const ed=await p.$(".bs-unit.enemy .bs-die:not(.off)");
  if(ed){ const box=await ed.boundingBox(); if(box) await p.touchscreen.tap(box.x+box.width/2, box.y+box.height/2); await p.waitForTimeout(300); }
}

async function lines(p){
  return p.evaluate(({ALLY,ENEMY,HI})=>{
    const paths=[...document.querySelectorAll(".bs-svg path.bs-arr, .bs-svg path.bs-arr-hi-line, .bs-svg .bs-arr-hi path")].map(e=>{
      const cs=getComputedStyle(e);
      return {
        cls:e.className?.baseVal||e.getAttribute("class")||"",
        stroke:(e.getAttribute("stroke")||cs.stroke||"").toLowerCase(),
        w:+(e.getAttribute("stroke-width")||0),
        dash:e.getAttribute("stroke-dasharray")||"",
        marker:e.getAttribute("marker-end")||"",
        u:e.getAttribute("data-u"), d:e.getAttribute("data-d"), side:e.getAttribute("data-side"), pu:e.getAttribute("data-pu"), pd:e.getAttribute("data-pd")
      };
    });
    const dashed=paths.filter(x=>x.cls.includes("bs-arr")&&!x.cls.includes("hi")&&x.dash);
    const hi=[...document.querySelectorAll(".bs-svg .bs-arr-hi-line")].map(e=>({
      stroke:(e.getAttribute("stroke")||"").toLowerCase(),
      w:+(e.getAttribute("stroke-width")||0),
      dash:e.getAttribute("stroke-dasharray")||"",
      marker:e.getAttribute("marker-end")||"",
      d:e.getAttribute("d")||""
    }));
    const infoOn=!!document.querySelector(".bs-info");
    const st=BattleStage._state();
    const zSvg=+getComputedStyle(document.querySelector(".bs-svg")).zIndex||0;
    const zHand=+getComputedStyle(document.querySelector(".hand, .bs-hand, .bs-fan")||document.body).zIndex||0;
    const zInfo=infoOn?+getComputedStyle(document.querySelector(".bs-info")).zIndex||0:0;
    const go=document.querySelector("#btn-mb-go");
    const zGo=go?+getComputedStyle(go).zIndex||0:0;
    return {paths,dashed,hi,infoOn,info:st.info,zSvg,zHand,zInfo,zGo,phase:__studyGame.battle?.phase};
  },{ALLY,ENEMY,HI});
}

async function pickEnemyWithTarget(p){
  return p.evaluate(()=>{
    const B=__studyGame.battle;
    const u=(B.units||[]).find(x=>x.side==="enemy"&&x.hp>0&&(x.dice||[]).some(d=>d.target));
    if(!u) return null;
    const i=u.dice.findIndex(d=>d.target);
    return {id:u.id,i,side:u.side};
  });
}
async function pickAllyWithTarget(p){
  return p.evaluate(()=>{
    const B=__studyGame.battle;
    const u=(B.units||[]).find(x=>x.side==="ally"&&x.hp>0&&(x.dice||[]).some(d=>d.card&&d.target));
    if(!u) return null;
    const i=u.dice.findIndex(d=>d.card&&d.target);
    return {id:u.id,i,side:u.side};
  });
}

for(const [w,h] of [[844,390],[390,844]]){
  const {p,errs}=await open(w,h);
  await assignOne(p);
  const before=await lines(p);
  ok(before.dashed.length>=1,`${w}x${h} dashed target lines present`, {n:before.dashed.length,ws:before.dashed.map(x=>x.w)});
  ok(before.dashed.every(x=>x.w>0&&x.w<2), `${w}x${h} default dashes are thinner than 2`, before.dashed.map(x=>x.w));
  ok(!before.hi.length&&!before.infoOn, `${w}x${h} no highlight before a die is selected`, {hi:before.hi.length,info:before.infoOn});

  const en=await pickEnemyWithTarget(p);
  ok(!!en, `${w}x${h} found an enemy die with a target`, en);
  if(en) await p.evaluate(e=>BattleStage.showInfo(e.id,e.i), en);
  await p.waitForTimeout(200);
  const mid=await lines(p);
  ok(mid.infoOn&&mid.info&&mid.info.unit===en.id&&mid.info.die===en.i, `${w}x${h} enemy die info bubble stays open`, mid.info);
  ok(mid.hi.length===1, `${w}x${h} one highlight line for the selected enemy die`, mid.hi);
  ok(mid.hi[0]&&mid.hi[0].dash===""&&mid.hi[0].w>mid.dashed[0].w, `${w}x${h} highlight is solid and thicker`, mid.hi[0]);
  ok(mid.hi[0]&&mid.hi[0].stroke.replace(/\s/g,"")===HI && mid.hi[0].marker.includes("bsAH"), `${w}x${h} highlight is ice-white with arrowhead`, mid.hi[0]);
  /* 그 적 주사위가 내 주사위와 서로 노리면(합) 원래 선은 두 주사위를 잇는 합 실선 하나다 (zj부터 적이 자기를 노린 주사위를 되노리는 일이 잦음) */
  ok(mid.dashed.some(x=>x.u===en.id&&String(x.d)===String(en.i))||mid.paths.some(x=>x.cls.includes("bs-arr-clash")&&((x.u===en.id&&String(x.d)===String(en.i))||(x.pu===en.id&&String(x.pd)===String(en.i)))), `${w}x${h} original dashed line for that die remains`, mid.dashed.filter(x=>x.u===en.id));
  ok(mid.zSvg<mid.zHand&&mid.zInfo>mid.zSvg, `${w}x${h} highlight stays in the arrow layer under front UI, bubble above`, {zSvg:mid.zSvg,zHand:mid.zHand,zInfo:mid.zInfo,zGo:mid.zGo});

  if(w===844) await p.screenshot({path:join(SHOT,"arrowhi-enemy-844x390.png")});
  if(w===390) await p.screenshot({path:join(SHOT,"arrowhi-enemy-390x844.png")});

  // move to another enemy die if possible, else an ally
  const other=await p.evaluate(cur=>{
    const B=__studyGame.battle;
    for(const u of B.units||[]){
      if(u.hp<=0) continue;
      const i=(u.dice||[]).findIndex(d=>d.target);
      if(i>=0&&!(u.id===cur.id&&i===cur.i)) return {id:u.id,i,side:u.side};
    }
    return null;
  }, en);
  if(other){
    await p.evaluate(e=>BattleStage.showInfo(e.id,e.i), other);
    await p.waitForTimeout(200);
    const mv=await lines(p);
    ok(mv.hi.length===1&&mv.info&&mv.info.unit===other.id&&mv.info.die===other.i, `${w}x${h} highlight moves with the new selection`, {info:mv.info,hi:mv.hi.length});
  }

  // close bubble
  await p.evaluate(()=>BattleStage.showInfo(__studyGame.battle.units.find(u=>u.side==="enemy").id, 0)); // may toggle
  // force close
  await p.evaluate(()=>{ const s=BattleStage._state(); if(s.info) BattleStage.showInfo(s.info.unit,s.info.die); });
  await p.waitForTimeout(200);
  const closed=await lines(p);
  ok(!closed.infoOn&&closed.hi.length===0, `${w}x${h} highlight clears when the bubble closes`, {info:closed.info,hi:closed.hi.length});

  // ally die with a target
  const al=await pickAllyWithTarget(p);
  if(al){
    await p.evaluate(e=>BattleStage.showInfo(e.id,e.i), al);
    await p.waitForTimeout(200);
    const aln=await lines(p);
    ok(aln.infoOn&&aln.hi.length===1&&aln.hi[0].stroke.replace(/\s/g,"")===HI, `${w}x${h} selected ally die also gets the same highlight`, {info:aln.info,hi:aln.hi});
    await p.evaluate(e=>BattleStage.showInfo(e.id,e.i), al); // close
  } else {
    ok(true, `${w}x${h} no assigned ally die this run (skipped ally highlight)`);
  }

  // 개막 clears highlight: reopen enemy info, then leave assign
  if(en) await p.evaluate(e=>BattleStage.showInfo(e.id,e.i), en);
  await p.waitForTimeout(150);
  await p.evaluate(()=>{
    const G=__studyGame, B=G.battle;
    if(B) B.phase="resolve";
    BattleStage.render(B);
  });
  await p.waitForTimeout(200);
  const afterGo=await lines(p);
  ok((afterGo.phase==="resolve")&&!afterGo.infoOn&&afterGo.hi.length===0, `${w}x${h} highlight clears on 개막 / leaving assign`, afterGo);

  ok(errs.length===0, `${w}x${h} no page errors`, errs);
  await p.context().close();
}

console.log("fails:",fails);
await b.close(); server.close();
process.exit(fails?1:0);
