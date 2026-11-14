// AIエンジン本体（Web Worker）。画面を固めないよう別スレッドで動かす。
// 音声認識: Whisper / 翻訳: LFM2-ENJP-MT または FuguMT（transformers.js + ONNX Runtime Web）

import { pipeline, env, LogitsProcessor } from '@huggingface/transformers';
// AI実行環境（ONNX Runtime）は自サイトから配信する。Vite が同梱するファイルを指定し、二重に配信しない
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import { ASR_MODELS, MT_MODELS, revisionOf } from '../core/models.js';
import { buildCaption } from '../core/radio.js';
import { tokensToWords, stepConfidence, vocabKey } from '../core/confidence.js';

/** デコードの各段で、選ばれた語の確信度を記録する（ロジットは変更しない） */
class ConfidenceRecorder extends LogitsProcessor {
  constructor(keys) {
    super();
    this.steps = [];
    this.keys = keys;
  }
  _call(inputIds, logits) {
    const vocab = logits.dims.at(-1);
    this.steps.push(stepConfidence(logits.data.subarray(0, vocab), this.keys));
    return logits;
  }
}

/** 語彙ごとの比較用キー（大文字小文字・記号の違いを無視）。モデルごとに1回だけ作る */
let vocabKeys = null;
function buildVocabKeys() {
  try {
    const t = asr.tokenizer;
    const size = t.model?.vocab?.length || t._tokenizer?.model?.vocab?.length || t.get_vocab?.().size || 0;
    if (!size) return null;
    const keys = new Array(size);
    for (let i = 0; i < size; i++) keys[i] = vocabKey(asr.tokenizer.decode([i], { skip_special_tokens: true }));
    post({ type: 'log', level: 'info', message: `確信度の比較用語彙: ${size}語` });
    return keys;
  } catch (e) {
    post({ type: 'log', level: 'warn', message: `確信度の比較用語彙を作れませんでした（${e?.message || e}）。表記ゆれの合算なしで続行します` });
    return null;
  }
}

let asr = null;
let mt = null;
let mtKind = null;
let device = 'wasm';
let queue = Promise.resolve();

const post = (msg) => self.postMessage(msg);

let hasF16 = false;
async function detectDevice() {
  try {
    if (self.navigator?.gpu) {
      const adapter = await self.navigator.gpu.requestAdapter();
      if (adapter) {
        hasF16 = adapter.features.has('shader-f16');
        return 'webgpu';
      }
    }
  } catch {}
  return 'wasm';
}

function progressFor(stage) {
  return (p) => {
    if (p.status === 'progress' || p.status === 'progress_total') {
      post({ type: 'progress', stage, file: p.file, loaded: p.loaded, total: p.total, progress: p.progress });
    }
  };
}

// GPUによっては初回の推論（シェーダーの準備）に数分かかったり応答しなくなったりする。
// 準備の段階で一度動かし（ウォームアップ）、時間内に終わらなければCPUに切り替える。
const WARMUP_LIMIT_MS = 30000;
const CALL_LIMIT_MS = 60000;
function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => (t = setTimeout(() => rej(new Error(`${label}が${ms / 1000}秒以内に終わりませんでした`)), ms)))]).finally(() => clearTimeout(t));
}
let asrInfo = null;
let mtInfo = null;

async function ensureCpuAsr(reason) {
  if (asrInfo?.opts?.device === 'wasm') return;
  vocabKeys = null; // 切り替え後に作り直す
  post({ type: 'log', level: 'warn', message: `音声認識をCPUに切り替えます（${reason}）` });
  const r = await loadWithFallback('automatic-speech-recognition', [asrInfo.id], [{ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'fp32' }], 'asr');
  asr = r.p;
  asrInfo = r;
  vocabKeys = buildVocabKeys();
  device = 'wasm';
  post({ type: 'device', device: mtInfo?.opts?.device === 'webgpu' ? 'mixed' : 'wasm' });
}

async function ensureCpuMt(reason) {
  if (mtInfo?.opts?.device === 'wasm') return;
  post({ type: 'log', level: 'warn', message: `翻訳をCPUに切り替えます（${reason}）` });
  const opts = mtKind === 'chat' ? [{ device: 'wasm', dtype: 'q4' }, { device: 'wasm', dtype: 'q8' }] : [{ device: 'wasm', dtype: 'q8' }];
  const r = await loadWithFallback(mtKind === 'chat' ? 'text-generation' : 'translation', [mtInfo.id], opts, 'mt');
  mt = r.p;
  mtInfo = r;
  post({ type: 'device', device: asrInfo?.opts?.device === 'webgpu' ? 'mixed' : 'wasm' });
}

/** 1秒の小さな雑音で認識と翻訳を一度動かす */
async function warmUp() {
  const noise = new Float32Array(16000).map(() => (Math.random() - 0.5) * 0.002);
  post({ type: 'progress', stage: 'warmup', message: 'AIの初回準備（最適化）をしています' });
  try {
    await withTimeout(asr(noise), WARMUP_LIMIT_MS, '音声認識の準備');
  } catch (e) {
    await ensureCpuAsr(e.message);
    await asr(noise);
  }
  try {
    await withTimeout(translate('Roger.'), WARMUP_LIMIT_MS, '翻訳の準備');
  } catch (e) {
    await ensureCpuMt(e.message);
    await translate('Roger.');
  }
}

async function loadWithFallback(task, ids, optsList, stage) {
  let lastErr;
  for (const id of ids) {
    for (const opts of optsList) {
      try {
        const p = await pipeline(task, id, { ...opts, revision: revisionOf(id), progress_callback: progressFor(stage) });
        return { p, id, opts };
      } catch (e) {
        lastErr = e;
        post({ type: 'log', level: 'warn', message: `${stage}: ${id} ${JSON.stringify(opts)} を読み込めませんでした: ${e?.message || e}` });
      }
    }
  }
  throw lastErr;
}

async function load({ asrKey, mtKey, forceWasm }) {
  env.backends.onnx.wasm.wasmPaths = {
    mjs: new URL(ortMjsUrl, self.location.href).href,
    wasm: new URL(ortWasmUrl, self.location.href).href,
  };
  device = forceWasm ? 'wasm' : await detectDevice();
  post({ type: 'device', device });

  const a = ASR_MODELS[asrKey];
  const asrOpts =
    device === 'webgpu'
      ? [
          // fp16 が使えるGPUでは容量が半分で精度は同等（実測で同一の認識結果）
          ...(hasF16 && asrKey === 'accurate' ? [{ device: 'webgpu', dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' } }] : []),
          { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } },
          { device: 'wasm', dtype: 'q8' },
        ]
      : [{ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'fp32' }];
  const r1 = await loadWithFallback('automatic-speech-recognition', [a.id, ...a.fallbacks], asrOpts, 'asr');
  asr = r1.p;
  asrInfo = r1;

  const m = MT_MODELS[mtKey];
  mtKind = m.kind;
  const mtOpts =
    m.kind === 'chat'
      ? device === 'webgpu'
        ? [{ device: 'webgpu', dtype: 'q4f16' }, { device: 'webgpu', dtype: 'q4' }, { device: 'wasm', dtype: 'q4' }]
        : [{ device: 'wasm', dtype: 'q4' }, { device: 'wasm', dtype: 'q8' }]
      : [{ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'fp32' }];
  const r2 = await loadWithFallback(m.kind === 'chat' ? 'text-generation' : 'translation', [m.id], mtOpts, 'mt');
  mt = r2.p;
  mtInfo = r2;

  await warmUp();
  vocabKeys = buildVocabKeys();
  const devs = new Set([asrInfo.opts.device, mtInfo.opts.device]);
  post({ type: 'ready', device: devs.size > 1 ? 'mixed' : [...devs][0], asr: { id: asrInfo.id, ...asrInfo.opts }, mt: { id: mtInfo.id, ...mtInfo.opts } });
}

/** 翻訳（GPUが応答しなければCPUに切り替えてやり直す） */
async function translateSafe(text) {
  try {
    return await withTimeout(translate(text), CALL_LIMIT_MS, '翻訳');
  } catch (e) {
    if (mtInfo?.opts?.device !== 'webgpu') throw e;
    await ensureCpuMt(e.message);
    return translate(text);
  }
}

async function translate(text) {
  if (mtKind === 'chat') {
    const out = await mt(
      [
        { role: 'system', content: 'Translate to Japanese.' },
        { role: 'user', content: text },
      ],
      // 入力に比例した上限で、小型モデルの「続きを書き足す」暴走を防ぐ
      { max_new_tokens: Math.min(160, 12 + Math.ceil(text.length * 0.7)), do_sample: false, repetition_penalty: 1.05 },
    );
    const g = out[0].generated_text;
    return Array.isArray(g) ? g.at(-1).content : String(g);
  }
  const out = await mt(text, { max_new_tokens: Math.min(160, 12 + Math.ceil(text.length * 0.7)) });
  return out[0].translation_text;
}

async function processAudio(id, audio) {
  const t0 = performance.now();
  let rec = new ConfidenceRecorder(vocabKeys);
  let r;
  try {
    r = await withTimeout(asr(audio, { return_timestamps: false, chunk_length_s: 30, logits_processor: [rec] }), CALL_LIMIT_MS, '音声認識');
  } catch (e) {
    if (asrInfo?.opts?.device !== 'webgpu') throw e;
    // GPUが応答しない場合はCPUで同じ交信をやり直す
    await ensureCpuAsr(e.message);
    rec = new ConfidenceRecorder(vocabKeys);
    r = await asr(audio, { return_timestamps: false, chunk_length_s: 30, logits_processor: [rec] });
  }
  const t1 = performance.now();
  let words = [];
  try {
    words = tokensToWords(rec.steps.map((st) => ({ t: asr.tokenizer.decode([st.id], { skip_special_tokens: true }), p: st.p })));
  } catch {}
  const cap = await buildCaption(r.text, translateSafe);
  const t2 = performance.now();
  if (cap) cap.words = words;
  post({ type: 'result', id, caption: cap, rawEn: r.text, ms: { asr: Math.round(t1 - t0), mt: Math.round(t2 - t1) } });
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'load') {
    load(msg).catch((e) => post({ type: 'error', stage: 'load', message: String(e?.message || e) }));
    return;
  }
  if (msg.type === 'process') {
    // 順番に処理（交信の時系列を崩さない）
    queue = queue
      .then(() => processAudio(msg.id, msg.audio))
      .catch((e) => post({ type: 'error', stage: 'process', id: msg.id, message: String(e?.message || e) }));
    return;
  }
  if (msg.type === 'translate') {
    queue = queue
      .then(async () => {
        const t0 = performance.now();
        const cap = await buildCaption(msg.text, translateSafe);
        post({ type: 'result', id: msg.id, caption: cap, rawEn: msg.text, ms: { asr: 0, mt: Math.round(performance.now() - t0) } });
      })
      .catch((e) => post({ type: 'error', stage: 'process', id: msg.id, message: String(e?.message || e) }));
  }
};
