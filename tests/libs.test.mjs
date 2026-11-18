import { chromium } from "playwright-core";
import { LIB_ROOT, launchBrowser } from "./lib/browser.mjs";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
const ROOT=LIB_ROOT;
const MIME={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".mp3":"audio/mpeg"};
const server=createServer((q,r)=>{const u=decodeURIComponent((q.url||"/").split("?")[0]);const a=normalize(join(ROOT,u==="/"?"/index.html":u));if(!a.startsWith(ROOT)||!existsSync(a)){r.writeHead(404);return r.end();}r.writeHead(200,{"content-type":MIME[extname(a)]||"application/octet-stream"});r.end(readFileSync(a));});
await new Promise(r=>server.listen(+(process.env.PORT||0),"127.0.0.1",r)); const URL="http://127.0.0.1:"+server.address().port+"/";
const b=await launchBrowser(chromium,{args:["--no-sandbox"]});
const p=await (await b.newContext({viewport:{width:844,height:390}})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
let fails=0; const ok=(c,n,o)=>{if(!c)fails++;console.log(c?"PASS":"FAIL",n,o===undefined?"":JSON.stringify(o));};
const boot=async()=>{ await p.goto(URL); await p.waitForFunction(()=>window.__studyGame&&window.__studyGame.libs); };
const setLS=async(obj)=>{ await p.evaluate(o=>{ const K=__studyGame.acq.SAVE_KEY; if(o===null) localStorage.removeItem(K); else localStorage.setItem(K,JSON.stringify(o)); },obj); };
await boot();

// 1) fresh save
await setLS(null); await boot();
const fresh=await p.evaluate(()=>{ const s=__studyGame.save, L=__studyGame.libs; return {party:s.party,kyu:{k:s.librarians.kyu.keyPage,d:s.librarians.kyu.deckId},eq:s.equippedKeyId,ad:s.activeDeckId,n:L.unlockedCount(s),next:L.nextAt(s),list:L.list(s),keyOf:L.keyOf(s,"kyu")?.id}; });
ok(JSON.stringify(fresh.party)==='["kyu"]',"fresh: party = [kyu]",fresh.party);
ok(fresh.kyu.k==="novice"&&fresh.kyu.d===fresh.ad&&fresh.eq==="novice","fresh: kyu wears novice and uses active deck",fresh);
ok(fresh.n===1&&fresh.next===5&&fresh.list.length===1&&fresh.list[0].slot===0&&fresh.keyOf==="novice","fresh: 1 librarian, next at 5",fresh);

// 2) migration from a libV:2 save without keyPage/deckId/party
const KEYS=["novice","reading-room","midnight"];
await setLS({libV:2,activeLibrarianId:"kyu",librarians:{kyu:{id:"kyu",name:"큐 양",gifts:{owned:[],equipped:{}},pity:{}}},
  unlockedKeyIds:KEYS,equippedKeyId:"midnight",decks:[{id:"deck-1",name:"제1 덱",pageIds:[]},{id:"deck-2",name:"제2 덱",pageIds:[]}],activeDeckId:"deck-2"});
await boot();
const mig=await p.evaluate(()=>{ const s=__studyGame.save; return {kyu:s.librarians.kyu,party:s.party,eq:s.equippedKeyId,ad:s.activeDeckId,ids:Object.keys(s.librarians),n:__studyGame.libs.unlockedCount(s)}; });
ok(mig.kyu.keyPage==="midnight"&&mig.kyu.deckId==="deck-2","migration: kyu.keyPage ← equippedKeyId, kyu.deckId ← activeDeckId",mig.kyu);
ok(mig.eq==="midnight"&&mig.ad==="deck-2","migration: old fields kept",{eq:mig.eq,ad:mig.ad});
ok(JSON.stringify(mig.party)==='["kyu"]'&&mig.n===1&&mig.ids.join()==="kyu","migration: party [kyu], only kyu exists",mig);
// very old save (pre-librarians)
await setLS({unlockedKeyIds:["novice","archivist"],equippedKeyId:"archivist",egoOwned:[],egoEquipped:{}});
await boot();
const old=await p.evaluate(()=>{ const s=__studyGame.save; return {k:s.librarians.kyu.keyPage,d:s.librarians.kyu.deckId,ad:s.activeDeckId,party:s.party}; });
ok(old.k==="archivist"&&old.d===old.ad&&old.party.join()==="kyu","migration: pre-librarian save also migrates",old);

// 3) unlock counts (computed from unlockedKeyIds.length)
const cnt=await p.evaluate(()=>{ const L=__studyGame.libs, f=n=>({unlockedKeyIds:Array.from({length:n},(_,i)=>"k"+i)}); return [0,1,4,5,9,10,12].map(n=>[n,L.unlockedCount(f(n)),L.nextAt(f(n))]); });
const exp={0:[1,5],1:[1,5],4:[1,5],5:[2,10],9:[2,10],10:[3,null],12:[3,null]};
ok(cnt.every(([n,c,x])=>c===exp[n][0]&&x===exp[n][1]),"unlock: 4→1, 5→2, 10→3 librarians; nextAt 5/10/null",cnt);

// 4) 5 key pages → lib2 appears; equip & swap
await setLS({libV:2,librarians:{kyu:{id:"kyu",name:"큐 양",gifts:{owned:[],equipped:{}},pity:{}}},unlockedKeyIds:["novice","reading-room","midnight","archivist","classical-robe"],equippedKeyId:"midnight"});
await boot();
const eq=await p.evaluate(()=>{ const s=__studyGame.save, L=__studyGame.libs, out={};
  out.n=L.unlockedCount(s); out.next=L.nextAt(s); out.lib2=s.librarians.lib2&&{k:s.librarians.lib2.keyPage,d:s.librarians.lib2.deckId}; out.list=L.list(s).map(x=>x.id);
  out.noKeyParty=L.setParty(s,["kyu","lib2"]);
  out.swapEmpty=L.equipKey(s,"lib2","midnight");
  out.e1=L.equipKey(s,"lib2","archivist"); out.after1={kyu:s.librarians.kyu.keyPage,lib2:s.librarians.lib2.keyPage};
  out.e2=L.equipKey(s,"lib2","midnight"); out.after2={kyu:s.librarians.kyu.keyPage,lib2:s.librarians.lib2.keyPage,eq:s.equippedKeyId,keyOfKyu:L.keyOf(s,"kyu")?.id,keyOfLib2:L.keyOf(s,"lib2")?.id};
  out.e3=L.equipKey(s,"kyu","midnight"); out.after3={kyu:s.librarians.kyu.keyPage,lib2:s.librarians.lib2.keyPage,eq:s.equippedKeyId};
  out.lockedKey=L.equipKey(s,"lib2","panopticon-coat"); out.lockedLib=L.equipKey(s,"lib3","novice"); out.unknown=L.equipKey(s,"lib2","nope");
  // old UI path: writes equippedKeyId directly → synced to kyu with swap
  s.equippedKeyId="archivist"; L.sync(s); out.legacy={kyu:s.librarians.kyu.keyPage,lib2:s.librarians.lib2.keyPage};
  return out; });
ok(eq.n===2&&eq.next===10&&eq.lib2&&eq.lib2.k===null&&eq.list.join()==="kyu,lib2","5 pages: lib2 unlocked with no key page",eq);
ok(!eq.noKeyParty.ok&&eq.noKeyParty.reason==="no-key","party rejects librarian without key page",eq.noKeyParty);
ok(!eq.swapEmpty.ok&&eq.swapEmpty.reason==="swap-empty"&&eq.after1.kyu==="midnight","swap that would leave kyu empty is refused",eq.swapEmpty);
ok(eq.e1.ok&&eq.after1.lib2==="archivist"&&eq.after1.kyu==="midnight","equip free page on lib2",eq.after1);
ok(eq.e2.ok&&eq.e2.swappedWith==="kyu"&&eq.after2.lib2==="midnight"&&eq.after2.kyu==="archivist"&&eq.after2.eq==="archivist","equip worn page → swap; legacy equippedKeyId follows kyu",eq.after2);
ok(eq.after2.keyOfKyu==="archivist"&&eq.after2.keyOfLib2==="midnight","keyOf per librarian",eq.after2);
ok(eq.e3.ok&&eq.after3.kyu==="midnight"&&eq.after3.lib2==="archivist"&&eq.after3.eq==="midnight","swap back from kyu side",eq.after3);
ok(!eq.lockedKey.ok&&eq.lockedKey.reason==="locked-key"&&!eq.unknown.ok&&!eq.lockedLib.ok&&eq.lockedLib.reason==="locked-librarian","locked key / unknown key / locked librarian refused",eq);
ok(eq.legacy.kyu==="archivist"&&eq.legacy.lib2==="midnight","old UI writing equippedKeyId still swaps (no duplicate wear)",eq.legacy);

// 5) party validation + persistence
const party=await p.evaluate(()=>{ const s=__studyGame.save, L=__studyGame.libs; return {
  empty:L.setParty(s,[]), notArr:L.setParty(s,"kyu"), dup:L.setParty(s,["kyu","kyu"]), tooMany:L.setParty(s,["kyu","lib2","lib3"]),
  locked:L.setParty(s,["lib3"]), good:L.setParty(s,["lib2","kyu"]), party:[...s.party], list:L.list(s).map(x=>[x.id,x.slot]) }; });
ok(!party.empty.ok&&!party.notArr.ok&&party.dup.reason==="duplicate"&&party.tooMany.reason==="too-many"&&party.locked.reason==="locked-librarian","party: empty/dup/too many/locked refused",party);
ok(party.good.ok&&party.party.join()==="lib2,kyu"&&JSON.stringify(party.list)==='[["kyu",1],["lib2",0]]',"party order = slot order",party);
await boot();
const re=await p.evaluate(()=>{ const s=__studyGame.save; return {party:s.party,kyu:s.librarians.kyu.keyPage,lib2:s.librarians.lib2.keyPage,eq:s.equippedKeyId}; });
ok(re.party.join()==="lib2,kyu"&&re.kyu==="archivist"&&re.lib2==="midnight"&&re.eq==="archivist","party and key pages survive reload",re);

// 6) corrupted: duplicate wear and party with locked ids get cleaned on load
await setLS({libV:2,librarians:{kyu:{id:"kyu",name:"큐 양",keyPage:"midnight",gifts:{owned:[],equipped:{}},pity:{}},lib2:{id:"lib2",name:"x",keyPage:"midnight",gifts:{owned:[],equipped:{}},pity:{}}},
  unlockedKeyIds:["novice","reading-room","midnight","archivist","classical-robe"],equippedKeyId:"midnight",party:["lib3","lib2","lib2","kyu","zzz"]});
await boot();
const cl=await p.evaluate(()=>{ const s=__studyGame.save; return {kyu:s.librarians.kyu.keyPage,lib2:s.librarians.lib2.keyPage,party:s.party}; });
ok(cl.kyu==="midnight"&&cl.lib2===null&&cl.party.join()==="kyu","load cleans duplicate wear, bad and keyless party ids",cl);

await setLS(null);
ok(errs.length===0,"no page errors",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
