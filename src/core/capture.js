// 音声の取り込み口。サンプル・ファイル・マイク（受信機）・ブラウザのタブ音声を
// すべて同じ経路（16kHz化 → 交信区切り）に流す。

import { StreamResampler } from './resample.js';
import { StreamingSegmenter } from './segmenter.js';
import workletUrl from './capture-worklet.js?url';

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

  /**
   * 取り込んだ音声を 16kHz化 → 交信区切り へ流す。
   * 音声処理専用スレッド（AudioWorklet）を優先し、使えないブラウザでは従来方式（ScriptProcessor）で動かす。
   */
  async _startPipeline(sourceNode, { monitor }) {
    const ctx = this.ctx;
    this.resampler = new StreamResampler(ctx.sampleRate, 16000);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    sourceNode.connect(this.analyser);
    this.maxLevel = 0;
    this.t0 = ctx.currentTime;
    this.segmenter = new StreamingSegmenter({
      onSegment: (seg) => this._emit('segment', seg),
      onLevel: (level, active) => this._emit('level', { level, active }),
    });
    const onChunk = (input) => {
      if (!this.running) return;
      for (let i = 0; i < input.length; i += 64) if (Math.abs(input[i]) > this.maxLevel) this.maxLevel = Math.abs(input[i]);
      this.segmenter.push(this.resampler.push(input));
    };
    let node = null;
    if (ctx.audioWorklet && !this.forceLegacy) {
      try {
        if (this.workletCtx !== ctx) {
          await ctx.audioWorklet.addModule(workletUrl);
          this.workletCtx = ctx;
        }
        node = new AudioWorkletNode(ctx, 'radio-lingua-capture', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers', // ステレオはモノラルに混ぜる
        });
        node.port.onmessage = (e) => onChunk(e.data);
        this.mode = 'worklet';
      } catch (e) {
        console.warn('AudioWorklet を使えないため従来方式で取り込みます', e);
        node = null;
      }
    }
    if (!node) {
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => {
        onChunk(e.inputBuffer.getChannelData(0));
        e.outputBuffer.getChannelData(0).fill(0);
      };
      node = proc;
      this.mode = 'script';
    }
    sourceNode.connect(node);
    node.connect(ctx.destination); // 処理を動かし続けるため（出力は無音）
    if (monitor) sourceNode.connect(ctx.destination);
    this.node = node;
    this.srcNode = sourceNode;
    this.running = true;
    this._emit('start', {});
  }

  /** 波形表示用（時間領域のデータ）。取り込み中でなければ false */
  readWaveform(buf) {
    if (!this.analyser || !this.running) return false;
    this.analyser.getFloatTimeDomainData(buf);
    return true;
  }

  /**
   * 利用者の配信URL（Icecast等）を再生しながら翻訳する。
   * 配信側が外部からの取り込み（CORS）を許可していないと、ブラウザは無音しか渡さないので検出して知らせる。
   */
  async startStream(url) {
    await this.startMedia(url, { label: '配信' });
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.running && this.mediaEl && !this.mediaEl.paused && this.maxLevel < 0.0005) {
        this._emit('failed', { message: 'この配信は音声の取り込みを許可していない（CORS未対応）ため翻訳できません。配信元の設定をご確認ください。' });
        this.stop();
      }
    }, 8000);
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
    await this._startPipeline(node, { monitor: true });
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
    await this._startPipeline(ctx.createMediaStreamSource(stream), { monitor: false });
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
    await this._startPipeline(ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())), { monitor: false });
  }

  async stop() {
    clearTimeout(this.silenceTimer);
    if (!this.running && !this.mediaEl && !this.stream) return;
    this.running = false;
    try {
      this.segmenter?.flush();
    } catch {}
    try {
      if (this.node?.port) this.node.port.onmessage = null;
      this.node?.disconnect();
      this.srcNode?.disconnect();
      this.analyser?.disconnect();
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
