// 使用するAIモデルの一覧。すべて無料で配布され、利用者のブラウザ内で動く（サーバー費用ゼロ）。
// モデルを追加・差し替えるときはここだけを編集する。

/**
 * モデルの版を固定する（Hugging Face のコミットID）。配布元が更新されても挙動が勝手に変わらないようにするため。
 * 更新するときは docs/benchmarks で精度を確認してから書き換える。（2026-11-14 取得）
 */
export const REVISIONS = {
  'onnx-community/whisper-small.en': '482fb8ba081b6e906f92efe103622316b2a0cc69',
  'onnx-community/whisper-base.en': '51eefc0af78b103839eda9e7e4f4186acc6517fe',
  'onnx-community/whisper-tiny.en': '794207fec2761281fe63a23a94b7e9f53a4efbc1',
  'Xenova/whisper-small.en': 'fa16a75f5d91e83ecb6a2ccb690f14d91ef00ca4',
  'Xenova/whisper-base.en': '95bf40a508535962c6483ead40270b2e32267508',
  'Xenova/whisper-tiny.en': '79fb389fc764e7c395bd330e9531d9d32ada7049',
  'onnx-community/LFM2-350M-ENJP-MT-ONNX': '29e6195eb1f63ddb3fa29c320edd4f4b25fa4ae7',
  'Kadonox/fugumt-en-ja-onnx': '0997e6ce157c3e784fcfc9917bf57ab4c74dbadc',
};

export const revisionOf = (id) => REVISIONS[id] || 'main';

export const ASR_MODELS = {
  accurate: {
    id: 'onnx-community/whisper-small.en',
    fallbacks: ['Xenova/whisper-small.en'],
    label: '高精度（Whisper small）',
    approxMB: { gpu: 390, cpu: 250 },
    license: 'MIT',
  },
  standard: {
    id: 'onnx-community/whisper-base.en',
    fallbacks: ['Xenova/whisper-base.en'],
    label: '標準（Whisper base）',
    approxMB: { gpu: 200, cpu: 80 },
    license: 'MIT',
  },
  light: {
    id: 'onnx-community/whisper-tiny.en',
    fallbacks: ['Xenova/whisper-tiny.en'],
    label: '軽量（Whisper tiny）',
    approxMB: { gpu: 70, cpu: 40 },
    license: 'MIT',
  },
};

export const MT_MODELS = {
  lfm2: {
    id: 'onnx-community/LFM2-350M-ENJP-MT-ONNX',
    kind: 'chat',
    label: '高品質（LFM2 英日翻訳）',
    approxMB: { gpu: 300, cpu: 300 },
    license: 'LFM Open License v1.0（年商1,000万ドル未満は商用無料）',
  },
  fugu: {
    id: 'Kadonox/fugumt-en-ja-onnx',
    kind: 'seq2seq',
    label: '省メモリ（FuguMT）',
    approxMB: { gpu: 110, cpu: 110 },
    license: 'CC BY-SA 4.0（表示義務あり）',
  },
};

export function isMobileUA(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** 端末に合わせた初期設定 */
export function defaultModelConfig({ webgpu, mobile }) {
  // 実測（docs/benchmarks）: 自然な音声では base の誤り率 4.0%、small 2.7%。
  // small はGPUでも交信の長さ以上の時間がかかる端末があり、ライブで遅れるため base を既定にする
  if (webgpu && !mobile) return { asr: 'standard', mt: 'lfm2' };
  if (webgpu) return { asr: 'light', mt: 'lfm2' };
  return { asr: 'light', mt: 'fugu' };
}

/** ダウンロード量の目安（実測値ベース）。device: 'gpu' | 'cpu' */
export function estimateDownloadMB(cfg, device = 'gpu') {
  const pick = (m) => m?.approxMB?.[device] ?? 0;
  return pick(ASR_MODELS[cfg.asr]) + pick(MT_MODELS[cfg.mt]);
}
