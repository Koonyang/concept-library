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

const VIEWS=[[1024,473],[844,390],[740,360],[667,375],[390,844]];
const AFTER={ "1024x473":"resultfit-after-1024x473.png", "844x390":"resultfit-after-844x390.png" };

async function open(w,h){
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage();
  const errs=[];
  p.on("pageerror",e=>errs.push(String(e.message||e)));
  await p.goto(BASE+"?multi=1");
  await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  return {p,errs};
}

async function party3(p){
  return p.evaluate(()=>{
    const G=__studyGame,s=G.save;
    s.unlockedKeyIds=[...G.data.KEY_PAGES.map(k=>k.id),"pad-a","pad-b","pad-c"];
    G.libs.sync(s);
    const keys=["novice","archivist","classical-robe"];
    ["kyu","lib2","lib3"].forEach((id,i)=>{ if(id!=="kyu") G.libs.equipKey(s,id,keys[i]); });
    return G.libs.setParty(s,["kyu","lib2","lib3"]);
  });
}

async function beginGuest(p, gid){
  await p.evaluate(g=>__studyGame.battleApi.begin(g), gid);
  await p.waitForSelector("#rbanner",{state:"attached",timeout:8000});
  await p.waitForTimeout(200);
}

function forceGifts(){
  return ()=>{
    let n=0;
    const pick=[0,0.4,0.8];
    Math.random=()=>{ n++; return n%2===1?0:pick[(n/2-1)|0]??0; };
  };
}
function forceNone(){ return ()=>{ Math.random=()=>0.999; }; }

async function showResult(p, {recall=true, book=1, gifts="all"}={}){
  await p.evaluate(({recall,book,gifts})=>{
    const G=__studyGame, s=G.save, rec=G.engine.getRec();
    if(recall){ if(!s.conqueredIds.includes(rec.guestId)) s.conqueredIds=[...s.conqueredIds,rec.guestId]; rec.isRecall=true; }
    else { s.conqueredIds=s.conqueredIds.filter(id=>id!==rec.guestId); rec.isRecall=false; }
    rec.bookGain=book;
    if(book) G.acq.addBooks(s,rec.guestId,book);
    rec.levelUpMessage="사서의 손끝이 한결 더 굳었다. (Lv.13)"; // engine may still send this; UI must ignore
    if(gifts==="all"){
      let n=0; const pick=[0,0.4,0.8];
      Math.random=()=>{ n++; return n%2===1?0:pick[(n/2-1)|0]??0; };
    } else {
      Math.random=()=>0.999;
    }
    // clear owned so drops are new
    for(const id of rec.librarianIds||[]){ const L=G.gifts.libOf(s,id); if(L&&L.gifts) L.gifts.owned=[]; }
    G.showWin();
  },{recall,book,gifts});
  await p.waitForSelector(".rb-card",{timeout:5000});
  await p.waitForTimeout(200);
}

async function measure(p){
  return p.evaluate(()=>{
    const card=document.querySelector(".rb-card");
    const ban=document.querySelector("#rbanner");
    if(!card||!ban) return {ok:false,why:"missing"};
    const cr=card.getBoundingClientRect(), br=ban.getBoundingClientRect();
    const title=card.querySelector(".rb-title")?.getBoundingClientRect();
    const msg=card.querySelector(".rb-msg")?.getBoundingClientRect();
    const body=card.querySelector(".rb-body")?.getBoundingClientRect();
    const hero=card.querySelector(".rb-hero")?.getBoundingClientRect();
    const text=card.innerText||"";
    const labs=[...card.querySelectorAll(".rb-gift:not(.book):not(.rb-nogift) .rb-gift-lab")].map(e=>e.innerText);
    const gifts=[...card.querySelectorAll(".rb-gift")].map(e=>({cls:e.className,t:e.innerText.replace(/\s+/g," ").trim()}));
    const none=[...card.querySelectorAll(".rb-nogift")].map(e=>e.innerText.trim());
    const hud=[...document.querySelectorAll(".hudstat,.topbar,.rb-card")].map(e=>e.innerText).join("\n");
    const bars=[...document.querySelectorAll(".xp-bar,.exp-bar,.xpbar,.expbar,[class*='xp-'],[class*='exp-bar']")].filter(e=>{
      const s=getComputedStyle(e); return s.display!=="none"&&s.visibility!=="hidden";
    }).map(e=>e.className);
    const land=innerWidth>innerHeight;
    const slack=2;
    const clipped=cr.top<-slack||cr.bottom>innerHeight+slack||cr.left<-slack||cr.right>innerWidth+slack;
    const scroll=card.scrollHeight>card.clientHeight+slack || ban.scrollHeight>ban.clientHeight+slack;
    const msgUnder=!(!title||!msg) && msg.top>=title.bottom-4;
    let msgCol=true;
    if(title&&msg&&body&&hero){
      const inHero=msg.left>=hero.left-2 && msg.right<=hero.right+2;
      if(land){
        msgCol = inHero && body.left>=hero.right-8;
      } else {
        msgCol = inHero && body.top>=msg.bottom-4;
      }
    }
    const lv = /Lv\.?\s*\d|레벨\s*\d|경험치/.test(text) || /Lv\.?\s*\d/.test(hud) || !!document.querySelector(".rb-levelup");
    const emptyRow = /기프트 없음/.test(text) || /이번에는 떨어지지 않았다/.test(text);
    return {
      ok:true, land, vw:innerWidth, vh:innerHeight,
      cr:{t:Math.round(cr.top),b:Math.round(cr.bottom),l:Math.round(cr.left),r:Math.round(cr.right),w:Math.round(cr.width),h:Math.round(cr.height)},
      scrollH:card.scrollHeight, clientH:card.clientHeight, clipped, scroll,
      msgUnder, msgCol, lv, emptyRow, labs, none, gifts, text, bars,
      eyebrow:(card.querySelector(".rb-eyebrow")?.innerText||""),
      msgText:(card.querySelector(".rb-msg")?.innerText||"")
    };
  });
}

// --- worst-case win at every size ---
for(const [w,h] of VIEWS){
  const {p,errs}=await open(w,h);
  const party=await party3(p);
  ok(party&&party.ok!==false,"party of 3 ready "+w+"x"+h,party);
  await beginGuest(p,"beccaria");
  await showResult(p,{recall:true,book:1,gifts:"all"});
  const m=await measure(p);
  const key=`${w}x${h}`;
  if(AFTER[key]) await p.screenshot({path:join(SHOT,AFTER[key])});
  if(key==="390x844") await p.screenshot({path:join(SHOT,"resultfit-after-390x844.png")});
  ok(!m.clipped&&!m.scroll,`worst-case fits ${key}`, {clipped:m.clipped,scroll:m.scroll,scrollH:m.scrollH,clientH:m.clientH,cr:m.cr,vh:m.vh});
  ok(!m.lv && !m.bars.length,`no level/exp text or bars ${key}`,{lv:m.lv,bars:m.bars,snip:m.text.slice(0,180)});
  ok(!m.emptyRow && m.labs.length===3 && m.none.length===0,`three gift rows, no empty rows ${key}`,{labs:m.labs,none:m.none,gifts:m.gifts});
  ok(m.msgUnder&&m.msgCol&&m.msgText==="회상을 마쳤다.",`회상 message under title (left/title block) ${key}`,{msgUnder:m.msgUnder,msgCol:m.msgCol,msg:m.msgText,land:m.land});
  ok(errs.length===0,`no page errors ${key}`,errs);
  await p.context().close();
}

// --- 접대 (first clear) message placement, landscape ---
{
  const {p,errs}=await open(844,390);
  await party3(p);
  await beginGuest(p,"beccaria");
  await showResult(p,{recall:false,book:1,gifts:"all"});
  const m=await measure(p);
  ok(/접대 완료/.test(m.eyebrow)&&/손님이 서고의 책이 되었다/.test(m.msgText), "접대 outcome line present", {eyebrow:m.eyebrow,msg:m.msgText});
  ok(m.msgUnder&&m.msgCol,"접대 message sits under the book name, left of rewards",{msgUnder:m.msgUnder,msgCol:m.msgCol});
  ok(!m.clipped&&!m.scroll&&!m.lv,"접대 result still fits, no level text",{clipped:m.clipped,scroll:m.scroll,lv:m.lv});
  ok(errs.length===0,"no page errors (접대)",errs);
  await p.context().close();
}

// --- nobody got a gift: exactly one compact line ---
{
  const {p,errs}=await open(844,390);
  await party3(p);
  await beginGuest(p,"beccaria");
  await showResult(p,{recall:true,book:1,gifts:"none"});
  const m=await measure(p);
  ok(m.none.length===1&&m.none[0]==="이번엔 기프트가 떨어지지 않았다"&&m.labs.length===0&&!m.emptyRow,
    "no-gift case is exactly one line",{none:m.none,labs:m.labs,emptyRow:m.emptyRow,gifts:m.gifts});
  ok(!m.clipped&&!m.scroll,"no-gift result fits",{clipped:m.clipped,scroll:m.scroll});
  ok(errs.length===0,"no page errors (no-gift)",errs);
  await p.context().close();
}

// --- save missing level/xp: UI does not break; lobby has no Lv ---
{
  const {p,errs}=await open(390,844);
  await p.evaluate(()=>{
    const s=__studyGame.save;
    delete s.level; delete s.xp;
    __studyGame.setScene("lobby");
  });
  await p.waitForTimeout(300);
  const lobby=await p.evaluate(()=>{
    const t=document.body.innerText||"";
    return {lv:/Lv\.?\s*\d/.test(t), hud:(document.querySelector(".topbar")?.innerText||"")};
  });
  ok(!lobby.lv&&!/Lv/.test(lobby.hud),"lobby HUD has no Lv when level/xp missing",lobby);
  await party3(p);
  await beginGuest(p,"beccaria");
  await p.evaluate(()=>{ delete __studyGame.save.level; delete __studyGame.save.xp; });
  await showResult(p,{recall:true,book:1,gifts:"none"});
  const m=await measure(p);
  ok(m.ok&&!m.lv&&!m.clipped,"result still renders without level/xp fields",{ok:m.ok,lv:m.lv,clipped:m.clipped,text:m.text.slice(0,200)});
  ok(errs.length===0,"no page errors (missing level/xp)",errs);
  await p.context().close();
}

// --- lose screen: outcome line under title ---
{
  const {p,errs}=await open(844,390);
  await party3(p);
  await beginGuest(p,"beccaria");
  await p.evaluate(()=>__studyGame.showLose());
  await p.waitForSelector(".rb-card.lose",{timeout:5000});
  const m=await measure(p);
  ok(/접대가 꺾였다/.test(m.text)&&m.msgUnder&&m.msgCol,"lose message under the title block",{msgUnder:m.msgUnder,msgCol:m.msgCol,msg:m.msgText});
  ok(!m.clipped&&!m.scroll,"lose result fits in landscape",{clipped:m.clipped,scroll:m.scroll,scrollH:m.scrollH,clientH:m.clientH,cr:m.cr});
  ok(errs.length===0,"no page errors (lose)",errs);
  await p.screenshot({path:join(SHOT,"resultfit-after-lose-844x390.png")});
  await p.context().close();
}

console.log("fails:",fails);
await b.close(); server.close();
process.exit(fails?1:0);
