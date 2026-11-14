import { describe, it, expect } from 'vitest';
import { normalizeKeyword, addKeyword, matchAlerts, SUGGESTED_ALERTS } from '../../src/core/alerts.js';

describe('キーワードの登録', () => {
  it('前後の空白・大文字・全角を整える', () => {
    expect(normalizeKeyword('  Structure   FIRE ')).toBe('structure fire');
    expect(normalizeKeyword('ＳＨＯＴＳ　fired')).toBe('shots fired');
  });
  it('短すぎ・長すぎは使えない', () => {
    expect(normalizeKeyword('a')).toBeNull();
    expect(normalizeKeyword('x'.repeat(41))).toBeNull();
  });
  it('重複は追加しない', () => {
    const l = addKeyword(addKeyword([], 'Pursuit'), 'pursuit ');
    expect(l).toEqual(['pursuit']);
  });
  it('提案の語はすべて登録できる', () => {
    expect(SUGGESTED_ALERTS.every((k) => normalizeKeyword(k) === k)).toBe(true);
  });
});

describe('一致の判定', () => {
  const item = { en: 'Respond to a reported structure fire. Residents are evacuating. Firefighters on scene.', ja: '建物火災の通報。住民が避難中。' };
  it('英語は語の先頭から一致する', () => {
    expect(matchAlerts(item, ['structure fire', 'evacuat', 'fire'])).toEqual(['structure fire', 'evacuat', 'fire']);
  });
  it('語の途中には一致しない', () => {
    expect(matchAlerts({ en: 'campfire reported' }, ['fire'])).toEqual([]);
    expect(matchAlerts({ en: 'the pursuits ended' }, ['pursuit'])).toEqual(['pursuit']);
  });
  it('空白とハイフンの違いを吸収する', () => {
    expect(matchAlerts({ en: 'shots-fired call' }, ['shots fired'])).toEqual(['shots fired']);
  });
  it('日本語は訳文で一致する', () => {
    expect(matchAlerts(item, ['火災', '発砲'])).toEqual(['火災']);
  });
  it('キーワードがなければ空', () => expect(matchAlerts(item, [])).toEqual([]));
});
