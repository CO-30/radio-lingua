// 日本語読み上げ。OS標準の音声合成（Web Speech API）を使うので無料・通信不要。

export class Speaker {
  constructor(synth = globalThis.speechSynthesis) {
    this.synth = synth;
    this.enabled = false;
    this.rate = 1.15;
    this.voice = null;
    this.maxQueue = 3; // 読み上げが追いつかない時は古いものを飛ばす
    this.pending = 0;
    if (synth) {
      this._pickVoice();
      synth.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }
  get supported() {
    return !!this.synth && typeof SpeechSynthesisUtterance !== 'undefined';
  }
  _pickVoice() {
    const voices = this.synth.getVoices?.() || [];
    const ja = voices.filter((v) => /^ja(-|_|$)/i.test(v.lang));
    this.voice = ja.find((v) => /Kyoko|Otoya|Nanami|Keita|Google/i.test(v.name)) || ja[0] || null;
  }
  speak(text) {
    if (!this.enabled || !this.supported || !text) return;
    if (this.pending >= this.maxQueue) {
      this.synth.cancel();
      this.pending = 0;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = this.rate;
    if (this.voice) u.voice = this.voice;
    this.pending++;
    u.onend = u.onerror = () => (this.pending = Math.max(0, this.pending - 1));
    this.synth.speak(u);
  }
  /** iOS は利用者の操作中に一度鳴らさないと以降読み上げない */
  unlock() {
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    this.synth.speak(u);
  }
  stop() {
    this.synth?.cancel();
    this.pending = 0;
  }
}
