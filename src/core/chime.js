// 通知音：短い2音（高め→さらに高め）。音源ファイルを使わず端末で鳴らす。
let ctx = null;

export function playChime(volume = 0.16) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!ctx || ctx.state === 'closed') ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [
      [880, 0],
      [1175, 0.16],
    ].forEach(([freq, at]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(volume, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.14);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + 0.16);
    });
    return true;
  } catch {
    return false;
  }
}
