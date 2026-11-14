import { describe, it, expect, vi } from 'vitest';
import { preprocessText, encodeText, splitForSpeech, sampleNoisyLatent, synthesize } from '../../src/core/supertonic.js';
import { AiVoice } from '../../src/core/aivoice.js';

describe('AI音声：文字の前処理（Supertone サンプルと同じ）', () => {
  it('言語タグで囲み、文末に句点が無ければ足す', () => {
    expect(preprocessText('了解')).toBe('<ja>了解.</ja>'.normalize('NFKD'));
    expect(preprocessText('了解。')).toBe('<ja>了解。</ja>');
  });
  it('NFKD で濁点を分け、記号を置き換える', () => {
    const t = preprocessText('ガス漏れ — 現場/北側');
    expect(t).toContain('ガ'); // ガ → カ + 濁点
    expect(t).toContain('- 現場 北側');
  });
  it('索引に無い文字は -1', () => {
    const ids = encodeText([0, 5], 'a', 'ja');
    expect(ids[0]).toBe(-1n);
    expect(ids.length).toBe(preprocessText('a').length);
  });
});

describe('AI音声：読み上げ単位への分割', () => {
  it('日本語の文末で分ける', () => {
    expect(splitForSpeech('消防車12、了解。現場へ向かう。')).toEqual(['消防車12、了解。', '現場へ向かう。']);
  });
  it('長い文は読点で分ける', () => {
    const long = 'あ'.repeat(60) + '、' + 'い'.repeat(80) + '。';
    const parts = splitForSpeech(long, 100);
    expect(parts.length).toBe(2);
    expect(parts[0].endsWith('、')).toBe(true);
  });
  it('記号だけの断片は読まない', () => expect(splitForSpeech('。 、')).toEqual([]));
});

const CFG = { ae: { sample_rate: 44100, base_chunk_size: 512 }, ttl: { chunk_compress_factor: 6, latent_dim: 24 } };

describe('AI音声：雑音の初期値', () => {
  it('長さと次元がサンプルコードの計算と一致', () => {
    const { xt, dims, mask } = sampleNoisyLatent(1.0, CFG, () => 0.5);
    const len = Math.ceil(44100 / (512 * 6));
    expect(dims).toEqual([1, 24 * 6, len]);
    expect(xt.length).toBe(24 * 6 * len);
    expect([...mask].every((m) => m === 1)).toBe(true);
  });
});

/** ONNX Runtime の代わり：入力の形を確かめて、決まった出力を返す */
function fakeOrt() {
  class Tensor {
    constructor(type, data, dims) {
      Object.assign(this, { type, data, dims });
    }
  }
  const calls = [];
  const s = (name, fn) => ({ run: async (feeds) => (calls.push([name, feeds]), fn(feeds)) });
  const sessions = {
    duration_predictor: s('dp', () => ({ duration: { data: new Float32Array([0.5]) } })),
    text_encoder: s('te', () => ({ text_emb: new Tensor('float32', new Float32Array(4), [1, 2, 2]) })),
    vector_estimator: s('ve', (f) => ({ denoised_latent: { data: f.noisy_latent.data.map((x) => x * 0.5) } })),
    vocoder: s('voc', () => ({ wav_tts: { data: new Float32Array(44100) } })),
  };
  return { ort: { Tensor }, sessions, calls };
}

describe('AI音声：合成の手順', () => {
  it('速さで長さが変わり、指定の回数だけ雑音を取り除き、長さに合わせて切り詰める', async () => {
    const { ort, sessions, calls } = fakeOrt();
    const style = { ttl: {}, dp: {} };
    const r = await synthesize(ort, sessions, CFG, new Array(70000).fill(1), style, '了解。', { speed: 1.25, steps: 3, rand: () => 0.5 });
    expect(r.duration).toBeCloseTo(0.4);
    expect(r.pcm.length).toBe(Math.floor(44100 * 0.4));
    expect(calls.filter((c) => c[0] === 've').map((c) => c[1].current_step.data[0])).toEqual([0, 1, 2]);
    expect(calls[0][1].text_ids.type).toBe('int64');
  });
});

describe('AI音声：再生の管理', () => {
  function setup() {
    const posted = [];
    const worker = { postMessage: (m) => posted.push(m), terminate() {} };
    const started = [];
    class Ctx {
      currentTime = 0;
      destination = {};
      resume() {}
      createBuffer(_c, n, sr) {
        return { duration: n / sr, copyToChannel() {} };
      }
      createBufferSource() {
        const src = { connect() {}, start: (at) => started.push(at), stop() {}, onended: null };
        return src;
      }
    }
    const v = new AiVoice({ createWorker: () => worker, AudioCtx: Ctx });
    return { v, posted, started };
  }
  it('準備前は話さない（端末の声に任せる）', () => {
    const { v } = setup();
    expect(v.speak('了解。')).toBe(false);
  });
  it('文ごとに依頼し、全部鳴り終わったら onend。停止すると残りを捨てる', () => {
    const { v, posted, started } = setup();
    v.ensure('ai-f');
    v._onMessage({ type: 'ready', device: 'wasm', rtf: 0.3 });
    let ended = 0;
    expect(v.speak('一つ目。二つ目。', { onend: () => ended++ })).toBe(true);
    const speaks = () => posted.filter((m) => m.type === 'speak');
    expect(speaks().map((m) => m.text)).toEqual(['一つ目。']); // 1文ずつ依頼する
    v._onMessage({ type: 'audio', seq: speaks()[0].seq, pcm: new Float32Array(4410), sampleRate: 44100 });
    expect(speaks().map((m) => m.text)).toEqual(['一つ目。', '二つ目。']);
    v._onMessage({ type: 'audio', seq: speaks()[1].seq, pcm: new Float32Array(4410), sampleRate: 44100 });
    expect(started.length).toBe(2);
    expect(started[1]).toBeGreaterThan(started[0]); // 重ならずに続けて鳴る
    expect(v.pending).toBe(1);
    v.stop();
    expect(ended).toBe(1);
    expect(v.pending).toBe(0);
    expect(posted.at(-1)).toMatchObject({ type: 'cancel' });
  });
  it('準備に失敗したら error になる', () => {
    const { v } = setup();
    v.ensure('ai-m');
    v._onMessage({ type: 'error', error: 'onnx/vocoder.onnx を取得できませんでした（403）' });
    expect(v.state.status).toBe('error');
  });
});

describe('AI音声：処理の重い端末では手順数を自動で減らす', () => {
  it('遅れると 8→6→5→4、余裕があれば戻す', () => {
    const v = new AiVoice({ createWorker: () => ({ postMessage() {} }), AudioCtx: null });
    const feed = (rtf) => {
      const seq = ++v.seq;
      v.stepsBySeq.set(seq, v.steps);
      v._adapt(seq, rtf * 3000, 3);
    };
    v.firstMeasure = false; // 段階的な調整だけを確かめる
    feed(2.5);
    expect(v.steps).toBe(6);
    feed(1.6);
    expect(v.steps).toBe(5);
    feed(1.2);
    expect(v.steps).toBe(4);
    feed(1.1);
    expect(v.steps).toBe(4); // これ以上は下げない
    feed(0.2);
    expect(v.steps).toBe(4); // 1回だけ速くても戻さない（平均で判断）
    feed(0.2);
    feed(0.2);
    expect(v.steps).toBe(5);
  });
});

describe('AI音声：最初の計測で一気に合わせる', () => {
  const mk = () => new AiVoice({ createWorker: () => ({ postMessage() {} }), AudioCtx: null });
  const feed = (v, rtf) => {
    const seq = ++v.seq;
    v.stepsBySeq.set(seq, v.steps);
    v._adapt(seq, rtf * 3000, 3);
  };
  it('重い端末（手順8で実時間の3倍）は最初から手順4', () => {
    const v = mk();
    feed(v, 3);
    expect(v.steps).toBe(4);
  });
  it('やや重い端末（1.0倍）は手順6', () => {
    const v = mk();
    feed(v, 1.0);
    expect(v.steps).toBe(6);
  });
  it('速い端末は手順8のまま', () => {
    const v = mk();
    feed(v, 0.3);
    expect(v.steps).toBe(8);
  });
});

describe('AI音声：字幕の処理を優先する', () => {
  it('字幕の処理中は合成を待ち、空いたら依頼する。待ちすぎたら依頼する', () => {
    vi.useFakeTimers();
    const posted = [];
    let busy = true;
    const v = new AiVoice({ createWorker: () => ({ postMessage: (m) => posted.push(m) }), isBusy: () => busy, AudioCtx: null });
    v.ensure('ai-f');
    v._onMessage({ type: 'ready', device: 'wasm' });
    v.speak('了解。');
    expect(posted.filter((m) => m.type === 'speak').length).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(posted.filter((m) => m.type === 'speak').length).toBe(0);
    busy = false;
    vi.advanceTimersByTime(300);
    expect(posted.filter((m) => m.type === 'speak').length).toBe(1);
    v._onMessage({ type: 'skipped', seq: 1 });
    busy = true;
    v.speak('現着。');
    vi.advanceTimersByTime(AiVoice.MAX_WAIT_MS + 300);
    expect(posted.filter((m) => m.type === 'speak').length).toBe(2);
    vi.useRealTimers();
  });
});
