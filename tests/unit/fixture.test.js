import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { segmentAll } from '../../src/core/segmenter.js';
import { resample } from '../../src/core/resample.js';

// 16bit PCM WAV を読む（テスト用の最小実装）
function readWav(path) {
  const b = readFileSync(path);
  let off = 12;
  let fmt = null;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') {
      const n = size / 2 / fmt.channels;
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * 2 * fmt.channels) / 32768;
      return { rate: fmt.rate, samples: out };
    }
    off += 8 + size;
  }
  throw new Error('no data chunk');
}

describe('デモ交信の区切り', () => {
  it('6つの交信に分かれる', () => {
    const { rate, samples } = readWav(new URL('../fixtures/demo-dispatch.wav', import.meta.url).pathname);
    const segs = segmentAll(resample(samples, rate, 16000));
    const lines = JSON.parse(readFileSync(new URL('../fixtures/demo-dispatch.lines.json', import.meta.url), 'utf8'));
    expect(segs.length).toBe(lines.length);
    for (const s of segs) expect(s.end - s.start).toBeGreaterThan(1);
  });
});
