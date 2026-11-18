/* 다대다: 개막 버튼(가운데, 손패 위)과 아군/적 체력·흐트러짐 상태판 */
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
const ok=(c,m,x)=>{ console.log((c?"PASS ":"FAIL ")+m+(x!==undefined?" "+JSON.stringify(x).slice(0,700):"")); if(!c) fails++; };
const inter=(a,b)=>Math.max(0,Math.min(a.r,b.r)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.b,b.b)-Math.max(a.y,b.y));

async function prepPage(p){
  await p.evaluate(()=>{
    const G=__studyGame, s=G.save;
    s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"];
    G.libs.sync(s);
    G.libs.equipKey(s,"lib2","archivist");
    G.libs.equipKey(s,"lib3","classical-robe");
    const sp=G.libs.setParty(s,["kyu","lib2","lib3"]);
    if(!(s.party||[]).includes("lib3")) throw new Error("party3 "+JSON.stringify(s.party)+" "+JSON.stringify(sp));
    const g=G.data.WEAK_POINTS.find(x=>x.id==="defamation-truth");
    if(g&&g.enemies.length<5) g.enemies=[...g.enemies,{key:"extra-foe",name:"그림자 손님",leader:false,q:[((g.enemies[0]||{}).q||[])[0]].filter(Boolean)}];
    if(g) g.manyEnemies=true;   /* 다수 적 손님이라도 상태판은 본체 최대 3행. 분신은 본체 행에 칩으로만 붙음 */
    G.battleApi.begin("defamation-truth");
  });
  await p.waitForFunction(()=>__studyGame.battle&&__studyGame.battle.phase==="question"&&document.querySelector(".qpanel.on"),null,{timeout:8000});
  await p.evaluate(()=>__studyGame.battleApi.answerUI(true));
  await p.waitForFunction(()=>__studyGame.battle&&__studyGame.battle.phase==="assign",null,{timeout:5000});
  await p.waitForTimeout(400);
}

for(const [w,h] of [[844,390],[390,844]]){
  const land=w>h;
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true,deviceScaleFactor:2})).newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  await p.goto(BASE);
  await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await prepPage(p);

  const info=await p.evaluate(()=>{
    const box=e=>{ if(!e) return null; const r=e.getBoundingClientRect(), s=getComputedStyle(e);
      return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),r:+r.right.toFixed(1),b:+r.bottom.toFixed(1),
        vis:s.display!=="none"&&s.visibility!=="hidden"&&+s.opacity!==0&&r.width>1&&r.height>1, text:(e.innerText||"").replace(/\s+/g," ").trim()}; };
    const go=document.querySelector("#btn-mb-go");
    const hand=document.querySelector("#hand, .hand.bs-fan, .bs-hand");
    const cards=[...document.querySelectorAll("#hand .cc, .hand.bs-fan .cc, .bs-hand .bs-card")].map(box);
    const ally=document.querySelector("#mb-stat-ally");
    const enemy=document.querySelector("#mb-stat-enemy");
    const leftBm=document.querySelector(".bm-btn");
    const setBm=document.querySelector("#set-bm");
    const units=[...document.querySelectorAll(".bs-unit:not(.dead)")].map(e=>({id:e.dataset.unit,plate:box(e.querySelector(".bs-plate")),fig:box(e.querySelector(".bs-fig")),dice:box(e.querySelector(".bs-dice")),bar:!!e.querySelector(".bs-bar")}));
    const B=__studyGame.battle;
    const rows=sel=>[...document.querySelectorAll(sel+" .mb-stat-row")].map(r=>{
      const bs=[...r.querySelectorAll(".mb-meter b")].map(b=>b.textContent.trim());
      return {id:r.dataset.unit,name:r.querySelector(".mb-nm span")?.textContent.trim(),hp:bs[0],st:bs[1],dead:r.classList.contains("dead"),stag:r.classList.contains("is-stag"),mark:!!r.querySelector(".st-mark"),box:box(r)};
    });
    return {
      phase:B.phase,
      go:Object.assign(box(go)||{},{label:(go&&go.innerText||"").replace(/\s+/g," ").trim(),ready:!!(go&&go.classList.contains("ready")),cx:go&&(go.getBoundingClientRect().left+go.getBoundingClientRect().width/2)}),
      hand:box(hand), cards,
      ally:box(ally), enemy:box(enemy),
      allyRows:rows("#mb-stat-ally"), enemyRows:rows("#mb-stat-enemy"),
      leftBm:box(leftBm), setBm:box(setBm),
      units,
      data:{
        allies:B.units.filter(u=>u.side==="ally").map(u=>({id:u.id,name:u.name,hp:u.hp,maxHp:u.maxHp,st:u.stagger,mst:u.maxStagger,stag:!!u.staggered})),
        enemies:B.units.filter(u=>u.side==="enemy").map(u=>({id:u.id,name:u.name,hp:u.hp,maxHp:u.maxHp,st:u.stagger,mst:u.maxStagger,stag:!!u.staggered,parent:u.parentId||u.ownerId||u.summoner||null}))
      },
      W:innerWidth,H:innerHeight
    };
  });

  ok(info.phase==="assign", `${w} in assign phase`, info.phase);
  ok(info.go.vis && info.go.label==="개막", `${w} button label is 개막`, info.go);
  ok(!info.go.ready, `${w} button is not ready before all dice are assigned`);
  ok(Math.abs(info.go.cx - w/2) <= 16, `${w} 개막 is horizontally centered`, {cx:info.go.cx,mid:w/2});
  ok(info.hand && info.go.b <= info.hand.y+2, `${w} 개막 sits above the hand`, {go:info.go,hand:info.hand});
  ok(info.ally && info.ally.vis && info.enemy && info.enemy.vis, `${w} both status panels visible`);
  ok(info.ally.x < info.enemy.x, `${w} ally panel is on the left, enemy on the right`, {ax:info.ally.x,ex:info.enemy.x});
  const mains=info.data.enemies.filter(u=>!u.parent).slice(0,3);
  ok(info.allyRows.length>=3 && info.enemyRows.length===mains.length && info.enemyRows.length<=3, `${w} panels list 3 allies / up to 3 enemy bodies`, {a:info.allyRows.length,e:info.enemyRows.length,m:mains.length});

  const match=(rows,data)=>rows.length===data.length && rows.every((r,i)=>{
    const u=data[i];
    return r.id===u.id && r.name===u.name && r.hp===`${u.hp}/${u.maxHp}` && r.st===`${u.st}/${u.mst}` && r.stag===u.stag;
  });
  ok(match(info.allyRows,info.data.allies), `${w} ally rows match battle.units hp/stagger`, {rows:info.allyRows,data:info.data.allies});
  ok(match(info.enemyRows,mains), `${w} enemy rows match main bodies only (max 3)`, {rows:info.enemyRows,data:mains,all:info.data.enemies});
  ok(info.units.every(u=>u.bar), `${w} small bars over characters' heads remain`);

  const hit=(a,b,pad=1)=>a&&b&&a.vis!==false&&b.vis!==false&&inter(
    {x:a.x+pad,y:a.y+pad,r:a.r-pad,b:a.b-pad},
    {x:b.x+pad,y:b.y+pad,r:b.r-pad,b:b.b-pad})>2;
  const cards=info.cards.filter(Boolean);
  const off=el=>el&&(el.x<-1||el.y<-1||el.r>w+1||el.b>h+1);
  const overlaps=[];
  if(hit(info.go,info.hand)) overlaps.push("go-hand");
  if(cards.some(c=>hit(info.go,c))) overlaps.push("go-card");
  if(hit(info.go,info.ally)||hit(info.go,info.enemy)) overlaps.push("go-panel");
  if(hit(info.hand,info.ally)||hit(info.hand,info.enemy)) overlaps.push("hand-panel");
  if(cards.some(c=>hit(c,info.ally)||hit(c,info.enemy))) overlaps.push("card-panel");
  if(hit(info.go,info.leftBm)||hit(info.go,info.setBm)) overlaps.push("go-bookmark");
  if(hit(info.ally,info.leftBm)||hit(info.enemy,info.setBm)||hit(info.ally,info.setBm)||hit(info.enemy,info.leftBm)) overlaps.push("panel-bookmark");
  if(hit(info.ally,info.enemy)) overlaps.push("panel-panel");
  /* 캐릭터(몸·이름 명찰·머리 막대)는 손패·개막·상태판에 가리지 않는다. */
  for(const u of info.units||[]){
    const bits=[u.fig,u.plate].filter(Boolean);
    if(bits.some(b=>hit(info.go,b))) overlaps.push("go-unit-"+u.id);
    if(cards.some(c=>bits.some(b=>hit(c,b)))) overlaps.push("card-unit-"+u.id);
    if(bits.some(b=>hit(info.ally,b)||hit(info.enemy,b))) overlaps.push("panel-unit-"+u.id);
  }
  const overflow=[info.go,info.hand,info.ally,info.enemy].filter(off).map(e=>e);
  ok(overlaps.length===0, `${w} no overlap between 개막, hand, panels, bookmarks`, overlaps);
  ok(overflow.length===0, `${w} 개막/hand/panels stay on screen`, overflow);
  await p.screenshot({path:`shots/hpstatus-${w}.png`});

  // mutate hp / stagger and confirm the panel updates on refresh
  const afterMut=await p.evaluate(()=>{
    const B=__studyGame.battle, A=__studyGame.battleApi;
    const a=B.units.find(u=>u.side==="ally"), e=B.units.find(u=>u.side==="enemy");
    a.hp=Math.max(1,Math.floor(a.maxHp/2)); a.stagger=1; a.staggered=true;
    const X=A.internals();
    if(X[a.id]){ X[a.id].cu.hp=a.hp; X[a.id].cu.st=a.stagger; X[a.id].cu.stag=1; }
    e.hp=0; e.stagger=0; e.staggered=false;
    if(X[e.id]){ X[e.id].cu.hp=0; X[e.id].cu.st=0; X[e.id].cu.stag=0; }
    A.refresh();
    const row=id=>document.querySelector(`.mb-stat-row[data-unit="${id}"]`);
    const read=id=>{ const r=row(id); if(!r) return null; const bs=[...r.querySelectorAll(".mb-meter b")].map(b=>b.textContent.trim());
      return {hp:bs[0],st:bs[1],dead:r.classList.contains("dead"),stag:r.classList.contains("is-stag"),mark:!!r.querySelector(".st-mark")}; };
    return {aid:a.id,eid:e.id,ahp:`${a.hp}/${a.maxHp}`,ast:`${a.stagger}/${a.maxStagger}`,ehp:`${e.hp}/${e.maxStagger?e.maxStagger:e.maxStagger}`,
      aExpHp:`${a.hp}/${a.maxHp}`, eExpHp:`${e.hp}/${e.maxHp}`, a:read(a.id), e:read(e.id)};
  });
  ok(afterMut.a&&afterMut.a.hp===afterMut.aExpHp&&afterMut.a.stag&&afterMut.a.mark, `${w} staggered ally row updates and shows marker`, afterMut);
  ok(afterMut.e&&afterMut.e.hp===afterMut.eExpHp&&afterMut.e.dead, `${w} dead enemy row is dimmed`, afterMut);

  // highlight: tap a row
  await p.evaluate(()=>{ const r=document.querySelector("#mb-stat-ally .mb-stat-row"); if(r) r.click(); });
  await p.waitForTimeout(80);
  const hl=await p.evaluate(()=>{
    const r=document.querySelector("#mb-stat-ally .mb-stat-row");
    const id=r&&r.dataset.unit;
    return {id, on:!!document.querySelector(`.bs-unit[data-unit="${id}"].mb-hl`)};
  });
  ok(hl.on, `${w} tapping a status row highlights the unit`, hl);

  // assign every remaining living ally die so the button glows (skip staggered)
  await p.evaluate(()=>{
    const G=__studyGame, A=G.battleApi, B=G.battle;
    const enemies=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
    for(const u of B.units.filter(x=>x.side==="ally"&&x.hp>0&&!x.staggered)){
      const X=A.internals()[u.id]; if(!X) continue;
      u.light=Math.max(u.light,6); u.maxLight=Math.max(u.maxLight||0,6);
      for(let i=0;i<(u.dice||[]).length;i++){
        if(u.dice[i].card) continue;
        const cid=(X.handIds||[])[0]||"turn-page";
        const tgt=enemies[i%Math.max(1,enemies.length)];
        if(tgt) A.assign(u.id,i,cid,{unit:tgt.id,die:0});
      }
    }
    A.refresh();
  });
  await p.waitForTimeout(250);
  const ready=await p.evaluate(()=>{ const go=document.querySelector("#btn-mb-go"); return {ready:!!(go&&go.classList.contains("ready")),text:(go&&go.innerText||"").trim(),disp:go&&getComputedStyle(go).display}; });
  ok(ready.ready && ready.text.includes("개막") && ready.disp!=="none", `${w} 개막 glows when every die is assigned`, ready);

  if(errs.length) ok(false, `${w} page errors`, errs);
  await p.context().close();
}
{
  const p=await (await b.newContext({viewport:{width:844,height:390},hasTouch:true})).newPage();
  await p.goto(BASE);
  await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await prepPage(p);
  const chip=await p.evaluate(()=>{
    const B=__studyGame.battle, A=__studyGame.battleApi;
    const parent=B.units.find(u=>u.side==="enemy");
    B.units.push(
      {id:"x1",side:"enemy",name:"분신1",hp:8,maxHp:8,stagger:4,maxStagger:4,staggered:false,parentId:parent.id,dice:[]},
      {id:"x2",side:"enemy",name:"분신2",hp:8,maxHp:8,stagger:4,maxStagger:4,staggered:false,parentId:parent.id,dice:[]}
    );
    A.refresh();
    const rows=[...document.querySelectorAll("#mb-stat-enemy .mb-stat-row")].map(r=>({
      id:r.dataset.unit, name:r.querySelector(".mb-nm span")?.textContent.trim(),
      chip:(r.querySelector(".mb-mini")||{}).textContent&&r.querySelector(".mb-mini").textContent.trim()
    }));
    return {parent:parent.id, rows, n:rows.length, nEnemy:B.units.filter(u=>u.side==="enemy").length};
  });
  const prow=chip.rows.find(r=>r.id===chip.parent);
  ok(chip.n<=3 && !chip.rows.some(r=>r.id==="x1"||r.id==="x2") && prow && /\+2/.test(prow.chip||"") && /분신/.test(prow.chip||""),
    "gimmick extras attach as +2 분신 chip on the parent row", chip);
  await p.context().close();
}
await b.close(); server.close();
console.log(fails?"FAILS "+fails:"ALL PASS");
process.exit(fails?1:0);
