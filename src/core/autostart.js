// AIの準備が終わったとき、押しておいた「受信して翻訳」を自動で始めてよいか。
// 準備に時間がかかった場合や、画面を見ていない場合に突然音声が流れないようにする。
export const AUTOSTART_LIMIT_MS = 45000;

export function shouldAutoStart(requestedAt, now, visible, canAutoplay = true) {
  return canAutoplay && visible && now - requestedAt <= AUTOSTART_LIMIT_MS;
}

/** iPhone・iPad は、押した操作の外では音を鳴らせない（自動で始めると無音になる） */
export function canAutoplayAudio(nav = globalThis.navigator) {
  const ua = nav?.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints || 0) > 1);
  return !ios;
}
