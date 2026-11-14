// 米国の警察・消防・救急無線に特有の言い回しを、翻訳しやすい英語に直す。
// 10コードは機関ごとに意味が違うことがあるため、APCOの一般的な意味を使い、
// 字幕には「元のコード」も残して利用者が確認できるようにする。

/** @type {Record<string, {en:string, ja:string}>} */
export const TEN_CODES = {
  '10-1': { en: 'poor reception', ja: '受信不良' },
  '10-2': { en: 'good reception', ja: '受信良好' },
  '10-3': { en: 'stop transmitting', ja: '送信中止' },
  '10-4': { en: 'Roger', ja: '了解' },
  '10-6': { en: 'busy', ja: '対応中' },
  '10-7': { en: 'out of service', ja: '業務外' },
  '10-8': { en: 'in service', ja: '業務復帰' },
  '10-9': { en: 'please repeat', ja: '再送願う' },
  '10-10': { en: 'negative', ja: '否定' },
  '10-19': { en: 'returning to station', ja: '帰署中' },
  '10-20': { en: 'location', ja: '現在地' },
  '10-22': { en: 'disregard', ja: '取り消し' },
  '10-23': { en: 'on scene', ja: '現着' },
  '10-28': { en: 'vehicle registration check', ja: '車両照会' },
  '10-29': { en: 'records check', ja: '記録照会' },
  '10-33': { en: 'emergency traffic', ja: '緊急通信' },
  '10-50': { en: 'traffic accident', ja: '交通事故' },
  '10-76': { en: 'en route', ja: '出動中' },
  '10-97': { en: 'on scene', ja: '現着' },
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
const UNIT_RE = new RegExp(`(?<!Fire |Ladder |Patrol )\\b(Engine|Ladder|Truck|Battalion|Rescue|Squad|Medic|Ambulance|Unit|Car)\\s+(\\d{1,4}|${NUM_WORD_RE}(?:[\\s-]${NUM_WORD_RE})?)\\b`, 'gi');

/**
 * 翻訳前の英文を整える。
 * @returns {{text:string, codes:{code:string, ja:string}[], units:{label:string, ja:string, kind:string}[]}}
 */
export function normalizeRadioText(input) {
  let text = ` ${input} `.replace(/\s+/g, ' ');
  // Whisper がよく聞き違える無線用語
  text = text.replace(/\b(and|in|on) route\b/gi, 'en route').replace(/\bcopies and route\b/gi, 'copies en route');
  const codes = [];
  const units = [];

  // "ten four" / "ten-four" / "10 4" → 10-4
  text = text.replace(new RegExp(`\\bten[\\s-](${NUM_WORD_RE}(?:[\\s-]${NUM_WORD_RE})?)\\b`, 'gi'), (m, n) => {
    const v = wordsToNumber(n);
    return v == null ? m : `10-${v}`;
  });
  text = text.replace(/\b10[\s.]?(\d{1,3})\b/g, (m, n) => (TEN_CODES[`10-${n}`] ? `10-${n}` : m));

  text = text.replace(/\b10-(\d{1,3})\b(-|\s+(?=\d))?/g, (m, n, dash) => {
    const code = `10-${n}`;
    const c = TEN_CODES[code];
    if (!c) return m;
    if (!codes.find((x) => x.code === code)) codes.push({ code, ja: c.ja });
    // "10-4-23 is on scene" のように呼出符号と続く場合は文を区切る
    return dash ? `${c.en}. ` : c.en;
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
    if (!units.find((u) => u.label === label)) units.push({ label, en: `${t.en} ${n}`, ja: `${t.ja}${n}`, kind: t.kind });
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
  // 小型翻訳モデルは「2 occupants」のような数字+複数名詞を崩しやすいので、1桁の数は英単語にする（two occupants は正しく訳せる）
  const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  text = text.replace(/(\b[A-Za-z]+\s+)?\b([1-9])\s+([a-z]{3,}s)\b/g, (m, prev, d, noun) => {
    // 部隊番号・道路番号（Engine 5 crews / Highway 9 ...）は数字のまま
    if (prev && /^(Engine|Truck|Chief|Rescue|Squad|Ambulance|Unit|Car|Highway|Route|Interstate|Channel|Station|Medic|Ladder)\s+$/i.test(prev)) return m;
    return `${prev || ''}${DIGIT_WORDS[d]} ${noun}`;
  });
  // コード展開と本人の言い直しが重なった重複（"no further assistance needed, No further assistance needed"）を除く
  text = text.replace(/\b([a-z][\w ]{8,}?)([,.]?)\s+\1\b/gi, '$1');

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

/** 無線の定型句。機械翻訳に任せると不自然になりやすいので辞書で訳す（キーは小文字・句読点なし） */
export const PHRASES = {
  roger: '了解',
  copy: '了解',
  copies: '了解',
  'copy that': '了解',
  acknowledged: '了解',
  'en route': '現場へ向かう',
  'responding': '出動する',
  'on scene': '現着',
  'is on scene': '現着',
  'no further assistance needed': '応援不要',
  'stand by': '待機せよ',
  'standing by': '待機中',
  'go ahead': 'どうぞ',
  affirmative: '肯定',
  negative: '否定',
  'say again': 'もう一度どうぞ',
  'please repeat': 'もう一度どうぞ',
  disregard: '取り消し',
  'in service': '業務に復帰',
  'out of service': '業務外',
  'priority one call': '最優先の出動要請',
  'priority one': '最優先',
  'priority 1 call': '最優先の出動要請',
  'priority 1': '最優先',
  'highest priority call': '最優先の出動要請',
  'returning to station': '帰署する',
  'assignment completed': '任務完了',
};

const phraseKey = (s) => s.toLowerCase().replace(/[.,!?;:]+/g, '').replace(/\s+/g, ' ').trim();

/** 文に分ける（略語の後のピリオドでは分けない） */
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Za-z0-9])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 直前と同じ文（言い直しや code 4 展開の重複）を除く */
export function dedupeSentences(sentences) {
  const out = [];
  for (const s of sentences) if (!out.length || phraseKey(out.at(-1)) !== phraseKey(s)) out.push(s);
  return out;
}

/** 小型翻訳モデルが誤訳しやすい無線・消防用語の補正 */
export const JA_FIXES = [
  [/構造物の火災|構造火災|建造物の火災/g, '建物火災'],
  [/クロス・?ストリート/g, '交差道路'],
  [/メディック/g, '救急隊'],
  [/交通検問所|停止信号/g, '交通停止'],
  [/ロジャー/g, '了解'],
];

export function fixTerms(ja) {
  return JA_FIXES.reduce((t, [re, to]) => t.replace(re, to), ja);
}

/** 翻訳後の日本語の後処理 */
export function polishJapanese(ja) {
  let t = ja
    .replace(/^[\s\-・*「『"]+|[」』"]+$/g, '')
    .replace(/\s+([、。])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/[“”"]/g, '')
    .trim();
  t = fixTerms(t);
  // 小型モデルの言い直し・繰り返し（「40マイル標識付近の40マイル標識付近」）を1回にまとめる
  // 例: 「40マイル地点付近の40マイル地点近くの」→「40マイル地点近くの」（6文字以上の語句が4文字以内で再登場したら後側を残す）
  for (let i = 0; i < 3; i++) t = t.replace(/(.{6,}?)(?:.{0,4}?)\1/g, '$1');
  return t;
}

function endSentence(ja) {
  return /[。！？!?」]$/.test(ja) ? ja : `${ja}。`;
}

const MAX_PHRASE_WORDS = Math.max(...Object.keys(PHRASES).map((k) => k.split(' ').length));

/** 文全体が定型句の並びだけで書けるなら、その訳を「、」でつないで返す（"copies en route" → 了解、現場へ向かう） */
export function tilePhrases(text) {
  const w = phraseKey(text).split(' ').filter(Boolean);
  if (!w.length) return null;
  const best = Array(w.length + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < w.length; i++) {
    if (!best[i]) continue;
    for (let n = Math.min(MAX_PHRASE_WORDS, w.length - i); n >= 1; n--) {
      const ja = PHRASES[w.slice(i, i + n).join(' ')];
      if (ja && (!best[i + n] || best[i + n].length > best[i].length + 1)) best[i + n] = [...best[i], ja];
    }
  }
  return best[w.length] ? best[w.length].join('、') : null;
}

/** 1文を訳す。定型句は辞書、長い文は読点で区切って小分けに機械翻訳する（小型モデルの暴走防止） */
async function translateClause(rest, translate) {
  const key = phraseKey(rest);
  if (!key) return '';
  if (PHRASES[key]) return PHRASES[key];
  const tiled = tilePhrases(rest);
  if (tiled) return tiled;
  const clauses = rest.split(/,\s+/).filter((c) => phraseKey(c));
  const anyPhrase = clauses.some((c) => tilePhrases(c));
  if (clauses.length > 1 && (anyPhrase || rest.length > 60)) {
    const out = [];
    let buf = [];
    const flush = async () => {
      if (buf.length) out.push(polishJapanese(await translate(buf.join(', '))).replace(/。$/, ''));
      buf = [];
    };
    for (const c of clauses) {
      const t = tilePhrases(c);
      if (t) {
        await flush();
        out.push(t);
      } else {
        buf.push(c);
        if (buf.join(', ').length > 40) await flush();
      }
    }
    await flush();
    return out.filter(Boolean).join('、');
  }
  return polishJapanese(await translate(rest));
}

/**
 * 正規化済みの英文を、文ごとに「辞書 → 呼出符号 → 機械翻訳」の順で訳す。
 * @param {string} text
 * @param {{en:string, ja:string}[]} units
 * @param {(en:string)=>Promise<string>} translate
 */
export async function translateRadio(text, units, translate) {
  const parts = [];
  for (const sentence of dedupeSentences(splitSentences(text))) {
    let rest = sentence;
    let prefix = '';
    const unit = units.find((u) => u.en && rest.toLowerCase().startsWith(u.en.toLowerCase()) && /^[\s,.]|^$/.test(rest.slice(u.en.length)));
    if (unit) {
      prefix = unit.ja;
      rest = rest.slice(unit.en.length).replace(/^[\s,]+/, '');
    } else {
      // "23 is on scene" のような番号だけの呼出符号（残りが定型句のときだけ）
      const m = rest.match(/^(\d{1,4})[\s,]+(.+)$/);
      if (m && tilePhrases(m[2])) {
        prefix = m[1];
        rest = m[2];
      }
    }
    const key = phraseKey(rest);
    const ja = await translateClause(rest, translate);
    if (prefix && ja) parts.push(endSentence(`${prefix}、${ja}`));
    else if (prefix) parts.push(endSentence(prefix));
    else if (ja) parts.push(endSentence(ja));
  }
  return parts.join('');
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
  const ja = await translateRadio(norm.text, norm.units, translate);
  if (!ja) return null;
  let category = classify(en);
  if (norm.units[0] && (category === 'other' || norm.units.every((u) => u.kind === norm.units[0].kind))) category = norm.units[0].kind;
  return { en, enForMt: norm.text, ja, codes: norm.codes, units: norm.units.map(({ en: _e, ...u }) => u), category };
}
