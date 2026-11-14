import { describe, it, expect } from 'vitest';
import { shouldAutoStart, AUTOSTART_LIMIT_MS } from '../../src/core/autostart.js';

describe('準備完了後の自動開始', () => {
  it('すぐに準備できて画面を見ていれば始める', () => expect(shouldAutoStart(0, 5000, true)).toBe(true));
  it('準備に45秒を超えたら始めない（突然音が出るのを防ぐ）', () => expect(shouldAutoStart(0, AUTOSTART_LIMIT_MS + 1, true)).toBe(false));
  it('画面を見ていなければ始めない', () => expect(shouldAutoStart(0, 1000, false)).toBe(false));
});
