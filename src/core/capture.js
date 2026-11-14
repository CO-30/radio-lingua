// 音声の取り込み口。サンプル・ファイル・マイク（受信機）・ブラウザのタブ音声を
// すべて同じ経路（16kHz化 → 交信区切り）に流す。

import { StreamResampler } from './resample.js';
import { StreamingSegmenter } from './segmenter.js';

export const SOURCE_KINDS = {
  sample: { label: 'デモ交信（合成音声）' },
  file: { label: '音声ファイル' },
  mic: { label: 'マイク・受信機' },
  tab: { label: 'ブラウザのタブ音声' },
};

export function canCaptureTab() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export class Capture extends EventTarget {
  constructor() {
    super();
    this.ctx = null;
    this.node = null;
    this.stream = null;
    this.mediaEl = null;
    this.srcNode = null;
    this.running = false;
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async _ensureCtx() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  _startPipeline(sourceNode, { monitor }) {
    const ctx = this.ctx;
    this.resampler = new StreamResampler(ctx.sampleRate, 16000);
    this.t0 = ctx.currentTime;
    this.segmenter = new StreamingSegmenter({
      onSegment: (seg) => this._emit('segment', seg),
      onLevel: (level, active) => this._emit('level', { level, active }),
    });
    // ScriptProcessor は非推奨だが iOS Safari を含めて最も確実に動く
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => {
      if (!this.running) return;
      const input = e.inputBuffer.getChannelData(0);
      this.segmenter.push(this.resampler.push(input));
      e.outputBuffer.getChannelData(0).fill(0);
    };
    sourceNode.connect(proc);
    proc.connect(ctx.destination); // 処理を動かすため（無音を出力）
    if (monitor) sourceNode.connect(ctx.destination);
    this.node = proc;
    this.srcNode = sourceNode;
    this.running = true;
    this._emit('start', {});
  }

  /** サンプルやファイルを再生しながら翻訳する */
  async startMedia(url, { label } = {}) {
    await this.stop();
    const ctx = await this._ensureCtx();
    const el = new Audio();
    el.src = url;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    this.mediaEl = el;
    const node = ctx.createMediaElementSource(el);
    this._startPipeline(node, { monitor: true });
    el.addEventListener('ended', () => {
      this.segmenter?.flush();
      this._emit('ended', {});
      this.stop();
    });
    el.addEventListener('timeupdate', () => this._emit('time', { current: el.currentTime, duration: el.duration }));
    el.addEventListener('error', () => this._emit('failed', { message: `${label || '音声'}を再生できませんでした。ファイル形式を確認してください。` }));
    await el.play();
  }

  async startMic() {
    await this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    const ctx = await this._ensureCtx();
    this.stream = stream;
    this._startPipeline(ctx.createMediaStreamSource(stream), { monitor: false });
  }

  async startTab() {
    await this.stop();
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: false } });
    stream.getVideoTracks().forEach((t) => t.stop());
    if (!stream.getAudioTracks().length) {
      throw new Error('タブの音声が共有されませんでした。共有画面で「タブの音声も共有する」をオンにしてください。');
    }
    const ctx = await this._ensureCtx();
    this.stream = stream;
    stream.getAudioTracks()[0].addEventListener('ended', () => this.stop());
    this._startPipeline(ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())), { monitor: false });
  }

  async stop() {
    if (!this.running && !this.mediaEl && !this.stream) return;
    this.running = false;
    try {
      this.segmenter?.flush();
    } catch {}
    try {
      this.node?.disconnect();
      this.srcNode?.disconnect();
    } catch {}
    if (this.mediaEl) {
      this.mediaEl.pause();
      this.mediaEl.removeAttribute('src');
      this.mediaEl.load();
      this.mediaEl = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.node = null;
    this.srcNode = null;
    this._emit('stop', {});
  }
}
