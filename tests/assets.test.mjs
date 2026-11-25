/* 3D 에셋: vendor three.js·KayKit 캐릭터 5종(애니메이션 없음, 256 텍스처)·anims.glb(정해진 클립만) 크기와 로드 */
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
import { statSync, readdirSync } from "fs";
const DIR=join(ROOT,"assets/models/characters"), CHARS=["Knight","Barbarian","Mage","Rogue","Rogue_Hooded"];
const ANIMS=["Idle","Running_A","1H_Melee_Attack_Slice_Diagonal","1H_Melee_Attack_Stab","2H_Melee_Attack_Chop","Spellcast_Shoot","Block","Block_Hit","Dodge_Backward","Hit_A","Hit_B","Death_A","Cheer"];
const files=[...CHARS.map(c=>c+".glb"),"anims.glb"].map(f=>join(DIR,f));
const exist=files.map(f=>existsSync(f));
ok(exist.every(Boolean),"파일 6개 있음",exist);
if(exist.every(Boolean)){
  const glbJson=f=>{ const b=readFileSync(f); const l=b.readUInt32LE(12); return JSON.parse(b.subarray(20,20+l).toString()); };
  const sizes=Object.fromEntries(files.map(f=>[f.split("/").pop(),statSync(f).size]));
  ok(CHARS.every(c=>sizes[c+".glb"]<=450*1024),"캐릭터 파일 각 ≤ 450KB",sizes);
  ok(Object.values(sizes).reduce((a,b)=>a+b,0)<=3*1024*1024,"합계 ≤ 3MB",sizes);
  const ca=CHARS.map(c=>(glbJson(join(DIR,c+".glb")).animations||[]).length);
  ok(ca.every(n=>n===0),"캐릭터 파일에 애니메이션 없음",ca);
  const an=(glbJson(join(DIR,"anims.glb")).animations||[]).map(a=>a.name).sort();
  ok(JSON.stringify(an)===JSON.stringify(ANIMS.slice().sort()),"anims.glb 클립 = ANIMS",an);
}

/* 몬스터(적 모델 다양화): Quaternius 59 + KayKit 해골 4, 동작은 표준 이름으로 */
{
  const MD=join(ROOT,"assets/models/monsters"), Q=("slime_drop slime_green slime_horned slime_pink slime_spiky blob_alien blob_bird blob_ninja blob_orc blob_wizard blob_yeti jelly_flyer alien_big demon demon_blue imp goblin orc_brute ninja_brute yeti ghost ghost_skull skull_hopper mushroom_imp mushroom_king monarch fluffy_flyer pebble_flyer bat bee armored_bee crab frog dragon dragon_whelp wyvern skeleton skeleton_crew skeleton_grunt zombie zombie_grunt mech mech_heavy robot_flyer robot_large robot_walker robot_gunner cat deer fox husky pug shiba stag wolf raptor trex triceratops dino").split(" ");
  const SK=["Skeleton_Minion","Skeleton_Warrior","Skeleton_Mage","Skeleton_Rogue"], STD=["Idle","Run","Attack","Attack2","Hit","Death","Block","Dodge","Cheer"], NEED=["Idle"];
  const have=existsSync(MD)?readdirSync(MD).filter(f=>f.endsWith(".glb")).map(f=>f.slice(0,-4)).sort():[];
  ok(Q.length===59&&JSON.stringify(have)===JSON.stringify([...Q,...SK].sort()),"monsters/ 에 63개(wolf_cartoon 없음)",{n:have.length,missing:[...Q,...SK].filter(x=>!have.includes(x))});
  if(have.length){
    const J=f=>{ const b=readFileSync(f); const l=b.readUInt32LE(12); return {j:JSON.parse(b.subarray(20,20+l).toString()),b}; };
    const bad=[], big=[], tex=[], mo=[];
    for(const n of have){ const f=join(MD,n+".glb"), {j,b:buf}=J(f), an=(j.animations||[]).map(a=>a.name);
      if(statSync(f).size>300*1024) big.push([n,statSync(f).size]);
      if((j.extensionsRequired||[]).some(e=>/meshopt/i.test(e))) mo.push(n);
      if(SK.includes(n)){ if(an.length) bad.push([n,an]); }
      else if(!NEED.every(x=>an.includes(x))||an.some(x=>!STD.includes(x))) bad.push([n,an]);
      const binStart=20+buf.readUInt32LE(12)+8;
      for(const im of j.images||[]){ if(im.bufferView==null) continue; const bv=j.bufferViews[im.bufferView], o=binStart+(bv.byteOffset||0);
        if(buf.readUInt32BE(o)===0x89504e47){ const w=buf.readUInt32BE(o+16),h=buf.readUInt32BE(o+20); if(w>256||h>256) tex.push([n,w,h]); } }
    }
    ok(!bad.length,"몬스터 동작: 필수 Idle, 표준 이름만(해골은 동작 없음)",bad);
    ok(!big.length,"몬스터 파일 각 ≤ 300KB",big);
    ok(!tex.length,"몬스터 텍스처 ≤ 256px",tex);
    ok(!mo.length,"meshopt 압축 안 씀(브라우저에 decoder 없음)",mo);
  }
}
await p.goto(BASE);
await p.setContent(`<script type="importmap">{"imports":{"three":"./vendor/three/three.module.min.js","three/addons/":"./vendor/three/addons/"}}</script>
<script type="module">
import * as THREE from "three"; import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"; import * as SU from "three/addons/utils/SkeletonUtils.js";
const L=new GLTFLoader(), names=${JSON.stringify([...CHARS,"anims"])};
try{
  const g=await Promise.all(names.map(n=>L.loadAsync("assets/models/characters/"+n+".glb")));
  const knight=SU.clone(g[0].scene), clips=g[5].animations, mixer=new THREE.AnimationMixer(knight);
  let bone=null; knight.traverse(o=>{ if(!bone&&o.isBone&&/arm|upper/i.test(o.name)) bone=o; }); if(!bone) knight.traverse(o=>{ if(!bone&&o.isBone) bone=o; });
  const q0=bone.quaternion.clone(); mixer.clipAction(THREE.AnimationClip.findByName(clips,"Idle")).play(); mixer.update(0.5);
  window.__r={loaded:g.length, moved:!bone.quaternion.equals(q0), bone:bone.name};
}catch(e){ window.__r={err:String(e)}; }
</script>`);
const r=await p.waitForFunction(()=>window.__r,null,{timeout:20000}).then(h=>h.jsonValue()).catch(e=>({err:String(e)}));
ok(r.loaded===6,"브라우저에서 6개 로드",r);
ok(r.moved===true,"Knight 에 anims.glb Idle 이 붙어 뼈가 움직임",r);
ok(errs.length===0,"오류 없음",errs);
console.log("fails",fails); await b.close(); server.close(); process.exit(fails?1:0);
