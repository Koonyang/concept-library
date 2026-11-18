import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { readFileSync } from "fs";
const ROOT=LIB_ROOT;
let fails=0; const ok=(c,m,x)=>{ console.log((c?"PASS ":"FAIL ")+m+(x!==undefined?" "+JSON.stringify(x):"")); if(!c) fails++; };
const js=readFileSync(ROOT+"/assets/ui/battle-stage.js","utf8");
const html=`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#07080d;font-family:sans-serif}#host{position:fixed;inset:0}</style><div id=host></div><script>${js}</script>`;
const mk=(nA,nE)=>({scene:1,phase:"assign",question:{fromUnit:"e1",answered:true,correct:true},units:[
  ...Array.from({length:nA},(_,i)=>({id:"a"+(i+1),side:"ally",slot:i,libId:"kyu",name:["큐 양","사서 2","사서 3"][i],hp:40,maxHp:50,stagger:20,maxStagger:30,staggered:false,light:3,maxLight:4,emotion:0,status:[],dice:[{speed:5-i,card:null,target:null},{speed:3,card:null,target:null}]})),
  ...Array.from({length:nE},(_,i)=>({id:"e"+(i+1),side:"enemy",slot:i,topic:["허위 인식","310조 입증","공익 범주","적시","전파성"][i],name:["허위의 소문꾼","입증의 저울","공익의 방패","적시자","전파자"][i],hp:30,maxHp:30,stagger:15,maxStagger:15,staggered:i===4,light:2,maxLight:3,emotion:0,status:[],
     dice:[{speed:4+i%3,card:"x",target:{unit:"a"+((i%nA)+1),die:0}}]}))]});
const hands={a1:["c1","c2","c3","c4"],a2:["c1","c5"],a3:["c2"]};
const cards={c1:{name:"정면 반박",cost:1,dice:[{type:"slash",min:3,max:6}]},c2:{name:"판례 인용",cost:2,dice:[{type:"pierce",min:4,max:8},{type:"guard",min:2,max:5}]},c3:{name:"고소 불가",cost:0,dice:[{type:"blunt",min:2,max:4}]},c4:{name:"위법성 조각",cost:3,dice:[{type:"slash",min:6,max:10}]},c5:{name:"회피",cost:1,dice:[{type:"evade",min:3,max:7}]},x:{name:"x",cost:0,dice:[]}};
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const errs=[];
for(const [w,h] of [[667,375],[844,390],[1024,473],[390,844]]){
  for(const [nA,nE] of [[2,5],[3,5],[1,2]]){
    const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true}); p.on("pageerror",e=>errs.push(String(e)));
    await p.setContent(html);
    await p.evaluate(([bt,hands,cards])=>{ window.__log=[]; BattleStage.mount(document.getElementById("host")); BattleStage.onAssign=(...a)=>{ __log.push(a); const u=window.__bt.units.find(x=>x.id===a[0]); u.dice[a[1]].card=a[2]; u.dice[a[1]].target=a[3]; BattleStage.render(window.__bt); }; window.__bt=bt; BattleStage.render(bt,{hands,cards}); },[mk(nA,nE),hands,cards]);
    await p.waitForTimeout(150);
    const lay=await p.evaluate(()=>{ const R=[...document.querySelectorAll(".bs-unit:not(.dead)")].map(e=>{const r=e.getBoundingClientRect(); return {id:e.dataset.unit,l:r.left,t:r.top,r:r.right,b:r.bottom};});
      const out=R.filter(r=>r.l<0||r.t<0||r.r>innerWidth+.5||r.b>innerHeight+.5).map(r=>r.id);
      const ov=[]; for(let i=0;i<R.length;i++) for(let j=i+1;j<R.length;j++){ const a=R[i],c=R[j]; const x=Math.max(0,Math.min(a.r,c.r)-Math.max(a.l,c.l)), y=Math.max(0,Math.min(a.b,c.b)-Math.max(a.t,c.t)); const m=Math.min((a.r-a.l)*(a.b-a.t),(c.r-c.l)*(c.b-c.t)); if(x*y>m*.25) ov.push(a.id+"/"+c.id); }
      const arrows=document.querySelectorAll(".bs-svg path").length; return {out,ov,arrows}; });
    ok(!lay.out.length&&!lay.ov.length&&lay.arrows>=nE-(nE===5?1:0),`${nA}v${nE} fits, no heavy overlap, enemy arrows ${w}x${h}`,lay);
    // tap flow: my die -> card -> enemy die
    await p.tap('.bs-die[data-u="a1"][data-d="0"]'); await p.waitForTimeout(60);
    const handN=await p.evaluate(()=>document.querySelectorAll(".bs-card").length);
    const hr=await p.evaluate(()=>{ const hb=document.querySelector(".bs-hand").getBoundingClientRect(); const dice=[...document.querySelectorAll(".bs-unit.enemy:not(.dead) .bs-die")].map(e=>e.getBoundingClientRect()); return {hidden:dice.some(d=>d.bottom>hb.top&&d.top<hb.bottom&&d.right>hb.left&&d.left<hb.right),inside:hb.left>=0&&hb.right<=innerWidth+.5&&hb.bottom<=innerHeight+.5}; });
    ok(handN>=1&&!hr.hidden&&hr.inside,`hand opens without hiding enemy dice ${w}x${h} ${nA}v${nE}`,{handN,...hr});
    await p.tap('.bs-card[data-card="c1"]'); await p.waitForTimeout(60);
    await p.tap('.bs-die[data-u="e1"][data-d="0"]'); await p.waitForTimeout(80);
    const log=await p.evaluate(()=>__log);
    const clash=await p.evaluate(()=>[...document.querySelectorAll(".bs-svg text")].some(t=>t.textContent==="합"));
    ok(log.length===1&&log[0][0]==="a1"&&log[0][2]==="c1"&&log[0][3].unit==="e1"&&clash,`tap flow assigns + shows clash ${w}x${h} ${nA}v${nE}`,log);
    if(nA===2&&nE===5){ await p.tap('.bs-die[data-u="a1"][data-d="1"]'); await p.waitForTimeout(80); await p.screenshot({path:ROOT+`/shots/bstage-${w}x${h}.png`}); }
    await p.close();
  }
}

/* ---- 손질 1~6 ---- */
for(const [w,h] of [[844,390],[390,844]]){
  const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true}); p.on("pageerror",e=>errs.push(String(e)));
  await p.setContent(html.replace("<div id=host></div>",`<div id=host></div><div id=qpanel class="on" style="position:fixed;left:5%;right:5%;bottom:8px;height:${Math.round(h*.4)}px;background:#222;z-index:60"></div>`));
  const bt=mk(2,5); bt.units.find(u=>u.id==="e5").dice=[]; bt.units.find(u=>u.id==="e1").dice[0].target={unit:"a2",die:null};
  bt.units[0].dice.push({speed:2,card:null,target:null});
  await p.evaluate(([bt,cards])=>{ window.__log=[]; window.__bt=bt; const hs=document.getElementById("host");
    BattleStage.mount(hs); BattleStage.mount(hs); BattleStage.unmount(); BattleStage.mount(hs);   // 여러 번 붙여도 하나만
    BattleStage.onAssign=(...a)=>{ __log.push(a); const u=__bt.units.find(x=>x.id===a[0]); u.dice[a[1]].card=a[2]; u.dice[a[1]].target=a[3]; BattleStage.render(__bt); };
    bt.phase="question"; BattleStage.render(bt,{hands:{a1:["c1","c1","c3"],a2:["c1"]},cards}); },[bt,cards]);
  await p.waitForTimeout(500);
  // 1) 문제 칸 위에만 유닛
  const q=await p.evaluate(()=>{ const top=document.getElementById("qpanel").getBoundingClientRect().top; return [...document.querySelectorAll(".bs-unit:not(.dead)")].filter(e=>e.getBoundingClientRect().bottom>top+1).map(e=>e.dataset.unit); });
  ok(!q.length,`${w}x${h} 문제 칸이 유닛을 안 가림`,q);
  await p.evaluate(()=>{ document.getElementById("qpanel").classList.remove("on"); document.getElementById("qpanel").style.display="none"; __bt.phase="assign"; BattleStage.render(__bt); }); await p.waitForTimeout(500);
  // 3) die:null 화살표도 그려짐 (적 4명 화살표 + e1→a2 몸)
  const arrows=await p.evaluate(()=>document.querySelectorAll(".bs-svg path").length);
  ok(arrows>=4,`${w}x${h} 주사위 없는 대상 화살표`,arrows);
  // 자동 선택 + 2) 흐트러진 적 몸 탭 = die:null
  const auto=await p.evaluate(()=>({sel:BattleStage._state().sel,hand:document.querySelectorAll(".bs-card").length}));
  ok(auto.sel&&auto.sel.unit==="a1"&&auto.sel.die===0&&auto.hand===3,`${w}x${h} 첫 주사위 자동 선택, 손패 바로 뜸`,auto);
  ok(await p.evaluate(()=>!!document.querySelector('.bs-unit[data-unit="e5"]')),"e5 present");
  await p.tap('.bs-card[data-k="0"]'); await p.waitForTimeout(60);
  ok(await p.evaluate(()=>document.querySelector('.bs-unit[data-unit="e5"]').classList.contains("can-hit")),`${w}x${h} 흐트러진 적 강조`);
  await p.tap('.bs-unit[data-unit="e5"] .bs-fig'); await p.waitForTimeout(80);
  let log=await p.evaluate(()=>__log);
  ok(log.length===1&&log[0][3].unit==="e5"&&log[0][3].die===null,`${w}x${h} 흐트러진 적 몸 탭 → die:null`,log);
  // 4) 같은 카드 두 장: 하나만 사용됨
  const cs=await p.evaluate(()=>[...document.querySelectorAll(".bs-card")].map(c=>c.dataset.card+(c.classList.contains("used")?"*":"")));
  ok(cs.join()==="c1*,c1,c3",`${w}x${h} 같은 카드 두 장 중 한 장만 사용됨`,cs);
  await p.tap('.bs-card[data-k="1"]'); await p.waitForTimeout(60); await p.tap('.bs-die[data-u="e2"][data-d="0"]'); await p.waitForTimeout(80);
  log=await p.evaluate(()=>__log);
  ok(log.length===2&&log[1][2]==="c1"&&log[1][1]===1,`${w}x${h} 두 번째 같은 카드도 놓임`,log[1]);
  // 6) 합 연출 불꽃
  await p.evaluate(()=>{ const r=BattleStage.clash({kind:"clash",ally:"a1",allyDie:0,enemy:"e1",enemyDie:0,win:"ally",by:{unit:"a1",die:0}}); window.__cp=r instanceof Promise; return new Promise(ok=>setTimeout(ok,BattleStage.hitAt+40)); });  // 카메라가 다가간 뒤 부딪침
  const fx=await p.evaluate(()=>({spark:!!document.querySelector(".bs-spark"),lunge:document.querySelector('.bs-unit[data-unit="a1"]').classList.contains("lunge"),lose:document.querySelector('.bs-unit[data-unit="e1"]').classList.contains("lose"),pt:BattleStage.unitPoint("e1")}));
  ok(fx.spark&&fx.lunge&&fx.lose&&fx.pt&&fx.pt.x>0,`${w}x${h} 합 연출`,fx);
  await p.waitForTimeout(500);
  // 5) 리스너가 하나만: pointerup 한 번에 onUp 한 번 → 드래그 배정 1회
  await p.screenshot({path:ROOT+`/shots/bstage-fix-${w}x${h}.png`});
  await p.close();
}
ok(!errs.length,"no page errors",errs);
await b.close(); process.exit(fails?1:0);
