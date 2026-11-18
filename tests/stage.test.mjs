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
  await p.screenshot({path:join(ROOT,`shots/stage-units-${w}.png`)});
}
await p.setViewportSize({width:844,height:390});
await p.route(/\.glb$/, r=>r.fulfill({status:404,body:""}));
const before=errs.length; await goStage();
const nf=await p.evaluate(setup3v3);
ok(nf.n===6&&nf.placeholder.every(x=>x===true)&&nf.cur.every(c=>c==="Idle"),"모델 로드 실패 → 자리표시 캐릭터로 계속",nf);
errs.splice(before); await p.unroute(/\.glb$/);
/* @@NEXT@@ */
ok(errs.filter(e=>!/Error creating WebGL context/.test(e)).length===0,"오류 없음 (nogl 페이지의 WebGL 생성 실패 로그는 의도)",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
