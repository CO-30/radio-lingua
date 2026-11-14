// 無線交信の区切り検出（エネルギー型VAD）。
// 無線は「送信 → 無音 → 送信」の繰り返しなので、無音で区切ると1交信=1字幕になる。
// ストリーミングで少しずつ push でき、ファイルにもマイクにも同じ処理を使う。

export const DEFAULTS = Object.freeze({
  sampleRate: 16000,
  frameMs: 30,
  minSpeechMs: 300, // これより短い音は雑音として捨てる
  hangoverMs: 900, // この長さの無音で1交信の終わりとみなす（文の間の息継ぎ≒0.5秒より長く、交信の切れ目≒1秒以上より短く）
  maxSegmentMs: 20000, // 長すぎる交信は強制的に区切る（Whisperは30秒まで）
  preRollMs: 180, // 話し始めの取りこぼし防止
  minRms: 0.012, // 絶対的な最小音量
  floorRatio: 3.2, // 背景雑音レベルの何倍で「音声あり」とするか
});

export function rms(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / Math.max(1, frame.length));
}

export class StreamingSegmenter {
  /**
   * @param {Partial<typeof DEFAULTS> & {onSegment?: (seg:{audio:Float32Array,start:number,end:number})=>void, onLevel?: (level:number, active:boolean)=>void}} opts
   */
  constructor(opts = {}) {
    this.o = { ...DEFAULTS, ...opts };
    this.onSegment = opts.onSegment || (() => {});
    this.onLevel = opts.onLevel || null;
    this.frameLen = Math.round((this.o.sampleRate * this.o.frameMs) / 1000);
    this.pending = new Float32Array(0); // フレームに満たない端数
    this.noiseFloor = this.o.minRms / 2;
    this.totalFrames = 0;
    this.preRoll = []; // 直前フレーム（話し始めの補完用）
    this.preRollFrames = Math.ceil(this.o.preRollMs / this.o.frameMs);
    this.active = false;
    this.segFrames = [];
    this.segStartFrame = 0;
    this.voicedFrames = 0;
    this.silentRun = 0;
  }

  get frameSec() {
    return this.o.frameMs / 1000;
  }

  push(samples) {
    let buf = samples;
    if (this.pending.length) {
      buf = new Float32Array(this.pending.length + samples.length);
      buf.set(this.pending, 0);
      buf.set(samples, this.pending.length);
    }
    let off = 0;
    while (off + this.frameLen <= buf.length) {
      this._frame(buf.slice(off, off + this.frameLen));
      off += this.frameLen;
    }
    this.pending = buf.slice(off);
  }

  _frame(frame) {
    const level = rms(frame);
    const threshold = Math.max(this.o.minRms, this.noiseFloor * this.o.floorRatio);
    const voiced = level > threshold;
    // 背景雑音は「音声なし」のときだけゆっくり追従（下がるのは速く）
    if (!voiced) {
      this.noiseFloor = level < this.noiseFloor ? level * 0.5 + this.noiseFloor * 0.5 : this.noiseFloor * 0.98 + level * 0.02;
    }
    if (this.onLevel) this.onLevel(level, this.active || voiced);

    const hangFrames = Math.ceil(this.o.hangoverMs / this.o.frameMs);
    const maxFrames = Math.ceil(this.o.maxSegmentMs / this.o.frameMs);

    if (!this.active) {
      if (voiced) {
        this.active = true;
        this.segFrames = [...this.preRoll];
        this.segStartFrame = this.totalFrames - this.preRoll.length;
        this.voicedFrames = 1;
        this.silentRun = 0;
        this.segFrames.push(frame);
      } else {
        this.preRoll.push(frame);
        if (this.preRoll.length > this.preRollFrames) this.preRoll.shift();
      }
    } else {
      this.segFrames.push(frame);
      if (voiced) {
        this.voicedFrames++;
        this.silentRun = 0;
      } else {
        this.silentRun++;
      }
      if (this.silentRun >= hangFrames) this._close(this.silentRun);
      else if (this.segFrames.length >= maxFrames) this._close(0);
    }
    this.totalFrames++;
  }

  _close(trailingSilentFrames) {
    const minFrames = Math.ceil(this.o.minSpeechMs / this.o.frameMs);
    const frames = this.segFrames;
    // 末尾の無音は少しだけ残して削る
    const keepTail = Math.min(trailingSilentFrames, 3);
    const usable = frames.slice(0, frames.length - (trailingSilentFrames - keepTail));
    const voiced = this.voicedFrames;
    const start = this.segStartFrame * this.frameSec;
    this.active = false;
    this.segFrames = [];
    this.preRoll = [];
    this.voicedFrames = 0;
    this.silentRun = 0;
    if (voiced < minFrames) return;
    const audio = new Float32Array(usable.length * this.frameLen);
    usable.forEach((f, i) => audio.set(f, i * this.frameLen));
    this.onSegment({ audio, start, end: start + usable.length * this.frameSec });
  }

  /** 入力終了時に残りを確定させる */
  flush() {
    if (this.pending.length) {
      const f = new Float32Array(this.frameLen);
      f.set(this.pending);
      this.pending = new Float32Array(0);
      this._frame(f);
    }
    if (this.active) this._close(this.silentRun);
  }
}

/** 一括で区切る（テスト・ファイル用） */
export function segmentAll(samples, opts = {}) {
  const out = [];
  const s = new StreamingSegmenter({ ...opts, onSegment: (seg) => out.push(seg) });
  s.push(samples);
  s.flush();
  return out;
}
