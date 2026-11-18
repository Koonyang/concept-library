/* 규칙 코어(js/core) 흐름: 빈 새 화면이 오류 없이 뜨고, Game API 로 접대 시작→정답→배치→개막→승리 정산→책 소각→덱→사서→달의 계시가 돈다 */
import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const BASE="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o).slice(0,700));};
const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await p.goto(BASE); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.battleApi);
await p.goto(BASE); await p.evaluate(()=>localStorage.clear()); await p.goto(BASE); await p.waitForFunction(()=>window.Game&&window.__studyGame);

const r=await p.evaluate(()=>{
  const G=Game, out={};
  out.data=[G.data.FLOORS.length,G.data.WEAK_POINTS.length,G.data.COMBAT_PAGES.length,G.data.KEY_PAGES.length,G.data.EGO_GIFTS.length];
  out.cover=G.data.bookCoverSrc(G.data.GUEST_BY.beccaria);
  let s=7; const rng=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  out.begin=G.battle.begin("pomodoro",{rng}).ok; out.phase0=G.battle.state.phase; out.q=!!G.battle.question();
  out.early=G.battle.resolve();            /* 문제를 안 풀면 개막 안 됨 */
  let scenes=0;
  while(!G.battle.outcome&&scenes<60){
    scenes++; G.battle.answer(true);
    const B=G.battle.state, en=B.units.filter(u=>u.side==="enemy"&&u.hp>0);
    for(const u of B.units.filter(u=>u.side==="ally"&&u.hp>0)) u.dice.forEach((d,i)=>{
      const c=G.battle.hand(u.id).find(c=>G.battle.usable(u.id,c).usable); if(!c||!en[0]) return;
      G.battle.assign(u.id,i,c,{unit:en[0].id,die:0});
    });
    G.battle.resolve();
  }
  out.outcome=G.battle.outcome; out.scenes=scenes;
  const st=G.battle.settle(); out.settle={won:st.won,bookGain:st.bookGain,books:st.books,total:st.total,correct:st.correct};
  out.settleTwice=G.battle.settle()===st;
  out.conq=G.save.conqueredIds.slice(); out.recall=G.save.recallStats.pomodoro;
  G.battle.leave(); out.left=G.battle.state===null;
  out.next=(G.battle.nextGuest("pomodoro")||{}).id;
  out.burn=G.books.burn("pomodoro",1); out.burnNone=G.books.burn("pomodoro",1);
  const pid=out.burn.cards[0]&&out.burn.cards[0].id; out.owned=G.deck.owned().includes(pid);
  const before=G.deck.active().pageIds.length; out.deckAdd=G.deck.toggle(pid).ok; out.deckLen=[before,G.deck.active().pageIds.length];
  out.party=G.libs.toggleParty(); out.libs=G.libs.list().length;
  G.moon.open(); const m=G.moon.start("reveal"); out.moonQ=m.qs.length;
  let k=0; while(G.moon.current()){ G.moon.answer(k++%2?G.moon.current().correctIndex:-1); }
  out.moonPhase=G.moon.state.phase; G.moon.skipReplay(); out.moonDone=G.moon.state.phase; out.moonSave=G.save.moon;
  return out;
});
ok(r.data.join()==="4,11,33,7,33","데이터 개수 (층 4·손님 11·책장 33·핵심 책장 7·기프트 33)",r.data);
ok(r.cover==="assets/books/book-7.webp","책 표지 경로 (guest.book)",r.cover);
ok(r.begin&&r.phase0==="question"&&r.q&&r.early===null,"접대 시작: 1막 문제 단계, 문제 전에는 개막 안 됨",r);
ok(r.outcome==="win"&&r.scenes>0,"정답만 내면 이긴다",{o:r.outcome,s:r.scenes});
ok(r.settle.won&&r.settle.bookGain===1&&r.settle.books===1&&r.settle.total===r.scenes&&r.settleTwice,"승리 정산: 첫 승리 책 1권, 정답 수 기록, 두 번 불러도 한 번만",r.settle);
ok(r.conq.includes("pomodoro")&&r.recall&&r.recall.wins===1&&r.left,"책이 된 손님·회상 기록 저장, 떠나면 전투 비움",{c:r.conq,rc:r.recall});
ok(r.next&&r.next!=="pomodoro","다음 손님",r.next);
ok(r.burn.ok&&r.burn.n===1&&r.burnNone.ok===false&&r.owned,"책 소각 → 책장 획득, 책이 없으면 소각 안 됨",r.burn);
ok(r.deckAdd&&r.deckLen[1]===r.deckLen[0]+1,"얻은 책장을 덱에 넣기",r.deckLen);
ok(r.party&&r.party.ok===false&&r.libs>=1,"사서 혼자면 명단에서 뺄 수 없음",r.party);
ok(r.moonQ===30&&r.moonPhase==="bridge"&&r.moonDone==="result"&&r.moonSave&&r.moonSave.used===false&&r.moonSave.reveal===15,"달의 계시: 30문제 → 재현시 다리 → 건너뛰기 → 오늘 기록",{q:r.moonQ,s:r.moonSave});
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
