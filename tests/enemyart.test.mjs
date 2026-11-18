/* 다대다 적 새 그림(인간형·기계인간형·꼭두각시형): 시트 + 무대 + 동작/표정 */
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
let fails=0; const ok=(c,m,x)=>{ console.log((c?"PASS ":"FAIL ")+m+(x!==undefined?" "+JSON.stringify(x):"")); if(!c) fails++; };
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const KINDS=["human","automaton","puppet"], FORMS=["base","ritual","knowledge","chaos"], EXS=["e0","e1","e2","e3"];

/* 1) 시트: 3종 × 4형 × 표정 4 + 우두머리 + 흐트러짐 */
{
  const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.gx);
  const r=await p.evaluate(([KINDS,FORMS,EXS])=>{ const gx=__studyGame.gx; const lab={human:"인간형",automaton:"기계인간형",puppet:"꼭두각시형"};
    const cell=(t,svg,w,h,clip)=>`<div style="color:#cbb992;font:11px sans-serif;text-align:center"><div>${t}</div><div style="width:${w}px;height:${h}px;${clip?"overflow:hidden;":""}">${svg}</div></div>`;
    let h=`<div id=sheet style="position:fixed;inset:0;z-index:99999;background:#0b0a12;padding:8px 10px;overflow:hidden">`; const bad=[];
    for(const k of KINDS){ h+=`<div style="display:flex;gap:6px;margin-bottom:6px;align-items:flex-end">`;
      h+=cell(lab[k]+" 우두머리",gx.guestSvg({id:"L"+k},false,180,300,true,{k,v:"base",lead:true}),180,300,true);
      for(const v of FORMS) h+=cell(gx.GX_VLABEL[v],gx.guestSvg({id:"t"+k+v},false,128,300,true,{k,v}),128,300,true);
      for(const v of FORMS) for(const ex of EXS){ const s=gx.guestSvg({id:"x"+k+v+ex},false,1,1,true,{k,v},ex); if(!/data-ex="e\d"/.test(s)||!s.includes(`class="${ex}"`)) bad.push(k+v+ex); }
      for(const ex of EXS) h+=cell(["대기","아픔","놀람","이김"][+ex[1]],gx.guestSvg({id:"f"+k+ex},false,92,92,true,{k,v:"base"},ex).replace(/viewBox="[^"]+"/,`viewBox="${k==="automaton"?"76 30 128 128":"80 40 120 120"}"`),92,92,true);
      h+=cell("흐트러짐",gx.guestSvg({id:"d"+k},true,128,300,true,{k,v:"base"}),128,300,true);
      h+=`</div>`; }
    document.body.insertAdjacentHTML("beforeend",h+"</div>");
    const vis=[...document.querySelectorAll("#sheet svg.gxn")].map(s=>{ const g=s.querySelector(`.${s.dataset.ex}`); return g&&getComputedStyle(g).display!=="none"&&g.getBBox().width>0; });
    return {bad,n:document.querySelectorAll("#sheet svg.gxn").length,allVis:vis.every(Boolean)}; },[KINDS,FORMS,EXS]);
  await p.waitForTimeout(500); await p.screenshot({path:"shots/enemyart-sheet.png"});
  ok(!r.bad.length&&r.allVis&&!errs.length,"3종×4형×표정4 그려짐, 표정 보임, 오류 없음",{...r,errs});
  await p.close();
}

/* 2) 무대: body/form/leader/expr 를 직접 넣어 보기 (전투 담당 배포 전) */
for(const [w,h] of [[844,390],[667,375],[390,844]]){
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>{ const G=__studyGame,s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
  await p.waitForTimeout(1200); await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(700);
  const set=async (o)=>{ await p.evaluate(o=>{ const U=__studyGame.battleApi.mb.battle.units.filter(u=>u.side==="enemy"); U.forEach((u,i)=>Object.assign(u,o[i]||{})); BattleStage.render(__studyGame.battleApi.mb.battle); },o); await p.waitForTimeout(600); };
  await set([{body:"human",form:"basic",leader:true,expr:"idle"},{body:"machine",form:"knowledge",expr:"idle"},{body:"puppet",form:"chaos",expr:"idle"}]);
  const st=await p.evaluate(()=>{ const E=[...document.querySelectorAll(".bs-unit.enemy:not(.dead)")];
    const R=[...document.querySelectorAll(".bs-unit:not(.dead)")].map(e=>{const r=e.getBoundingClientRect(); return {id:e.dataset.unit,l:r.left,t:r.top,r:r.right,b:r.bottom};});
    const out=R.filter(r=>r.l<0||r.t<0||r.r>innerWidth+.5||r.b>innerHeight+.5).map(r=>r.id);
    const figs=E.map(e=>{ const s=e.querySelector("svg.gxn"); const r=e.querySelector(".bs-fig").getBoundingClientRect(); return {id:e.dataset.unit,art:s&&s.dataset.art,lead:e.classList.contains("lead"),h:Math.round(r.height)}; });
    const ally=document.querySelector(".bs-unit.ally .bs-fig").getBoundingClientRect().height;
    return {out,figs,ally}; });
  const arts=st.figs.map(f=>f.art).join();
  const lead=st.figs.find(f=>f.lead), other=st.figs.find(f=>!f.lead);
  ok(arts==="human,automaton,puppet"&&!st.out.length&&lead&&other&&lead.h>other.h&&other.h>=st.ally,`${w}x${h} 새 적 그림·우두머리 크게·화면 안`,st);
  if(w===844) await p.screenshot({path:"shots/enemyart-stage-844.png"});
  else await p.screenshot({path:`shots/enemyart-stage-${w}.png`});
  // 표정: expr 바뀌면 다시 그릴 때 반영
  await set([{expr:"win"},{expr:"hurt"},{expr:"shock"}]);
  const ex=await p.evaluate(()=>[...document.querySelectorAll(".bs-unit.enemy svg.gxn")].map(s=>s.dataset.ex).join());
  ok(ex==="e3,e1,e2",`${w}x${h} expr → 표정`,ex);
  // 동작: 예전 이벤트 모양(카드 id) + 새 모양(a/b)
  const mv=await p.evaluate(()=>{ const A=__studyGame.battleApi, mb=A.mb; const e=mb.battle.units.find(u=>u.id==="e1"), a=mb.battle.units.find(u=>u.side==="ally");
    const cid=(e.dice.find(d=>d.card)||{}).card; const res={};
    BattleStage.clash({kind:"one-sided",by:{unit:"e1",die:0},ally:a.id,allyDie:null,enemy:"e1",enemyDie:0,enemyCard:cid,win:null,steps:[]});
    const el=document.querySelector('.bs-unit[data-unit="e1"]'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
    return wait(BattleStage.hitAt+40).then(()=>{ res.old=[...el.classList].filter(c=>c.startsWith("m-")).join();
    res.type=cid&&mb.cards[cid]&&(mb.cards[cid].dice||[]).map(d=>d.type).join("/");
    return new Promise(r=>setTimeout(()=>{ BattleStage.clash({kind:"one-sided",a:{unit:"e2",die:0,card:{dice:[{type:"관통",min:1,max:3}]},values:[2]},b:null,steps:[{aVal:2,bVal:null,winner:"a",dmg:{unit:a.id,hp:1,stagger:1}}],result:{staggered:[],dead:[]}});
      return wait(BattleStage.hitAt+40).then(()=>{ res.neu=[...document.querySelector('.bs-unit[data-unit="e2"]').classList].filter(c=>c.startsWith("m-")).join();
      res.tgt=document.querySelector(`.bs-unit[data-unit="${a.id}"]`).classList.contains("flinch");
      BattleStage.clash({kind:"clash",a:{unit:a.id,die:0,card:{dice:[{type:"slash"}]}},b:{unit:"e3",die:0,card:{dice:[{type:"방어"}]}},steps:[{winner:"a"},{winner:"a"}],result:{}});
      return wait(BattleStage.hitAt+40).then(()=>{ res.e3=[...document.querySelector('.bs-unit[data-unit="e3"]').classList].filter(c=>c.startsWith("m-")||c==="lose").join();
      r(res); }); }); },700)); }); });
  ok(/^m-(slash|pierce|blunt|guard|evade|page)$/.test(mv.old)&&mv.neu==="m-pierce"&&mv.tgt&&mv.e3.includes("m-guard")&&mv.e3.includes("lose"),`${w}x${h} 주사위 종류별 동작 (예전·새 이벤트 모양)`,mv);
  await p.waitForTimeout(150); if(w===844) await p.screenshot({path:"shots/enemyart-stage-844-clash.png"});
  await p.waitForTimeout(700);
  // 흐트러짐: 무너짐(꼭두각시는 줄이 끊김), 쓰러짐: 잠깐 보였다가 사라짐
  await set([{staggered:true},{},{hp:0}]);
  const dn=await p.evaluate(()=>{ const q=id=>document.querySelector(`.bs-unit[data-unit="${id}"]`); return {fall:q("e1").classList.contains("falling"),down:!!q("e1").querySelector("svg.gxn.down"),dying:q("e3").classList.contains("dying"),op:getComputedStyle(q("e3")).opacity}; });
  ok(dn.fall&&dn.down&&dn.dying&&+dn.op>0.5,`${w}x${h} 흐트러짐 무너짐 / 쓰러짐 연출`,dn);
  await p.waitForTimeout(1600);
  const gone=await p.evaluate(()=>getComputedStyle(document.querySelector('.bs-unit[data-unit="e3"]')).opacity);
  ok(+gone<0.05,`${w}x${h} 쓰러진 적은 사라짐`,gone);
  // body 없으면 예전 그림
  await set([{body:undefined,leader:undefined},{body:undefined},{body:undefined}]);
  const old=await p.evaluate(()=>document.querySelectorAll(".bs-unit.enemy svg.gxn").length);
  ok(old===0,`${w}x${h} body 없으면 예전 그림`,old);
  ok(!errs.length,`${w}x${h} 페이지 오류 없음`,errs);
  await p.close();
}
await b.close(); server.close();
console.log(fails?`${fails} FAIL`:"ALL PASS"); if(fails) process.exitCode=1;
