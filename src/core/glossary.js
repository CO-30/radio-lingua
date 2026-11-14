// 無線の専門用語の補足説明。字幕の下に「用語」として表示する。
// 追加するときは re（英語の表記ゆれ）と ja（訳語）・desc（一言説明）を書く。

export const GLOSSARY = [
  { key: 'dispatch', re: /\bdispatch(er)?\b/i, ja: '通信指令', desc: '通報を受けて出動部隊を割り当てる指令センター。' },
  { key: 'engine', re: /\b(fire )?engine \d+/i, ja: '消防ポンプ車', desc: '放水を担当する消防車。番号は隊の番号。' },
  { key: 'ladder', re: /\b(ladder|truck) \d+/i, ja: 'はしご車', desc: '高所の救助・消火を担当する消防車。' },
  { key: 'medic', re: /\b(medic|ambulance) \d+/i, ja: '救急隊', desc: '米国の Medic は救急救命士が乗る高度救命の救急車を指すことが多い。' },
  { key: 'battalion', re: /\bbattalion( chief)?\b/i, ja: '大隊長', desc: '複数の消防隊を指揮する現場の指揮官。' },
  { key: 'unit', re: /\bunit \d+/i, ja: 'ユニット', desc: '警察などの車両・班の呼び名。番号で呼び合う。' },
  { key: 'structure-fire', re: /\bstructure fire\b/i, ja: '建物火災', desc: '住宅やビルなど建物の火災。車両火災・林野火災と区別する。' },
  { key: 'cross-street', re: /\bcross[- ]?street\b/i, ja: '交差道路', desc: '現場の近くで交わる道路。場所を特定するために伝える。' },
  { key: 'mile-marker', re: /\bmile marker\b/i, ja: 'マイル標識', desc: '高速道路の距離標。1マイルは約1.6km。' },
  { key: 'priority', re: /\bpriority (one|1)\b/i, ja: '最優先', desc: '緊急度が最も高い出動。' },
  { key: 'traffic-stop', re: /\btraffic stop\b/i, ja: '交通停止', desc: '警察官が車両を停止させて確認すること。' },
  { key: 'occupants', re: /\boccupants?\b/i, ja: '乗員', desc: '車に乗っている人数。' },
  { key: 'en-route', re: /\ben route\b/i, ja: '現場へ移動中', desc: '出動して現場に向かっている状態。' },
  { key: 'on-scene', re: /\bon scene\b/i, ja: '現着', desc: '現場に到着したこと。' },
  { key: 'eta', re: /\b(ETA|E\.?T\.?A\.?|estimated arrival time)\b/i, ja: '到着予定', desc: '現場や病院に着くまでの見込み時間。' },
  { key: 'copy', re: /\bcop(y|ies)\b/i, ja: '了解（受信した）', desc: '無線で「内容を受け取った」という返事。' },
  { key: 'ten-code', re: /\b10-\d{1,3}\b/, ja: '10コード', desc: '米国の無線で使う短縮符号。機関によって意味が異なる。' },
  { key: 'code', re: /\bcode [234]\b/i, ja: 'コード', desc: 'code 3＝赤色灯とサイレンで緊急走行、code 4＝応援不要、など。機関により異なる。' },
  { key: 'bolo', re: /\bBOLO\b/i, ja: '手配', desc: 'Be On the LookOut：特定の人物・車両を警戒せよ、という指示。' },
  { key: 'bound', re: /\b(north|south|east|west)bound\b/i, ja: '〜行き', desc: '道路の進行方向（southbound＝南行き）。' },
  { key: 'highway', re: /\bhighway \d+/i, ja: 'ハイウェイ', desc: '米国の幹線道路（州道・国道）。日本の高速道路とは限らない。' },
];

/** 英文に含まれる用語を、出現順・重複なしで返す */
export function findTerms(text) {
  if (!text) return [];
  const hits = [];
  for (const g of GLOSSARY) {
    const m = g.re.exec(text);
    if (m) hits.push({ key: g.key, ja: g.ja, desc: g.desc, en: m[0], at: m.index });
  }
  return hits.sort((a, b) => a.at - b.at).map(({ at, ...rest }) => rest);
}
