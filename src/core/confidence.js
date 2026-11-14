// Whisper の確信度から「聞き取りが不確かな語」を求める。
// 推測ではなく、デコード時にモデル自身が出した確率（0〜1）を使う。

export const UNCERTAIN_BELOW = 0.5;

/**
 * トークン片（先頭が空白なら新しい語）を語にまとめる。語の確信度は含まれる片の最小値。
 * @param {{t:string, p:number}[]} tokens
 * @returns {{w:string, p:number}[]}
 */
export function tokensToWords(tokens) {
  const words = [];
  for (const { t, p } of tokens) {
    if (!t) continue;
    const startsWord = /^\s/.test(t) || !words.length;
    const piece = t.replace(/^\s+/, '');
    if (!piece) continue;
    if (startsWord) words.push({ w: piece, p });
    else {
      const last = words[words.length - 1];
      last.w += piece;
      last.p = Math.min(last.p, p);
    }
  }
  return words.map((x) => ({ w: x.w, p: Math.round(x.p * 1000) / 1000 }));
}

/** 表示用：不確かな語（記号だけの語は除く）の一覧 */
export function uncertainWords(words, threshold = UNCERTAIN_BELOW) {
  return words.filter((x) => x.p < threshold && /[A-Za-z0-9]/.test(x.w)).map((x) => x.w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''));
}

/**
 * 原文を表示用の断片に分ける。不確かな語は { uncertain: true }。
 * words が無い（モック等）場合は全体を1つの確かな断片として返す。
 * @param {string} text
 * @param {{w: string, p: number}[]} words
 * @param {number} [threshold]
 * @returns {TextPart[]}
 */
export function markText(text, words, threshold = UNCERTAIN_BELOW) {
  if (!words?.length) return [{ text, uncertain: false }];
  /** @type {TextPart[]} */
  const out = [];
  let pos = 0;
  for (const { w, p } of words) {
    const at = text.indexOf(w, pos);
    if (at < 0) continue;
    if (at > pos) out.push({ text: text.slice(pos, at), uncertain: false });
    out.push({ text: w, uncertain: p < threshold && /[A-Za-z0-9]/.test(w), p });
    pos = at + w.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), uncertain: false });
  // 隣り合う確かな断片をまとめる
  return out.reduce((/** @type {TextPart[]} */ acc, s) => {
    const last = acc[acc.length - 1];
    if (last && !last.uncertain && !s.uncertain) last.text += s.text;
    else acc.push({ ...s });
    return acc;
  }, []);
}
