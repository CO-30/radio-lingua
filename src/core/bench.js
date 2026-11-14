// 実モデルの精度測定ツール。正解文と認識結果から単語誤り率（WER）を出す。
// 使い方（ブラウザのコンソール）: await __rl.bench('samples/demo-dispatch.mp3', [...正解文])

import { segmentAll } from './segmenter.js';
import { resample, downmix } from './resample.js';

export function words(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** 単語誤り率（置換・削除・挿入の合計 ÷ 正解の単語数） */
export function wer(ref, hyp) {
  const r = words(ref);
  const h = words(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return r.length ? d[r.length][h.length] / r.length : h.length ? 1 : 0;
}

export async function decodeTo16k(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, 1, 44100);
  const audio = await ctx.decodeAudioData(buf);
  const chans = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  return resample(downmix(chans), audio.sampleRate, 16000);
}

/** engine: WorkerEngine。音声を区切って順に認識・翻訳し、正解と比べる */
export async function runBench(engine, url, expected = []) {
  const samples = await decodeTo16k(url);
  const segs = segmentAll(samples);
  const rows = [];
  for (const [i, seg] of segs.entries()) {
    const detail = await new Promise((res) => {
      const id = engine.process(seg.audio.slice(), {});
      const h = (ev) => {
        if (ev.detail.id === id) {
          engine.removeEventListener('result', h);
          engine.removeEventListener('error', h);
          res(ev.detail);
        }
      };
      engine.addEventListener('result', h);
      engine.addEventListener('error', h);
    });
    const ref = expected[i] || '';
    rows.push({ ref, en: detail.rawEn?.trim(), ja: detail.caption?.ja, wer: ref ? Number(wer(ref, detail.rawEn || '').toFixed(3)) : null, ms: detail.ms, sec: Number((seg.end - seg.start).toFixed(1)) });
  }
  const scored = rows.filter((r) => r.wer != null);
  const totalRef = scored.reduce((s, r) => s + words(r.ref).length, 0);
  const avgWer = totalRef ? scored.reduce((s, r) => s + r.wer * words(r.ref).length, 0) / totalRef : null;
  return { segments: segs.length, expected: expected.length, wer: avgWer && Number(avgWer.toFixed(3)), rows };
}
