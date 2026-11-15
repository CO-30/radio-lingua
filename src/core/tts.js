// 日本語読み上げ。OS標準の音声合成（Web Speech API）を使うので無料・通信不要。

// 自然に聞こえる順。Edge の「Natural」、macOS/iOS の拡張・Premium版、Google の声を優先する。
const VOICE_RANK = [
  /Natural|Neural|Online/i,
  /Premium|プレミアム/i,
  /Enhanced|拡張|高品質/i,
  /Google/i,
  /Nanami|Keita|Otoya|Kyoko|O-Ren|Hattori/i,
];

export function pickJapaneseVoice(voices) {
  const ja = voices.filter((v) => /^ja(-|_|$)/i.test(v.lang));
  const score = (v) => {
    const i = VOICE_RANK.findIndex((re) => re.test(v.name));
    return i < 0 ? VOICE_RANK.length : i;
  };
  return ja.slice().sort((a, b) => score(a) - score(b))[0] || null;
}

/**
 * iPhone は消音スイッチがオンだと、Web Audio で作った音（AI音声・デモ音声のモニター）を鳴らさない。
 * 音声の再生を「メディアの再生」として扱うよう伝え、消音スイッチに関係なく鳴らす（Safari 16.4以降）。
 */
export function useMediaPlayback(nav = globalThis.navigator) {
  try {
    if (nav?.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
  } catch {
    /* 対応していない環境 */
  }
}

export class Speaker {
  constructor(synth = globalThis.speechSynthesis) {
    this.synth = synth;
    this.enabled = false;
    this.rate = 1.0; // 速くすると機械っぽさが目立つ
    this.voice = null;
    this.maxQueue = 3; // 読み上げが追いつかない時は古いものを飛ばす
    this.pending = 0;
    this.ai = null; // AI音声（準備ができたらこちらを優先）
    this.useAi = false;
    if (synth) {
      this._pickVoice();
      synth.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }
  get supported() {
    return !!this.synth && typeof SpeechSynthesisUtterance !== 'undefined';
  }
  /** AI音声を使える状態か（準備中や失敗時は端末の声で読む） */
  get aiActive() {
    return this.useAi && !!this.ai?.ready;
  }
  _pickVoice() {
    this.voice = pickJapaneseVoice(this.synth.getVoices?.() || []);
  }
  /** 1件だけ読み上げる（自動読み上げの設定に関係なく）。終わったら onend */
  speakNow(text, onend) {
    if (!text) return false;
    if (this.aiActive) {
      this.stop();
      if (this.ai.speak(text, { speed: this.rate, onend })) return true;
    }
    if (!this.supported) return false;
    this.synth.cancel();
    this.pending = 0;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = this.rate;
    if (this.voice) u.voice = this.voice;
    u.onend = u.onerror = () => onend?.();
    this.synth.speak(u);
    return true;
  }
  speak(text) {
    if (!this.enabled || !text) return;
    if (this.aiActive) {
      if (this.ai.pending >= this.maxQueue) this.ai.stop(); // 追いつかない時は古いものを飛ばす
      if (this.ai.speak(text, { speed: this.rate })) return;
    }
    if (!this.supported) return;
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
    useMediaPlayback();
    this.ai?.unlock();
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    this.synth.speak(u);
  }
  stop() {
    this.ai?.stop();
    this.synth?.cancel();
    this.pending = 0;
  }
}
