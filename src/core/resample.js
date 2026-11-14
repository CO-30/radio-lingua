// ブラウザの音声（44.1k/48kHz）を Whisper 用の 16kHz モノラルに変換する。
// ストリーミング用に端数の位置を保持する。区間平均でエイリアシングを抑える。

export class StreamResampler {
  constructor(inRate, outRate = 16000) {
    if (!(inRate > 0) || !(outRate > 0)) throw new Error('sample rate must be positive');
    this.inRate = inRate;
    this.outRate = outRate;
    this.ratio = inRate / outRate;
    this.pos = 0; // 次の出力サンプルの入力上の位置（先頭からの通算）
    this.consumed = 0; // これまでに受け取った入力サンプル数
    this.tail = new Float32Array(0);
  }

  push(input) {
    if (this.ratio === 1) return input.slice();
    const buf = new Float32Array(this.tail.length + input.length);
    buf.set(this.tail, 0);
    buf.set(input, this.tail.length);
    const base = this.consumed - this.tail.length; // buf[0] の通算位置
    const out = [];
    while (true) {
      const startAbs = this.pos;
      const endAbs = this.pos + this.ratio;
      const s = startAbs - base;
      const e = endAbs - base;
      if (Math.ceil(e) > buf.length) break;
      let sum = 0;
      let n = 0;
      if (this.ratio > 1) {
        for (let i = Math.floor(s); i < Math.ceil(e); i++) {
          sum += buf[i];
          n++;
        }
        out.push(sum / n);
      } else {
        // アップサンプル：線形補間
        const i = Math.floor(s);
        const frac = s - i;
        const a = buf[i];
        const b = i + 1 < buf.length ? buf[i + 1] : a;
        out.push(a + (b - a) * frac);
      }
      this.pos = endAbs;
    }
    this.consumed += input.length;
    const keepFrom = Math.max(0, Math.floor(this.pos - base));
    this.tail = buf.slice(keepFrom);
    return Float32Array.from(out);
  }
}

export function resample(input, inRate, outRate = 16000) {
  return new StreamResampler(inRate, outRate).push(input);
}

/** 複数チャンネルを平均してモノラル化 */
export function downmix(channels) {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}
