// 画面側からAIエンジンを使うための窓口。本物（Worker）とテスト用モックで同じ使い方にする。

export class WorkerEngine extends EventTarget {
  constructor() {
    super();
    this.worker = new Worker(new URL('../worker/engine.worker.js', import.meta.url), { type: 'module' });
    this.seq = 0;
    this.worker.onmessage = (ev) => this.dispatchEvent(new CustomEvent(ev.data.type, { detail: ev.data }));
    this.worker.onerror = (ev) => this.dispatchEvent(new CustomEvent('error', { detail: { stage: 'worker', message: ev.message || 'Worker error' } }));
  }
  load({ asrKey, mtKey, forceWasm = false }) {
    const baseUrl = new URL(import.meta.env.BASE_URL, location.href).href;
    this.worker.postMessage({ type: 'load', asrKey, mtKey, baseUrl, forceWasm });
  }
  process(audio, meta) {
    const id = ++this.seq;
    this.worker.postMessage({ type: 'process', id, audio }, [audio.buffer]);
    return id;
  }
  translateText(text) {
    const id = ++this.seq;
    this.worker.postMessage({ type: 'translate', id, text });
    return id;
  }
}

/**
 * 画面テスト用。モデルをダウンロードせずに、決まった字幕を順番に返す。
 * URL に ?engine=mock を付けると使われる。
 */
export class MockEngine extends EventTarget {
  constructor(script = MOCK_SCRIPT) {
    super();
    this.script = script;
    this.i = 0;
    this.seq = 0;
  }
  emit(type, detail) {
    setTimeout(() => this.dispatchEvent(new CustomEvent(type, { detail })), 0);
  }
  load() {
    this.emit('device', { device: 'mock' });
    let p = 0;
    const tick = () => {
      p += 25;
      this.emit('progress', { stage: p <= 50 ? 'asr' : 'mt', file: 'mock.onnx', progress: (p % 50 || 50) * 2, loaded: p, total: 100 });
      if (p < 100) setTimeout(tick, 40);
      else this.emit('ready', { device: 'mock', asr: { id: 'mock-asr' }, mt: { id: 'mock-mt' } });
    };
    setTimeout(tick, 40);
  }
  process() {
    const id = ++this.seq;
    const item = this.script[this.i++ % this.script.length];
    setTimeout(() => this.dispatchEvent(new CustomEvent('result', { detail: { id, caption: item, rawEn: item.en, ms: { asr: 120, mt: 80 } } })), 150);
    return id;
  }
  translateText(text) {
    const id = ++this.seq;
    this.emit('result', { id, caption: { en: text, enForMt: text, ja: `（模擬翻訳）${text}`, codes: [], units: [], category: 'other' }, rawEn: text, ms: { asr: 0, mt: 10 } });
    return id;
  }
}

/** モック用：原文を語に分け、指定した語だけ確信度を低くする */
function mockWords(en, low = []) {
  return en.split(' ').map((w) => ({ w, p: low.includes(w.replace(/[^A-Za-z0-9]/g, '')) ? 0.32 : 0.95 }));
}

export const MOCK_SCRIPT = [
  { en: 'Dispatch to Engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross street is Oak Drive.', ja: '消防車12へ。メープル通り421番地で建物火災の通報、出動せよ。交差道路はオーク・ドライブ。', codes: [], units: [{ label: 'Engine 12', ja: '消防車12', kind: 'fire' }], category: 'fire' },
  { en: 'Engine 12 copies. En route.', ja: '消防車12、了解。現場へ向かっています。', codes: [], units: [{ label: 'Engine 12', ja: '消防車12', kind: 'fire' }], category: 'fire' },
  { en: 'Medic 7, priority one call. 65-year-old male with chest pain at the Riverside Shopping Center.', ja: '救急車7、最優先の出動要請。リバーサイド・ショッピングセンターで65歳男性が胸の痛みを訴えている。', codes: [], units: [{ label: 'Medic 7', ja: '救急車7', kind: 'ems' }], category: 'ems' },
  { en: 'Medic 7 responding. ETA six minutes.', ja: '救急車7、出動します。到着まで約6分。', codes: [], units: [{ label: 'Medic 7', ja: '救急車7', kind: 'ems' }], category: 'ems' },
  { en: 'Unit 23, traffic stop on Highway 9 southbound near mile marker 40. Silver sedan, two occupants.', ja: 'ユニット23、国道9号南行き40マイル標識付近で交通停止。銀色のセダン、2人乗車。', codes: [], units: [{ label: 'Unit 23', ja: 'ユニット23', kind: 'police' }], category: 'police', words: mockWords('Unit 23, traffic stop on Highway 9 southbound near mile marker 40. Silver sedan, two occupants.', ['sedan']) },
  { en: '10-4. 23 is on scene. Code 4, no further assistance needed.', ja: '了解。23、現着。応援不要。', codes: [{ code: '10-4', ja: '了解' }, { code: 'code 4', ja: '応援不要' }], units: [], category: 'police' },
];
