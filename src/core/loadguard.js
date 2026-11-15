// AIの読み込み中に画面が落ちた（iPhone のメモリ不足で再読み込みされた）ことを見分ける。
// 読み込み開始時に印を付け、終わったら消す。次に開いたとき印が残っていれば、途中で落ちたと判断する。
// タブを閉じれば消える sessionStorage を使い、利用者が自分で閉じた場合と区別する。
const KEY = 'radiolingua.loadGuard';
const FRESH_MS = 15 * 60 * 1000;

export function markLoading(kind, info = {}, store = globalThis.sessionStorage) {
  try {
    const cur = JSON.parse(store.getItem(KEY) || '{}');
    cur[kind] = { ...info, at: Date.now() };
    store.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* 保存できない環境 */
  }
}

export function clearLoading(kind, store = globalThis.sessionStorage) {
  try {
    const cur = JSON.parse(store.getItem(KEY) || '{}');
    delete cur[kind];
    store.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* 保存できない環境 */
  }
}

/** 前回、読み込み中に落ちたもの（{ engine?, voice? }）。読んだら消す */
export function takeCrashed(store = globalThis.sessionStorage, now = Date.now()) {
  try {
    const cur = JSON.parse(store.getItem(KEY) || '{}');
    store.removeItem(KEY);
    const out = {};
    for (const [k, v] of Object.entries(cur)) if (v && now - v.at < FRESH_MS) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** 落ちたときの軽い構成。翻訳を軽く → 音声認識を軽く → GPUを使わない、の順で下げる */
export function lighterConfig(s) {
  if (s.mt !== 'fugu') return { mt: 'fugu' };
  if (s.asr !== 'light') return { asr: 'light' };
  if (!s.forceWasm) return { forceWasm: true };
  return null;
}
