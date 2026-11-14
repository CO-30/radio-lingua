// AIの準備が終わったとき、押しておいた「受信して翻訳」を自動で始めてよいか。
// 準備に時間がかかった場合や、画面を見ていない場合に突然音声が流れないようにする。
export const AUTOSTART_LIMIT_MS = 45000;

export function shouldAutoStart(requestedAt, now, visible) {
  return visible && now - requestedAt <= AUTOSTART_LIMIT_MS;
}
