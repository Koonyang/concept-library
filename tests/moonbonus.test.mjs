import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const URL="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await p.goto(URL); await p.waitForFunction(()=>window.__studyGame);
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const near=(a,b,e=1e-12)=>Math.abs(a-b)<e;

const rules=await p.evaluate(()=>{
  const G=__studyGame.gifts, R=G.EGO_GIFT_RULES;
  return {first:R.dropRateFirstClear,recall:R.dropRateRecall,pity:R.pityEvery,nw:R.newWeight,bonus:R.moonBonusMax,firstCap:R.moonFirstCap,recallCap:R.moonRecallCap};
});
ok(rules.first===0.5&&rules.recall===0.3&&rules.pity===10&&rules.nw===3,"base gift rules: first 50%, recall 30%, pity 10, newWeight 3",rules);
ok(rules.bonus===0.4&&rules.firstCap===0.9&&rules.recallCap===0.7,"moon caps: +0.4, first 0.9, recall 0.7",rules);

// guest sheet UI reads rates from EGO_GIFT_RULES
await p.evaluate(()=>{__studyGame.setScene("lobby"); __studyGame.openGuestSheet("pomodoro");});
await p.waitForTimeout(300);
const sheet=await p.evaluate(()=>document.querySelector("#guest-sheet")?.innerText||"");
ok(/첫 접대 50%/.test(sheet)&&/회상 30%/.test(sheet),"guest sheet UI shows 첫 접대 50% · 회상 30%",(sheet.match(/첫 접대[^\n]*확정/)||[sheet.slice(0,200)])[0]);
await p.evaluate(()=>__studyGame.closeGuestSheet());

const helper=await p.evaluate(()=>{
  const G=__studyGame.gifts, today=G.todaySeoul();
  const none=G.moonBonus({}, today);
  const missing=G.moonBonus({moon:null}, today);
  const bad=G.moonBonus({moon:"nope"}, today);
  const stale=G.moonBonus({moon:{date:"2000-01-01",reveal:30,replay:30,used:false}}, today);
  const used=G.moonBonus({moon:{date:today,reveal:30,replay:0,used:true}}, today);
  const full=G.moonBonus({moon:{date:today,reveal:30,replay:0,used:false}}, today);
  const replayHalf=G.moonBonus({moon:{date:today,reveal:0,replay:30,used:false}}, today);
  const mixed=G.moonBonus({moon:{date:today,reveal:20,replay:10,used:false}}, today);
  const capped=G.moonBonus({moon:{date:today,reveal:30,replay:30,used:false}}, today);
  const baseF=G.moonAdjustedRate(false, none);
  const baseR=G.moonAdjustedRate(true, none);
  const recFull=G.moonAdjustedRate(true, full);
  const firstFull=G.moonAdjustedRate(false, full);
  const recHalf=G.moonAdjustedRate(true, replayHalf);
  const firstHalf=G.moonAdjustedRate(false, replayHalf);
  return {today,none,missing,bad,stale,used,full,replayHalf,mixed,capped,baseF,baseR,recFull,firstFull,recHalf,firstHalf,R:G.EGO_GIFT_RULES};
});
ok(helper.none.active===false&&helper.none.ratio===0&&helper.missing.active===false&&helper.bad.active===false,"no/malformed moon → inactive",helper.none);
ok(helper.baseF===helper.R.dropRateFirstClear&&helper.baseR===helper.R.dropRateRecall,"no moon → unchanged rates",{baseF:helper.baseF,baseR:helper.baseR});
ok(helper.stale.active===false&&helper.stale.ratio===0,"stale date ignored",helper.stale);
ok(helper.used.active===false,"already used → inactive",helper.used);
ok(helper.full.active&&near(helper.full.ratio,1),"today reveal 30 → ratio 1",helper.full);
ok(helper.replayHalf.active&&near(helper.replayHalf.ratio,0.5),"replay counts half (30 replay → ratio 0.5)",helper.replayHalf);
ok(helper.mixed.active&&near(helper.mixed.ratio,25/30),"reveal 20 + half of 10 replay → 25/30",helper.mixed);
ok(helper.capped.active&&near(helper.capped.ratio,1),"score caps at 30",helper.capped);
ok(near(helper.recFull,0.7),"today moon ratio 1 on recall → rate 0.7",helper.recFull);
ok(near(helper.firstFull,0.9),"today moon ratio 1 on first clear → rate 0.9",helper.firstFull);
ok(near(helper.recHalf,0.5)&&near(helper.firstHalf,0.7),"ratio 0.5 → recall 0.5, first 0.7",{recHalf:helper.recHalf,firstHalf:helper.firstHalf});

const rolls=await p.evaluate(()=>{
  const g=__studyGame, G=g.gifts, d=g.data;
  const guest=d.WEAK_POINTS.find(x=>x.id==="pomodoro");
  const today=G.todaySeoul();
  const seqRoll=(seq,isRecall)=>{
    const q=[...seq]; const orig=Math.random; Math.random=()=>q.length?q.shift():0;
    const r=G.rollEgoGift(guest,isRecall,"kyu"); Math.random=orig; return r;
  };
  // reset owned + pity + moon between cases
  const reset=(moon)=>{
    g.setGifts([],{});
    const L=G.libOf(g.save,"kyu"); L.pity={};
    if(moon===undefined) delete g.save.moon; else g.save.moon=moon;
  };
  const out={};

  // no moon: first-clear rate 0.5 — 0.49 hits, 0.5 misses (no guaranteed path)
  reset();
  out.noMoonHit=!!seqRoll([0.49,0], false);
  reset();
  out.noMoonMiss=seqRoll([0.5,0], false);
  reset();
  out.noMoonRecallMiss=seqRoll([0.3,0], true);
  out.noMoonUsed=g.save.moon;

  // today ratio 1 recall → 0.7 rate
  reset({date:today,reveal:30,replay:0,used:false});
  out.recallFullHit=!!seqRoll([0.69,0], true);
  out.recallFullMoon=out.recallFullHit&&g.save.moon&&g.save.moon.used===true;
  // flag consumed once: second roll at 0.69 now uses base 0.3, so misses
  out.recallSecond=seqRoll([0.69,0], true);
  out.stillUsed=g.save.moon.used===true;

  // first clear ratio 1 → 0.9; 0.89 hits, 0.9 would miss
  reset({date:today,reveal:30,replay:0,used:false});
  out.firstFullHit=!!seqRoll([0.89,0], false);
  out.firstFullFlag=out.firstFullHit&&typeof (out.firstFullHit && seqRoll); // placeholder, overwritten below
  out.firstFullMoon=g.save.moon.used===true && out.firstFullHit;

  // replay half: reveal 0 replay 30 → ratio 0.5, recall rate 0.5
  reset({date:today,reveal:0,replay:30,used:false});
  out.replayHit=!!seqRoll([0.49,0], true);
  reset({date:today,reveal:0,replay:30,used:false});
  out.replayMiss=seqRoll([0.5,0], true);
  out.replayConsumed=g.save.moon.used===true; // miss still consumes

  // stale date ignored: rate stays 0.3 on recall, used stays false
  reset({date:"2000-01-01",reveal:30,replay:30,used:false});
  out.staleHitAtHigh=seqRoll([0.69,0], true);
  out.staleStillUnused=g.save.moon.used===false;

  // malformed moon does not throw and does not change rates
  reset({date:today,reveal:"na",replay:undefined,used:false});
  out.malformed={active:G.moonBonus(g.save,today).active, ratio:G.moonBonus(g.save,today).ratio};
  out.malformedMiss=seqRoll([0.5,0], false); // first-clear base 0.5, so miss; used becomes true because date is today

  return out;
});
ok(rolls.noMoonHit===true&&rolls.noMoonMiss===null&&rolls.noMoonRecallMiss===null&&rolls.noMoonUsed===undefined,"no moon: first-clear 0.5 / recall 0.3, no guaranteed drop, moon untouched",rolls);
ok(rolls.recallFullHit===true&&rolls.recallFullMoon===true,"today moon ratio 1 on recall drops at 0.69 (rate 0.7) and marks used",{hit:rolls.recallFullHit,used:rolls.recallFullMoon});
ok(rolls.recallSecond===null&&rolls.stillUsed===true,"used flag consumed once: second recall at 0.69 misses",{second:rolls.recallSecond,used:rolls.stillUsed});
ok(rolls.firstFullHit===true&&rolls.firstFullMoon===true,"today moon ratio 1 on first clear drops at 0.89 (rate 0.9)",{hit:rolls.firstFullHit,used:rolls.firstFullMoon});
ok(rolls.replayHit===true&&rolls.replayMiss===null&&rolls.replayConsumed===true,"replay counts half: ratio 0.5 recall hits 0.49, misses 0.5, miss still consumes",{hit:rolls.replayHit,miss:rolls.replayMiss,used:rolls.replayConsumed});
ok(rolls.staleHitAtHigh===null&&rolls.staleStillUnused===true,"stale date ignored: no boosted rate, used stays false",{hit:rolls.staleHitAtHigh,unused:rolls.staleStillUnused});
ok(rolls.malformed.active===true&&rolls.malformed.ratio===0,"malformed reveal/replay treated as 0 but still valid today",rolls.malformed);

console.log("errors:",errs.length,errs.slice(0,3)); console.log("fails:",fails);
await b.close(); server.close(); process.exit(fails||errs.length?1:0);
