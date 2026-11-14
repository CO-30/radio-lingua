// AIエンジン本体（Web Worker）。画面を固めないよう別スレッドで動かす。
// 音声認識: Whisper / 翻訳: LFM2-ENJP-MT または FuguMT（transformers.js + ONNX Runtime Web）

import { pipeline, env } from '@huggingface/transformers';
import { ASR_MODELS, MT_MODELS } from '../core/models.js';
import { buildCaption } from '../core/radio.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

let asr = null;
let mt = null;
let mtKind = null;
let device = 'wasm';
let queue = Promise.resolve();

const post = (msg) => self.postMessage(msg);

async function detectDevice() {
  try {
    if (self.navigator?.gpu) {
      const adapter = await self.navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
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

async function loadWithFallback(task, ids, optsList, stage) {
  let lastErr;
  for (const id of ids) {
    for (const opts of optsList) {
      try {
        const p = await pipeline(task, id, { ...opts, progress_callback: progressFor(stage) });
        return { p, id, opts };
      } catch (e) {
        lastErr = e;
        post({ type: 'log', level: 'warn', message: `${stage}: ${id} ${JSON.stringify(opts)} を読み込めませんでした: ${e?.message || e}` });
      }
    }
  }
  throw lastErr;
}

async function load({ asrKey, mtKey, baseUrl, forceWasm }) {
  env.backends.onnx.wasm.wasmPaths = {
    mjs: `${baseUrl}ort/ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${baseUrl}ort/ort-wasm-simd-threaded.asyncify.wasm`,
  };
  device = forceWasm ? 'wasm' : await detectDevice();
  post({ type: 'device', device });

  const a = ASR_MODELS[asrKey];
  const asrOpts =
    device === 'webgpu'
      ? [{ device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' } }, { device: 'wasm', dtype: 'q8' }]
      : [{ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'fp32' }];
  const r1 = await loadWithFallback('automatic-speech-recognition', [a.id, ...a.fallbacks], asrOpts, 'asr');
  asr = r1.p;

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

  post({ type: 'ready', device, asr: { id: r1.id, ...r1.opts }, mt: { id: r2.id, ...r2.opts } });
}

async function translate(text) {
  if (mtKind === 'chat') {
    const out = await mt(
      [
        { role: 'system', content: 'Translate to Japanese.' },
        { role: 'user', content: text },
      ],
      // 入力に比例した上限で、小型モデルの「続きを書き足す」暴走を防ぐ
      { max_new_tokens: Math.min(200, 16 + Math.ceil(text.length * 0.9)), do_sample: false, repetition_penalty: 1.05 },
    );
    const g = out[0].generated_text;
    return Array.isArray(g) ? g.at(-1).content : String(g);
  }
  const out = await mt(text, { max_new_tokens: Math.min(200, 16 + Math.ceil(text.length * 0.9)) });
  return out[0].translation_text;
}

async function processAudio(id, audio) {
  const t0 = performance.now();
  const r = await asr(audio, { return_timestamps: false, chunk_length_s: 30 });
  const t1 = performance.now();
  const cap = await buildCaption(r.text, translate);
  const t2 = performance.now();
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
        const cap = await buildCaption(msg.text, translate);
        post({ type: 'result', id: msg.id, caption: cap, rawEn: msg.text, ms: { asr: 0, mt: Math.round(performance.now() - t0) } });
      })
      .catch((e) => post({ type: 'error', stage: 'process', id: msg.id, message: String(e?.message || e) }));
  }
};
