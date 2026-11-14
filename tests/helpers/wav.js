import { readFileSync } from 'node:fs';

/** 16bit PCM WAV を読む（テスト用の最小実装）。モノラル化して返す */
export function readWav(path) {
  const b = readFileSync(path);
  let off = 12;
  let fmt = null;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') {
      if (fmt.bits !== 16) throw new Error('16bit PCM のみ対応');
      const n = Math.floor(size / 2 / fmt.channels);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let v = 0;
        for (let c = 0; c < fmt.channels; c++) v += b.readInt16LE(off + 8 + (i * fmt.channels + c) * 2);
        out[i] = v / fmt.channels / 32768;
      }
      return { rate: fmt.rate, samples: out };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}
