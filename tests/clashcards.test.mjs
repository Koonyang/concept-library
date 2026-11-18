/* 합 책장 대결: 합 클로즈업 동안 두 쪽 책장(이름·빛·주사위 칸), 쓰는 칸 강조, 굴린 값, 승/패/무승부/방어/회피 도장, 일방 공격.
   캐릭터(몸·이름·막대)를 가리지 않고 화면 안, fast·탭 빨리 감기·길게 눌러 건너뛰기에서 바로 사라짐 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(+(process.env.PORT||0),"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
let fails=0; const ok=(c,m,x)=>{ console.log((c?"PASS ":"FAIL ")+m+(x!==undefined&&!c?" "+JSON.stringify(x):"")); if(!c) fails++; };
mkdirSync(ROOT+"/shots",{recursive:true});
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const SIZES=[[844,390],[740,360],[667,375],[1024,473],[390,844]];
for(const [w,h] of SIZES){
  const L=`${w}x${h}`;
  const p=await (await b.newContext({viewport:{width:w,height:h},hasTouch:true})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE+"?multi=1"); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
  await p.evaluate(()=>{ const G=__studyGame,s=G.save; s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe"]; G.libs.equipKey(s,"lib2","archivist"); G.libs.setParty(s,["kyu","lib2"]); G.battleApi.begin("beccaria"); });
  await p.waitForTimeout(1200); await p.evaluate(()=>__studyGame.battleApi.answerUI(true)); await p.waitForTimeout(800);
  await p.evaluate(()=>{
    const B=__studyGame.battleApi.mb.battle, a=B.units.find(u=>u.side==="ally").id, e=B.units.find(u=>u.side==="enemy").id;
    const CA={name:"표지 내려치기",cost:1,dice:[{type:"blunt",min:3,max:7},{type:"slash",min:2,max:5}]};
    const CE={name:"판사의 재량",cost:0,dice:[{type:"pierce",min:1,max:4},{type:"guard",min:2,max:6}]};
    const CV={name:"몸 피하기",cost:0,dice:[{type:"evade",min:2,max:6}]};
    window.__ids={a,e};
    window.__ev={
      two:{kind:"clash",a:{unit:a,die:0,card:CA,values:[7,3]},b:{unit:e,die:0,card:CE,values:[4,5]},target:e,
        steps:[{aVal:7,bVal:4,winner:"a",dmg:{unit:e,hp:7,stagger:3}},{aVal:3,bVal:5,winner:"b",dmg:{unit:a,hp:0,stagger:2}}],result:{staggered:[],dead:[]}},
      tie:{kind:"clash",a:{unit:e,die:0,card:CE,values:[3]},b:{unit:a,die:0,card:CA,values:[3]},target:a,steps:[{aVal:3,bVal:3,winner:"tie",dmg:null}],result:{}},
      /* 전투 원래 필드(pd=사서, gd=적, keeps)만 있는 모양: 회피가 이기면 같은 칸을 다시 쓴다 */
      eng:{kind:"clash",a:{unit:a,die:0,card:CA},b:{unit:e,die:0,card:CV},target:e,
        steps:[{aVal:4,bVal:6,winner:"b",pd:{type:"타격",roll:4},gd:{type:"회피",roll:6,keeps:true},pRange:[3,7],gRange:[2,6],dmg:null,events:[{kind:"recover",target:"G",st:6}]},
               {aVal:5,bVal:2,winner:"a",pd:{type:"참격",roll:5},gd:{type:"회피",roll:2,keeps:false,reused:true},pRange:[2,5],gRange:[2,6],dmg:{unit:e,hp:5,stagger:2}}],result:{}},
      /* aDie/bDie 가 오면 그것을 쓴다 (사서 방어가 공격을 깎아 짐) */
      dief:{kind:"clash",a:{unit:e,die:0,card:CE},b:{unit:a,die:0,card:CA},target:a,
        steps:[{aVal:6,bVal:2,winner:"a",aDie:{type:"pierce",min:1,max:6},bDie:{type:"guard",min:1,max:4,index:1},dmg:{unit:a,hp:4,stagger:0}}],result:{}},
      /* 전투 새 필드: aDie/bDie{type,min,max,value,idx,reused}, aResult/bResult, blocked, recovered */
      nfe:{kind:"clash",a:{unit:a,die:0,card:CA},b:{unit:e,die:0,card:CV},target:e,
        steps:[{aDie:{type:"slash",min:2,max:5,value:4,idx:1,reused:false},bDie:{type:"evade",min:2,max:6,value:5,idx:0,reused:true},aResult:"lose",bResult:"evade",blocked:0,recovered:3,dmg:null}],result:{}},
      nfb:{kind:"clash",a:{unit:e,die:0,card:CE},b:{unit:a,die:0,card:CA},target:a,
        steps:[{aDie:{type:"pierce",min:1,max:6,value:6,idx:0,reused:false},bDie:{type:"guard",min:1,max:4,value:3,idx:1,reused:false},aResult:"win",bResult:"block",blocked:3,recovered:0,dmg:{unit:a,hp:3,stagger:0}}],result:{}},
      one:{kind:"one-sided",a:{unit:e,die:0,card:CE,values:[4]},b:null,target:a,steps:[{aVal:4,bVal:null,winner:"a",dmg:{unit:a,hp:4,stagger:1}}],result:{}}};
    /* 매 프레임 기록 */
    const R=el=>{ const r=el.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom}; };
    window.__rec=[]; window.__recOn=false;
    const tick=()=>{ if(window.__recOn){
        const ps=[...document.querySelectorAll(".bs-cc.on:not(.out)")];
        if(ps.length){
          const parts=[]; document.querySelectorAll(".bs-unit.fo").forEach(u=>u.querySelectorAll(".bs-fig,.bs-plate,.bs-nm,.bs-bar").forEach(x=>{ const r=R(x); if(r.r-r.l>1&&r.b-r.t>1) parts.push(r); }));
          window.__rec.push({ps:ps.map(el=>{ const ro=el.querySelector(".bs-cc-roll"), st=ro&&ro.querySelector(".bs-cc-stamp"), sb=ro&&ro.querySelector(".bs-cc-sub");
            const on=el.querySelector(".bs-cc-die.on");
            return {role:el.dataset.role,side:el.dataset.side,unit:el.dataset.unit,name:el.querySelector(".bs-cc-nm").textContent,cost:el.querySelector(".bs-cc-gem").textContent,
              one:!!el.querySelector(".bs-cc-tag"),tag:(el.querySelector(".bs-cc-tag")||{}).textContent||"",
              act:on?+on.dataset.i:null,actT:on?on.dataset.t:null,lost:[...el.querySelectorAll(".bs-cc-die.lost")].map(x=>+x.dataset.i),won:[...el.querySelectorAll(".bs-cc-die.won")].map(x=>+x.dataset.i),
              step:ro&&ro.dataset.step!=null?+ro.dataset.step:null,val:(ro&&ro.querySelector(".bs-cc-val")||{}).textContent||"",type:(ro&&ro.querySelector(".bs-cc-type")||{}).textContent||"",
              rng:(ro&&ro.querySelector(".bs-cc-rng")||{}).textContent||"",stamp:st?st.textContent:"",re:!!(ro&&ro.querySelector(".bs-cc-re")),sub:sb?sb.textContent:"",cls:ro?ro.className:"",
              rect:R(el),nmFs:parseFloat(getComputedStyle(el.querySelector(".bs-cc-nm")).fontSize),valFs:ro&&ro.querySelector(".bs-cc-val")?parseFloat(getComputedStyle(ro.querySelector(".bs-cc-val")).fontSize):null}; }),
            parts,vw:innerWidth,vh:innerHeight,cam:!!document.querySelector(".bs-cam-on")});
        } }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__run=(k,o)=>{ window.__rec=[]; window.__recOn=true; return BattleStage.clash(__ev[k],o).then(()=>{ window.__recOn=false; return {left:document.querySelectorAll(".bs-cc").length}; }); };
  });
  const hitR=(a,b2)=>Math.max(0,Math.min(a.r,b2.r)-Math.max(a.l,b2.l))*Math.max(0,Math.min(a.b,b2.b)-Math.max(a.t,b2.t));
  /* 도장이 찍힌(결과) 프레임에서: 캐릭터와 안 겹치고 화면 안 */
  const geom=(rec,label)=>{ const bad=[]; for(const f of rec){ if(!f.ps.some(x=>x.stamp||x.sub)) continue;
      for(const x of f.ps){ const r=x.rect; if(r.l<-0.5||r.t<-0.5||r.r>f.vw+0.5||r.b>f.vh+0.5) bad.push({k:"off",r});
        for(const q of f.parts){ const A=hitR(r,q); if(A>2) bad.push({k:"cover",A:Math.round(A),r,q}); } }
      for(let i=0;i<f.ps.length;i++) for(let j=i+1;j<f.ps.length;j++) if(hitR(f.ps[i].rect,f.ps[j].rect)>2) bad.push({k:"cards"}); }
    ok(!bad.length,`${L} ${label}: 책장은 캐릭터를 가리지 않고 화면 안`,bad.slice(0,3)); };
  const last=(rec,role,step)=>{ let o=null; for(const f of rec) for(const x of f.ps) if(x.role===role&&x.step===step&&(x.stamp||x.sub||x.cls.includes("one"))) o=x; return o; };
  const ids=await p.evaluate(()=>__ids);

  // 1) 두 쪽 합, 주사위 두 칸
  const end1=await p.evaluate(()=>__run("two")); const r1=await p.evaluate(()=>__rec);
  const a0=last(r1,"a",0), b0=last(r1,"b",0), a1=last(r1,"a",1), b1=last(r1,"b",1);
  ok(a0&&b0&&a1&&b1,`${L} 두 칸 모두 결과 프레임 있음`,{a0:!!a0,b0:!!b0,a1:!!a1,b1:!!b1});
  if(a0&&b0&&a1&&b1){
    ok(a0.name==="표지 내려치기"&&b0.name==="판사의 재량"&&a0.cost==="1"&&b0.cost==="0",`${L} 두 책장 이름·빛`,[a0.name,b0.name,a0.cost,b0.cost]);
    ok(a0.side==="ally"&&b0.side==="enemy",`${L} 아군 책장 / 적 책장 쪽`,[a0.side,b0.side]);
    ok(a0.act===0&&b0.act===0&&a0.actT==="blunt"&&b0.actT==="pierce",`${L} 1합: 쓰는 칸 0 강조`,[a0.act,a0.actT,b0.act,b0.actT]);
    ok(a0.val==="7"&&b0.val==="4"&&a0.rng==="3~7"&&b0.rng==="1~4"&&a0.type.includes("타격")&&b0.type.includes("관통"),`${L} 1합: 값·범위·종류`,[a0.val,b0.val,a0.rng,b0.rng,a0.type,b0.type]);
    ok(a0.stamp==="승"&&a0.cls.includes("win")&&b0.stamp==="패"&&b0.cls.includes("lose")&&b0.sub==="피해 7",`${L} 1합: 승/패 + 피해`,[a0.stamp,b0.stamp,b0.sub]);
    ok(a1.act===1&&b1.act===1&&a1.val==="3"&&b1.val==="5"&&b1.actT==="guard",`${L} 2합: 다음 칸으로 넘어감`,[a1.act,b1.act,a1.val,b1.val,b1.actT]);
    ok(b1.stamp==="방어"&&b1.sub==="피해 0"&&b1.cls.includes("win")&&a1.stamp==="패"&&a1.sub==="흐트러짐 2",`${L} 2합: 방어 성공은 "방어 / 피해 0"`,[b1.stamp,b1.sub,a1.stamp,a1.sub]);
    ok(a1.lost.includes(1)&&a1.won.includes(0)&&b1.lost.includes(0)&&b1.won.includes(1),`${L} 이긴 칸 / 깨진 칸 표시`,{al:a1.lost,aw:a1.won,bl:b1.lost,bw:b1.won});
    ok(a0.nmFs>=10&&a0.valFs>=24,`${L} 읽을 수 있는 글자 크기`,[a0.nmFs,a0.valFs]);
  }
  ok(r1.every(f=>f.cam),`${L} 책장은 카메라 클로즈업 동안만`);
  ok(end1.left===0,`${L} 합 끝나면 책장 정리`,end1);
  geom(r1,"두 쪽 합");
  if(w===844||w===390){ // 스크린샷: 2합 결과
    await p.evaluate(()=>{ __run("two"); }); await p.waitForFunction(()=>{ const s=document.querySelectorAll(".bs-cc .bs-cc-roll[data-step='1'] .bs-cc-stamp"); return s.length===2; },null,{polling:"raf"});
    await p.waitForTimeout(140); await p.screenshot({path:`shots/clashcards-two-${w}.png`}); await p.waitForTimeout(1200);
  }
  // 2) 무승부
  await p.evaluate(()=>__run("tie")); const r2=await p.evaluate(()=>__rec);
  const t0=last(r2,"a",0), t1=last(r2,"b",0);
  ok(t0&&t1&&t0.stamp==="무승부"&&t1.stamp==="무승부"&&t0.cls.includes("tie")&&t0.side==="enemy"&&t1.side==="ally",`${L} 무승부`,[t0&&t0.stamp,t1&&t1.stamp]);
  // 3) 전투 원래 필드: 회피가 이기면 같은 칸 다시
  await p.evaluate(()=>__run("eng")); const r3=await p.evaluate(()=>__rec);
  const e0=last(r3,"b",0), e1=last(r3,"b",1), ea1=last(r3,"a",1);
  ok(e0&&e0.stamp==="회피"&&e0.sub==="피해 0 · 흐트러짐 +6"&&e0.act===0&&e0.actT==="evade",`${L} 회피 성공은 "회피 / 피해 0"`,e0&&[e0.stamp,e0.sub,e0.act]);
  ok(e1&&ea1&&e1.act===0&&ea1.act===1&&e1.stamp==="패"&&ea1.stamp==="승"&&e1.sub==="피해 5"&&e1.re&&!ea1.re&&ea1.val==="5"&&ea1.rng==="2~5",`${L} 이긴 회피는 같은 칸을 다시 씀`,e1&&ea1&&[e1.act,ea1.act,e1.stamp,ea1.stamp,e1.sub,ea1.rng]);
  // 4) aDie/bDie 필드 (방어가 깎았지만 짐)
  await p.evaluate(()=>__run("dief")); const r4=await p.evaluate(()=>__rec);
  const d0=last(r4,"b",0);
  ok(d0&&d0.act===1&&d0.type.includes("방어")&&d0.rng==="1~4"&&d0.stamp==="패"&&d0.sub==="피해 4 · 2 막음",`${L} aDie/bDie 칸·범위, 방어가 진 경우 줄어든 피해`,d0&&[d0.act,d0.rng,d0.stamp,d0.sub]);
  // 4b) 전투 새 필드
  await p.evaluate(()=>__run("nfe")); const r4b=await p.evaluate(()=>__rec);
  const n0=last(r4b,"b",0), na=last(r4b,"a",0);
  ok(n0&&na&&n0.stamp==="회피"&&n0.sub==="피해 0 · 흐트러짐 +3"&&n0.re&&n0.val==="5"&&n0.rng==="2~6"&&na.act===1&&na.val==="4"&&na.stamp==="패",`${L} 새 필드: 회피 + 흐트러짐 회복 + 재사용`,n0&&na&&[n0.stamp,n0.sub,n0.re,na.act,na.stamp]);
  await p.evaluate(()=>__run("nfb")); const r4c=await p.evaluate(()=>__rec);
  const m0=last(r4c,"b",0), ma=last(r4c,"a",0);
  ok(m0&&ma&&m0.stamp==="방어"&&m0.sub==="피해 3 · 3 막음"&&m0.act===1&&ma.stamp==="승"&&ma.val==="6",`${L} 새 필드: 방어로 줄인 피해`,m0&&ma&&[m0.stamp,m0.sub,ma.stamp]);
  // 5) 일방 공격: 공격하는 쪽 책장만
  await p.evaluate(()=>__run("one")); const r5=await p.evaluate(()=>__rec);
  const o0=last(r5,"a",0);
  ok(r5.length&&r5.every(f=>f.ps.length===1)&&o0&&o0.one&&o0.tag==="일방 공격"&&o0.side==="enemy"&&o0.val==="4"&&o0.sub==="피해 4"&&!o0.stamp,`${L} 일방 공격`,o0);
  geom(r5,"일방 공격");
  if(w===844||w===390){
    await p.evaluate(()=>{ __run("one"); }); await p.waitForFunction(()=>!!document.querySelector(".bs-cc .bs-cc-roll .bs-cc-sub"),null,{polling:"raf"});
    await p.waitForTimeout(140); await p.screenshot({path:`shots/clashcards-one-${w}.png`}); await p.waitForTimeout(1200);
  }
  // 6) fast: 책장 없이
  await p.evaluate(()=>__run("two",{fast:true})); ok((await p.evaluate(()=>__rec)).length===0&&await p.evaluate(()=>!document.querySelector(".bs-cc")),`${L} fast 면 책장 안 띄움`);
  // 7) 탭 빨리 감기 → 바로 사라짐
  const R=await p.evaluate(()=>{ const r=document.querySelector(".bs").getBoundingClientRect(); return {x:r.left+r.width*.5,y:r.top+30}; });
  await p.evaluate(()=>{ window.__pp=__run("two"); }); await p.waitForFunction(()=>!!document.querySelector(".bs-cc.on"),null,{polling:"raf"});
  await p.touchscreen.tap(R.x,R.y); await p.waitForTimeout(40);
  ok(await p.evaluate(()=>!document.querySelector(".bs-cc")),`${L} 탭하면 책장 바로 사라짐`); await p.evaluate(()=>__pp);
  // 8) 길게 누르기 → 사라지고 다음 합도 안 뜸
  await p.evaluate(()=>{ window.__pp=__run("two"); }); await p.waitForFunction(()=>!!document.querySelector(".bs-cc.on"),null,{polling:"raf"});
  await p.mouse.move(R.x,R.y); await p.mouse.down(); await p.waitForTimeout(520); await p.mouse.up(); await p.evaluate(()=>__pp);
  await p.evaluate(()=>__run("one")); ok(await p.evaluate(()=>!document.querySelector(".bs-cc")&&__rec.length===0),`${L} 길게 누르면 책장 없이 건너뜀`);
  await p.evaluate(()=>BattleStage.render(__studyGame.battleApi.mb.battle));
  // 9) 실제 합 진행: 전투가 만든 ev 로 책장 이름·값이 뜸
  await p.evaluate(()=>{ window.__rec=[]; window.__recOn=true; BattleStage.onSkip=null; });
  const go=await p.$("#btn-mb-go"); if(go) await go.click().catch(()=>{});
  await p.waitForTimeout(5000); const r9=await p.evaluate(()=>{ window.__recOn=false; return __rec; });
  const seen=r9.flatMap(f=>f.ps).filter(x=>x.val!=="");
  ok(seen.length>0&&seen.every(x=>x.name&&x.name!=="책장"&&/^\d+$/.test(x.val)),`${L} 실제 합: 책장 이름·값 표시`,seen.slice(0,2).map(x=>[x.name,x.val]));
  geom(r9,"실제 합");
  ok(!errs.length,`${L} 페이지 오류 없음`,errs);
  await p.close();
}
await b.close(); server.close();
console.log(fails?`${fails} FAIL`:"ALL PASS"); if(fails) process.exitCode=1;
