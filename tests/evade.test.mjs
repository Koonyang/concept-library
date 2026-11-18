import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage(); const errs=[];
p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if((m.type()==="error"&&!/moon-words\.js/.test((m.location()||{}).url||"")))errs.push(m.text());});
await p.goto("http://127.0.0.1:"+server.address().port+"/?multi=0"); /* 1:1 합(회피 재사용) 검사 */ await p.waitForFunction(()=>window.__studyGame);
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const run=(pd,gd,pst=0)=>p.evaluate(({pd,gd,pst})=>{const E=__studyGame.engine;const P=E.mkUnit(100,300),G=E.mkUnit(100,300);P.st=pst;G.st=pst; if(pst===0){P.st=P.stMax;G.st=G.stMax;}
  const d=a=>a.map(([type,v])=>({type,min:v,max:v}));
  const steps=E.resolveScene({P,G,pDice:pd?d(pd):null,gDice:gd?d(gd):null,correct:true,isKey:false,rng:()=>0.5,mods:{}});
  return {n:steps.length,out:steps.map(s=>s.outcome),pr:steps.map(s=>s.pd&&{roll:s.pd.roll,t:s.pd.type,re:s.pd.reused,keep:s.pd.keeps}),gr:steps.map(s=>s.gd&&{roll:s.gd.roll,t:s.gd.type,re:s.gd.reused,keep:s.gd.keeps}),P:{hp:P.hp,st:P.st},G:{hp:G.hp,st:G.st}};},{pd,gd,pst});
// 1. evade wins every clash and is reused vs all 3 opponent dice, recovering stagger each win
let r=await run([["회피",14]],[["참격",3],["참격",3],["참격",3]],5);
ok(r.n===3&&r.out.join()==="P,P,P"&&r.P.hp===100&&r.pr[0].keep&&!r.pr[0].re&&r.pr[1].re&&r.pr[2].re&&r.P.st>5,"player evade wins 3 clashes, reused (no consumption), recovers stagger each win",r);
const rec1=await p.evaluate(()=>0); 
// stagger recovered three times (each roll>3) -> capped at 30
ok(r.P.st===30||r.P.st>=5+3*3,"stagger recovered per win",r.P);
// 2. evade loses on 2nd clash -> consumed, remaining opp die hits one-sided
r=await run([["회피",14]],[["참격",3],["참격",30],["참격",3]]);
ok(r.n===3&&r.out.join()==="P,G,G"&&r.P.hp<100&&!r.pr[1].keep&&r.pr[2]===null&&r.pr[1].re,"evade loses -> consumed; third opp die resolves one-sided",r);
// 3. tie ends reuse
const probe=await run([["회피",14]],[["참격",3]]); const pr14=probe.pr[0].roll;
let gval=14; for(let v=5;v<40;v++){ const t=await run([["회피",14]],[["참격",v]]); if(t.gr[0].roll===pr14){ gval=v; break; } }
r=await run([["회피",14]],[["참격",3],["참격",gval],["참격",3]]);
ok(r.out.slice(0,2).join()==="P,tie"&&r.pr[2]===null&&r.n===3,"tie ends reuse (evade consumed), remaining die one-sided",r);
// 4. multi-die player page: evade then attack; opponent runs out -> attack goes one-sided
r=await run([["회피",14],["참격",6]],[["참격",3],["참격",3],["참격",3]]);
ok(r.n===4&&r.out.join()==="P,P,P,P"&&r.pr[3].t==="참격"&&r.gr[3]===null&&r.G.hp<100&&r.P.hp===100,"opp exhausted -> next player die hits one-sided; held evade ends silently",r);
// 5. guest evade reuse vs player multi attack
r=await run([["참격",14],["참격",14],["참격",14]],[["회피",30]]);
ok(r.n===3&&r.out.join()==="G,G,G"&&r.gr[0].keep&&r.gr[1].re&&r.gr[2].re&&r.G.hp===100,"guest evade also reused vs 3 attack dice, takes no damage",r);
// 6. defense consumed normally
r=await run([["방어",5]],[["참격",30],["참격",3]]);
ok(r.n===2&&r.out.join()==="G,G"&&!r.pr[0].keep&&r.pr[1]===null&&r.P.hp<100,"방어 is consumed (not reused): 2nd attack hits one-sided",r);
r=await run([["방어",14]],[["참격",3],["참격",3]]);
ok(r.out[0]==="P"&&!r.pr[0].keep,"방어 win is not kept either",{out:r.out,keep:r.pr[0].keep});
// 7. evade vs defense/evade: no reuse
r=await run([["회피",14],["참격",5]],[["방어",3],["참격",3]]);
ok(r.pr[0].keep===false&&r.n>=2,"evade vs defense does not trigger reuse",r);
// 8. attack vs attack unchanged
r=await run([["참격",14],["참격",14]],[["참격",3],["참격",30]]);
ok(r.n===2&&r.out.join()==="P,G","plain attack clashes unchanged (index paired)",r);
// 9. one-sided single die each way
r=await run([["참격",9]],null); ok(r.n===1&&r.G.hp<100,"player-only die hits",r);
r=await run(null,[["참격",9]]); ok(r.n===1&&r.P.hp<100,"guest-only die hits",r);
// 10. staggered player cannot use dice but guest dice still resolve
r=await run([["회피",14]],[["참격",3],["참격",3]]); 
// 11. UI cue: tag in DOM when reused
await p.evaluate(()=>{__studyGame.setScene("lobby");__studyGame.beginReception("beccaria");}); await p.waitForTimeout(1200);
const ui=await p.evaluate(()=>{const g=__studyGame,E=g.engine,rec=g.reception;
  rec.intent={name:"테스트",dice:[{type:"참격",min:3,max:3},{type:"참격",min:3,max:3},{type:"참격",min:3,max:3}],big:false};
  const pg={id:"evade-test",name:"회피 테스트",cost:0,emotion:0,dice:[{type:"회피",min:14,max:14}]}; E.PAGE_BY["evade-test"]=pg; rec.handIds=["evade-test",...rec.handIds.slice(1)]; return true;});
await p.evaluate(()=>{__studyGame.choosePage("evade-test");}); 
let tagSeen=false; for(let i=0;i<30;i++){ await p.waitForTimeout(150); const t=await p.evaluate(()=>{const {q}=__studyGame.currentQuestion?__studyGame.currentQuestion():{}; return !!document.querySelector(".reuse-tag");}); tagSeen||=t;
  await p.evaluate(()=>{const g=__studyGame,r=g.reception; if(r&&r.phase==="question"){const {q}=g.currentQuestion(); if(q.type==="short") g.answerShort(q.answer); else g.answer(q.correctIndex);} }); }
ok(tagSeen,"'재사용' tag appears in the clash UI when an evade die is reused");
console.log("errors",errs.length,errs.slice(0,3)); console.log("fails",fails);
await b.close(); server.close(); process.exit(fails||errs.length?1:0);
