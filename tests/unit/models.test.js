import { describe, it, expect } from 'vitest';
import { defaultModelConfig, estimateDownloadMB, isMobileUA } from '../../src/core/models.js';

describe('端末に合わせた初期設定', () => {
  it('GPU搭載PCは標準+高品質翻訳', () => expect(defaultModelConfig({ webgpu: true, mobile: false })).toEqual({ asr: 'standard', mt: 'lfm2' }));
  it('GPUのあるスマホは軽量認識', () => expect(defaultModelConfig({ webgpu: true, mobile: true })).toEqual({ asr: 'light', mt: 'lfm2' }));
  it('GPUなしは軽量+省メモリ', () => expect(defaultModelConfig({ webgpu: false, mobile: true })).toEqual({ asr: 'light', mt: 'fugu' }));
  it('容量の目安（実測値ベース）', () => {
    expect(estimateDownloadMB({ asr: 'standard', mt: 'lfm2' }, 'gpu')).toBe(500);
    expect(estimateDownloadMB({ asr: 'light', mt: 'fugu' }, 'cpu')).toBe(150);
  });
  it('スマホの判定', () => {
    expect(isMobileUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
    expect(isMobileUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);
  });
});
