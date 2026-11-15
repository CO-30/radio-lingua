import { describe, it, expect } from 'vitest';
import { shouldAutoStart, AUTOSTART_LIMIT_MS, canAutoplayAudio } from '../../src/core/autostart.js';

describe('準備完了後の自動開始', () => {
  it('すぐに準備できて画面を見ていれば始める', () => expect(shouldAutoStart(0, 5000, true)).toBe(true));
  it('準備に45秒を超えたら始めない（突然音が出るのを防ぐ）', () => expect(shouldAutoStart(0, AUTOSTART_LIMIT_MS + 1, true)).toBe(false));
  it('画面を見ていなければ始めない', () => expect(shouldAutoStart(0, 1000, false)).toBe(false));
});

describe('iPhone・iPad では自動で始めない（無音になるため、押してもらう）', () => {
  it('iPhone', () => expect(canAutoplayAudio({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X)' })).toBe(false));
  it('iPad（Mac と名乗る）', () => expect(canAutoplayAudio({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(false));
  it('Mac・Android は自動で始める', () => {
    expect(canAutoplayAudio({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(true);
    expect(canAutoplayAudio({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)' })).toBe(true);
  });
  it('自動再生できない端末では始めない', () => expect(shouldAutoStart(0, 1000, true, false)).toBe(false));
});
