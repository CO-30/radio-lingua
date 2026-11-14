// 使用するAIモデルの一覧。すべて無料で配布され、利用者のブラウザ内で動く（サーバー費用ゼロ）。
// モデルを追加・差し替えるときはここだけを編集する。

export const ASR_MODELS = {
  accurate: {
    id: 'onnx-community/whisper-small.en',
    fallbacks: ['Xenova/whisper-small.en'],
    label: '高精度（Whisper small）',
    approxMB: 250,
    license: 'MIT',
  },
  standard: {
    id: 'onnx-community/whisper-base.en',
    fallbacks: ['Xenova/whisper-base.en'],
    label: '標準（Whisper base）',
    approxMB: 80,
    license: 'MIT',
  },
  light: {
    id: 'onnx-community/whisper-tiny.en',
    fallbacks: ['Xenova/whisper-tiny.en'],
    label: '軽量（Whisper tiny）',
    approxMB: 40,
    license: 'MIT',
  },
};

export const MT_MODELS = {
  lfm2: {
    id: 'onnx-community/LFM2-350M-ENJP-MT-ONNX',
    kind: 'chat',
    label: '高品質（LFM2 英日翻訳）',
    approxMB: 420,
    license: 'LFM Open License v1.0（年商1,000万ドル未満は商用無料）',
  },
  fugu: {
    id: 'Kadonox/fugumt-en-ja-onnx',
    kind: 'seq2seq',
    label: '省メモリ（FuguMT）',
    approxMB: 110,
    license: 'CC BY-SA 4.0（表示義務あり）',
  },
};

export function isMobileUA(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** 端末に合わせた初期設定 */
export function defaultModelConfig({ webgpu, mobile }) {
  if (webgpu && !mobile) return { asr: 'accurate', mt: 'lfm2' }; // 実測で base より誤り率が約半分（docs/benchmarks）
  if (webgpu) return { asr: 'light', mt: 'lfm2' };
  return { asr: 'light', mt: 'fugu' };
}

export function estimateDownloadMB(cfg) {
  return (ASR_MODELS[cfg.asr]?.approxMB || 0) + (MT_MODELS[cfg.mt]?.approxMB || 0);
}
