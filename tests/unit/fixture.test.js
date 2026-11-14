import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { segmentAll } from '../../src/core/segmenter.js';
import { resample } from '../../src/core/resample.js';
import { readWav } from '../helpers/wav.js';

describe('デモ交信の区切り', () => {
  it('6つの交信に分かれる', () => {
    const { rate, samples } = readWav(new URL('../fixtures/demo-dispatch.wav', import.meta.url).pathname);
    const segs = segmentAll(resample(samples, rate, 16000));
    const lines = JSON.parse(readFileSync(new URL('../fixtures/demo-dispatch.lines.json', import.meta.url), 'utf8'));
    expect(segs.length).toBe(lines.length);
    for (const s of segs) expect(s.end - s.start).toBeGreaterThan(1);
  });
});
