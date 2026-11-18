import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";import { readFileSync, existsSync } from "fs";import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".webp":"image/webp",".png":"image/png",".woff2":"font/woff2"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!existsSync(a)){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a))});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"],headless:true});
const p=await b.newPage();const errs=[];p.on("pageerror",e=>errs.push(String(e)));
await p.goto("http://127.0.0.1:"+server.address().port+"/");await p.waitForFunction(()=>window.__studyGame);
const out=await p.evaluate(()=>{
  const E=__studyGame.engine, C=E.COMBAT;
  function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const rng=mulberry(12345);
  const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const DECKS={
    starter:["turn-page","focus-line","cover-slam","margin-guard","silence","breathe"],
    glass:["turn-page","focus-line","cover-slam","stamp-seal","underline","heavy-tome"],
    turtle:["margin-guard","silence","breathe","page-echo","turn-page","focus-line"],
    rare:["stamp-seal","underline","blank-fill","heavy-tome","cover-slam","focus-line"]
  };
  const pageScore=(pg,Gdice)=>{let s=0;for(const d of pg.dice){const av=(d.min+d.max)/2;s+= ["참격","관통","타격"].includes(d.type)?av:av*0.5;}return s};
  function sim(guestId,pc,pk,deckIds,lvl=1){
    const g=E.WEAK_POINTS.find(x=>x.id===guestId), kit=E.guestCombat(g);
    const G=E.mkUnit(kit.hp,kit.st,kit.resist);
    const hpMax=100+(lvl-1)*8;
    const P=E.mkUnit(hpMax,E.playerStaggerMax(lvl),E.FLAT_RESIST);
    let emotion=0,charge=0,light=C.baseLight,pend={d:0,l:0};
    let deck=shuffle(deckIds),hand=[],disc=[];
    const draw=n=>{for(let i=0;i<n;i++){if(hand.length>=8)break;if(!deck.length){if(!disc.length)break;deck=shuffle(disc);disc=[]}hand.push(deck.shift())}};
    draw(4);
    const rec={turn:1,g:G,normalIdx:0};
    let intent=E.planIntent(kit,rec);
    let scenes=0,stagP=0,stagG=0,dmgTaken=0;
    for(scenes=1;scenes<=80;scenes++){
      let page=null,correct=false,isKey=false,asked=false;
      if(P.stag===0){
        const aff=hand.map(id=>E.PAGE_BY[id]).filter(pg=>pg.cost<=light&&pg.emotion<=emotion);
        if(aff.length){aff.sort((a,b)=>pageScore(b)-pageScore(a));page=aff[0];hand.splice(hand.indexOf(page.id),1);disc.push(page.id);light-=page.cost}
      }
      if(page){asked=true;isKey=!!(intent&&intent.big);correct=rng()<(isKey?pk:pc)}
      const hp0=P.hp;
      const steps=E.resolveScene({P,G,pDice:page&&P.stag===0?page.dice:null,gDice:G.stag>0?null:(intent?intent.dice:null),correct,isKey,emotion,mods:{},rng});
      dmgTaken+=hp0-P.hp;
      if(steps.some(s=>s.newStag.includes("P")))stagP++; if(steps.some(s=>s.newStag.includes("G")))stagG++;
      if(asked){ if(correct){charge++;if(charge>=C.chargesPerEmotion&&emotion<C.emotionMax){emotion++;charge=0;pend.d++;pend.l++}} else charge=0 }
      if(G.hp<=0) return {win:true,scenes,hp:P.hp,stagP,stagG,dmgTaken};
      if(P.hp<=0) return {win:false,scenes,hp:0,stagP,stagG,dmgTaken};
      // next turn
      for(const u of [P,G]){ if(u.stag===2)u.stag=1; else if(u.stag===1){u.stag=0;u.st=u.stMax} }
      const cap=Math.min(C.maxLightCap,C.baseLight+emotion);
      light=Math.min(cap,light+1+(page&&page.id==="breathe"?1:0)+pend.l);pend.l=0;
      draw(1+pend.d);pend.d=0;
      rec.turn++; intent=E.planIntent(kit,rec);
    }
    return {win:false,scenes:80,hp:P.hp,timeout:true,stagP,stagG,dmgTaken};
  }
  const res={};
  const N=500;
  for(const gid of E.WEAK_POINTS.map(g=>g.id)){
    res[gid]={};
    for(const [dk,deck] of Object.entries(DECKS)){
      res[gid][dk]={};
      for(const pc of [1,0.9,0.75,0.6,0.4,0.2,0]){
        let w=0,sc=0,hp=0,sp=0,sg=0,to=0;
        for(let i=0;i<N;i++){const r=sim(gid,pc,pc,deck);w+=r.win?1:0;sc+=r.scenes;hp+=r.hp;sp+=r.stagP;sg+=r.stagG;to+=r.timeout?1:0}
        res[gid][dk][pc]={win:+(w/N*100).toFixed(0),scenes:+(sc/N).toFixed(1),hp:+(hp/N).toFixed(0),stagP:+(sp/N).toFixed(2),stagG:+(sg/N).toFixed(2),to};
      }
    }
  }
  // power-gap table: player die [3+g,7+g] vs guest die [3,7]
  const gap={};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  for(let g=-6;g<=6;g+=2){
    const pd={min:Math.max(1,3+g),max:Math.max(2,7+g)}, gd={min:3,max:7};
    const row={};
    for(const [lab,correct] of [["correct",true],["wrong",false]]){
      let W=0,T=0,L=0;const M=60000;
      for(let i=0;i<M;i++){
        const pr=E.playerDieRange(pd,correct,false,0,0), gr=E.guestDieRange(gd,correct,false);
        const a=pr[0]+Math.floor(rng()*(pr[1]-pr[0]+1)), c=gr[0]+Math.floor(rng()*(gr[1]-gr[0]+1));
        if(a>c)W++; else if(a<c)L++; else T++;
      }
      row[lab]={win:+(W/M*100).toFixed(0),tie:+(T/M*100).toFixed(0),lose:+(L/M*100).toFixed(0)};
    }
    gap[(g>=0?"+":"")+g]=row;
  }
  // key (hard) scene: my [2,5] page vs big die, etc
  return {res,gap};
});
console.log("GAP TABLE (player die [3+g,7+g] vs guest [3,7], emotion 0): win/tie/lose %");
for(const [g,r] of Object.entries(out.gap)) console.log(("gap "+g).padEnd(8),"correct",JSON.stringify(r.correct),"wrong",JSON.stringify(r.wrong));
for(const [gid,d] of Object.entries(out.res)){
  console.log("\n== "+gid);
  for(const [dk,rows] of Object.entries(d)){
    console.log(" deck:"+dk.padEnd(8)+Object.entries(rows).map(([pc,v])=>`p${pc}:${v.win}%/${v.scenes}s${v.to?"(t"+v.to+")":""}`).join("  "));
  }
}
console.log("errs",errs);
await b.close();server.close();
