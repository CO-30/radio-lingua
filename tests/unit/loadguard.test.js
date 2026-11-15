import { describe, it, expect } from 'vitest';
import { markLoading, clearLoading, takeCrashed, lighterConfig } from '../../src/core/loadguard.js';

function mem() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

describe('読み込み中に画面が落ちたことの検出', () => {
  it('終わる前に開き直すと検出し、一度読んだら消える', () => {
    const s = mem();
    markLoading('engine', { stationId: 'demo' }, s);
    markLoading('voice', {}, s);
    clearLoading('voice', s);
    const c = takeCrashed(s);
    expect(Object.keys(c)).toEqual(['engine']);
    expect(c.engine.stationId).toBe('demo');
    expect(takeCrashed(s)).toEqual({});
  });
  it('古い印は無視する', () => {
    const s = mem();
    markLoading('engine', {}, s);
    expect(takeCrashed(s, Date.now() + 60 * 60 * 1000)).toEqual({});
  });
  it('軽い構成へ順に下げる', () => {
    expect(lighterConfig({ asr: 'light', mt: 'lfm2', forceWasm: false })).toEqual({ mt: 'fugu' });
    expect(lighterConfig({ asr: 'standard', mt: 'fugu', forceWasm: false })).toEqual({ asr: 'light' });
    expect(lighterConfig({ asr: 'light', mt: 'fugu', forceWasm: false })).toEqual({ forceWasm: true });
    expect(lighterConfig({ asr: 'light', mt: 'fugu', forceWasm: true })).toBeNull();
  });
});
