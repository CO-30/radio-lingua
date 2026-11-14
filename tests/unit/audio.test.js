import { describe, it, expect } from 'vitest';
import { segmentAll, StreamingSegmenter } from '../../src/core/segmenter.js';
import { resample, StreamResampler, downmix } from '../../src/core/resample.js';

const SR = 16000;
function tone(sec, amp = 0.3, freq = 440) {
  const a = new Float32Array(Math.round(sec * SR));
  for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return a;
}
function noise(sec, amp = 0.002) {
  const a = new Float32Array(Math.round(sec * SR));
  let x = 1;
  for (let i = 0; i < a.length; i++) {
    x = (x * 16807) % 2147483647;
    a[i] = amp * ((x / 2147483647) * 2 - 1);
  }
  return a;
}
function concat(...parts) {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe('StreamingSegmenter', () => {
  it('無音で区切られた3つの交信を3つの区間に分ける', () => {
    const audio = concat(noise(0.5), tone(1.2), noise(1.0), tone(2.0), noise(1.0), tone(0.8), noise(1.0));
    const segs = segmentAll(audio);
    expect(segs.length).toBe(3);
    expect(segs[0].start).toBeGreaterThan(0.2);
    expect(segs[0].start).toBeLessThan(0.55);
    expect(segs[1].end - segs[1].start).toBeGreaterThan(1.9);
    expect(segs[1].end - segs[1].start).toBeLessThan(2.6);
  });

  it('短い雑音（クリック音）は捨てる', () => {
    const audio = concat(noise(0.5), tone(0.09), noise(1.5));
    expect(segmentAll(audio).length).toBe(0);
  });

  it('長い交信は上限で分割する', () => {
    const segs = segmentAll(concat(tone(25), noise(1)), { maxSegmentMs: 10000 });
    expect(segs.length).toBe(3);
  });

  it('小分けにpushしても一括と同じ結果になる', () => {
    const audio = concat(noise(0.4), tone(1.0), noise(1.0), tone(1.0), noise(1.0));
    const a = segmentAll(audio);
    const b = [];
    const s = new StreamingSegmenter({ onSegment: (x) => b.push(x) });
    for (let i = 0; i < audio.length; i += 1234) s.push(audio.subarray(i, i + 1234));
    s.flush();
    expect(b.map((x) => x.audio.length)).toEqual(a.map((x) => x.audio.length));
  });

  it('入力終了時に話し途中の区間も確定する', () => {
    const segs = segmentAll(concat(noise(0.3), tone(1.0)));
    expect(segs.length).toBe(1);
  });
});

describe('resample', () => {
  it('48kHz→16kHzでサンプル数が1/3になる', () => {
    const out = resample(new Float32Array(48000).fill(0.5), 48000, 16000);
    expect(out.length).toBe(16000);
    expect(out[100]).toBeCloseTo(0.5, 5);
  });
  it('44.1kHzを分割pushしても長さが一致する', () => {
    const input = new Float32Array(44100 * 2).map((_, i) => Math.sin(i / 10));
    const whole = resample(input, 44100);
    const r = new StreamResampler(44100);
    const parts = [];
    for (let i = 0; i < input.length; i += 999) parts.push(r.push(input.subarray(i, i + 999)));
    const total = parts.reduce((s, p) => s + p.length, 0);
    expect(Math.abs(total - whole.length)).toBeLessThanOrEqual(1);
    expect(Math.abs(total - 32000)).toBeLessThanOrEqual(1);
  });
  it('ステレオを平均する', () => {
    const m = downmix([Float32Array.from([1, 0]), Float32Array.from([0, 0])]);
    expect(Array.from(m)).toEqual([0.5, 0]);
  });
});
