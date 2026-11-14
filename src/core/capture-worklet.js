// 音声取り込み用の AudioWorklet（音声処理専用スレッドで動く）。
// 届いた音声を 2048 サンプルずつまとめて画面側へ送る。出力は無音。
class RadioLinguaCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf, [this.buf.buffer]);
          this.buf = new Float32Array(2048);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('radio-lingua-capture', RadioLinguaCapture);
