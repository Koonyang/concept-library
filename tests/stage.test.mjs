/* 3D 무대(js/stage): 분위기·소품 setFloor, 그려짐, 모르는 소품, WebGL 없음 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox","--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o).slice(0,700));};
const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
const goStage=async(q="")=>{ await p.goto(BASE+"tests/stage.html"+q); await p.waitForFunction(()=>window.__stageMod,null,{timeout:15000}); };
/* ---------- Task 3: 무대·분위기·소품 ---------- */
await goStage();
const t3=await p.evaluate(async()=>{ const S=await __stageMod.createStage(document.getElementById("stage")); window.__S=S;
  S.setFloor(Game.data.floorStage("crime")); const a={ok:S.ok,mood:S.debug.mood,props:S.debug.props.slice()};
  await new Promise(r=>setTimeout(r,300));
  S.renderer.render(S.scene,S.camera); /* 그린 직후 같은 작업 안에서 읽어야 버퍼가 비어 있지 않다 */
  const c=document.getElementById("stage"), g=document.createElement("canvas"); g.width=c.width; g.height=c.height; const x=g.getContext("2d"); x.drawImage(c,0,0);
  const d=x.getImageData(0,0,g.width,g.height).data; let distinct=new Set(); for(let i=0;i<d.length;i+=4*97) distinct.add(d[i]<<16|d[i+1]<<8|d[i+2]);
  a.colors=distinct.size; a.frames=S.debug.frames;
  S.setFloor({mood:"moon",accent:"#7fc8e8",props:["없는소품","globe"]}); a.mood2=S.debug.mood; a.props2=S.debug.props.slice();
  return a; });
ok(t3.ok&&t3.mood==="lamp"&&JSON.stringify(t3.props)==='["scales","candles"]',"crime 층: 등불·저울·촛대",t3);
ok(t3.colors>20&&t3.frames>0,"캔버스에 무언가 그려짐",t3);
ok(t3.mood2==="moon"&&JSON.stringify(t3.props2)==='["globe"]',"모르는 소품은 건너뜀",t3);
await goStage("?nogl");
const ng=await p.evaluate(async()=>{ const S=await __stageMod.createStage(document.getElementById("stage")); const t=performance.now(); await S.play({}); S.setFloor(Game.data.floorStage("crime")); return {ok:S.ok,ms:performance.now()-t}; });
ok(ng.ok===false&&ng.ms<50,"WebGL 없으면 ok=false, play 즉시 끝",ng);
/* ---------- Task 4: 캐릭터 배치·동작 ---------- */
const setup3v3=`(async()=>{ const G=__studyGame, s=G.save;
  s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"]; G.libs.sync(s);
  G.libs.equipKey(s,"lib2","archivist"); G.libs.equipKey(s,"lib3","classical-robe"); window.__party=G.libs.setParty(s,["kyu","lib2","lib3"]); Game.battle.leave(); Game.battle.begin("beccaria");
  const S=await __stageMod.createStage(document.getElementById("stage")); window.__S=S; S.setFloor(Game.data.floorStage("crime"));
  await S.setUnits(Game.battle.state.units, Game.data.GUEST_BY.beccaria); await new Promise(r=>setTimeout(r,300));
  const U=Game.battle.state.units, c=document.getElementById("stage").getBoundingClientRect();
  return { n:U.length, allies:U.filter(u=>u.side==="ally").map(u=>S.figure(u.id).obj.position.x), enemies:U.filter(u=>u.side==="enemy").map(u=>({x:S.figure(u.id).obj.position.x,s:S.figure(u.id).obj.scale.x,leader:u.leader})),
    pts:U.map(u=>S.unitPoint(u.id)), w:c.width, h:c.height, cur:U.map(u=>S.figure(u.id).current), placeholder:U.map(u=>S.figure(u.id).placeholder) }; })()`;
for(const [w,h] of [[844,390],[390,844]]){
  await p.setViewportSize({width:w,height:h}); await goStage();
  const r=await p.evaluate(setup3v3);
  ok(r.n===6&&r.allies.every(x=>x<0)&&r.enemies.every(e=>e.x>0),`${w}×${h}: 3:3, 사서 왼쪽 적 오른쪽`,r);
  const ld=r.enemies.filter(e=>e.leader), fo=r.enemies.filter(e=>!e.leader);
  ok(ld.length&&fo.length&&Math.min(...ld.map(e=>e.s))>Math.max(...fo.map(e=>e.s)),`${w}×${h}: 우두머리가 더 큼`,r.enemies);
  ok(r.pts.every(q=>q&&q.x>=0&&q.x<=r.w&&q.y>=0&&q.y<=r.h),`${w}×${h}: 모든 유닛 머리 위 좌표가 화면 안`,r.pts);
  ok(r.cur.every(c=>c==="Idle")&&r.placeholder.every(x=>x===false),`${w}×${h}: 모두 Idle, 진짜 모델`,{cur:r.cur,ph:r.placeholder});
  /* 편 고리: 사서 청록(#8fd3c8 계열), 적 붉은색(#e88a7e 계열), 우두머리 고리는 더 크고 진함 */
  const rg=await p.evaluate(()=>Game.battle.state.units.map(u=>({side:u.side,leader:!!u.leader,...((__S.ring&&__S.ring(u.id))||{})})));
  const hue=c=>{const n=parseInt(c.slice(1),16),R=n>>16,G=n>>8&255,B=n&255;return {R,G,B};};
  ok(rg.every(q=>q.color&&q.visible)&&rg.filter(q=>q.side==="ally").every(q=>{const c=hue(q.color);return c.G>c.R+40&&c.B>c.R+40;})
    &&rg.filter(q=>q.side==="enemy").every(q=>{const c=hue(q.color);return c.R>c.G+60&&c.R>c.B+60;}),`${w}×${h}: 유닛마다 편 색 고리`,rg);
  const rl=rg.filter(q=>q.side==="enemy"&&q.leader), rf=rg.filter(q=>q.side==="enemy"&&!q.leader);
  ok(rl.length&&rf.length&&Math.min(...rl.map(q=>q.radius))>Math.max(...rf.map(q=>q.radius))&&Math.min(...rl.map(q=>q.opacity))>Math.max(...rf.map(q=>q.opacity)),`${w}×${h}: 우두머리 고리가 더 크고 진함`,rg);
  if(h>w){ const xs=r.pts.map(q=>q.x), ys=r.pts.map(q=>q.y);
    /* 머리 위 좌표 기준: 폭 75% 이상(몸까지 치면 80% 이상), 머리는 위쪽 20%~50%(발은 60% 위) — 아래 40%는 문제·손패 자리 */
    ok((Math.max(...xs)-Math.min(...xs))>=0.75*r.w&&ys.every(y=>y>=0.2*r.h&&y<=0.5*r.h),`${w}×${h}: 세로 화면 — 유닛이 폭 75% 이상, 머리가 위쪽 20%~50%`,{xspan:(Math.max(...xs)-Math.min(...xs))/r.w,ys:ys.map(y=>+(y/r.h).toFixed(3))}); }
  await p.screenshot({path:join(ROOT,`shots/stage-units-${w}.png`)});
}
await p.setViewportSize({width:844,height:390});
await p.route(/\.glb$/, r=>r.fulfill({status:404,body:""}));
const before=errs.length; await goStage();
const nf=await p.evaluate(setup3v3);
ok(nf.n===6&&nf.placeholder.every(x=>x===true)&&nf.cur.every(c=>c==="Idle"),"모델 로드 실패 → 자리표시 캐릭터로 계속",nf);
errs.splice(before); await p.unroute(/\.glb$/);
/* ---------- Task 5: 교환 연출 ---------- */
await goStage();
const t5=await p.evaluate(async()=>{
  const mk=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  Math.random=mk(9); const o={};
  Game.battle.leave(); Game.battle.begin("pomodoro",{rng:mk(21)});
  const S=await __stageMod.createStage(document.getElementById("stage")); S.setFloor(Game.data.floorStage("memory"));
  await S.setUnits(Game.battle.state.units, Game.data.GUEST_BY.pomodoro);
  const scene=()=>{ Game.battle.answer(true); const B=Game.battle.state, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
    for(const u of B.units.filter(u=>u.side==="ally")) u.dice.forEach((d,i)=>{ const c=Game.battle.hand(u.id).find(c=>Game.battle.usable(u.id,c).usable); if(c) Game.battle.assign(u.id,i,c,{unit:en[0].id,die:0}); });
    const R=Game.battle.stepBegin(), evs=[]; let ev; while((ev=Game.battle.stepNext(R))) evs.push(ev); Game.battle.stepEnd(R); return evs; };
  const evs=scene().filter(e=>e.kind!=="skip");
  const e0=evs[0]; let hits=0, t=performance.now();
  await S.play(e0,{onHit:()=>hits++}); o.ms=performance.now()-t; o.hits=hits; o.dmgSteps=e0.steps.filter(s=>s.dmg).length;
  t=performance.now(); await S.play(evs[1]||e0,{fast:true}); o.fastMs=performance.now()-t;
  t=performance.now(); const pr=S.play(e0); setTimeout(()=>S.finishNow(),100); await pr; o.skipMs=performance.now()-t;
  /* 적 하나를 체력 1로 → 쓰러짐·책 낙하, 이어지는 skip 교환엔 책이 더 안 떨어짐 */
  const X=__studyGame.battleApi.internals(), en=Game.battle.state.units.filter(u=>u.side==="enemy"&&u.hp>0);
  for(const e of en){ X[e.id].cu.hp=1; e.hp=1; }
  const evs2=scene(); o.kinds=evs2.map(e=>e.kind); o.dead=evs2.flatMap(e=>(e.result&&e.result.dead)||[]);
  const b0=S.debug.bookDrops; for(const e of evs2) await S.play(e,{fast:true,final:Game.battle.outcome==="win"&&e===evs2.filter(x=>x.kind!=="skip").at(-1)});
  o.books=S.debug.bookDrops-b0; o.deadEnemies=o.dead.filter(id=>id[0]==="e").length;
  o.deadRings=o.dead.map(id=>S.ring&&S.ring(id)&&S.ring(id).visible);
  /* 등급 연출 + 전용 연출 */
  const ssr={...e0,a:{...e0.a,card:"apex"}}; await S.play(ssr,{fast:true}); o.tier=S.debug.lastTier;
  let called=0; __stageMod.registerFx("apex",async ctx=>{ called++; await ctx.wait(50); }); await S.play(ssr); o.called=called;
  await S.play({kind:"skip"}); o.ok=true; return o; });
ok(t5.ms<=1600*1.2&&t5.hits===t5.dmgSteps,"일반 교환: 1.6초 안, 맞는 단계마다 onHit",t5);
ok(t5.fastMs<=350*1.5,"빨리 감기: 0.53초 안",t5);
ok(t5.skipMs<=320,"finishNow: 100ms 뒤 부르면 곧 끝남",t5);
ok(t5.deadEnemies>=1&&t5.books===t5.deadEnemies,"쓰러진 적마다 책 한 권(skip 교환에선 더 안 떨어짐)",t5);
ok(t5.deadRings.length>0&&t5.deadRings.every(v=>v===false),"쓰러진 유닛은 발밑 고리도 사라짐",t5.deadRings);
ok(t5.tier==="SSR","SSR 책장 → SSR 연출",t5);
ok(t5.called===1,"registerFx 로 등록한 전용 연출이 한 번 불림",t5);
/* ---------- 최종 검토 수정: 상태 맞추기·반복 누수 ---------- */
await goStage();
const fix=await p.evaluate(async()=>{ const o={};
  Game.battle.leave(); Game.battle.begin("beccaria");
  const S=await __stageMod.createStage(document.getElementById("stage")); S.setFloor(Game.data.floorStage("crime"));
  const g=Game.data.GUEST_BY.beccaria; await S.setUnits(Game.battle.state.units,g);
  /* 연출 없이 죽은 적을 무대에 맞춤 */
  const e=Game.battle.state.units.find(u=>u.side==="enemy"); const b0=S.debug.bookDrops; e.hp=0;
  S.syncUnits(Game.battle.state.units); await new Promise(r=>setTimeout(r,50));
  o.hidden=S.figure(e.id).obj.visible===false; o.books=S.debug.bookDrops-b0; S.syncUnits(Game.battle.state.units); o.books2=S.debug.bookDrops-b0;
  /* setUnits 반복: 자원·ticker 가 늘지 않음 */
  const count=()=>({g:S.renderer.info.memory.geometries,t:S.renderer.info.memory.textures,k:S.tickers.size});
  const run=async()=>{ Game.battle.leave(); Game.battle.begin("beccaria"); await S.setUnits(Game.battle.state.units,g); for(const u of Game.battle.state.units) S.setStaggered(u.id,true); await new Promise(r=>setTimeout(r,120)); };
  await run(); await run(); o.a=count(); for(let i=0;i<4;i++) await run(); o.b=count();
  Game.battle.leave(); return o; });
ok(fix.hidden&&fix.books===1&&fix.books2===1,"syncUnits: 연출 없이 죽은 적도 숨기고 책은 한 번만",fix);
ok(fix.b.k<=fix.a.k&&fix.b.g<=fix.a.g+2&&fix.b.t<=fix.a.t+2,"setUnits 반복해도 ticker·지오메트리·텍스처가 늘지 않음",fix);
/* ---------- 휴대폰이 3D 메모리를 회수했다가 돌려줌(컨텍스트 손실·복구) ---------- */
await goStage();
const cl=await p.evaluate(async()=>{ const S=await __stageMod.createStage(document.getElementById("stage")); S.setFloor(Game.data.floorStage("crime"));
  Game.battle.leave(); Game.battle.begin("pomodoro"); await S.setUnits(Game.battle.state.units,Game.data.GUEST_BY.pomodoro);
  const gl=S.renderer.getContext(), ext=gl.getExtension("WEBGL_lose_context"); if(!ext) return {skip:true};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  ext.loseContext(); await wait(300); const f1=S.debug.frames; await wait(300); const lostFrames=S.debug.frames-f1, lostFlag=S.debug.contextLost;
  ext.restoreContext(); await wait(600); const f2=S.debug.frames; await wait(300);
  S.renderer.render(S.scene,S.camera); const c=document.getElementById("stage"), g=document.createElement("canvas"); g.width=c.width; g.height=c.height; const x=g.getContext("2d"); x.drawImage(c,0,0);
  const d=x.getImageData(0,0,g.width,g.height).data; const set=new Set(); for(let i=0;i<d.length;i+=4*97) set.add(d[i]<<16|d[i+1]<<8|d[i+2]);
  return {lostFlag,lostFrames,resumed:S.debug.frames-f2,colors:set.size,after:S.debug.contextLost}; });
ok(cl.skip||(cl.lostFlag===true&&cl.lostFrames===0),"컨텍스트 손실 중엔 그리기 멈춤",cl);
ok(cl.skip||(cl.after===false&&cl.resumed>0&&cl.colors>20),"복구되면 다시 그려짐(검은 화면 아님)",cl);
/* ---------- 복장(장서복 look): 데이터 한 줄로 겉모습 바꾸기, 도서관 사서 한 명 ---------- */
const LOOK_RED=`{cloth:"#ff0000",hide:["Mage_Hat"],props:[{name:"orb",bone:"hand.r"}]}`;
const kyuFig=`(S=>{ const u=Game.battle.state.units.find(u=>u.side==="ally"&&u.libId==="kyu"); return u&&S.figure(u.id); })`;
const probe=`(F=>{ if(!F) return null; const o=F.obj, n=k=>o.getObjectByName(k), hs=n("handslot.r")||n("handslotr"), cape=n("Mage_Cape");
  const props=[]; o.traverse(x=>{ if(/^prop:/.test(x.name)) props.push(x.name+"@"+(x.parent&&x.parent.name)); });
  return { hat:n("Mage_Hat")?n("Mage_Hat").visible:null, wand:n("1H_Wand")?n("1H_Wand").visible:null, book:n("Spellbook_open")?n("Spellbook_open").visible:null,
    orbInHand:!!(hs&&hs.getObjectByName("prop:orb")), props, cape:cape&&cape.material?"#"+cape.material.color.getHexString():null, placeholder:F.placeholder, current:F.current }; })`;
await goStage();
const lk=await p.evaluate(async([LOOK,KF,PR])=>{ const o={}, KF_=eval(KF), PR_=eval(PR), K=Game.data.KEY_PAGES;
  o.kyuKey=(Game.libs.keyOf("kyu")||{}).id; o.isFirst=Game.libs.keyOf("kyu")===K[0]; o.hadLook="look" in K[0];
  const S=await __stageMod.createStage(document.getElementById("stage")); window.__S=S; S.setFloor(Game.data.floorStage("crime"));
  Game.battle.leave(); Game.battle.begin("beccaria"); const g=Game.data.GUEST_BY.beccaria;
  await S.setUnits(Game.battle.state.units,g); o.plain=PR_(KF_(S));
  K[0].look=eval("("+LOOK+")");
  await S.setUnits(Game.battle.state.units,g); o.red=PR_(KF_(S));
  /* 몸 바꾸기 + 부품 켜고 끄기 + 등 소품 */
  K[0].look={model:"Knight",show:["Round_Shield"],hide:["Knight_Helmet"],props:[{name:"lantern",bone:"back",scale:0.5},{name:"candles",bone:"head"},{name:"없는소품",bone:"hand.l"}]};
  await S.setUnits(Game.battle.state.units,g); { const F=KF_(S), n=k=>F.obj.getObjectByName(k), ch=n("chest");
    o.knight={body:!!n("Knight_Body"), shield:n("Round_Shield")&&n("Round_Shield").visible, helmet:n("Knight_Helmet")&&n("Knight_Helmet").visible,
      sword:n("1H_Sword")&&n("1H_Sword").visible, lanternOnChest:!!(ch&&ch.getObjectByName("prop:lantern")), candlesOnHead:!!(n("head")&&n("head").getObjectByName("prop:candles"))};
    /* 소품이 화면에서 자연스러운 크기: 등 소품 높이가 키(1.9)의 15%~50% */
    F.obj.updateMatrixWorld(true); const L=F.obj.getObjectByName("prop:lantern"); if(L){ const b=new S.three.Box3().setFromObject(L); o.knight.lanternH=+(b.max.y-b.min.y).toFixed(3); } }
  /* 도서관: 사서 한 명만 가운데 */
  K[0].look=eval("("+LOOK+")");
  await S.showLibrarian("kyu"); { const ids=[...S.figures.keys()], F=S.figure(ids[0]); const up=S.unitPoint(ids[0]), r=document.getElementById("stage").getBoundingClientRect();
    o.lib={n:ids.length, x:+F.obj.position.x.toFixed(2), ry:+F.obj.rotation.y.toFixed(2), px:+(up.x/r.width).toFixed(3), py:+(up.y/r.height).toFixed(3), ...PR_(F)}; }
  /* 장서복 바꾼 뒤 다시 부르면 반영 */
  delete K[0].look; await S.showLibrarian("kyu"); { const F=S.figure([...S.figures.keys()][0]); o.lib2=PR_(F); }
  K[0].look=eval("("+LOOK+")"); await S.showLibrarian("kyu");
  const cp=S.cheer(); { const F=S.figure([...S.figures.keys()][0]); o.cheerNow=F.current; } await cp; o.cheerAfter=S.figure([...S.figures.keys()][0]).current;
  /* 반복해도 자원·ticker 가 늘지 않음 */
  const count=()=>({g:S.renderer.info.memory.geometries,t:S.renderer.info.memory.textures,k:S.tickers.size});
  const run=async()=>{ await S.showLibrarian("kyu"); await new Promise(r=>setTimeout(r,60)); await S.setUnits(Game.battle.state.units,g); await new Promise(r=>setTimeout(r,60)); };
  await run(); await run(); o.a=count(); for(let i=0;i<4;i++) await run(); o.b=count();
  /* 빠르게 두 번 불러도 한 명 */
  S.showLibrarian("kyu"); await S.showLibrarian("kyu"); o.twice=S.figures.size;
  delete K[0].look; await S.setUnits(Game.battle.state.units,g); o.restored=PR_(KF_(S)); o.lookGone=!("look" in K[0]);
  Game.battle.leave(); return o; },[LOOK_RED,kyuFig,probe]);
ok(lk.kyuKey==="novice"&&lk.isFirst&&!lk.hadLook,"kyu 기본 장서복 = novice = KEY_PAGES[0], 원래 look 없음",lk);
ok(lk.plain&&lk.plain.hat===true&&lk.plain.wand===true&&lk.plain.book===true&&lk.plain.props.length===0,"look 없으면 기존 그대로(모자·지팡이·책, 소품 없음)",lk.plain);
ok(lk.red&&lk.red.hat===false&&lk.red.orbInHand&&lk.red.wand===true,"look.hide 로 모자 숨김, 오른손 뼈에 prop:orb",lk.red);
{ const c=lk.red&&lk.red.cape, n=c?parseInt(c.slice(1),16):0, R=n>>16, G=n>>8&255, B=n&255; ok(R>180&&G<90&&B<90,"look.cloth → 망토 색 빨강 계열",{cape:c,plain:lk.plain&&lk.plain.cape}); }
ok(lk.knight.body&&lk.knight.shield===true&&lk.knight.helmet===false&&lk.knight.sword===true&&lk.knight.lanternOnChest&&lk.knight.candlesOnHead,"look.model·show·hide·뼈(back→chest, head) 반영, 모르는 소품은 건너뜀",lk.knight);
ok(lk.knight.lanternH>=0.18&&lk.knight.lanternH<=0.95,"뼈에 붙인 소품 크기가 자연스러움(모델 보정 고려, 키 1.9의 10~50%)",lk.knight);
ok(lk.lib.n===1&&lk.lib.px>=0.15&&lk.lib.px<=0.30&&lk.lib.hat===false&&lk.lib.orbInHand&&lk.lib.current==="Idle"&&Math.abs(lk.lib.ry)>0.05&&Math.abs(lk.lib.ry)<0.8,"showLibrarian(844×390): 사서 한 명, 머리가 폭 15~30%(왼쪽 1/3), 정면 약간 비스듬히, Idle, 복장 반영",lk.lib);
ok(lk.lib2.hat===true&&!lk.lib2.orbInHand,"장서복(look) 바뀐 뒤 다시 부르면 반영",lk.lib2);
ok(lk.cheerNow==="Cheer"&&lk.cheerAfter==="Idle","cheer: Cheer 한 번 하고 Idle 로",lk);
ok(lk.b.k<=lk.a.k&&lk.b.g<=lk.a.g+2&&lk.b.t<=lk.a.t+2,"showLibrarian·setUnits 반복해도 ticker·지오메트리·텍스처가 늘지 않음",lk);
ok(lk.twice===1,"showLibrarian 을 겹쳐 불러도 사서는 한 명",lk);
ok(lk.restored.hat===true&&lk.restored.props.length===0&&lk.lookGone,"임시 look 되돌림 → 원래 모습",lk.restored);
await p.route(/\.glb$/, r=>r.fulfill({status:404,body:""}));
{ const before=errs.length; await goStage();
  const ph=await p.evaluate(async([LOOK,KF,PR])=>{ const K=Game.data.KEY_PAGES; K[0].look=eval("("+LOOK+")"); K[0].look.props.push({name:"lantern",bone:"back"},{name:"quill",bone:"head"},{name:"bookpile",bone:"hand.l"});
    const S=await __stageMod.createStage(document.getElementById("stage")); S.setFloor(Game.data.floorStage("crime"));
    Game.battle.leave(); Game.battle.begin("beccaria"); await S.setUnits(Game.battle.state.units,Game.data.GUEST_BY.beccaria); const a=eval(PR)(eval(KF)(S));
    await S.showLibrarian("kyu"); const F=S.figure([...S.figures.keys()][0]), b=eval(PR)(F); await S.cheer(); delete K[0].look; Game.battle.leave(); return {a,b,n:S.figures.size}; },[LOOK_RED,kyuFig,probe]);
  ok(ph.a.placeholder&&ph.b.placeholder&&ph.n===1&&ph.b.props.length>=1,"glb 404: 자리표시에서도 복장·showLibrarian·cheer 오류 없음",ph);
  { const e=errs.slice(before).filter(m=>!/Failed to load resource|404/.test(m)); ok(e.length===0,"glb 404 복장: 오류 없음(404 로드 실패 로그 빼고)",e); } errs.splice(before); }
await p.unroute(/\.glb$/);
/* 손 뼈(F.hand): 점이 지워진 이름(handslotl)도 찾음 → 책 없는 모델 사서(lib2 Knight·lib3 Rogue)는 왼손에 코드 책 */
await goStage();
const hd=await p.evaluate(async()=>{ const G=__studyGame, s=G.save;
  s.unlockedKeyIds=["novice","reading-room","midnight","archivist","classical-robe","panopticon-coat","truth-robe","pad8","pad9","pad10"]; G.libs.sync(s);
  G.libs.equipKey(s,"lib2","archivist"); G.libs.equipKey(s,"lib3","classical-robe"); G.libs.setParty(s,["kyu","lib2","lib3"]); Game.battle.leave(); Game.battle.begin("beccaria");
  const S=await __stageMod.createStage(document.getElementById("stage")); await S.setUnits(Game.battle.state.units,Game.data.GUEST_BY.beccaria);
  const r=Game.battle.state.units.filter(u=>u.side==="ally").map(u=>{ const F=S.figure(u.id), L=F.hand("l"), R=F.hand("r");
    return {lib:u.libId, l:!!L, r:!!R, lKids:L?L.children.filter(c=>c.visible&&!c.isBone).map(c=>c.name||c.type):[]}; });
  Game.battle.leave(); return r; });
ok(hd.length===3&&hd.every(h=>h.l&&h.r),"F.hand(l/r) 가 손 뼈를 돌려줌",hd);
ok(hd.filter(h=>h.lib!=="kyu").every(h=>h.lKids.includes("Group")),"lib2·lib3 왼손에 코드 책",hd);
ok(hd.find(h=>h.lib==="kyu").lKids.includes("Spellbook_open"),"kyu(Mage) 왼손은 모델 책 Spellbook_open",hd);
/* 세로 화면 도서관: 가로 가운데, 머리가 위쪽 25~45% */
await p.setViewportSize({width:390,height:844}); await goStage();
const lt=await p.evaluate(async()=>{ const S=await __stageMod.createStage(document.getElementById("stage")); S.setFloor(Game.data.floorStage("crime"));
  await S.showLibrarian("kyu"); const id=[...S.figures.keys()][0], up=S.unitPoint(id), r=document.getElementById("stage").getBoundingClientRect(), F=S.figure(id);
  const o=F.obj.position, v=o.clone().project(S.camera);
  return {px:+(up.x/r.width).toFixed(3), py:+(up.y/r.height).toFixed(3), feetY:+((1-v.y)/2).toFixed(3)}; });
ok(lt.px>=0.4&&lt.px<=0.6&&lt.py>=0.25&&lt.py<=0.45&&lt.feetY<=0.46,"showLibrarian(390×844): 가로 가운데, 머리가 위쪽 25~45%, 발이 아래 패널(54%) 위",lt);
await p.screenshot({path:join(ROOT,"shots/stage-library-390.png")});
await p.setViewportSize({width:844,height:390});
/* @@NEXT@@ */
ok(errs.filter(e=>!/Error creating WebGL context/.test(e)).length===0,"오류 없음 (nogl 페이지의 WebGL 생성 실패 로그는 의도)",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
