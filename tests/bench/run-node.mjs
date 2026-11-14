// 実際のAIモデルで精度を測る（GitHub Actions 上で実行。開発環境からは Hugging Face に接続できないため）。
// デモ音声を交信ごとに区切り、Whisper で認識 → 無線用語の正規化 → 翻訳 → 単語誤り率(WER) を記録する。
import { pipeline } from '@huggingface/transformers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { segmentAll } from '../../src/core/segmenter.js';
import { resample } from '../../src/core/resample.js';
import { buildCaption } from '../../src/core/radio.js';
import { wer, words } from '../../src/core/bench.js';
import { ASR_MODELS, MT_MODELS, revisionOf } from '../../src/core/models.js';
import { readWav } from '../helpers/wav.js';

const root = new URL('../../', import.meta.url);
const expected = JSON.parse(readFileSync(new URL('public/samples/bench/expected.json', root), 'utf8'));
const { rate, samples } = readWav(new URL('tests/fixtures/demo-dispatch.wav', root).pathname);
const segs = segmentAll(resample(samples, rate, 16000));

async function load(task, ids, dtypes) {
  for (const id of ids)
    for (const dtype of dtypes) {
      try {
        return { p: await pipeline(task, id, { dtype, revision: revisionOf(id) }), id, dtype };
      } catch (e) {
        console.warn(`load failed ${id} ${dtype}: ${e.message}`);
      }
    }
  throw new Error(`could not load ${ids}`);
}

const CONFIGS = (process.env.BENCH_CONFIGS || 'standard:lfm2,accurate:lfm2,standard:fugu').split(',').map((c) => c.split(':'));
const report = { date: new Date().toISOString(), commit: process.env.GITHUB_SHA || 'local', segments: segs.length, expected: expected.length, results: [] };

const asrCache = {};
const mtCache = {};
for (const [asrKey, mtKey] of CONFIGS) {
  const a = ASR_MODELS[asrKey];
  const m = MT_MODELS[mtKey];
  asrCache[asrKey] ??= await load('automatic-speech-recognition', [a.id, ...a.fallbacks], ['q8', 'fp32']);
  mtCache[mtKey] ??= await load(m.kind === 'chat' ? 'text-generation' : 'translation', [m.id], m.kind === 'chat' ? ['q4', 'q8'] : ['q8', 'fp32']);
  const asr = asrCache[asrKey].p;
  const mt = mtCache[mtKey].p;
  const translate = async (text) => {
    const max_new_tokens = Math.min(160, 12 + Math.ceil(text.length * 0.7));
    if (m.kind === 'chat') {
      const out = await mt([{ role: 'system', content: 'Translate to Japanese.' }, { role: 'user', content: text }], { max_new_tokens, do_sample: false, repetition_penalty: 1.05 });
      return out[0].generated_text.at(-1).content;
    }
    return (await mt(text, { max_new_tokens }))[0].translation_text;
  };
  const rows = [];
  for (const [i, seg] of segs.entries()) {
    const t0 = performance.now();
    const r = await asr(seg.audio, { chunk_length_s: 30 });
    const t1 = performance.now();
    const cap = await buildCaption(r.text, translate);
    const t2 = performance.now();
    rows.push({ ref: expected[i], en: r.text.trim(), ja: cap?.ja ?? null, wer: Number(wer(expected[i] || '', r.text).toFixed(3)), asrMs: Math.round(t1 - t0), mtMs: Math.round(t2 - t1), sec: Number((seg.end - seg.start).toFixed(1)) });
  }
  const totalRef = rows.reduce((s, r) => s + words(r.ref || '').length, 0);
  const avg = rows.reduce((s, r) => s + r.wer * words(r.ref || '').length, 0) / totalRef;
  const result = { asr: `${asrCache[asrKey].id} (${asrCache[asrKey].dtype})`, mt: `${mtCache[mtKey].id} (${mtCache[mtKey].dtype})`, wer: Number(avg.toFixed(3)), rows };
  report.results.push(result);
  console.log(`\n### ${result.asr} + ${result.mt}  WER=${result.wer}`);
  for (const r of rows) console.log(`- [${r.wer}] ${r.en}\n  → ${r.ja}`);
}

mkdirSync(new URL('docs/benchmarks/', root), { recursive: true });
writeFileSync(new URL('docs/benchmarks/latest.json', root), JSON.stringify(report, null, 2));
let md = `# 実モデル精度測定（自動）\n\n- 日時: ${report.date}\n- コミット: ${report.commit}\n- 音声: デモ交信（検出 ${report.segments} / 正解 ${report.expected} 交信）\n- 実行環境: GitHub Actions（CPU）。ブラウザのGPU実行より遅い\n\n`;
for (const r of report.results) {
  md += `## ${r.asr} + ${r.mt}\n\n単語誤り率（WER）: **${(r.wer * 100).toFixed(1)}%**\n\n| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |\n|---|---|---|---|\n`;
  for (const x of r.rows) md += `| ${(x.wer * 100).toFixed(0)}% | ${x.en.replace(/\|/g, '/')} | ${(x.ja || '（字幕なし）').replace(/\|/g, '/')} | ${x.asrMs}/${x.mtMs} |\n`;
  md += '\n';
}
writeFileSync(new URL('docs/benchmarks/latest.md', root), md);
console.log('\nwrote docs/benchmarks/latest.{json,md}');
