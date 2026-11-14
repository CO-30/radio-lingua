import { describe, it, expect } from 'vitest';
import { normalizeRadioText, classify, isLikelyHallucination, cleanAsrText, buildCaption, polishJapanese } from '../../src/core/radio.js';

describe('normalizeRadioText', () => {
  it('10コードを意味に置き換え、元のコードを記録する', () => {
    const r = normalizeRadioText('Ten four, twenty three is 10-97.');
    expect(r.text).toContain('Roger');
    expect(r.text).toContain('on scene');
    expect(r.codes.map((c) => c.code)).toEqual(['10-4', '10-97']);
    expect(r.codes[0].ja).toBe('了解');
  });

  it('"10 4" のような区切りも認識する', () => {
    expect(normalizeRadioText('10 4 copy').codes[0].code).toBe('10-4');
  });

  it('未知の10コードはそのまま残す', () => {
    const r = normalizeRadioText('go to 10-555');
    expect(r.text).toContain('10-555');
    expect(r.codes).toEqual([]);
  });

  it('code 4 を展開する', () => {
    const r = normalizeRadioText('Code four, no units needed');
    expect(r.text.toLowerCase()).toContain('no further assistance needed');
    expect(r.codes[0]).toEqual({ code: 'code 4', ja: '応援不要' });
  });

  it('部隊名を分かる英語にし、日本語ラベルを付ける', () => {
    const r = normalizeRadioText('Dispatch to Engine twelve and Medic 7.');
    expect(r.text).toContain('Fire Engine 12');
    expect(r.text).toContain('Ambulance 7');
    expect(r.units).toEqual([
      { label: 'Engine 12', en: 'Fire Engine 12', ja: '消防車12', kind: 'fire' },
      { label: 'Medic 7', en: 'Ambulance 7', ja: '救急車7', kind: 'ems' },
    ]);
  });

  it('二重に正規化しても部隊名が重ならない', () => {
    const once = normalizeRadioText('Engine 12 copies').text;
    expect(normalizeRadioText(once).text).toBe(once);
  });

  it('code 4 の展開と言い直しの重複をまとめる', () => {
    expect(normalizeRadioText('Code 4, no further assistance needed.').text.toLowerCase()).toBe('no further assistance needed.');
  });

  it('フォネティックコードの連続を文字に直す', () => {
    const r = normalizeRadioText('plate Adam Boy Charles 123.');
    expect(r.text).toContain('plate ABC 123');
    const n = normalizeRadioText('callsign Alpha Bravo.');
    expect(n.text).toContain('AB.');
  });

  it('単独の名前（Frank 等）は変換しない', () => {
    expect(normalizeRadioText('Frank is on scene').text).toBe('Frank is on scene');
  });

  it('略語 ETA を展開する', () => {
    expect(normalizeRadioText('ETA six minutes').text).toBe('estimated arrival time six minutes');
    expect(normalizeRadioText('E T A 6').text).toBe('estimated arrival time 6');
  });
});

describe('classify', () => {
  it('消防・救急・警察を見分ける', () => {
    expect(classify('Respond to a structure fire at Maple Avenue')).toBe('fire');
    expect(classify('65 year old male with chest pain, patient conscious')).toBe('ems');
    expect(classify('traffic stop, silver sedan, two occupants')).toBe('police');
    expect(classify('good morning')).toBe('other');
  });
});

describe('Whisperの誤出力対策', () => {
  it('定型の幻聴文を除外する', () => {
    for (const t of ['Thank you.', 'Thanks for watching!', '[BLANK_AUDIO]', '(static)', 'you', ' . ']) {
      expect(isLikelyHallucination(t)).toBe(true);
    }
    expect(isLikelyHallucination('Engine 12 copies, en route.')).toBe(false);
  });
  it('音響タグを取り除く', () => {
    expect(cleanAsrText('[static] Engine 12 (radio noise) en route')).toBe('Engine 12 en route');
  });
});

describe('buildCaption', () => {
  it('認識→正規化→翻訳→分類までつなぐ', async () => {
    const seen = [];
    const cap = await buildCaption(' Medic 7 responding. ETA six minutes. ', async (en) => {
      seen.push(en);
      return '- 到着予定時間は6分です。';
    });
    expect(seen).toEqual(['estimated arrival time six minutes.']);
    expect(cap.ja).toBe('救急車7、出動する。到着予定時間は6分です。');
    expect(cap.category).toBe('ems');
    expect(cap.units[0].ja).toBe('救急車7');
  });
  it('雑音由来の文は字幕にしない', async () => {
    expect(await buildCaption('Thank you.', async () => 'x')).toBeNull();
    expect(await buildCaption('', async () => 'x')).toBeNull();
  });
  it('誤訳しやすい用語を補正する', () => {
    expect(polishJapanese('メープル通りで発生した構造物の火災。クロス・ストリートはオーク・ドライブ')).toBe('メープル通りで発生した建物火災。交差道路はオーク・ドライブ');
  });
  it('日本語の後処理（記号・繰り返し）', () => {
    expect(polishJapanese('"了解 。"')).toBe('了解。');
    expect(polishJapanese('- 了解')).toBe('了解');
    expect(polishJapanese('南行き、40マイル標識付近の40マイル標識付近で停止')).toBe('南行き、40マイル標識付近で停止');
    expect(polishJapanese('南行き、40マイル地点付近の40マイル地点近くの交通停止だ。')).toBe('南行き、40マイル地点近くの交通停止だ。');
    expect(polishJapanese('救急車7、救急車8が出動')).toBe('救急車7、救急車8が出動');
    expect(polishJapanese('メープルアベニュー421番地で発生した建物火災に対応してください。')).toBe('メープルアベニュー421番地で発生した建物火災に対応してください。');
  });
  it('定型句は機械翻訳を使わずに訳す', async () => {
    const mt = async (en) => {
      throw new Error(`MTが呼ばれた: ${en}`);
    };
    expect((await buildCaption('Engine 12 copies, en route.', mt)).ja).toBe('消防車12、了解、現場へ向かう。');
    expect((await buildCaption('10-4.', mt)).ja).toBe('了解。');
    expect((await buildCaption('Engine 12 copies en route.', mt)).ja).toBe('消防車12、了解、現場へ向かう。');
    expect((await buildCaption('Medic 7 responding.', mt)).ja).toBe('救急車7、出動する。');
    expect((await buildCaption('Medic 7, priority 1 call.', mt)).ja).toBe('救急車7、最優先の出動要請。');
    expect((await buildCaption('10-4-23 is on scene.', mt)).ja).toBe('了解。23、現着。');
    expect((await buildCaption('10-4 23 is on scene.', mt)).ja).toBe('了解。23、現着。');
    expect((await buildCaption('Code 4, no further assistance needed.', mt)).ja).toBe('応援不要。');
  });
  it('定型句と自由文が混ざった文は分けて訳す', async () => {
    const seen = [];
    const cap = await buildCaption('Medic 7 responding, ETA 6 minutes.', async (en) => (seen.push(en), '到着予定6分'));
    expect(seen).toEqual(['estimated arrival time 6 minutes.']);
    expect(cap.ja).toBe('救急車7、出動する、到着予定6分。');
  });
  it('長い文は読点で小分けにする', async () => {
    const seen = [];
    await buildCaption('Unit 23, traffic stop on Highway 9 southbound near mile marker 40, silver sedan, two occupants.', async (en) => (seen.push(en), 'x'));
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.every((s) => s.length <= 70)).toBe(true);
  });
  it('文ごとに分けて翻訳する', async () => {
    const seen = [];
    await buildCaption('Dispatch to Engine 12. Respond to a fire at 421 Maple Avenue. Cross street is Oak Drive.', async (en) => (seen.push(en), 'x'));
    expect(seen).toEqual(['Dispatch to Fire Engine 12.', 'Respond to a fire at 421 Maple Avenue.', 'Cross street is Oak Drive.']);
  });
});
