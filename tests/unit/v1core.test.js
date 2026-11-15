import { describe, it, expect } from 'vitest';
import { findTerms } from '../../src/core/glossary.js';
import { tokensToWords, uncertainWords, markText, stepConfidence, vocabKey } from '../../src/core/confidence.js';
import { DEMO_STATION, makeUserStation, filterStations, countByCountry } from '../../src/core/stations.js';
import worldmap from '../../src/data/worldmap.json';

describe('用語の補足', () => {
  it('出現順に重複なく返す', () => {
    const t = findTerms('Unit 23, traffic stop on Highway 9 southbound near mile marker 40. Two occupants.');
    expect(t.map((x) => x.key)).toEqual(['unit', 'traffic-stop', 'highway', 'bound', 'mile-marker', 'occupants']);
    expect(t[0].ja).toBe('ユニット');
  });
  it('用語がなければ空', () => expect(findTerms('Hello there')).toEqual([]));
});

describe('確信度', () => {
  const tokens = [
    { t: ' Silver', p: 0.92 },
    { t: ' Civ', p: 0.31 },
    { t: 'an', p: 0.8 },
    { t: ',', p: 0.99 },
    { t: ' two', p: 0.97 },
    { t: ' occupants', p: 0.88 },
  ];
  it('トークンを語にまとめ、最小確率を語の確信度にする', () => {
    expect(tokensToWords(tokens)).toEqual([
      { w: 'Silver', p: 0.92 },
      { w: 'Civan,', p: 0.31 },
      { w: 'two', p: 0.97 },
      { w: 'occupants', p: 0.88 },
    ]);
  });
  it('不確かな語だけを記号なしで返す', () => expect(uncertainWords(tokensToWords(tokens))).toEqual(['Civan']));
  it('表示用に原文を分割する', () => {
    const parts = markText('Silver Civan, two occupants', tokensToWords(tokens));
    expect(parts.filter((p) => p.uncertain).map((p) => p.text)).toEqual(['Civan,']);
    expect(parts.map((p) => p.text).join('')).toBe('Silver Civan, two occupants');
  });
  it('表記だけ違う候補（大文字小文字・句読点）の確率は合算する', () => {
    const keys = [' Southbound', ' southbound', ' Northbound', '.', ','].map(vocabKey);
    // Southbound と southbound が拮抗しても、どちらも同じ語なので確信度は高い
    const r = stepConfidence([2.0, 1.9, -1, -5, -5], keys);
    expect(r.id).toBe(0);
    expect(r.p).toBeGreaterThan(0.9);
    // 合算しない場合は約0.5に見える（従来の誤検知の原因）
    expect(stepConfidence([2.0, 1.9, -1, -5, -5], null).p).toBeLessThan(0.55);
  });
  it('違う語と迷っているときは低い確信度になる', () => {
    const keys = [' seven', ' salmon', ' seventy'].map(vocabKey);
    expect(stepConfidence([1.0, 0.9, -3], keys).p).toBeLessThan(0.6);
  });
  it('数詞と数字（two と 2）は同じ語として扱う', () => {
    const keys = [' 2', ' two', ' to'].map(vocabKey);
    expect(stepConfidence([1.0, 0.95, -2], keys).p).toBeGreaterThan(0.9);
  });
  it('記号だけの語は判定しない', () => {
    const keys = ['.', ',', ' and'].map(vocabKey);
    expect(stepConfidence([1.0, 0.95, 0.9], keys)).toEqual({ id: 0, p: 1 });
  });
  it('確信度がなければ全体を1断片で返す', () => expect(markText('abc', [])).toEqual([{ text: 'abc', uncertain: false }]));
});

describe('無線局', () => {
  it('利用者の局を作る（検証つき）', () => {
    const s = makeUserStation({ name: ' 自宅の受信機 ', types: ['fire'], country: 'US', input: 'mic' }, [-98, 39]);
    expect(s.name).toBe('自宅の受信機');
    expect(s.kind).toBe('user');
    expect(s.lon).toBe(-98);
    expect(() => makeUserStation({ name: '', types: ['fire'], country: 'US', input: 'mic' })).toThrow('名前');
    expect(() => makeUserStation({ name: 'a', types: [], country: 'US', input: 'mic' })).toThrow('警察');
    expect(() => makeUserStation({ name: 'a', types: ['ems'], country: 'US', input: 'stream', url: 'http://x' })).toThrow('https');
  });
  it('同じ国の2局目は位置をずらす', () => {
    const a = makeUserStation({ name: 'a', types: ['fire'], country: 'US', input: 'mic' }, [-98, 39], 0);
    const b = makeUserStation({ name: 'b', types: ['fire'], country: 'US', input: 'mic' }, [-98, 39], 1);
    expect(Math.hypot(a.lon - b.lon, a.lat - b.lat)).toBeGreaterThan(1);
  });
  it('絞り込み', () => {
    const u = makeUserStation({ name: 'Tokyo scanner', types: ['police'], country: 'JP', input: 'mic' }, [139, 35]);
    const list = [DEMO_STATION, u];
    expect(filterStations(list, { type: 'police' }).length).toBe(2);
    expect(filterStations(list, { type: 'police', country: 'JP' })).toEqual([u]);
    expect(filterStations(list, { q: 'デモ' })).toEqual([DEMO_STATION]);
    expect(filterStations(list, { q: '日本' }, (c) => (c === 'JP' ? '日本' : c))).toEqual([u]);
    expect(filterStations(list, { favoritesOnly: true, favorites: ['demo'] })).toEqual([DEMO_STATION]);
    expect(countByCountry(list).get('US')).toBe(1);
  });
});

describe('世界地図データ', () => {
  it('主要国が含まれ、各国に点がある', () => {
    const codes = worldmap.countries.map((c) => c.a2);
    for (const c of ['US', 'JP', 'GB', 'AU', 'CA', 'BR', 'ZA']) expect(codes).toContain(c);
    const withDots = new Set();
    for (let i = 2; i < worldmap.dots.length; i += 3) withDots.add(worldmap.dots[i]);
    expect(withDots.size).toBe(worldmap.countries.length);
  });
  it('日本の点は日本付近にある', () => {
    const jp = worldmap.countries.findIndex((c) => c.a2 === 'JP');
    for (let i = 0; i < worldmap.dots.length; i += 3) {
      if (worldmap.dots[i + 2] !== jp) continue;
      const lon = worldmap.lon0 + (worldmap.dots[i] + 0.5) * worldmap.step;
      const lat = worldmap.latMax - worldmap.dots[i + 1] * worldmap.step;
      expect(lon).toBeGreaterThan(122);
      expect(lon).toBeLessThan(150);
      expect(lat).toBeGreaterThan(23);
      expect(lat).toBeLessThan(47);
    }
  });
});

import { pickJapaneseVoice } from '../../src/core/tts.js';
describe('日本語の声の選び方', () => {
  const v = (name, lang = 'ja-JP') => ({ name, lang });
  it('Edge の Natural 音声を最優先', () =>
    expect(pickJapaneseVoice([v('Kyoko'), v('Microsoft Nanami Online (Natural) - Japanese (Japan)'), v('Google 日本語')]).name).toMatch(/Natural/));
  it('macOS の拡張版を簡易版より優先', () =>
    expect(pickJapaneseVoice([v('Kyoko'), v('Kyoko (Enhanced)'), v('Samantha', 'en-US')]).name).toBe('Kyoko (Enhanced)'));
  it('日本語の声がなければ null', () => expect(pickJapaneseVoice([v('Samantha', 'en-US')])).toBeNull());
});

import { useMediaPlayback } from '../../src/core/tts.js';
describe('iPhone の消音スイッチ対策', () => {
  it('audioSession があれば再生用にする', () => {
    const nav = { audioSession: { type: 'auto' } };
    useMediaPlayback(nav);
    expect(nav.audioSession.type).toBe('playback');
  });
  it('無い環境では何もしない', () => expect(() => useMediaPlayback({})).not.toThrow());
});
