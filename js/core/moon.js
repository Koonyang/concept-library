/* 개념의 서고 — 달의 계시 / 달의 재현시 (하루 1회 영단어 4지선다) — 규칙만, 화면 없음
 * 계시: 오늘 분량(MOON_PER_DAY) × MOON_SEC_PER_WORD 초. 단어→뜻 / 뜻→단어 섞어서.
 * 재현시: 계시에서 틀리거나 못 푼 단어만, 같은 단어당 시간. 건너뛰기 가능.
 * 끝나면 save.moon = {date, reveal, replay, used:false} (보너스 계산·used 처리는 battle.js 의 rollEgoGift)
 * 서고의 편린(2026-11-19): 오늘 끝까지 정답이 못 된 단어(재현시에서 틀림·못 품, 재현시를 건너뛰면 계시에서 틀린 것)는
 *   save.moonShards(단어 id 목록)에 쌓인다. 편린 단어는 계시·재현시에 안 나오고(오늘 묶음은 다음 단어로 채워 30개), 시간 제한 없이 목록으로 본다.
 *   골라서 [정화] = 보상 없는 재현시(startPurify). 거기서 맞힌 단어만 편린에서 빠져 다시 계시에 나올 수 있다.
 *
 * 시간은 화면이 잰다: round.limitMs 동안 진행하고, 시간이 다 되면 MoonCore.endRound() 를 부른다.
 * 흐름: start("reveal") → answer(i)… → endRound() → (phase "bridge" 면) start("replay") 또는 skipReplay() → phase "result"
 */
const MOON_PER_DAY=30;          // 하루 단어 수 — 여기 하나만 바꾸면 된다
const MOON_SEC_PER_WORD=2.5;    // 단어당 제한 시간(초)
const MOON_OK_MS=170, MOON_BAD_MS=650;  // (화면용 참고값) 정답/오답 표시 시간
const MOON_POS={v:"동사",n:"명사",adj:"형용사",adv:"부사",prep:"전치사",conj:"접속사",phr:"숙어"};
const MoonCore=(()=>{
  let nowFn=()=>new Date();
  const fmt=(()=>{ try{ return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}); }catch(e){ return null; } })();
  function today(){
    const d=nowFn();
    if(fmt){ const p={}; fmt.formatToParts(d).forEach(x=>p[x.type]=x.value); return `${p.year}-${p.month}-${p.day}`; }
    const k=new Date(d.getTime()+9*3600e3); return k.toISOString().slice(0,10);
  }
  /* 실제 단어(assets/data/moon-words.js → window.MOON_WORDS)가 있으면 그것, 없으면(404) 예시(moon-words.sample.js) */
  const isSample=()=>!(Array.isArray(window.MOON_WORDS)&&window.MOON_WORDS.length);
  /* 단어 형식은 {id, en, ko, pos}. 예전 {w, m}도 읽는다. 같은 객체를 그대로 써야 정답 위치(indexOf)가 맞으므로 제자리에 w/m만 채운다 */
  const wordsRaw=()=>isSample()?(Array.isArray(window.MOON_WORDS_SAMPLE)?window.MOON_WORDS_SAMPLE:[]):window.MOON_WORDS;
  const words=()=>wordsRaw().filter(x=>{ if(!x) return false; if(!x.w&&x.en) x.w=x.en; if(!x.m&&x.ko) x.m=x.ko; return !!(x.w&&x.m); });
  const doneToday=()=>!!(save.moon&&save.moon.date===today());
  const chunkCount=()=>Math.max(1,Math.ceil(words().length/MOON_PER_DAY));
  /* 단어 열쇠: id 가 있으면 id, 없으면(예시 단어) 영단어 */
  const keyOf=x=>x&&(x.id||x.w||x.en);
  const shardIds=()=>Array.isArray(save.moonShards)?save.moonShards:[];
  const isShard=x=>shardIds().includes(keyOf(x));
  function shards(){ const by=new Map(words().map(x=>[keyOf(x),x])); return shardIds().map(id=>by.get(id)).filter(Boolean); }
  function addShards(list){ const cur=new Set(shardIds()); for(const w of list||[]){ const k=keyOf(w); if(k) cur.add(k); } save.moonShards=[...cur]; }
  function todaysWords(){
    const all=words(); if(!all.length) return [];
    const ci=((save.moonChunk|0)%chunkCount()+chunkCount())%chunkCount();
    /* 오늘 묶음에서 편린 단어는 빼고, 그 뒤 단어들로(끝이면 처음부터) 채워 MOON_PER_DAY 개를 맞춘다 */
    const want=Math.min(MOON_PER_DAY,all.filter(x=>!isShard(x)).length), set=[];
    for(let k=0;k<all.length&&set.length<want;k++){ const x=all[(ci*MOON_PER_DAY+k)%all.length]; if(!isShard(x)&&!set.includes(x)) set.push(x); }
    return set;
  }
  function buildQ(word,dir){
    const all=words(), key=dir==="w2m"?"m":"w";
    const seen=new Set([word[key]]);
    const pickU=pool=>shuffle(pool).filter(x=>{ if(seen.has(x[key])) return false; seen.add(x[key]); return true; });
    let d=pickU(all.filter(x=>x!==word&&x.pos===word.pos)).slice(0,3);
    if(d.length<3) d=d.concat(pickU(all.filter(x=>x!==word&&x.pos!==word.pos)).slice(0,3-d.length));
    const opts=shuffle([word,...d]);
    return {word,dir,prompt:dir==="w2m"?word.w:word.m,options:opts.map(x=>x[key]),correctIndex:opts.indexOf(word)};
  }
  function buildRound(list){
    // 방향 반반 섞기 (각 문제마다 무작위 + 최소 한쪽씩 보장)
    const dirs=list.map((_,i)=>i%2?"w2m":"m2w"); const sd=shuffle(dirs);
    return shuffle(list).map((w,i)=>buildQ(w,sd[i]));
  }
  /* ---- 진행 상태 ---- phase: "intro" | "quiz" | "bridge" | "result" | "purified"(정화 끝) */
  let st=null;
  function open(){ st=doneToday()?{phase:"result",kind:"view"}:{phase:"intro"}; return st; }
  function start(kind){
    const prev=st||{};
    const list=kind==="replay"?(prev.wrongFromReveal||[]):todaysWords();
    st={kind,qs:buildRound(list),i:0,correct:0,wrong:[],right:[],limitMs:list.length*MOON_SEC_PER_WORD*1000,
        reveal:prev.reveal, revealTotal:prev.revealTotal, wrongFromReveal:prev.wrongFromReveal, phase:"quiz"};
    return st;
  }
  const current=()=>st&&st.phase==="quiz"?st.qs[st.i]||null:null;
  /* 답 하나. 돌려주는 값: {ok, correctIndex, done} — done 이면 라운드가 끝나 endRound() 까지 처리됨 */
  function answer(idx){
    const q=current(); if(!q) return null;
    const ok=idx===q.correctIndex;
    if(ok){ st.correct++; st.right.push(q.word); } else st.wrong.push(q.word);
    st.i++;
    const done=st.i>=st.qs.length; if(done) endRound();
    return {ok,correctIndex:q.correctIndex,done};
  }
  function endRound(){
    if(!st||st.phase!=="quiz") return st;
    // 시간 초과로 못 푼 단어는 틀린 것으로 (재현시에 다시 나온다)
    for(let j=st.i;j<st.qs.length;j++) st.wrong.push(st.qs[j].word);
    if(st.kind==="purify"){ finishPurify(); return st; }
    if(st.kind==="reveal"){
      st.reveal=st.correct; st.revealTotal=st.qs.length; st.wrongFromReveal=st.wrong.slice();
      if(st.wrong.length) st.phase="bridge"; else finish(0);
    } else finish(st.correct);
    return st;
  }
  function finish(replay){
    const total=st.revealTotal, wrongN=(st.wrongFromReveal||[]).length;
    /* 오늘 정답이 못 된 단어 → 서고의 편린. 재현시를 했으면 거기서 틀리거나 못 푼 것, 건너뛰었으면 계시에서 틀린 것 전부 */
    const lost=st.kind==="replay"?st.wrong.concat(st.qs.slice(st.i).map(q=>q.word)):(st.wrongFromReveal||[]);
    const before=shardIds().length; addShards(lost); st.newShards=shardIds().length-before;
    save.moon={date:today(),reveal:st.reveal|0,replay:replay|0,used:false};
    save.moonChunk=((save.moonChunk|0)+1)%chunkCount();
    save.moonLast={date:save.moon.date,total,replayTotal:wrongN,replayDone:st.kind==="replay"};
    persist();
    st.phase="result";
  }
  function skipReplay(){ if(!st||st.phase==="result") return st; if(st.kind==="purify"){ finishPurify(); return st; } finish(st.kind==="replay"?st.correct:0); return st; }
  /* [정화]: 고른 편린 단어로 보상 없는 재현시. save.moon(오늘 점수·보너스)은 건드리지 않는다 */
  function startPurify(ids){
    const want=new Set(ids||[]), list=shards().filter(x=>want.has(keyOf(x))); if(!list.length) return null;
    st={kind:"purify",qs:buildRound(list),i:0,correct:0,wrong:[],right:[],limitMs:list.length*MOON_SEC_PER_WORD*1000,phase:"quiz"};
    return st;
  }
  function finishPurify(){
    const out=new Set(st.right.map(keyOf)); save.moonShards=shardIds().filter(id=>!out.has(id));
    st.purified=st.right.slice(); st.kept=st.qs.map(q=>q.word).filter(w=>!out.has(keyOf(w))); persist(); st.phase="purified";
  }
  function close(){ st=null; }
  return {today,isSample,words,doneToday,todaysWords,buildQ,buildRound,open,start,current,answer,endRound,skipReplay,close,
    shards,keyOf,startPurify,
    get state(){ return st; }, setNow(fn){ nowFn=fn||(()=>new Date()); }};
})();
