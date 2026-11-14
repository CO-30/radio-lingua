import { describe, it, expect } from 'vitest';
import { wer, words } from '../../src/core/bench.js';

describe('wer', () => {
  it('一致なら0', () => expect(wer('Engine 12 copies, en route.', 'engine 12 copies en route')).toBe(0));
  it('1語置換で1/5', () => expect(wer('Engine 12 copies en route', 'Engine 12 copies in route')).toBeCloseTo(0.2));
  it('削除と挿入も数える', () => expect(wer('a b c d', 'a c d e')).toBeCloseTo(0.5));
  it('記号を無視して単語に分ける', () => expect(words("Ten-four, it's 10-4!")).toEqual(['ten', 'four', "it's", '10', '4']));
});
