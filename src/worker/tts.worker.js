// AI音声の読み上げ（Web Worker）。画面や字幕の処理を止めないよう別スレッドで動かす。
import * as ort from 'onnxruntime-web/webgpu';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import { SUPERTONIC, AI_VOICES, fileUrl, styleTensors, synthesize } from '../core/supertonic.js';

import { VOICE_CACHE as CACHE } from '../core/aivoice.js';
const post = (m, t) => self.postMessage(m, t || []);

let sessions = null;
let cfgs = null;
let indexer = null;
let device = 'wasm';
const styles = {};
let queue = Promise.resolve();
let cancelBefore = 0; // これより前の依頼は読み上げない（停止ボタン）

/** 取得済みならキャッシュから、無ければ取得して保存する。進み具合を返す */
async function fetchCached(path, onBytes) {
  const url = fileUrl(path);
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) {
    const buf = await hit.arrayBuffer();
    onBytes(buf.byteLength);
    return buf;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path} を取得できませんでした（${res.status}）`);
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.byteLength;
    onBytes(value.byteLength);
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.byteLength;
  }
  await cache?.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  return buf.buffer;
}

async function hasWebGPU() {
  try {
    return !!(self.navigator?.gpu && (await self.navigator.gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function load(voiceKey, forceDevice) {
  ort.env.wasm.wasmPaths = {
    mjs: new URL(ortMjsUrl, self.location.href).href,
    wasm: new URL(ortWasmUrl, self.location.href).href,
  };
  const total = SUPERTONIC.approxMB * 1e6;
  let got = 0;
  const onBytes = (n) => {
    got += n;
    post({ type: 'progress', progress: Math.min(0.99, got / total) });
  };
  if (!sessions) {
    cfgs = JSON.parse(new TextDecoder().decode(await fetchCached('onnx/tts.json', onBytes)));
    indexer = JSON.parse(new TextDecoder().decode(await fetchCached('onnx/unicode_indexer.json', onBytes)));
    const providers = forceDevice ? [[forceDevice]] : (await hasWebGPU()) ? [['webgpu'], ['wasm']] : [['wasm']];
    const bufs = {};
    for (const name of SUPERTONIC.models) bufs[name] = new Uint8Array(await fetchCached(`onnx/${name}.onnx`, onBytes));
    let lastErr = null;
    for (const ep of providers) {
      try {
        const s = {};
        for (const name of SUPERTONIC.models) s[name] = await ort.InferenceSession.create(bufs[name], { executionProviders: ep, graphOptimizationLevel: 'all' });
        sessions = s;
        device = ep[0];
        break;
      } catch (e) {
        lastErr = e;
        post({ type: 'log', message: `AI音声を ${ep[0]} で準備できませんでした: ${e?.message || e}` });
      }
    }
    if (!sessions) throw lastErr || new Error('AI音声を準備できませんでした');
  }
  await loadStyle(voiceKey, onBytes);
  // 初回の推論は遅いので、短い文で一度動かしておく
  const t0 = performance.now();
  const { duration } = await synthesize(ort, sessions, cfgs, indexer, styles[voiceKey], '了解。');
  const rtf = (performance.now() - t0) / 1000 / Math.max(0.3, duration);
  post({ type: 'ready', device, rtf: +rtf.toFixed(2) });
}

async function loadStyle(voiceKey, onBytes = () => {}) {
  if (styles[voiceKey]) return;
  const v = AI_VOICES[voiceKey];
  if (!v) throw new Error(`不明な声: ${voiceKey}`);
  const json = JSON.parse(new TextDecoder().decode(await fetchCached(`voice_styles/${v.style}.json`, onBytes)));
  styles[voiceKey] = styleTensors(ort, json);
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'load') {
    queue = queue.then(() => load(m.voice, m.device)).catch((err) => post({ type: 'error', error: String(err?.message || err) }));
  } else if (m.type === 'cancel') {
    cancelBefore = m.before;
  } else if (m.type === 'speak') {
    queue = queue.then(async () => {
      if (m.seq < cancelBefore || !sessions) return post({ type: 'skipped', seq: m.seq });
      try {
        await loadStyle(m.voice);
        const t0 = performance.now();
        const { pcm, sampleRate, duration, prof } = await synthesize(ort, sessions, cfgs, indexer, styles[m.voice], m.text, { speed: m.speed || 1, steps: m.steps });
        if (m.seq < cancelBefore) return post({ type: 'skipped', seq: m.seq });
        post({ type: 'audio', seq: m.seq, pcm, sampleRate, ms: Math.round(performance.now() - t0), duration, prof }, [pcm.buffer]);
      } catch (err) {
        post({ type: 'speak-error', seq: m.seq, error: String(err?.message || err) });
      }
    });
  }
};
