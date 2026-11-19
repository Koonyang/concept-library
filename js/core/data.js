/* 개념의 서고 — 데이터: 층·손님·문제·책장·핵심 책장·E.G.O 기프트·수치, 사서/기프트 계산 (화면 없음) */
/* stage: 3D 무대 겉모습 {mood:"lamp"|"moon", accent, props(js/stage/props.js PROP_KIT)}. 없으면 floorStage() 기본값 */
const FLOORS = [
  { id:"crime", name:"범죄학의 층", subject:"범죄학의 기초", motto:"처벌은 복수가 아니라 예방이라는 오래된 문장들.", stage:{ mood:"lamp", accent:"#d9a35a", props:["scales","candles"] } },
  { id:"memory", name:"기억의 층 · 예시", subject:"학습법 (예시)", motto:"잊힐 때까지 기다리는 책장.", stage:{ mood:"moon", accent:"#7fc8e8", props:["hourglass","bookpile"] } },
  { id:"cognition", name:"인지의 층 · 예시", subject:"학습법 (예시)", motto:"알고 있는지, 아직 모르는지를 보는 창.", stage:{ mood:"moon", accent:"#a99be0", props:["globe","clock"] } },
  { id:"criminal-law", name:"형법의 층", subject:"형법", motto:"진실과 공익이 함께 설 때, 적시한 말은 벌하지 않는다.", stage:{ mood:"lamp", accent:"#c4705a", props:["scales","scroll"] } }
];

const WEAK_POINTS = [
  {
    id:"beccaria", floorId:"crime", concept:"베카리아", subject:"범죄학의 기초", weakness:1, archetype:"scholar", palette:"bone", accessory:"quill", book:7,
    sourceNote:"범죄학의 기초 2강 · 범죄학의 탄생 (11/12)",
    explanation:"18세기 유럽에서는 판사의 재량과 신분에 따른 처벌, 고문 같은 잔혹한 형벌이 흔했고, 고전주의 학파는 이에 대한 반발로 나왔습니다. 체사레 베카리아는 1764년 『범죄와 형벌』에서 인간이 비용과 이익을 합리적으로 따진다고 보았고, 형벌의 목적은 복수가 아니라 예방이라며 고문과 사형에 반대했습니다.",
    questions:[
      { id:"beccaria-q0", type:"mc", prompt:"베카리아가 1764년에 펴낸 책의 제목은?", options:["『범죄와 형벌』","『감시와 처벌』","『국부론』","『사회계약론』"], correctIndex:0 },
      { id:"beccaria-q1", type:"mc", prompt:"18세기 유럽 형벌의 모습으로 알맞은 것은?", options:["판사의 재량과 신분에 따른 처벌, 고문 같은 잔혹한 형벌이 흔했다","모든 사람이 똑같은 법정형으로 처벌받았다","범죄와 형벌이 법률로 미리 엄격히 정해져 있었다","고문은 거의 쓰이지 않았다"], correctIndex:0 },
      { id:"beccaria-q2", type:"ox", prompt:"베카리아는 형벌의 목적이 복수가 아니라 예방이라고 보았다.", options:["O","X"], correctIndex:0 },
      { id:"beccaria-q3", type:"mc", prompt:"베카리아의 주장으로 알맞은 것은?", options:["고문과 사형에 반대했다","고문은 범죄 예방에 꼭 필요하다고 보았다","형벌은 신분에 따라 달리해야 한다고 보았다","형벌의 목적은 복수(응보)라고 보았다"], correctIndex:0 },
      { id:"beccaria-q4", type:"mc", prompt:"고전주의 학파가 인간을 바라본 관점으로 알맞은 것은?", options:["인간은 비용과 이익을 합리적으로 따져 행동한다","인간은 타고난 범죄 기질이 정해져 있다","인간은 신분에 따라 행동이 정해진다","인간은 충동만으로 움직인다"], correctIndex:0 }
    ],
    enemies:[
      { key:"beccaria-author", name:"계몽의 집필자", topic:"『범죄와 형벌』과 저자", leader:true, q:["beccaria-q0","beccaria-k1"] },
      { key:"beccaria-no-revenge", name:"복수를 거두는 자", topic:"형벌의 목적·고문 반대", q:["beccaria-q2","beccaria-q3","beccaria-k0"] },
      { key:"beccaria-rack-ghost", name:"고문대의 망령", topic:"18세기 형벌·합리적 인간", q:["beccaria-q1","beccaria-q4"] }
    ]
  },
  {
    id:"three-conditions", floorId:"crime", concept:"확실성·신속성·비례성", subject:"범죄학의 기초", weakness:2, archetype:"knight", palette:"steel", accessory:"watch", book:4,
    sourceNote:"범죄학의 기초 2강 · 고전주의 학파 (11/12)",
    explanation:"베카리아는 형벌의 엄격함(가혹함)보다 확실성(반드시 처벌받는다), 신속성(빠르게 처벌받는다), 비례성(범죄의 무게에 맞는 처벌)이 더 중요하다고 보았습니다. 단속 없이 과태료를 1억 원으로 정해도 위반은 계속되지만, 5만 원이라도 매번 단속하면 위반하지 않게 되는 것이 확실성과 신속성의 예입니다.",
    questions:[
      { id:"three-conditions-q0", type:"mc", prompt:"베카리아가 형벌에서 중요하다고 본 세 가지 조건은?", options:["확실성·신속성·비례성","엄격성·잔혹성·공개성","신분·재량·관습","확실성·엄격성·보복성"], correctIndex:0 },
      { id:"three-conditions-q1", type:"mc", prompt:"베카리아에 따르면 억제 효과에서 더 중요한 것은?", options:["확실성·신속성·비례성","형벌의 엄격함(가혹함)","판사의 재량","범죄자의 신분"], correctIndex:0 },
      { id:"three-conditions-q2", type:"ox", prompt:"형벌이 가혹하기만 하면 확실성·신속성·비례성이 없어도 억제 효과가 가장 크다.", options:["O","X"], correctIndex:1 },
      { id:"three-conditions-q3", type:"mc", prompt:"단속이 없는 상태에서 과태료를 1억 원으로 정해도 위반이 계속되는 사례가 보여 주는 것은?", options:["처벌받을 확실성이 없으면 무거운 처벌도 억제하지 못한다","과태료는 무거울수록 항상 효과적이다","신속성은 억제와 관계가 없다","비례성이 높아서 위반이 계속된다"], correctIndex:0 },
      { id:"three-conditions-q4", type:"mc", prompt:"5만 원이어도 매번 단속하면 위반하지 않게 되는 사례에 가장 가까운 조건은?", options:["확실성과 신속성","엄격성","신분에 따른 차등","판사의 재량"], correctIndex:0 }
    ],
    enemies:[
      { key:"tc-scale-knight", name:"세 겹 저울의 기사", topic:"확실성·신속성·비례성", leader:true, q:["three-conditions-q0","three-conditions-k1"] },
      { key:"tc-harshness", name:"가혹함의 허상", topic:"엄격함보다 확실성", q:["three-conditions-q1","three-conditions-q2","three-conditions-k0"] },
      { key:"tc-fine-collector", name:"단속 없는 징수원", topic:"과태료 사례", q:["three-conditions-q3","three-conditions-q4"] }
    ]
  },
  {
    id:"bentham", floorId:"crime", concept:"벤담의 쾌락 계산", subject:"범죄학의 기초", weakness:2, archetype:"mage", palette:"crimson", accessory:"cage", book:2,
    sourceNote:"범죄학의 기초 2강 · 고전주의 학파 (11/12)",
    explanation:"제러미 벤담은 공리주의자로, '최대 다수의 최대 행복'을 내세웠습니다. 형벌의 고통이 범죄의 쾌락을 조금만 넘으면 범죄를 막을 수 있다고 보았고, 이것이 쾌락 계산입니다. 파놉티콘은 벤담이 구상한 원형 감옥으로, 한 명의 감시자가 모든 수감자를 볼 수 있습니다.",
    questions:[
      { id:"bentham-q0", type:"mc", prompt:"제러미 벤담의 사상적 입장은?", options:["공리주의","실증주의","낭만주의","신비주의"], correctIndex:0 },
      { id:"bentham-q1", type:"mc", prompt:"'최대 다수의 최대 행복'을 내세운 사람은?", options:["벤담","베카리아","피니어스 게이지","판사"], correctIndex:0 },
      { id:"bentham-q2", type:"mc", prompt:"벤담의 쾌락 계산에서 형벌의 고통은 범죄의 쾌락보다 어느 정도면 되는가?", options:["조금만 넘으면 된다","훨씬 커야 한다","정확히 같아야 한다","고려할 필요가 없다"], correctIndex:0 },
      { id:"bentham-q3", type:"mc", prompt:"파놉티콘의 특징은?", options:["원형 감옥에서 한 명의 감시자가 모든 수감자를 볼 수 있다","수감자들이 서로를 감시하는 지하 독방이다","사형을 집행하는 시설이다","죄수를 신분별로 나누어 가두는 건물이다"], correctIndex:0 },
      { id:"bentham-q4", type:"ox", prompt:"파놉티콘은 벤담이 구상한 원형 감옥이다.", options:["O","X"], correctIndex:0 }
    ],
    enemies:[
      { key:"bentham-accountant", name:"쾌락 장부의 회계사", topic:"쾌락 계산", leader:true, q:["bentham-q2","bentham-k0"] },
      { key:"bentham-preacher", name:"최대 행복의 설교자", topic:"공리주의", q:["bentham-q0","bentham-q1"] },
      { key:"bentham-warden", name:"원형 감옥의 간수", topic:"파놉티콘", q:["bentham-q3","bentham-q4","bentham-k1"] }
    ]
  },
  {
    id:"legality", floorId:"crime", concept:"죄형법정주의", subject:"범죄학의 기초", weakness:1, archetype:"fixer", palette:"amber", accessory:"banner", book:8,
    sourceNote:"범죄학의 기초 2강 · 고전주의 학파 (11/12)",
    explanation:"죄형법정주의는 어떤 행위가 범죄인지, 그리고 어떤 형벌을 받는지가 미리 법률로 정해져 있어야 한다는 원칙으로, 베카리아와 연결됩니다.",
    questions:[
      { id:"legality-q0", type:"mc", prompt:"죄형법정주의의 내용으로 알맞은 것은?", options:["범죄와 형벌은 미리 법률로 정해져 있어야 한다","판사가 사건마다 형벌을 정한다","범죄가 일어난 뒤에 법을 만들어 처벌할 수 있다","신분에 따라 형벌이 달라진다"], correctIndex:0 },
      { id:"legality-q1", type:"ox", prompt:"죄형법정주의에서는 판사가 사건마다 재량으로 형벌을 정한다.", options:["O","X"], correctIndex:1 },
      { id:"legality-q2", type:"mc", prompt:"죄형법정주의와 연결되는 학자는?", options:["베카리아","벤담","피니어스 게이지","판사"], correctIndex:0 },
      { id:"legality-q3", type:"mc", prompt:"다음 중 죄형법정주의에 어긋나는 상황은?", options:["법에 정해지지 않은 행위를 판사가 나중에 범죄로 처벌한다","법에 정해진 범죄를 법에 정해진 형벌로 처벌한다","형벌을 법률로 미리 정해 둔다","법률에 정해진 대로 재판한다"], correctIndex:0 }
    ],
    enemies:[
      { key:"legality-gatekeeper", name:"조문의 문지기", topic:"죄형법정주의 원칙", leader:true, q:["legality-q0","legality-q2","legality-k1"] },
      { key:"legality-whim-judge", name:"재량에 취한 판관", topic:"원칙에 어긋나는 처벌", q:["legality-q1","legality-q3","legality-k0"] }
    ]
  },
  {
    id:"deterrence", floorId:"crime", concept:"한계 억제", subject:"범죄학의 기초", weakness:2, archetype:"scholar", palette:"rust", accessory:"chain", book:5,
    sourceNote:"범죄학의 기초 2강 · 고전주의 학파 (11/12)",
    explanation:"한계 억제는 범죄의 무게에 비례해 처벌해야 범죄자가 더 큰 범죄로 나아가지 않는다는 생각입니다(예: 폭행에서 살인으로). 억제 연구에서는 형벌을 엄하게 하는 것보다 잡힐 확률, 곧 확실성을 높이는 것이 일관되게 더 효과적이었습니다. 생활반응 같은 과학수사의 발달은 검거 가능성을 높여 억제에 기여할 수 있고, CSI 효과는 토론 주제입니다.",
    questions:[
      { id:"deterrence-q0", type:"mc", prompt:"한계 억제의 내용으로 알맞은 것은?", options:["범죄의 무게에 비례해 처벌해 더 큰 범죄로 나아가지 않게 한다","모든 범죄를 같은 형벌로 처벌한다","가벼운 범죄일수록 더 무겁게 처벌한다","형벌을 비밀로 한다"], correctIndex:0 },
      { id:"deterrence-q1", type:"mc", prompt:"한계 억제가 막으려는 상황의 예로 알맞은 것은?", options:["폭행을 저지른 사람이 살인으로 나아가는 것","신분에 따라 처벌이 달라지는 것","법이 없는데 처벌받는 것","감시자가 한 명뿐인 것"], correctIndex:0 },
      { id:"deterrence-q2", type:"mc", prompt:"억제 연구가 일관되게 보여 준 것은?", options:["잡힐 확률(확실성)을 높이는 것이 형벌을 엄하게 하는 것보다 효과적이다","형벌을 엄하게 하는 것이 가장 효과적이다","확실성과 엄격성의 효과는 같다","신속성만 효과가 있다"], correctIndex:0 },
      { id:"deterrence-q3", type:"mc", prompt:"생활반응 같은 과학수사의 발달이 억제에 기여하는 방식은?", options:["검거 가능성(확실성)을 높인다","형벌을 더 가혹하게 만든다","재판을 신분별로 나눈다","판사의 재량을 늘린다"], correctIndex:0 },
      { id:"deterrence-q4", type:"ox", prompt:"살인이든 폭행이든 같은 벌이라면 한계 억제가 잘 작동한다.", options:["O","X"], correctIndex:1 }
    ],
    enemies:[
      { key:"deterrence-brakeman", name:"한계의 제동수", topic:"한계 억제의 원리", leader:true, q:["deterrence-q0","deterrence-k1"] },
      { key:"deterrence-same-price", name:"같은 값의 유혹자", topic:"같은 벌의 함정", q:["deterrence-q1","deterrence-q4"] },
      { key:"deterrence-tracker", name:"확률의 추적자", topic:"적발 확률·과학수사", q:["deterrence-q2","deterrence-q3","deterrence-k0"] }
    ]
  },
  {
    id:"limits", floorId:"crime", concept:"고전주의의 한계", subject:"범죄학의 기초", weakness:3, archetype:"knight", palette:"violet", accessory:"mirror", book:3,
    sourceNote:"범죄학의 기초 2강 · 고전주의 학파 + 심화 (11/12)",
    explanation:"고전주의는 모든 사람이 똑같이 합리적이라고 가정해서 범죄성의 개인차를 설명하지 못하고, 이 한계가 다음 강의의 실증주의로 이어집니다. 심화로, 전전두엽이 손상되면(1848년 피니어스 게이지) 비용과 이익을 따지는 추론이 약해져 억제가 약해질 수 있습니다. 형법 제10조는 심신상실자는 벌하지 않고 심신미약자는 형을 감경할 수 있다고 정합니다.",
    questions:[
      { id:"limits-q0", type:"mc", prompt:"고전주의 학파의 한계로 알맞은 것은?", options:["모든 사람이 똑같이 합리적이라고 가정한다","형벌의 확실성을 무시한다","고문을 옹호한다","범죄를 신분으로만 설명한다"], correctIndex:0 },
      { id:"limits-q1", type:"mc", prompt:"고전주의가 잘 설명하지 못하는 것은?", options:["범죄성의 개인차","형벌의 목적","죄형법정주의의 뜻","검거 확률의 효과"], correctIndex:0 },
      { id:"limits-q2", type:"mc", prompt:"고전주의의 한계에서 이어지는 다음 강의의 주제는?", options:["실증주의","공리주의","파놉티콘","한계 억제"], correctIndex:0 },
      { id:"limits-q3", type:"mc", prompt:"전전두엽이 손상되면 억제가 약해질 수 있는 이유는?", options:["비용과 이익을 따지는 추론이 약해지기 때문","검거 확률이 높아지기 때문","형벌이 가혹해지기 때문","신분이 바뀌기 때문"], correctIndex:0 },
      { id:"limits-q4", type:"mc", prompt:"형법 제10조에서 심신상실 상태의 행위는?", options:["벌하지 않는다","반드시 사형에 처한다","형을 더 무겁게 한다","재판 없이 풀어 준다"], correctIndex:0 },
      { id:"limits-q5", type:"mc", prompt:"형법 제10조에서 심신미약 상태의 행위는?", options:["형을 감경할 수 있다","벌하지 않는다","반드시 형을 가중한다","심신상실과 똑같이 취급한다"], correctIndex:0 }
    ],
    enemies:[
      { key:"limits-shadow", name:"합리의 그림자", topic:"고전주의의 한계", leader:true, q:["limits-q0","limits-q1","limits-q2"] },
      { key:"limits-dim-lobe", name:"꺼진 이마의 등불", topic:"전전두엽과 억제", q:["limits-q3","limits-k1"] },
      { key:"limits-article-ten", name:"제10조의 감정인", topic:"심신상실·심신미약", q:["limits-q4","limits-q5","limits-k0"] }
    ]
  },
  {
    id:"pomodoro", floorId:"memory", concept:"포모도로 기법", subject:"학습법 (예시)", weakness:1, archetype:"fixer", palette:"teal", accessory:"hourglass", book:5,
    explanation:"포모도로는 25분 집중과 5분 휴식을 한 세트로 반복하며, 집중 중에는 다른 일을 끼워 넣지 않는 기법입니다. 목적은 무작정 긴 공부가 아니라, 집중과 휴식의 리듬을 만드는 것입니다.",
    questions:[
      { id:"pomodoro-q0", type:"mc", prompt:"포모도로 기법의 기본 집중 시간으로 가장 잘 쓰이는 것은?", options:["25분","10분","60분","5분"], correctIndex:0 },
      { id:"pomodoro-q1", type:"mc", prompt:"한 포모도로 세션이 끝나면 보통 좋은 짧은 휴식은?", options:["5분","30분","휴식 없이 바로 다음","2시간"], correctIndex:0 },
      { id:"pomodoro-q2", type:"ox", prompt:"포모도로 집중 시간 동안에는 다른 일을 끼워 넣는 것이 좋다.", options:["O","X"], correctIndex:1 },
      { id:"pomodoro-q3", type:"mc", prompt:"포모도로를 쓰는 가장 큰 목적은?", options:["집중과 휴식의 리듬을 만드는 것","하루 전체를 한 과목에만 쓰는 것","시험 범위를 줄이는 것","암기 횟수를 기록하는 것"], correctIndex:0 }
    ],
    enemies:[
      { key:"pomodoro-clockwork", name:"태엽 토마토", topic:"집중·휴식 시간", leader:true, q:["pomodoro-q0","pomodoro-q1","pomodoro-k1"] },
      { key:"pomodoro-intruder", name:"끼어드는 알림", topic:"몰입과 목적", q:["pomodoro-q2","pomodoro-q3","pomodoro-k0"] }
    ]
  },
  {
    id:"active-recall", floorId:"memory", concept:"능동적 회상", subject:"학습법 (예시)", weakness:2, archetype:"scholar", palette:"amber", accessory:"quill", book:1,
    explanation:"능동적 회상은 자료를 닫고 기억에서 꺼내 보는 연습입니다. 다시 읽기나 하이라이트만으로는 '알게 된 느낌'만 부풀리기 쉽습니다. 백지에 써 보거나 문제로 점검하는 쪽이 기억을 더 강하게 만듭니다.",
    questions:[
      { id:"active-recall-q0", type:"mc", prompt:"능동적 회상에 가장 가까운 설명은?", options:["책을 닫고 기억에서 꺼내 보기","중요한 문장에 밑줄만 긋기","교과서를 여러 번 다시 읽기","형광펜으로 색만 칠하기"], correctIndex:0 },
      { id:"active-recall-q1", type:"ox", prompt:"교과서를 여러 번 읽기만 하는 것이 능동적 회상이다.", options:["O","X"], correctIndex:1 },
      { id:"active-recall-q2", type:"mc", prompt:"다음 중 능동적 회상에 가장 가까운 활동은?", options:["백지에 기억나는 대로 써 보기","색연필로 필기를 꾸미기","강의를 다시 틀어만 보기","요약본을 그대로 베껴 쓰기"], correctIndex:0 },
      { id:"active-recall-q3", type:"mc", prompt:"능동적 회상이 효과적인 이유는?", options:["기억에서 꺼내는 연습이 기억을 강화하기 때문","글씨를 예쁘게 쓰게 되기 때문","공부 시간이 길어지기 때문","같은 문장을 반복 필사하기 때문"], correctIndex:0 }
    ],
    enemies:[
      { key:"recall-echo", name:"덮인 책의 메아리", topic:"능동적 회상의 원리", leader:true, q:["active-recall-q0","active-recall-q3","active-recall-k1"] },
      { key:"recall-reread", name:"되풀이 읽기의 환영", topic:"회상과 재독 구별", q:["active-recall-q1","active-recall-q2","active-recall-k0"] }
    ]
  },
  {
    id:"spaced-repetition", floorId:"memory", concept:"간격 반복", subject:"학습법 (예시)", weakness:2, archetype:"puppet", palette:"rust", accessory:"gear", book:3,
    explanation:"간격 반복은 한 번에 몰아서 외우는 대신, 시간을 두고 다시 복습하는 방법입니다. 기억이 약간 희미해질 때 다시 꺼내 보면 학습 효과가 커집니다. 예: 1일 후, 3일 후, 1주일 후.",
    questions:[
      { id:"spaced-repetition-q0", type:"mc", prompt:"간격 반복의 핵심은?", options:["시간을 두고 다시 복습하기","하루 만에 몰아서 외우기","처음만 열심히 보고 끝내기","매일 새 내용만 공부하기"], correctIndex:0 },
      { id:"spaced-repetition-q1", type:"ox", prompt:"한 번에 몰아서 외운 뒤, 다시 보지 않아도 오래 기억된다.", options:["O","X"], correctIndex:1 },
      { id:"spaced-repetition-q2", type:"mc", prompt:"기억이 약간 희미해질 때쯤 다시 보는 이유는?", options:["조금 어려울 때 인출하는 쪽이 학습 효과가 커서","완전히 잊은 뒤에 보는 것이 항상 최고여서","같은 날 10번 반복하는 것이 가장 좋아서","복습은 적을수록 좋아서"], correctIndex:0 },
      { id:"spaced-repetition-q3", type:"mc", prompt:"간격 반복에 가장 가까운 계획은?", options:["1일 후, 3일 후, 1주일 후 다시 보기","오늘 밤 10번 반복하고 끝내기","시험 전날에만 모아서 보기","매주 새 단원만 공부하기"], correctIndex:0 }
    ],
    enemies:[
      { key:"spaced-sentinel", name:"망각 곡선의 파수꾼", topic:"간격 반복의 원리", leader:true, q:["spaced-repetition-q0","spaced-repetition-q2","spaced-repetition-k1"] },
      { key:"spaced-cram-night", name:"벼락치기의 밤", topic:"복습 간격 계획", q:["spaced-repetition-q1","spaced-repetition-q3","spaced-repetition-k0"] }
    ]
  },
  {
    id:"metacognition", floorId:"cognition", concept:"메타인지", subject:"학습법 (예시)", weakness:3, archetype:"mage", palette:"violet", accessory:"orb", book:2,
    explanation:"메타인지는 '내가 이것을 얼마나 이해하는지'를 알아차리는 능력입니다. 대충 읽었는데도 이미 안다고 느끼면 약점을 놓칩니다. 설명해 보거나 문제로 점검하고, 아직 모르는 것을 적어 두면 다음 공부를 잡기 쉬워집니다.",
    questions:[
      { id:"metacognition-q0", type:"mc", prompt:"메타인지를 가장 잘 설명한 말은?", options:["자신의 이해 상태를 알아차리는 것","암기가 빨라지는 속도","글씨를 예쁘게 쓰는 실력","수업 출석률"], correctIndex:0 },
      { id:"metacognition-q1", type:"ox", prompt:"대충 읽었는데도 '나는 이미 안다'고 느끼는 것은 메타인지가 정확한 상태다.", options:["O","X"], correctIndex:1 },
      { id:"metacognition-q2", type:"mc", prompt:"메타인지를 높이는 방법으로 가장 적절한 것은?", options:["내 말로 설명해 보거나 문제로 점검하기","같은 문장만 반복 필사하기","형광펜 색을 더 늘리기","강의 배속만 높이기"], correctIndex:0 },
      { id:"metacognition-q3", type:"mc", prompt:"공부 후 '아직 무엇을 모르는지' 적는 습관의 효과는?", options:["약점이 드러나 다음 공부를 잡기 쉬워서","시간만 버리는 일이라서","이미 아는 것만 적게 되도록 하려고","성적과는 관계가 없어서"], correctIndex:0 }
    ],
    enemies:[
      { key:"meta-mirror", name:"자기 점검의 거울", topic:"메타인지의 뜻", leader:true, q:["metacognition-q0","metacognition-q1","metacognition-k1"] },
      { key:"meta-scribe", name:"모름을 적는 서기", topic:"메타인지 높이기", q:["metacognition-q2","metacognition-q3","metacognition-k0"] }
    ]
  },
  {
    id:"defamation-truth", floorId:"criminal-law", concept:"명예훼손과 제310조", subject:"형법", weakness:2, archetype:"puppet", palette:"verdant", accessory:"lantern", book:6,
    sourceNote:"형법 · 명예에 관한 죄 (11/18)",
    explanation:"명예훼손죄(형법 제307조 제1항)의 '사실'은 진실한 사실만 뜻하지 않습니다. 허위라도 행위자가 진실이라고 알고 적시했다면 사실 적시 명예훼손으로 보고, 허위라는 인식은 엄격한 증명의 대상입니다. 판례는 '동성애자'라는 허위 적시와 기소유예·단순 징계 같은 아주 가벼운 처벌 전력 적시는 명예훼손으로 보았지만(O), '돌싱'(과거 혼인 전력) 적시는 명예훼손으로 보지 않았습니다(X). 제310조에 따라 진실성과 공익성이 있으면 위법성이 조각되는데, 입증 책임은 피고인에게 있고 자유로운 증명으로 족합니다(★). 이 조항은 군형법 제64조 제3항(상관 명예훼손)에도 유추적용됩니다(★). 진실이라는 증명이 없어도 진실이라고 믿은 데 상당한 이유가 있으면 위법성이 없고(책임 조각이 아님), 중요한 부분이 사실이면 세부에 약간의 오류가 있어도 허위로 보지 않습니다. 공공의 이익에는 사회 전반뿐 아니라 특정 사회집단의 이익도 들어갑니다.",
    questions:[
      { id:"defamation-truth-q0", type:"ox", prompt:"명예훼손죄(형법 제307조 제1항)에서 말하는 '사실'은 진실한 사실만을 뜻한다.", options:["O","X"], correctIndex:1 },
      { id:"defamation-truth-q1", type:"mc", prompt:"허위 사실을 적시했지만 행위자는 그것이 진실이라고 알고 있었다. 어떻게 보는가?", options:["허위 사실 적시 명예훼손(제307조 제2항)","사실 적시 명예훼손(제307조 제1항)","고의가 없으므로 언제나 무죄","모욕죄"], correctIndex:1 },
      { id:"defamation-truth-q2", type:"mc", prompt:"적시한 사실이 허위이고 행위자가 그 허위를 알았다는 점은 어떻게 증명해야 하는가?", options:["자유로운 증명으로 족하다","엄격한 증명이 필요하다","피고인의 소명으로 족하다","증명할 필요가 없다"], correctIndex:1 },
      { id:"defamation-truth-q3", type:"ox", prompt:"판례: 사실이 아닌데 다른 사람을 '동성애자'라고 적시하면 명예훼손이 성립한다.", options:["O","X"], correctIndex:0 },
      { id:"defamation-truth-q4", type:"mc", prompt:"판례: 확정된 형이 아닌 기소유예·단순 징계 처분처럼 아주 가벼운 처벌 전력을 적시했다면?", options:["확정된 사실이 아니므로 명예훼손이 아니다","명예훼손이 성립한다","형이 확정된 경우에만 성립한다","가벼운 전력이므로 언제나 무죄다"], correctIndex:1 },
      { id:"defamation-truth-q5", type:"ox", prompt:"판례: 어떤 사람을 '돌싱'(과거 혼인 전력이 있음)이라고 적시한 것만으로 명예훼손이 성립한다.", options:["O","X"], correctIndex:1 },
      { id:"defamation-truth-q6", type:"mc", prompt:"형법 제310조에 따라 위법성이 조각되려면 갖춰야 하는 것은?", options:["진실성과 공익성","진실성과 공연성","공익성과 피해자의 승낙","허위성과 공익성"], correctIndex:0 },
      { id:"defamation-truth-q7", type:"mc", prompt:"제310조의 진실성·공익성은 누가 입증해야 하는가?", options:["검사","피해자","피고인","법원"], correctIndex:2 },
      { id:"defamation-truth-q8", type:"ox", prompt:"형법 제310조는 군형법 제64조 제3항(상관 명예훼손)에도 유추적용된다.", options:["O","X"], correctIndex:0 },
      { id:"defamation-truth-q9", type:"mc", prompt:"진실이라는 증명은 없지만 진실이라고 믿은 데 상당한 이유가 있었다. 판례의 결론은?", options:["책임이 조각된다","형을 감경할 뿐 처벌한다","위법성이 없다(위법성 조각)","구성요건에 해당하지 않는다"], correctIndex:2 },
      { id:"defamation-truth-q10", type:"ox", prompt:"적시한 사실의 중요한 부분이 사실과 맞으면, 세부에 약간의 거짓이나 오류가 있어도 허위로 보지 않는다.", options:["O","X"], correctIndex:0 },
      { id:"defamation-truth-q11", type:"ox", prompt:"제310조의 '공공의 이익'에는 사회 전반의 이익만 해당하고, 특정 사회집단의 이익은 해당하지 않는다.", options:["O","X"], correctIndex:1 }
    ],
    enemies:[
      { key:"defamation-advocate", name:"제310조의 변론인", topic:"310조 입증·증명", leader:true, q:["defamation-truth-q6","defamation-truth-q7","defamation-truth-q8","defamation-truth-k0","defamation-truth-k1"] },
      { key:"defamation-rumormonger", name:"허위의 소문꾼", topic:"허위 인식·사실 적시 판례", q:["defamation-truth-q0","defamation-truth-q1","defamation-truth-q2","defamation-truth-q3","defamation-truth-q4","defamation-truth-q5","defamation-truth-q10"] },
      { key:"defamation-accuser", name:"공익을 내건 고발자", topic:"상당한 이유·공익 범주", q:["defamation-truth-q9","defamation-truth-q11"] }
    ]
  }
];

/* 예시: 에고 기프트 수치와 드롭 규칙은 이 상수만 바꿔 조정한다. 개별 기프트는 매우 약하고, 회상으로 쌓이면 의미가 생긴다. */
const EGO_GIFT_RULES = {
  dropRateFirstClear: 0.5,
  dropRateRecall: 0.3,
  pityEvery: 10,                // 몬테카를로 20만 회: 한 손님의 기프트 3종을 모두 모으는 데 평균 약 10.2회(중앙값 9, 90%≤17회)
  newWeight: 3,                 // 미보유 기프트가 보유 기프트보다 3배 잘 나온다
  moonBonusMax: 0.4,            // 달의 계시 점수비만큼 드롭률에 더함
  moonFirstCap: 0.9,            // 첫 접대 보정 상한
  moonRecallCap: 0.7,           // 회상 보정 상한
  /* 몸의 부위. 기프트는 정확히 한 부위에 속하고, 부위당 하나만 착용한다. */
  slots: ["머리","눈","얼굴","목","가슴","손","등","발"],
  /* 기프트 하나는 아주 작다. 장서복 하나(시작 빛 +1 등)보다 한참 약하게. */
  unit: { hp:1, staggerPct:0.01, dmgPct:0.01 },
  /* 한 손님의 기프트 3종을 모두 착용하면 세트 보너스 (보유가 아니라 착용 기준) */
  setBonus: { hp:2, staggerPct:0.01 }
};
const EGO_GIFTS = [
  { id:"sand-heart", guestId:"pomodoro", name:"모래시계의 심장", slot:"손", art:"hourglass",
    text:"시간의 결을 쥐지만, 겨우 숨 한 줌이다.", perk:{ hp:2 } },
  { id:"cycle-crest", guestId:"pomodoro", name:"적색 주기의 문장", slot:"가슴", art:"crest",
    text:"리듬이 가슴에 붙는다. 아주 얕게.", perk:{ staggerPct:1 } },
  { id:"short-rest-charm", guestId:"pomodoro", name:"짧은 휴식의 부적", slot:"목", art:"charm",
    text:"5분의 온기가 목덜미에 남는다.", perk:{ hp:1 } },
  { id:"blank-afterimage", guestId:"active-recall", name:"백지의 잔상", slot:"손", art:"page",
    text:"빈 페이지가 손끝을 스친다.", perk:{ dmgPct:1 } },
  { id:"recall-lens", guestId:"active-recall", name:"회상의 렌즈", slot:"눈", art:"lens",
    text:"꺼낸 기억이 조금 더 또렷하다.", perk:{ staggerPct:1 } },
  { id:"underlined-mark", guestId:"active-recall", name:"밑줄의 홍조", slot:"얼굴", art:"mark",
    text:"중요한 문장이 볼에 스며 있다.", perk:{ dmgPct:1 } },
  { id:"interval-gear", guestId:"spaced-repetition", name:"간격의 톱니", slot:"등", art:"gear",
    text:"되돌아올 때가 희미하게 빛난다.", perk:{ staggerPct:1 } },
  { id:"fading-ribbon", guestId:"spaced-repetition", name:"희미한 리본", slot:"머리", art:"ribbon",
    text:"잊히기 직전을 한번 붙잡는다.", perk:{ hp:1 } },
  { id:"review-clasp", guestId:"spaced-repetition", name:"복습의 걸쇠", slot:"가슴", art:"clasp",
    text:"다시 펼 때의 손맛이 남는다.", perk:{ dmgPct:1 } },
  { id:"seer-orb", guestId:"metacognition", name:"알아차림의 구슬", slot:"손", art:"orb",
    text:"자신이 조금 더 보인다.", perk:{ staggerPct:1 } },
  { id:"unknown-sigil", guestId:"metacognition", name:"아직 모름의 인", slot:"얼굴", art:"sigil",
    text:"모르는 것을 입가에 적어두었다.", perk:{ hp:1 } },
  { id:"blind-spot-pin", guestId:"metacognition", name:"사각의 핀", slot:"발", art:"pin",
    text:"놓친 부분을 발끝에 새긴다.", perk:{ dmgPct:1 } },
  { id:"becc-bookmark", guestId:"beccaria", name:"『범죄와 형벌』의 책갈피", slot:"가슴", art:"bookmark",
    text:"1764년, 복수가 아닌 예방을 적은 쪽에 꽂혀 있다.", perk:{ dmgPct:1 } },
  { id:"becc-eye", guestId:"beccaria", name:"반(反)고문의 눈", slot:"눈", art:"eye",
    text:"고문과 사형에 반대하는 맑은 시선.", perk:{ hp:1 } },
  { id:"becc-knot", guestId:"beccaria", name:"합리의 매듭", slot:"목", art:"knot",
    text:"인간은 비용과 이익을 따진다는 생각이 매듭 지어져 있다.", perk:{ staggerPct:1 } },
  { id:"cert-stamp", guestId:"three-conditions", name:"확실의 인장", slot:"손", art:"stamp",
    text:"반드시 처벌받는다는 확신이 찍힌다.", perk:{ dmgPct:1 } },
  { id:"swift-wing", guestId:"three-conditions", name:"신속의 날개", slot:"발", art:"wing",
    text:"빠르게 닿는 처벌의 가벼운 걸음.", perk:{ staggerPct:1 } },
  { id:"prop-crown", guestId:"three-conditions", name:"비례의 저울관", slot:"머리", art:"scale",
    text:"범죄의 무게에 맞는 처벌만을 올려 둔다.", perk:{ hp:1 } },
  { id:"hedon-abacus", guestId:"bentham", name:"쾌락 계산판", slot:"손", art:"abacus",
    text:"형벌의 고통이 범죄의 쾌락을 조금만 넘으면 된다.", perk:{ staggerPct:1 } },
  { id:"greatest-badge", guestId:"bentham", name:"최대 행복의 배지", slot:"가슴", art:"badge",
    text:"최대 다수의 최대 행복이 가슴에 달려 있다.", perk:{ hp:1 } },
  { id:"panopticon-eye", guestId:"bentham", name:"원형 감시의 눈", slot:"눈", art:"oculus",
    text:"원형 감옥의 한 명의 감시자가 모두를 본다.", perk:{ dmgPct:1 } },
  { id:"legal-scroll", guestId:"legality", name:"법전의 두루마리", slot:"등", art:"scroll",
    text:"죄와 벌이 미리 적혀 있다.", perk:{ staggerPct:1 } },
  { id:"legal-wig", guestId:"legality", name:"재판관의 가발", slot:"머리", art:"wig",
    text:"재량이 아니라 법으로 판결한다는 표식.", perk:{ dmgPct:1 } },
  { id:"legal-tablet", guestId:"legality", name:"죄형의 석판", slot:"가슴", art:"tablet",
    text:"범죄와 형벌이 새겨진 석판.", perk:{ hp:1 } },
  { id:"marginal-stairs", guestId:"deterrence", name:"한계의 계단", slot:"발", art:"stairs",
    text:"폭행에서 살인으로 오르지 못하게 한 칸씩 막아 둔 계단.", perk:{ dmgPct:1 } },
  { id:"catch-chart", guestId:"deterrence", name:"검거 확률의 그래프", slot:"등", art:"chart",
    text:"잡힐 확률이 높을수록 억제가 커진다.", perk:{ hp:1 } },
  { id:"vital-vial", guestId:"deterrence", name:"생활반응의 시약병", slot:"손", art:"vial",
    text:"과학수사가 검거 가능성을 끌어올린다.", perk:{ staggerPct:1 } },
  { id:"equal-mask", guestId:"limits", name:"똑같은 얼굴의 가면", slot:"얼굴", art:"mask",
    text:"모두가 똑같이 합리적이라는 가정.", perk:{ hp:1 } },
  { id:"prefrontal-compass", guestId:"limits", name:"전전두엽의 나침반", slot:"머리", art:"compass",
    text:"비용과 이익을 가늠하는 추론의 바늘.", perk:{ staggerPct:1 } },
  { id:"article10-gavel", guestId:"limits", name:"제10조의 판결봉", slot:"목", art:"gavel",
    text:"심신상실은 벌하지 않고, 심신미약은 형을 감경할 수 있다.", perk:{ dmgPct:1 } },
  { id:"truth-public-scale", guestId:"defamation-truth", name:"진실과 공익의 저울", slot:"머리", art:"scale",
    text:"진실성과 공익성, 두 접시가 함께 차야 위법성이 조각된다.", perk:{ hp:1 } },
  { id:"defendant-proof-scroll", guestId:"defamation-truth", name:"피고인의 입증 두루마리", slot:"등", art:"scroll",
    text:"제310조의 입증은 피고인의 몫. 다만 자유로운 증명으로.", perk:{ staggerPct:1 } },
  { id:"military-64-gavel", guestId:"defamation-truth", name:"군형법 제64조의 판결봉", slot:"목", art:"gavel",
    text:"제310조는 군형법 제64조 제3항에도 유추적용된다.", perk:{ dmgPct:1 } }
];
const EGO_BY = Object.fromEntries(EGO_GIFTS.map(g=>[g.id,g]));


const COMBAT = {
  playerStartHp:100, baseLight:3, maxLightCap:6, lightPerTurn:1,
  emotionMax:5, chargesPerEmotion:2, weakAccuracyThreshold:0.7,
  guestHp:{1:28,2:44,3:64},
  guestStagger:{1:12,2:16,3:22},          // 흐트러짐 저항 게이지 (0이 되면 흐트러짐)
  playerStagger:26,                       // 사서 레벨 제거: 1:1 사서 체력·흐트러짐은 고정값 (기프트·장서복만 더함)
  quizShift:2, keyShift:3,                // 정답 시 내 주사위 +, 오답 시 −
  quizGuestShift:1, keyWrongGuestShift:1, // (예전 고정값 — 지금은 아래 pct 를 쓴다)
  /* 주사위 변동은 비율: 각 끝(min·max)에 곱해 반올림, 변동은 최소 1, 하한 1, hi≥lo.
     정답: 내 +right(핵심 keyRight) + emotionPer×감정단계, 손님 −guestRight. 오답: 내 −wrong(핵심 keyWrong), 핵심 문항 오답일 때만 손님 +guestKeyWrong */
  pct:{right:0.20, wrong:0.20, keyRight:0.30, keyWrong:0.30, emotionPer:0.05, guestRight:0.20, guestKeyWrong:0.20},
  correctStagger:1.25, keyCorrectStagger:1.75,
  bigEvery:{1:4,2:3,3:3}
};
function playerStaggerMax(){ return COMBAT.playerStagger; }


/* Combat pages: when adding a page from lecture notes, include `flavor` —
   a short 1–2 line in-world quote that embeds the actual study concept
   (accurate fact, phrased stylishly) so reading the card reinforces learning. */
const COMBAT_PAGES = [
  {id:"turn-page",name:"첫 장 넘기기",cost:1,emotion:0,dice:[{type:"참격",min:2,max:5}],text:"서고의 기본 공격 책장.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"공부는 첫 장을 넘기는 그 순간에 시작된다."},
  {id:"margin-guard",name:"여백의 방어",cost:1,emotion:0,dice:[{type:"방어",min:2,max:6}],text:"손님의 일격을 여백으로 받아낸다.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"여백을 남겨 두어야, 다음에 적을 생각이 들어올 자리가 생긴다."},
  {id:"silence",name:"서고의 침묵",cost:1,emotion:0,dice:[{type:"회피",min:3,max:6}],text:"공격을 흐름에 흘린다.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"정적 속에서만, 문장이 스스로 말을 건넨다."},
  {id:"breathe",name:"숨 고르기",cost:0,emotion:0,dice:[{type:"방어",min:1,max:3}],text:"이 순간은 빛 1을 더 회복한다.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"잠깐의 숨이 다음 집중을 만든다. 쉬지 않으면 오래 가지 못한다."},
  {id:"focus-line",name:"한 줄 집중",cost:1,emotion:0,dice:[{type:"관통",min:2,max:5}],text:"한 문장만 노려 찌른다.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"한 번에 한 문장만. 산만함은 줄을 건너뛰며 시작된다."},
  {id:"page-echo",name:"여운 남기기",cost:0,emotion:0,dice:[{type:"회피",min:1,max:4}],text:"방금 읽은 줄을 입 안에 남긴 채 장을 넘긴다.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"장을 넘기기 전, 방금 읽은 한 줄을 입 안에 남겨 둔다."},
  {id:"cover-slam",name:"표지 내려치기",cost:1,emotion:0,dice:[{type:"타격",min:2,max:6}],text:"두꺼운 표지로 내려친다. 타격.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"한 번 읽고 덮는 것은 두드림이 아니다. 복습은 두드릴수록 단단해진다."},
  {id:"stamp-seal",name:"이해의 도장",cost:2,emotion:0,dice:[{type:"타격",min:4,max:8}],text:"설명할 수 있어야 찍히는 도장. 묵직한 타격.",starter:true,rarity:"N",floorId:null,subject:"기본",
    flavor:"남에게 설명해 보면 모르는 곳이 드러난다. 도장은 그 뒤에 찍는다."},
  {id:"underline",name:"밑줄 긋기",cost:2,emotion:1,dice:[{type:"참격",min:4,max:7}],text:"핵심 문장에 선을 긋는 책장.",rarity:"R",floorId:"memory",subject:"학습법 (예시)",sourceGuest:"pomodoro",
    flavor:"이십오 분의 선. 그 선을 넘기기 전에는 다른 일에 손을 대지 않는다."},
  {id:"repeat-line",name:"되뇌는 문장",cost:2,emotion:2,dice:[{type:"참격",min:3,max:5},{type:"참격",min:3,max:5}],text:"같은 개념을 두 번 꺼낸다.",rarity:"R",floorId:"memory",subject:"학습법 (예시)",sourceGuest:"active-recall",
    flavor:"책을 덮고 나서야 비로소, 기억은 제 발로 걸어 나온다."},
  {id:"blank-fill",name:"빈칸 채우기",cost:2,emotion:2,dice:[{type:"관통",min:5,max:8}],text:"빈자리를 정확히 꿰뚫는다.",rarity:"R",floorId:"memory",subject:"학습법 (예시)",sourceGuest:"spaced-repetition",
    flavor:"한 번에 외운 것은 쉽게 무너지고, 간격을 둔 복습만이 남는다."},
  {id:"heavy-tome",name:"육중한 전공서",cost:2,emotion:1,dice:[{type:"타격",min:5,max:9}],text:"몰아 읽은 두꺼운 책으로 내려친다.",rarity:"R",floorId:"memory",subject:"학습법 (예시)",sourceGuest:"pomodoro",
    flavor:"한 번에 몰아 읽은 두꺼운 책은 무겁기만 하다. 나눠 읽은 쪽이 오래 남는다."},
  {id:"night-study",name:"심야 열람",cost:3,emotion:3,dice:[{type:"관통",min:6,max:9}],text:"밤이 깊을수록 필촉이 밝아진다.",rarity:"SR",floorId:"cognition",subject:"학습법 (예시)",sourceGuest:"metacognition",
    flavor:"밤이 깊을수록 묻게 된다. 나는 이것을, 정말 이해하고 있는가."},
  {id:"apex",name:"개념의 정점",cost:3,emotion:4,dice:[{type:"참격",min:8,max:12}],text:"감정을 담아 한 줄에 마침표를 찍는다.",rarity:"SSR",floorId:"cognition",subject:"학습법 (예시)",sourceGuest:"metacognition",
    flavor:"아는 것과 아는 척을 가려낼 때, 비로소 개념은 정점에 선다."},
  {id:"crime-and-punishment",name:"범죄와 형벌",cost:2,emotion:1,dice:[{type:"관통",min:5,max:8}],text:"1764년의 한 권을 꽂아 찌른다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"beccaria",
    flavor:"1764년, 베카리아는 형벌의 목적이 복수가 아니라 예방이라고 적었다."},
  {id:"anti-torture",name:"고문 반대 변론",cost:1,emotion:0,dice:[{type:"방어",min:4,max:8}],text:"고문과 사형에 반대한 변론으로 받아낸다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"beccaria",
    flavor:"고문과 사형에 반대한 목소리는, 방패가 되어 돌아온다."},
  {id:"prevention-not-revenge",name:"복수 아닌 예방",cost:2,emotion:2,dice:[{type:"참격",min:3,max:5},{type:"참격",min:3,max:5}],text:"복수가 아니라 예방을 위해, 두 번 벤다.",rarity:"SR",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"beccaria",
    flavor:"처벌은 복수가 아니라 예방을 위해 존재한다."},
  {id:"certainty-brand",name:"확실성의 낙인",cost:2,emotion:1,dice:[{type:"타격",min:5,max:9}],text:"반드시 처벌받는다는 확신으로 내려찍는다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"three-conditions",
    flavor:"엄한 벌보다, 반드시 받게 된다는 확신이 사람을 멈춘다."},
  {id:"swift-verdict",name:"신속한 판결",cost:1,emotion:0,dice:[{type:"참격",min:3,max:6}],text:"처벌이 늦지 않게, 빠르게 닿는다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"three-conditions",
    flavor:"형벌은 확실하고 신속해야 한다. 5만 원이라도 매번 단속하면 사람은 위반하지 않는다."},
  {id:"proportion-scale",name:"비례의 저울",cost:2,emotion:2,dice:[{type:"방어",min:3,max:6},{type:"관통",min:3,max:6}],text:"범죄의 무게만큼, 딱 그만큼만 되돌려 준다.",rarity:"SR",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"three-conditions",
    flavor:"범죄의 무게에 맞는 처벌. 그것이 비례성이다."},
  {id:"hedonic-calculus",name:"쾌락 계산",cost:2,emotion:2,dice:[{type:"관통",min:4,max:6},{type:"참격",min:3,max:5}],text:"쾌락과 고통을 저울질해 찌른다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"bentham",
    flavor:"형벌의 고통이 범죄의 쾌락을 조금만 넘으면, 범죄는 계산에서 진다."},
  {id:"greatest-happiness",name:"최대 다수의 최대 행복",cost:3,emotion:3,dice:[{type:"참격",min:6,max:9},{type:"방어",min:3,max:5}],text:"공리주의의 한 줄로 베고, 곁을 지킨다.",rarity:"SR",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"bentham",
    flavor:"벤담의 공리주의: 최대 다수의 최대 행복."},
  {id:"panopticon-gaze",name:"파놉티콘의 시선",cost:2,emotion:1,dice:[{type:"관통",min:5,max:8}],text:"시선 하나가 모든 곳을 꿰뚫는다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"bentham",
    flavor:"원형 감옥의 중앙, 한 명의 감시자가 모든 수감자를 본다."},
  {id:"statute-clause",name:"미리 쓰인 조문",cost:1,emotion:0,dice:[{type:"방어",min:3,max:7}],text:"미리 법에 적힌 조문으로 막아낸다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"legality",
    flavor:"죄와 벌은 미리 법에 적혀 있어야 한다. 죄형법정주의."},
  {id:"statutory-sentence",name:"법정 선고",cost:2,emotion:1,dice:[{type:"타격",min:5,max:8}],text:"법이 정한 죄에, 법이 정한 벌을 내려친다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"legality",
    flavor:"범죄와 형벌은 미리 법률로 정해 두어야 한다."},
  {id:"marginal-brake",name:"한계 억제",cost:2,emotion:2,dice:[{type:"타격",min:4,max:6},{type:"회피",min:3,max:5}],text:"한 칸씩 막아 더 큰 범죄로 번지지 않게 한다.",rarity:"SR",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"deterrence",
    flavor:"범죄의 무게에 비례해 처벌하면, 폭행이 살인이 되는 일을 막는다."},
  {id:"catch-chance",name:"잡힐 확률",cost:3,emotion:3,dice:[{type:"관통",min:6,max:9}],text:"놓치지 않는다는 확신이 가장 깊게 박힌다.",rarity:"SR",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"deterrence",
    flavor:"억제 연구: 형을 높이는 것보다, 잡힐 확률을 높이는 것이 일관되게 더 효과적이다."},
  {id:"equal-assumption",name:"똑같은 합리성의 가정",cost:2,emotion:1,dice:[{type:"참격",min:4,max:7}],text:"모두가 똑같다는 가정으로 벤다.",rarity:"R",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"limits",
    flavor:"고전주의는 모두가 똑같이 합리적이라 가정했다. 개인차는 설명하지 못한다."},
  {id:"prefrontal-warning",name:"전전두엽의 경고",cost:3,emotion:3,dice:[{type:"타격",min:6,max:10}],text:"추론이 무너진 곳에 일격이 박힌다.",rarity:"SR",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"limits",
    flavor:"전전두엽이 손상되면 비용과 이익을 따지는 추론이 약해져 억제도 약해진다. 1848년, 게이지처럼."},
  {id:"article-ten",name:"형법 제10조",cost:3,emotion:3,dice:[{type:"방어",min:5,max:9},{type:"타격",min:4,max:7}],text:"조문 한 줄로 받아내고 되돌려 친다.",rarity:"SSR",floorId:"crime",subject:"범죄학의 기초",sourceGuest:"limits",
    flavor:"심신상실은 벌하지 않고, 심신미약은 형을 감경할 수 있다."},
  {id:"reasonable-belief",name:"상당한 이유",cost:1,emotion:0,dice:[{type:"방어",min:4,max:8}],text:"진실이라 믿을 만했던 이유로 받아낸다.",rarity:"R",floorId:"criminal-law",subject:"형법",sourceGuest:"defamation-truth",
    flavor:"진실의 증명이 없어도, 진실이라 믿은 데 상당한 이유가 있었다면 위법성이 없다. 책임이 아니라 위법성이다."},
  {id:"public-interest",name:"공공의 이익",cost:2,emotion:1,dice:[{type:"참격",min:5,max:8}],text:"사회 전반과 그 안의 한 집단을 위해 벤다.",rarity:"R",floorId:"criminal-law",subject:"형법",sourceGuest:"defamation-truth",
    flavor:"공공의 이익은 사회 전반만이 아니다. 특정 사회집단의 이익도 공익이다."},
  {id:"defendant-burden",name:"피고인의 입증",cost:2,emotion:2,dice:[{type:"관통",min:4,max:6},{type:"방어",min:3,max:5}],text:"진실과 공익을 스스로 증명하며 꿰뚫는다.",rarity:"SR",floorId:"criminal-law",subject:"형법",sourceGuest:"defamation-truth",
    flavor:"제310조, 진실성과 공익성의 입증은 피고인이 진다. 엄격한 증명이 아니라 자유로운 증명으로."}
];

/* look: 3D 복장(선택, docs/ui.md 9절). 사서 몸은 그대로 두고 망토·모자 색과 소품으로 구분. novice 는 기본 모습 */
const KEY_PAGES = [
  {id:"novice",name:"초보 사서의 장서복",text:"기본 착장. 특별한 효과는 없다.",perk:"none",coat:0},
  {id:"reading-room",name:"열람실의 장서복",text:"열람의 기율을 입는다. 접대 시작 빛 +1.",perk:"light",coat:1,look:{cloth:"#3fb0a6",body:"#5a8c88",props:[{name:"lantern",bone:"back",scale:0.45,pos:[0.28,0.42,-0.22]}]}},
  {id:"midnight",name:"심야 사서",text:"밤을 허비하지 않는 자세. 감정 단계 1로 시작.",perk:"emotion",coat:2,look:{cloth:"#6b5ce0",body:"#4a4a8a",props:[{name:"orb",bone:"head",scale:0.24}]}},
  {id:"archivist",name:"소장관의 망토",text:"서고를 지키는 자의 옷. 매 턴 빛 회복 +1.",perk:"recover",coat:3,look:{cloth:"#d0463a",body:"#8a3a3a",props:[{name:"quill",bone:"head",scale:0.45,pos:[0.14,0.75,-0.05],rot:[0,0,-0.5]}]}},
  {id:"classical-robe",name:"고전주의 재판관의 법복",text:"합리의 저울을 입는다. 최대 체력 +10.",perk:"hp10",coat:4,look:{cloth:"#f0e6cc",body:"#d8cdb2",props:[{name:"scales",bone:"back",scale:0.45,pos:[0.3,0.4,-0.2]}]}},
  {id:"panopticon-coat",name:"파놉티콘 감시관의 외투",text:"모든 곳을 보는 눈. 흐트러짐 피해 +10%.",perk:"stagger10",coat:5,look:{cloth:"#a86e3c",body:"#7a5a3e",props:[{name:"lantern",bone:"hand.l",scale:0.5}]}},
  {id:"truth-robe",name:"진실과 공익의 법복",text:"진실을 비추는 등불을 든다. 접대 시작 빛 +1.",perk:"light",coat:6,look:{cloth:"#9a52c8",body:"#6a3a8a",props:[{name:"lantern",bone:"hand.l",scale:0.5},{name:"scroll",bone:"back",scale:0.4,pos:[0.3,0.4,-0.2]}]}}
];

/* 책 소각 풀 — 모든 비기본 책장/핵심 책장은 최소 한 손님의 책에서 나온다 (acqAudit가 검사) */
const BOOK_POOLS = {
  beccaria:[{k:"page",id:"crime-and-punishment",w:10},{k:"page",id:"anti-torture",w:10},{k:"page",id:"prevention-not-revenge",w:6},{k:"key",id:"classical-robe",w:4}],
  "three-conditions":[{k:"page",id:"certainty-brand",w:10},{k:"page",id:"swift-verdict",w:10},{k:"page",id:"proportion-scale",w:6},{k:"key",id:"classical-robe",w:4}],
  bentham:[{k:"page",id:"hedonic-calculus",w:10},{k:"page",id:"panopticon-gaze",w:10},{k:"page",id:"greatest-happiness",w:6},{k:"key",id:"panopticon-coat",w:4}],
  legality:[{k:"page",id:"statute-clause",w:10},{k:"page",id:"statutory-sentence",w:10},{k:"page",id:"crime-and-punishment",w:4},{k:"key",id:"classical-robe",w:4}],
  deterrence:[{k:"page",id:"marginal-brake",w:8},{k:"page",id:"catch-chance",w:8},{k:"page",id:"certainty-brand",w:4},{k:"key",id:"panopticon-coat",w:4}],
  limits:[{k:"page",id:"equal-assumption",w:10},{k:"page",id:"prefrontal-warning",w:6},{k:"page",id:"article-ten",w:4},{k:"page",id:"marginal-brake",w:3},{k:"key",id:"panopticon-coat",w:3},{k:"key",id:"classical-robe",w:3}],
  pomodoro:[{k:"page",id:"underline",w:10},{k:"page",id:"heavy-tome",w:10},{k:"key",id:"reading-room",w:5}],
  "active-recall":[{k:"page",id:"repeat-line",w:10},{k:"page",id:"underline",w:5},{k:"key",id:"reading-room",w:5}],
  "spaced-repetition":[{k:"page",id:"blank-fill",w:10},{k:"page",id:"heavy-tome",w:5},{k:"key",id:"midnight",w:5}],
  metacognition:[{k:"page",id:"night-study",w:8},{k:"page",id:"repeat-line",w:5},{k:"page",id:"apex",w:3},{k:"key",id:"archivist",w:4}],
  "defamation-truth":[{k:"page",id:"reasonable-belief",w:10},{k:"page",id:"public-interest",w:10},{k:"page",id:"defendant-burden",w:6},{k:"key",id:"classical-robe",w:4},{k:"key",id:"truth-robe",w:4}]
};
const BOOK_RULES = { recallOne:0.65, firstClear:1, pityGuarantee:2, newMul:3, dupMul:0.5, burnDraws:1 };
const DECK_MAX_COPIES = 2;

const SLOTS = ["책갈피","장식","깃펜","동반자","서고","호칭"];
const RARITY_ORDER = ["N","R","SR","SSR"];
const THEMES = [
  ...["잉크","양피지","양초","먼지","창가","인덱스","제본","쪽수"].map(theme=>({theme,rarity:"N"})),
  ...["금박","심야","먹물","단풍","바다","서리"].map(theme=>({theme,rarity:"R"})),
  ...["달빛","벚꽃","석양","별빛"].map(theme=>({theme,rarity:"SR"})),
  ...["은하","황금"].map(theme=>({theme,rarity:"SSR"}))
];
const SLOT_NOUN = {
  N:{책갈피:"책갈피",장식:"단추",깃펜:"연필",동반자:"참새",서고:"열람실",호칭:"수강생"},
  R:{책갈피:"장식띠",장식:"견장",깃펜:"만년필",동반자:"고양이",서고:"창가 서고",호칭:"탐구가"},
  SR:{책갈피:"봉랍",장식:"장서복",깃펜:"장서 깃펜",동반자:"부엉이",서고:"옥상 서고",호칭:"정복자"},
  SSR:{책갈피:"금빛 책갈피",장식:"망토",깃펜:"성검필",동반자:"서고의 용",서고:"성역",호칭:"전설"}
};
const COSMETIC_ITEMS = [];
for (const slot of SLOTS) {
  THEMES.forEach((entry, index) => {
    const noun = SLOT_NOUN[entry.rarity][slot];
    const name = slot==="호칭" ? `「${entry.theme} ${noun}」` : `${entry.theme} ${noun}`;
    COSMETIC_ITEMS.push({ id:`${slot}-${entry.theme}`, name, slot, rarity:entry.rarity, seed:index + SLOTS.indexOf(slot)*20 });
  });
}
const COLLECTION_TOTAL = COSMETIC_ITEMS.length;
const STARTER_PAGES = COMBAT_PAGES.filter(p=>p.starter).map(p=>p.id);
const PAGE_BY = Object.fromEntries(COMBAT_PAGES.map(p=>[p.id,p]));
/* 감정 요구 단계는 card.emotionReq 로 통일 (예전 page.emotion 은 별칭으로 읽어 emotionReq 에 맞춘다) */
const pageEmotionReq=p=>p?(p.emotionReq!=null?p.emotionReq:(p.emotion||0)):0;
COMBAT_PAGES.forEach(p=>{ if(p.emotionReq==null) p.emotionReq=p.emotion||0; });
const KEY_BY = Object.fromEntries(KEY_PAGES.map(p=>[p.id,p]));
const ITEM_BY = Object.fromEntries(COSMETIC_ITEMS.map(p=>[p.id,p]));
const GUEST_BY = Object.fromEntries(WEAK_POINTS.map(p=>[p.id,p]));

const SAVE_KEY = "concept-library-game-v1";
/* ---------- helpers ---------- */

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const pick = a => a[Math.floor(Math.random()*a.length)];
function keyPerk(s){
  /* 활성(없으면 첫) 사서의 장서복 = 핵심 책장. 옛 필드 equippedKeyId는 활성 사서의 별칭으로 동기화된다. */
  if(s&&s.librarians) syncLibs(s);
  const L=s&&s.librarians&&(s.librarians[s.activeLibrarianId]||s.librarians[(s.party||[])[0]]||s.librarians[LIB_DEFAULT_ID]);
  return KEY_BY[L&&L.keyPage]||KEY_BY[s&&s.equippedKeyId]||KEY_PAGES[0];
}
function emptyEgoEquip(){ return Object.fromEntries(EGO_GIFT_RULES.slots.map(sl=>[sl,null])); }
/* ---- 사서별 기프트: save.librarians[id].gifts = {owned:[], equipped:{부위:id}} ---- */
const LIB_DEFAULT_ID="kyu";
function mkLibrarian(id,name){ return {id,name,keyPage:null,deckId:null,gifts:{owned:[],equipped:emptyEgoEquip()},pity:{}}; }
/* ---- 사서 여러 명 (다대다 전투 준비) ----
   save.librarians[id].keyPage = 입은 장서복(핵심 책장) id, .deckId = 쓰는 덱 id.
   옛 필드 save.equippedKeyId / save.activeDeckId 는 활성 사서(activeLibrarianId, 기본 kyu)의 별칭으로 계속 동기화된다.
   해금: 장서복 5개 → 2번째(lib2), 10개 → 3번째(lib3). 저장하지 않고 unlockedKeyIds.length 로 계산.
   save.party = 접대에 나가는 사서 id 순서 (slot 0..2). */
const LIB_ORDER=[LIB_DEFAULT_ID,"lib2","lib3"];
const LIB_UNLOCK_AT=[0,5,10];
const LIB_NAMES={kyu:"큐 양",lib2:"두 번째 사서",lib3:"세 번째 사서"};
const PARTY_MAX=3;
function libUnlockedCount(s){ const n=((s&&s.unlockedKeyIds)||[]).length; return LIB_UNLOCK_AT.filter(t=>n>=t).length; }
function libNextAt(s){ const c=libUnlockedCount(s); return c<LIB_UNLOCK_AT.length?LIB_UNLOCK_AT[c]:null; }
function libUnlockedIds(s){ return LIB_ORDER.slice(0,libUnlockedCount(s)); }
function libActive(s){ return s.librarians[s.activeLibrarianId]||s.librarians[LIB_DEFAULT_ID]; }
/* 옛 필드(활성 사서의 별칭) ↔ 사서별 필드 맞추기 + 해금된 사서 만들기 + 중복 장서복·없는 덱·파티 정리. 여러 번 불러도 안전. */
function syncLibs(s){
  if(!s||typeof s!=="object") return s;
  s.librarians=s.librarians&&typeof s.librarians==="object"?s.librarians:{};
  const unlocked=libUnlockedIds(s);
  for(const id of unlocked) if(!s.librarians[id]) s.librarians[id]=mkLibrarian(id,LIB_NAMES[id]||id);
  if(!s.librarians[s.activeLibrarianId]) s.activeLibrarianId=LIB_DEFAULT_ID;
  const keys=new Set(s.unlockedKeyIds||[]), decks=new Set((s.decks||[]).map(d=>d.id));
  const A=libActive(s);
  /* 옛 필드가 바뀌었으면(기존 UI가 equippedKeyId/activeDeckId를 직접 씀) 활성 사서에게 반영, 겹치면 상대와 맞바꿈 */
  if(s.equippedKeyId&&KEY_BY[s.equippedKeyId]&&A.keyPage!==s.equippedKeyId){
    const other=Object.values(s.librarians).find(L=>L!==A&&L.keyPage===s.equippedKeyId);
    if(other) other.keyPage=A.keyPage&&KEY_BY[A.keyPage]?A.keyPage:null;
    A.keyPage=s.equippedKeyId;
  }
  if(s.activeDeckId&&A.deckId!==s.activeDeckId) A.deckId=s.activeDeckId;
  /* 정리: 열린 장서복만, 한 장서복은 한 사서만 (활성 사서 우선) */
  const worn=new Set();
  for(const L of [A,...Object.values(s.librarians).filter(L=>L!==A)]){
    if(L.keyPage===undefined) L.keyPage=null;
    if(L.deckId===undefined) L.deckId=null;
    if(L.keyPage&&(!KEY_BY[L.keyPage]||!keys.has(L.keyPage)||worn.has(L.keyPage))) L.keyPage=null;
    if(L.keyPage) worn.add(L.keyPage);
    if(L.deckId&&decks.size&&!decks.has(L.deckId)) L.deckId=null;
  }
  if(!A.keyPage){ const free=["novice",...(s.unlockedKeyIds||[])].find(k=>KEY_BY[k]&&keys.has(k)&&!worn.has(k)); if(free) A.keyPage=free; }
  if(!A.deckId&&decks.size) A.deckId=(s.decks||[])[0].id;
  if(A.keyPage) s.equippedKeyId=A.keyPage;
  if(A.deckId) s.activeDeckId=A.deckId;
  const pool=new Set(unlocked);
  let party=Array.isArray(s.party)?[...new Set(s.party)].filter(id=>pool.has(id)&&s.librarians[id].keyPage):[];
  party=party.slice(0,Math.min(PARTY_MAX,unlocked.length));
  if(!party.length) party=[LIB_DEFAULT_ID];
  s.party=party;
  return s;
}
function libsList(s){
  syncLibs(s);
  return libUnlockedIds(s).map(id=>{ const L=s.librarians[id]; return {id,name:L.name,keyPage:L.keyPage,deckId:L.deckId,slot:s.party.indexOf(id),active:id===s.activeLibrarianId}; });
}
function libsKeyOf(s,libId){ syncLibs(s); const L=s.librarians[libId||s.activeLibrarianId]; return L&&L.keyPage?(KEY_BY[L.keyPage]||null):null; }
/* 장서복 입히기: 다른 사서가 입고 있으면 서로 맞바꿈. 맞바꿀 때 상대가 빈 손이 되면 막는다. keyId=null 은 활성이 아닌 사서의 벗기. */
function libsEquipKey(s,libId,keyId){
  syncLibs(s);
  if(!libUnlockedIds(s).includes(libId)) return {ok:false,reason:"locked-librarian"};
  const L=s.librarians[libId], A=libActive(s);
  if(keyId==null){
    if(L===A) return {ok:false,reason:"active-needs-key"};
    if(s.party.includes(libId)) return {ok:false,reason:"party-needs-key"};
    L.keyPage=null; if(s===save) persist(); return {ok:true,swappedWith:null};
  }
  if(!KEY_BY[keyId]||!(s.unlockedKeyIds||[]).includes(keyId)) return {ok:false,reason:"locked-key"};
  if(L.keyPage===keyId) return {ok:true,swappedWith:null};
  const other=Object.values(s.librarians).find(o=>o!==L&&o.keyPage===keyId);
  if(other&&!L.keyPage) return {ok:false,reason:"swap-empty"};
  if(other) other.keyPage=L.keyPage;
  L.keyPage=keyId;
  if(A.keyPage) s.equippedKeyId=A.keyPage;
  if(s===save) persist();
  return {ok:true,swappedWith:other?other.id:null};
}
/* 파티 정하기: 열린 사서만, 중복 없이, 1~min(3, 열린 수)명, 모두 장서복을 입고 있어야 함. */
function libsSetParty(s,ids){
  syncLibs(s);
  if(!Array.isArray(ids)||!ids.length) return {ok:false,reason:"empty"};
  if(new Set(ids).size!==ids.length) return {ok:false,reason:"duplicate"};
  const unlocked=libUnlockedIds(s);
  if(ids.length>Math.min(PARTY_MAX,unlocked.length)) return {ok:false,reason:"too-many"};
  if(ids.some(id=>!unlocked.includes(id))) return {ok:false,reason:"locked-librarian"};
  if(ids.some(id=>!s.librarians[id].keyPage)) return {ok:false,reason:"no-key"};
  s.party=[...ids];
  if(s===save) persist();
  return {ok:true,party:[...s.party]};
}
function libOf(s,id){
  s.librarians=s.librarians||{};
  const k=id||s.activeLibrarianId||LIB_DEFAULT_ID;
  if(!s.librarians[k]) s.librarians[k]=mkLibrarian(k,k===LIB_DEFAULT_ID?"큐 양":k);
  return s.librarians[k];
}
const egoOwned=(s,id)=>libOf(s,id).gifts.owned;
const egoEquip=(s,id)=>libOf(s,id).gifts.equipped;
function equippedGifts(s,id){
  const e=egoEquip(s,id);
  return EGO_GIFT_RULES.slots.map(slot=>EGO_BY[e[slot]||""]).filter(Boolean);
}
/* 세트: 한 손님의 기프트 3종을 모두 '착용'해야 활성 */
function activeSets(s,id){
  const eq=new Set(equippedGifts(s,id).map(g=>g.id));
  return [...new Set(EGO_GIFTS.map(g=>g.guestId))].filter(gid=>EGO_GIFTS.filter(g=>g.guestId===gid).every(g=>eq.has(g.id)));
}
function giftTotals(s,id){
  const u=EGO_GIFT_RULES.unit, t={hp:0,dieMin:0,staggerPct:0,dmgPct:0,startLight:0,startEmotion:0,lightRegen:0,sets:0};
  for(const g of equippedGifts(s,id)){
    if(!g.perk) continue;
    for(const [k,n] of Object.entries(g.perk)) t[k]=(t[k]||0)+(u[k]||1)*n;
  }
  for(const gid of activeSets(s,id)){
    t.sets++;
    for(const [k,v] of Object.entries(EGO_GIFT_RULES.setBonus)) t[k]=(t[k]||0)+v;
  }
  t.staggerPct=Math.round(t.staggerPct*1000)/1000; t.dmgPct=Math.round(t.dmgPct*1000)/1000;
  return t;
}
/* 슬롯 선택 전부를 따져 본 이론상 최대치 (표/테스트용) */
let _gmtCache=null;
function giftMaxTotals(){
  if(_gmtCache) return _gmtCache;
  const u=EGO_GIFT_RULES.unit, sb=EGO_GIFT_RULES.setBonus;
  const gids=[...new Set(EGO_GIFTS.map(g=>g.guestId))], need={};
  gids.forEach(id=>need[id]=EGO_GIFTS.filter(g=>g.guestId===id).length);
  const bySlot=EGO_GIFT_RULES.slots.map(sl=>[null,...EGO_GIFTS.filter(g=>g.slot===sl)]);
  let best=null, bestScore=-1; const cnt={}; gids.forEach(id=>cnt[id]=0);
  const cur={hp:0,staggerPct:0,dmgPct:0,dieMin:0,startLight:0,startEmotion:0,lightRegen:0};
  const picks=[];
  (function rec(i){
    if(i===bySlot.length){
      let sets=0; gids.forEach(id=>{ if(cnt[id]===need[id]) sets++; });
      const t={...cur,sets};
      for(const [k,v] of Object.entries(sb)) t[k]=(t[k]||0)+v*sets;
      const sc=t.hp+t.staggerPct*100+t.dmgPct*100;
      if(sc>bestScore){ bestScore=sc; best={...t,picks:picks.slice()}; }
      return;
    }
    for(const g of bySlot[i]){
      if(g){
        for(const [k,n] of Object.entries(g.perk||{})) cur[k]+=(u[k]||1)*n;
        cnt[g.guestId]++; picks.push(g.id);
      }
      rec(i+1);
      if(g){
        for(const [k,n] of Object.entries(g.perk||{})) cur[k]-=(u[k]||1)*n;
        cnt[g.guestId]--; picks.pop();
      }
    }
  })(0);
  best.staggerPct=Math.round(best.staggerPct*1000)/1000; best.dmgPct=Math.round(best.dmgPct*1000)/1000;
  return (_gmtCache=best);
}
function bonusLabel(t){
  const parts=[];
  if(t.hp) parts.push("체력 +"+t.hp);
  if(t.dieMin) parts.push("주사위 최솟값 +"+t.dieMin);
  if(t.staggerPct) parts.push("흐트러짐 피해 +"+Math.round(t.staggerPct*100)+"%");
  if(t.dmgPct) parts.push("피해 +"+Math.round(t.dmgPct*100)+"%");
  if(t.startLight) parts.push("시작 빛 +"+t.startLight);
  if(t.startEmotion) parts.push("시작 감정 +"+t.startEmotion);
  if(t.lightRegen) parts.push("빛 회복 +"+t.lightRegen);
  if(t.sets) parts.push("세트 "+t.sets+"개 활성");
  return parts.length?parts.join(" · "):"아직 누적된 효과가 없습니다.";
}
function withKeyMods(t,s){
  const p=keyPerk(s).perk, o=Object.assign({},t);
  if(p==="hp10") o.hp=(o.hp||0)+10;
  if(p==="stagger10") o.staggerPct=Math.round(((o.staggerPct||0)+0.10)*1000)/1000;
  return o;
}
function effectiveMaxHp(s){ return COMBAT.playerStartHp+withKeyMods(giftTotals(s),s).hp; }
function startLight(s){ return Math.min(COMBAT.maxLightCap, COMBAT.baseLight+(keyPerk(s).perk==="light"?1:0)+giftTotals(s).startLight); }
function startEmotion(s){ return (keyPerk(s).perk==="emotion"?1:0)+giftTotals(s).startEmotion; }
function lightRegen(s){ return COMBAT.lightPerTurn+(keyPerk(s).perk==="recover"?1:0)+giftTotals(s).lightRegen; }
function weaknessLabel(w){ return w===1?"낮음":w===2?"보통":"높음"; }
/*ENGINE-START*/
