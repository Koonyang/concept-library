/* 무대 분위기. 층 데이터 stage.mood 가 이 키를 고른다(js/core/data.js FLOORS).
   값은 시안(https://claude.ai/artifact/U8LJwZgAt4bQRWhXfsDn7U) A·B 에서 가져왔다. 새 분위기는 같은 키로 하나 더 추가하면 된다. */
export const MOODS = {
  /* 등불 서고: 따뜻한 등불, 짙은 나무 책장, 청록 그늘 */
  lamp: {
    bg: 0x15110e, fog: [0x15110e, 11, 26],
    floor: 0x3b2b20, floorEdge: 0x271c15, shelf: 0x452d1e,
    books: [0x8a3b2e, 0x2e5a5a, 0xb08a3e, 0x3e4a6a, 0x6b4a2e],
    amb: [0x2c4048, 0.9], key: [0xffb36b, 1.6], rim: [0x4fa3a3, 0.7],
    spark: 0xffd28a, dust: 0xffc98a, lamps: true,
  },
  /* 달빛 열람실: 대리석 바닥, 차가운 달빛, 옅은 안개 */
  moon: {
    bg: 0x0b1220, fog: [0x0f1828, 9, 24],
    floor: 0x5d6a82, floorEdge: 0x3a4560, shelf: 0x26324a,
    books: [0x5a6f9a, 0xa8b8d8, 0x34445f, 0xd5ddeb, 0x7a88b0],
    amb: [0x2a3b5c, 0.85], key: [0xc6dcff, 1.05], rim: [0x9fe8ff, 0.9],
    spark: 0x9fe8ff, dust: 0xcfe6ff, lamps: false,
  },
};
export const DEFAULT_MOOD = "lamp";
