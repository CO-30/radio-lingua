// キーワード通知：登録した語を含む交信が届いたら知らせる。
// 英語は単語の先頭から一致（"evacuat" で evacuate / evacuation に一致）、日本語は訳文に含まれていれば一致。

export const SUGGESTED_ALERTS = ['structure fire', 'shots fired', 'officer down', 'pursuit', 'mass casualty', 'hazmat', 'evacuat', '火災', '発砲', '救助'];

/** 入力を登録用に整える。使えない語は null */
export function normalizeKeyword(raw) {
  const k = String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (k.length < 2 || k.length > 40) return null;
  return k;
}

/** 一覧に追加（重複・不正は無視）。新しい配列を返す */
export function addKeyword(list, raw) {
  const k = normalizeKeyword(raw);
  if (!k || list.includes(k) || list.length >= 30) return list;
  return [...list, k];
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function asciiMatcher(k) {
  // 語の途中からは一致させない（"fire" が "campfire" に一致しない）。語尾は自由（"evacuat"→evacuation）
  return new RegExp(`(^|[^a-z0-9])${escapeRe(k).replace(/ /g, '[\\s-]+')}`, 'i');
}

/**
 * 交信が一致したキーワードを返す（登録順）。
 * @param {{en?: string, enForMt?: string, ja?: string}} item
 * @param {string[]} keywords
 */
export function matchAlerts(item, keywords) {
  if (!keywords?.length || !item) return [];
  const en = `${item.en || ''} ${item.enForMt || ''}`.toLowerCase();
  const ja = String(item.ja || '').normalize('NFKC');
  return keywords.filter((k) => (/^[\x00-\x7f]+$/.test(k) ? asciiMatcher(k).test(en) : ja.includes(k)));
}
