// 米国の警察・消防・救急無線に特有の言い回しを、翻訳しやすい英語に直す。
// 10コードは機関ごとに意味が違うことがあるため、APCOの一般的な意味を使い、
// 字幕には「元のコード」も残して利用者が確認できるようにする。

/** @type {Record<string, {en:string, ja:string}>} */
export const TEN_CODES = {
  '10-1': { en: 'poor reception', ja: '受信不良' },
  '10-2': { en: 'good reception', ja: '受信良好' },
  '10-3': { en: 'stop transmitting', ja: '送信中止' },
  '10-4': { en: 'acknowledged', ja: '了解' },
  '10-6': { en: 'busy', ja: '対応中' },
  '10-7': { en: 'out of service', ja: '業務外' },
  '10-8': { en: 'in service', ja: '業務復帰' },
  '10-9': { en: 'please repeat', ja: '再送願う' },
  '10-10': { en: 'negative', ja: '否定' },
  '10-19': { en: 'returning to station', ja: '帰署中' },
  '10-20': { en: 'location', ja: '現在地' },
  '10-22': { en: 'disregard', ja: '取り消し' },
  '10-23': { en: 'arrived at scene', ja: '現着' },
  '10-28': { en: 'vehicle registration check', ja: '車両照会' },
  '10-29': { en: 'records check', ja: '記録照会' },
  '10-33': { en: 'emergency traffic', ja: '緊急通信' },
  '10-50': { en: 'traffic accident', ja: '交通事故' },
  '10-76': { en: 'en route', ja: '出動中' },
  '10-97': { en: 'arrived on scene', ja: '現着' },
  '10-98': { en: 'assignment completed', ja: '任務完了' },
};

export const PLAIN_CODES = {
  'code 2': { en: 'urgent response without lights and siren', ja: '緊急（サイレンなし）' },
  'code 3': { en: 'emergency response with lights and siren', ja: '緊急走行' },
  'code 4': { en: 'no further assistance needed', ja: '応援不要' },
};

const NUM_WORDS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

function wordsToNumber(str) {
  const parts = str.toLowerCase().split(/[\s-]+/).filter(Boolean);
  let total = 0;
  for (const p of parts) {
    if (!(p in NUM_WORDS)) return null;
    total += NUM_WORDS[p];
  }
  return total;
}

const NUM_WORD_RE = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';

const NATO = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'x-ray', 'yankee', 'zulu'];
const APCO = ['adam', 'boy', 'charles', 'david', 'edward', 'frank', 'george', 'henry', 'ida', 'john', 'king', 'lincoln', 'mary', 'nora', 'ocean', 'paul', 'queen', 'robert', 'sam', 'tom', 'union', 'victor', 'william', 'x-ray', 'young', 'zebra'];
const PHONETIC = new Map();
NATO.forEach((w) => PHONETIC.set(w, w[0].toUpperCase()));
APCO.forEach((w) => PHONETIC.set(w, w[0].toUpperCase()));

/** 呼出符号（部隊名）。字幕で強調表示し、翻訳前に意味の分かる英語へ置き換える */
const UNIT_TYPES = [
  { re: /\bengine/i, en: 'Fire Engine', ja: '消防車', kind: 'fire' },
  { re: /\b(ladder|truck)/i, en: 'Ladder Truck', ja: 'はしご車', kind: 'fire' },
  { re: /\bbattalion/i, en: 'Battalion Chief', ja: '大隊長', kind: 'fire' },
  { re: /\brescue/i, en: 'Rescue', ja: '救助隊', kind: 'fire' },
  { re: /\bsquad/i, en: 'Squad', ja: '特別隊', kind: 'fire' },
  { re: /\b(medic|ambulance)/i, en: 'Ambulance', ja: '救急車', kind: 'ems' },
  { re: /\bunit/i, en: 'Unit', ja: 'ユニット', kind: 'police' },
  { re: /\bcar/i, en: 'Patrol Car', ja: 'パトカー', kind: 'police' },
];
const UNIT_RE = new RegExp(`\\b(Engine|Ladder|Truck|Battalion|Rescue|Squad|Medic|Ambulance|Unit|Car)\\s+(\\d{1,4}|${NUM_WORD_RE}(?:[\\s-]${NUM_WORD_RE})?)\\b`, 'gi');

/**
 * 翻訳前の英文を整える。
 * @returns {{text:string, codes:{code:string, ja:string}[], units:{label:string, ja:string, kind:string}[]}}
 */
export function normalizeRadioText(input) {
  let text = ` ${input} `.replace(/\s+/g, ' ');
  const codes = [];
  const units = [];

  // "ten four" / "ten-four" / "10 4" → 10-4
  text = text.replace(new RegExp(`\\bten[\\s-](${NUM_WORD_RE}(?:[\\s-]${NUM_WORD_RE})?)\\b`, 'gi'), (m, n) => {
    const v = wordsToNumber(n);
    return v == null ? m : `10-${v}`;
  });
  text = text.replace(/\b10[\s.]?(\d{1,3})\b/g, (m, n) => (TEN_CODES[`10-${n}`] ? `10-${n}` : m));

  text = text.replace(/\b10-(\d{1,3})\b/g, (m) => {
    const c = TEN_CODES[m];
    if (!c) return m;
    if (!codes.find((x) => x.code === m)) codes.push({ code: m, ja: c.ja });
    return c.en;
  });

  text = text.replace(/\bcode (two|three|four|2|3|4)\b/gi, (m, n) => {
    const num = { two: 2, three: 3, four: 4 }[n.toLowerCase()] ?? n;
    const key = `code ${num}`;
    const c = PLAIN_CODES[key];
    if (!codes.find((x) => x.code === key)) codes.push({ code: key, ja: c.ja });
    return c.en;
  });

  // 部隊名 "Engine twelve" → "Fire Engine 12"
  text = text.replace(UNIT_RE, (m, type, num) => {
    const n = /^\d+$/.test(num) ? Number(num) : wordsToNumber(num);
    if (n == null) return m;
    const t = UNIT_TYPES.find((u) => u.re.test(type));
    const label = `${type[0].toUpperCase()}${type.slice(1).toLowerCase()} ${n}`;
    if (!units.find((u) => u.label === label)) units.push({ label, ja: `${t.ja}${n}`, kind: t.kind });
    return `${t.en} ${n}`;
  });

  // フォネティックコード（2語以上の連続）→ 文字列 "Adam Boy Charles" → "ABC"
  const words = text.split(' ');
  const out = [];
  for (let i = 0; i < words.length; ) {
    let j = i;
    let letters = '';
    while (j < words.length && PHONETIC.has(words[j].toLowerCase().replace(/[.,]$/, ''))) {
      letters += PHONETIC.get(words[j].toLowerCase().replace(/[.,]$/, ''));
      j++;
    }
    if (j - i >= 2) {
      const trailing = /[.,]$/.test(words[j - 1]) ? words[j - 1].slice(-1) : '';
      out.push(letters + trailing);
      i = j;
    } else {
      out.push(words[i]);
      i++;
    }
  }
  text = out.join(' ');

  text = text
    .replace(/\bE\s?T\s?A\b/g, 'estimated arrival time')
    .replace(/\bBOLO\b/gi, 'be on the lookout for')
    .replace(/\bGOA\b/g, 'gone on arrival')
    .replace(/\bDOA\b/g, 'dead on arrival')
    .replace(/\bMVA\b|\bMVC\b/g, 'motor vehicle accident')
    .replace(/\bEMS\b/g, 'emergency medical services')
    .replace(/\s+/g, ' ')
    .trim();

  return { text, codes, units };
}

const KEYWORDS = {
  fire: ['fire', 'smoke', 'flames', 'alarm', 'hydrant', 'structure', 'engine', 'ladder', 'battalion', 'brush', 'hazmat', 'extinguish', 'evacuat'],
  ems: ['medic', 'ambulance', 'patient', 'chest pain', 'breathing', 'unconscious', 'cardiac', 'overdose', 'injur', 'bleeding', 'als', 'bls', 'priority one', 'hospital', 'stroke', 'fall'],
  police: ['unit', 'suspect', 'traffic stop', 'plate', 'vehicle', 'officer', 'warrant', 'pursuit', 'sedan', 'occupants', 'patrol', 'theft', 'burglary', 'armed', 'license', 'code 4', 'no further assistance', 'sheriff', 'deputy'],
};

/** 交信内容から警察/消防/救急を推定（字幕の色分け用） */
export function classify(text) {
  const t = ` ${text.toLowerCase()} `;
  let best = 'other';
  let bestScore = 0;
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) if (t.includes(w)) score++;
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

// Whisper が雑音から作り出しがちな定型文
const HALLUCINATIONS = [
  /^\s*(thank you|thanks)( for watching| for listening)?[.!]*\s*$/i,
  /^\s*(you|bye|okay|so)[.!]*\s*$/i,
  /^\s*[\[(].*[\])]\s*$/, // [BLANK_AUDIO] (static) [music]
  /^\s*please subscribe.*$/i,
  /^[\s.,!?♪-]*$/,
];

export function isLikelyHallucination(text) {
  return HALLUCINATIONS.some((re) => re.test(text));
}

export function cleanAsrText(text) {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // 音響タグ
    .replace(/♪/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 翻訳後の日本語の後処理 */
export function polishJapanese(ja) {
  return ja
    .replace(/^["「『]|["」』]$/g, '')
    .replace(/\s+([、。])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 認識結果 → 字幕データ。translate は英文を受け取り日本語を返す関数。
 * @param {string} rawEn
 * @param {(en:string)=>Promise<string>} translate
 */
export async function buildCaption(rawEn, translate) {
  const en = cleanAsrText(rawEn || '');
  if (!en || isLikelyHallucination(en)) return null;
  const norm = normalizeRadioText(en);
  const ja = polishJapanese(await translate(norm.text));
  let category = classify(en);
  if (norm.units[0] && (category === 'other' || norm.units.every((u) => u.kind === norm.units[0].kind))) category = norm.units[0].kind;
  return { en, enForMt: norm.text, ja, codes: norm.codes, units: norm.units, category };
}
