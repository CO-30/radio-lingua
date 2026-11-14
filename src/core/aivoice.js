// AI音声（Supertonic 3）の読み上げを画面側で扱う。作るのは Worker、鳴らすのは Web Audio。
import { splitForSpeech } from './supertonic.js';

export const VOICE_CACHE = 'radio-lingua-voice-v1';

/** モデルを取得済みか（起動時に、勝手に大きな取得を始めないための確認） */
export async function isVoiceCached(url) {
  try {
    const c = await caches.open(VOICE_CACHE);
    return !!(await c.match(url));
  } catch {
    return false;
  }
}

export class AiVoice {
  static STEPS = [8, 6, 5, 4];
  /** @param {{ createWorker: () => Worker, onState?: (s: any) => void, AudioCtx?: any }} opts */
  constructor({ createWorker, onState = () => {}, AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.createWorker = createWorker;
    this.onState = onState;
    this.AudioCtx = AudioCtx;
    this.worker = null;
    this.voice = null;
    this.state = { status: 'idle', progress: 0, error: null, device: null, rtf: null };
    this.seq = 0;
    this.utterances = []; // { seqs:Set, left, onend, done }
    this.bySeq = new Map();
    this.ctx = null;
    this.playEnd = 0;
    this.sources = new Set();
    this.steps = 8; // 処理が追いつかない端末では自動で減らす（品質より遅れを優先して防ぐ）
    this.stepsBySeq = new Map();
    this.rtfAvg = null;
  }
  /** 実際の読み上げにかかった時間から、次の手順数を決める */
  _adapt(seq, ms, duration) {
    const used = this.stepsBySeq.get(seq);
    this.stepsBySeq.delete(seq);
    if (!used || !duration) return;
    const rtf = ms / 1000 / duration;
    this.rtfAvg = this.rtfAvg == null ? rtf : this.rtfAvg * 0.6 + rtf * 0.4;
    if (used !== this.steps) return;
    const ladder = AiVoice.STEPS;
    const i = ladder.indexOf(this.steps);
    if (this.rtfAvg > 0.9 && i < ladder.length - 1) this.steps = ladder[i + 1];
    else if (this.rtfAvg < 0.45 && i > 0) this.steps = ladder[i - 1];
    else return;
    this.rtfAvg = null; // 手順数を変えたら測り直す
  }
  get ready() {
    return this.state.status === 'ready';
  }
  _set(patch) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }
  /** 声を選んだときに呼ぶ。初回だけモデルを取得する（約400MB） */
  ensure(voice) {
    if (voice === this.voice && (this.state.status === 'ready' || this.state.status === 'loading')) return;
    this.voice = voice;
    if (this.state.status === 'ready' || this.state.status === 'loading') {
      this.worker?.postMessage({ type: 'load', voice });
      return;
    }
    if (!this.worker) {
      this.worker = this.createWorker();
      this.worker.onmessage = (e) => this._onMessage(e.data);
      this.worker.onerror = (e) => this._set({ status: 'error', error: e.message || 'AI音声の処理が止まりました' });
    }
    this._set({ status: 'loading', progress: 0, error: null });
    this.worker.postMessage({ type: 'load', voice });
  }
  _onMessage(m) {
    if (m.type === 'progress') this._set({ progress: m.progress });
    else if (m.type === 'ready') this._set({ status: 'ready', progress: 1, device: m.device, rtf: null });
    else if (m.type === 'error') this._set({ status: 'error', error: m.error });
    else if (m.type === 'audio') {
      this._adapt(m.seq, m.ms, m.duration);
      this._set({ rtf: this.rtfAvg == null ? this.state.rtf : +this.rtfAvg.toFixed(2), steps: this.steps });
      this._play(m.seq, m.pcm, m.sampleRate);
    }
    else if (m.type === 'skipped' || m.type === 'speak-error') this._finishPart(m.seq);
  }
  unlock() {
    try {
      if (!this.ctx && this.AudioCtx) this.ctx = new this.AudioCtx();
      void this.ctx?.resume?.();
    } catch {
      /* 音声出力が使えない環境 */
    }
  }
  /** 文ごとに作って、できた順に途切れなく鳴らす。全部鳴り終わったら onend */
  speak(text, { speed = 1, onend } = {}) {
    const parts = splitForSpeech(text);
    if (!this.worker || !this.ready || !parts.length) return false;
    this.unlock();
    const u = { left: parts.length, onend, done: false };
    this.utterances.push(u);
    for (const p of parts) {
      const seq = ++this.seq;
      this.bySeq.set(seq, u);
      this.stepsBySeq.set(seq, this.steps);
      this.worker.postMessage({ type: 'speak', seq, text: p, voice: this.voice, speed, steps: this.steps });
    }
    return true;
  }
  get pending() {
    return this.utterances.filter((u) => !u.done).length;
  }
  _play(seq, pcm, sampleRate) {
    const u = this.bySeq.get(seq);
    if (!u || u.done || !this.ctx) return this._finishPart(seq);
    const buf = this.ctx.createBuffer(1, pcm.length, sampleRate);
    buf.copyToChannel ? buf.copyToChannel(pcm, 0) : buf.getChannelData(0).set(pcm);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.02, this.playEnd);
    src.start(at);
    this.playEnd = at + buf.duration + 0.25; // 文と文の間を少し空ける
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      this._finishPart(seq);
    };
  }
  _finishPart(seq) {
    const u = this.bySeq.get(seq);
    this.bySeq.delete(seq);
    if (!u || u.done) return;
    if (--u.left <= 0) this._end(u);
  }
  _end(u) {
    u.done = true;
    this.utterances = this.utterances.filter((x) => x !== u);
    u.onend?.();
  }
  stop() {
    this.worker?.postMessage({ type: 'cancel', before: this.seq + 1 });
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* 既に止まっている */
      }
    }
    this.sources.clear();
    this.playEnd = 0;
    const list = this.utterances;
    this.utterances = [];
    this.bySeq.clear();
    for (const u of list) if (!u.done) ((u.done = true), u.onend?.());
  }
  /** 取得したモデルを端末から消す */
  async clearCache() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this._set({ status: 'idle', progress: 0, error: null, device: null, rtf: null });
    try {
      await caches.delete(VOICE_CACHE);
    } catch {
      /* 対応していない環境 */
    }
  }
}
