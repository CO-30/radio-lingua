// AI音声（Supertonic 3）の推論。ブラウザの中だけで日本語を読み上げる。
// 推論手順は Supertone 社のサンプルコード（MIT License, github.com/supertone-inc/supertonic web/helper.js）に従い、
// 配列を型付き配列に置き換えて書き直したもの。モデル本体は OpenRAIL-M（docs/CREDITS.md 参照）。
// ONNX Runtime は引数で受け取る（ブラウザでは onnxruntime-web、テストでは onnxruntime-node）。

export const SUPERTONIC = {
  id: 'Supertone/supertonic-3',
  revision: '3cadd1ee6394adea1bd021217a0e650ede09a323',
  models: ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'],
  approxMB: 400,
  steps: 8,
};

/** 声の選択肢（聞き比べで自然と判断した2つ） */
export const AI_VOICES = {
  'ai-f': { style: 'F2', label: 'AI音声（女性）' },
  'ai-m': { style: 'M1', label: 'AI音声（男性）' },
};

export function fileUrl(path) {
  return `https://huggingface.co/${SUPERTONIC.id}/resolve/${SUPERTONIC.revision}/${path}`;
}

const REPLACEMENTS = [
  ['–', '-'], ['‑', '-'], ['—', '-'], ['_', ' '],
  ['“', '"'], ['”', '"'], ['‘', "'"], ['’', "'"], ['´', "'"], ['`', "'"],
  ['[', ' '], [']', ' '], ['|', ' '], ['/', ' '], ['#', ' '], ['→', ' '], ['←', ' '],
];
const EXPRESSIONS = [['@', ' at '], ['e.g.,', 'for example, '], ['i.e.,', 'that is, ']];
const EMOJI = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;

/** モデルが学習時に見た形に文字列を整える（サンプルコードと同じ処理） */
export function preprocessText(text, lang = 'ja') {
  let t = text.normalize('NFKD').replace(EMOJI, '');
  for (const [k, v] of REPLACEMENTS) t = t.replaceAll(k, v);
  t = t.replace(/[♥☆♡©\\]/g, '');
  for (const [k, v] of EXPRESSIONS) t = t.replaceAll(k, v);
  t = t.replace(/ ,/g, ',').replace(/ \./g, '.').replace(/ !/g, '!').replace(/ \?/g, '?').replace(/ ;/g, ';').replace(/ :/g, ':').replace(/ '/g, "'");
  while (t.includes('""')) t = t.replace('""', '"');
  while (t.includes("''")) t = t.replace("''", "'");
  t = t.replace(/\s+/g, ' ').trim();
  if (!/[.!?;:,'"')\]}…。」』】〉》›»]$/.test(t)) t += '.';
  return `<${lang}>${t}</${lang}>`;
}

/** 文字を番号に変える。サンプルコード同様 UTF-16 の位置ごとに codePointAt を使う */
export function encodeText(indexer, text, lang = 'ja') {
  const t = preprocessText(text, lang);
  const ids = new BigInt64Array(t.length);
  for (let j = 0; j < t.length; j++) {
    const cp = t.codePointAt(j);
    ids[j] = BigInt(cp < indexer.length ? indexer[cp] : -1);
  }
  return ids;
}

/**
 * 読み上げる単位に分ける。日本語は「。」の後に空白が無いので文末記号で区切り、
 * 1文ずつ作って先に鳴らす（待ち時間を短くする）。長すぎる文は読点で分ける。
 */
export function splitForSpeech(text, maxLen = 120) {
  const out = [];
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^。！？!?]+[。！？!?]*/g) || [];
  for (let s of sentences) {
    s = s.trim();
    while (s.length > maxLen) {
      const cut = Math.max(s.lastIndexOf('、', maxLen), s.lastIndexOf(' ', maxLen));
      const at = cut > maxLen / 3 ? cut + 1 : maxLen;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s && /[^\s。、！？!?.,]/.test(s)) out.push(s);
  }
  return out;
}

/** 標準正規分布の乱数（Box-Muller）。テストでは決まった乱数を渡せる */
function gaussian(rand) {
  const u1 = Math.max(0.0001, rand());
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/** 雑音から始める潜在表現と、その有効範囲（サンプルコードと同じ計算） */
export function sampleNoisyLatent(durationSec, cfgs, rand = Math.random) {
  const sr = cfgs.ae.sample_rate;
  const chunk = cfgs.ae.base_chunk_size * cfgs.ttl.chunk_compress_factor;
  const dim = cfgs.ttl.latent_dim * cfgs.ttl.chunk_compress_factor;
  const wavLen = Math.floor(durationSec * sr);
  const len = Math.floor((wavLen + chunk - 1) / chunk);
  const valid = Math.floor((wavLen + chunk - 1) / chunk);
  const mask = new Float32Array(len);
  for (let t = 0; t < len; t++) mask[t] = t < valid ? 1 : 0;
  const xt = new Float32Array(dim * len);
  for (let d = 0; d < dim; d++) for (let t = 0; t < len; t++) xt[d * len + t] = gaussian(rand) * mask[t];
  return { xt, dims: [1, dim, len], mask };
}

/** 声の特徴（JSON）を Tensor にする */
export function styleTensors(ort, json) {
  const t = json.style_ttl;
  const d = json.style_dp;
  return {
    ttl: new ort.Tensor('float32', Float32Array.from(t.data.flat(Infinity)), t.dims),
    dp: new ort.Tensor('float32', Float32Array.from(d.data.flat(Infinity)), d.dims),
  };
}

/**
 * 1文を音声にする。戻り値は 44.1kHz のモノラル Float32Array。
 * sessions: { duration_predictor, text_encoder, vector_estimator, vocoder }
 */
export async function synthesize(ort, sessions, cfgs, indexer, style, text, { speed = 1.0, steps, rand = Math.random } = {}) {
  steps = steps || SUPERTONIC.steps;
  const now = () => (globalThis.performance ? performance.now() : Date.now());
  const prof = { dp: 0, enc: 0, ve: 0, voc: 0 };
  let t = now();
  const ids = encodeText(indexer, text, 'ja');
  const textIds = new ort.Tensor('int64', ids, [1, ids.length]);
  const textMask = new ort.Tensor('float32', new Float32Array(ids.length).fill(1), [1, 1, ids.length]);

  const dp = await sessions.duration_predictor.run({ text_ids: textIds, style_dp: style.dp, text_mask: textMask });
  const duration = dp.duration.data[0] / speed;
  prof.dp = now() - t;
  t = now();

  const enc = await sessions.text_encoder.run({ text_ids: textIds, style_ttl: style.ttl, text_mask: textMask });
  prof.enc = now() - t;
  t = now();
  const { xt: x0, dims, mask } = sampleNoisyLatent(duration, cfgs, rand);
  let xt = x0;
  const latentMask = new ort.Tensor('float32', mask, [1, 1, dims[2]]);
  const total = new ort.Tensor('float32', new Float32Array([steps]), [1]);
  for (let step = 0; step < steps; step++) {
    const out = await sessions.vector_estimator.run({
      noisy_latent: new ort.Tensor('float32', xt, dims),
      text_emb: enc.text_emb,
      style_ttl: style.ttl,
      latent_mask: latentMask,
      text_mask: textMask,
      current_step: new ort.Tensor('float32', new Float32Array([step]), [1]),
      total_step: total,
    });
    xt = new Float32Array(out.denoised_latent.data);
  }
  prof.ve = now() - t;
  t = now();
  const voc = await sessions.vocoder.run({ latent: new ort.Tensor('float32', xt, dims) });
  const wav = voc.wav_tts.data;
  prof.voc = now() - t;
  const n = Math.min(wav.length, Math.floor(cfgs.ae.sample_rate * duration));
  return { pcm: Float32Array.from(wav.subarray(0, n)), sampleRate: cfgs.ae.sample_rate, duration, prof };
}
