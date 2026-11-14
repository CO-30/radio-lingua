import './styles.css';
import { WorkerEngine, MockEngine } from './core/engine.js';
import { Capture, canCaptureTab } from './core/capture.js';
import { History } from './core/history.js';
import { Speaker } from './core/tts.js';
import { ASR_MODELS, MT_MODELS, defaultModelConfig, estimateDownloadMB, isMobileUA } from './core/models.js';
import { LIVE_PROVIDERS, TYPE_LABEL } from './data/sources.js';
import { runBench } from './core/bench.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const useMock = params.get('engine') === 'mock';
const SETTINGS_KEY = 'radiolingua.settings.v1';

const state = {
  source: 'sample',
  engineStatus: 'idle', // idle | loading | ready | error
  loadedKey: null,
  running: false,
  file: null,
  pendingStart: false,
  device: null,
  settings: null,
};

const history = new History();
const speaker = new Speaker();
const capture = new Capture();
let engine = null;
const liveIds = new Set(); // 画面の取り込みから送った交信だけを字幕・履歴に出す（精度測定の結果を混ぜない）

/* ---------- 設定 ---------- */
function loadSettings() {
  const hasWebGPU = !!navigator.gpu;
  const base = { ...defaultModelConfig({ webgpu: hasWebGPU, mobile: isMobileUA() }), showEn: true, rate: 1.15, size: 1, forceWasm: false, tts: false };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return base;
  }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {}
  applySettings();
}
function applySettings() {
  const s = state.settings;
  document.documentElement.style.setProperty('--cap-scale', s.size);
  document.body.classList.toggle('hide-en', !s.showEn);
  speaker.rate = s.rate;
  speaker.enabled = s.tts;
  $('ttsToggle').checked = s.tts;
}

/* ---------- エンジン ---------- */
function modelKey() {
  const s = state.settings;
  return `${s.asr}|${s.mt}|${s.forceWasm}`;
}

function setEngineStatus(status, text) {
  state.engineStatus = status;
  const el = $('engineState');
  el.dataset.status = status;
  $('engineStateText').textContent = text;
}

function createEngine() {
  const e = useMock ? new MockEngine() : new WorkerEngine();
  const files = new Map();
  e.addEventListener('device', (ev) => (state.device = ev.detail.device));
  e.addEventListener('progress', (ev) => {
    const d = ev.detail;
    if (d.file) files.set(`${d.stage}:${d.file}`, { loaded: d.loaded || 0, total: d.total || 0 });
    let loaded = 0;
    let total = 0;
    files.forEach((f) => {
      loaded += f.loaded;
      total += f.total;
    });
    const pct = total ? Math.min(100, (loaded / total) * 100) : 0;
    $('progressFill').style.width = `${pct.toFixed(1)}%`;
    $('prepDetail').textContent = `${d.stage === 'asr' ? '音声認識モデル' : '翻訳モデル'}を読み込み中… ${total ? `${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB` : ''}`;
  });
  e.addEventListener('ready', (ev) => {
    state.loadedKey = modelKey();
    const dev = ev.detail.device === 'webgpu' ? 'GPU' : ev.detail.device === 'mock' ? 'テスト' : 'CPU';
    setEngineStatus('ready', `AI準備完了（${dev}）`);
    $('prep').hidden = true;
    if (state.pendingStart) {
      state.pendingStart = false;
      start();
    }
  });
  e.addEventListener('error', (ev) => {
    const d = ev.detail;
    if (d.stage === 'process') {
      if (liveIds.delete(d.id)) markPendingFailed(d.id, d.message);
      return;
    }
    setEngineStatus('error', 'AIの読み込みに失敗');
    $('prep').hidden = false;
    $('prepText').textContent = 'AIモデルを読み込めませんでした。通信状況を確認して、もう一度「翻訳を開始」を押してください。';
    $('prepDetail').textContent = d.message || '';
    state.pendingStart = false;
    updateStartButton();
  });
  e.addEventListener('log', (ev) => console.warn(ev.detail.message));
  e.addEventListener('result', (ev) => onResult(ev.detail));
  return e;
}

function ensureEngine() {
  if (state.engineStatus === 'ready' && state.loadedKey === modelKey()) return true;
  if (state.engineStatus === 'loading') {
    state.pendingStart = true;
    return false;
  }
  const mb = estimateDownloadMB(state.settings, navigator.gpu && !state.settings.forceWasm ? 'gpu' : 'cpu');
  if (!useMock && !localStorage.getItem('radiolingua.downloaded.' + modelKey())) {
    $('consentBody').textContent = `音声認識「${ASR_MODELS[state.settings.asr].label}」と翻訳「${MT_MODELS[state.settings.mt].label}」で、合計 約${mb}MB です。モバイル回線ではWi-Fiへの切り替えをおすすめします。`;
    $('consent').showModal();
    return false;
  }
  beginLoad();
  return false;
}

function beginLoad() {
  if (engine && state.loadedKey && state.loadedKey !== modelKey() && engine.worker) engine.worker.terminate();
  if (!engine || (state.loadedKey && state.loadedKey !== modelKey())) engine = createEngine();
  state.pendingStart = true;
  setEngineStatus('loading', 'AIモデルを準備中');
  $('prep').hidden = false;
  $('prepText').textContent = '端末の中で動くAIを準備しています。初回は数分かかることがあります。';
  $('progressFill').style.width = '0%';
  $('prepDetail').textContent = '';
  try {
    localStorage.setItem('radiolingua.downloaded.' + modelKey(), '1');
  } catch {}
  engine.load({ asrKey: state.settings.asr, mtKey: state.settings.mt, forceWasm: state.settings.forceWasm });
  updateStartButton();
}

/* ---------- 取り込み元 ---------- */
const SOURCE_HINT = {
  sample: '架空の通報を合成音声で作ったデモです。実在の交信ではありません。',
  file: '録音済みの英語の無線音声（mp3・wav・m4a など）を選んでください。',
  mic: '受信機（スキャナー）のスピーカー近くに端末を置いてください。読み上げを使う場合はイヤホン推奨です。受信内容の公開・転載は法令で禁じられている場合があります。',
  tab: '無線を再生しているブラウザのタブを選び、「タブの音声も共有する」をオンにしてください。配信サイトの利用規約の範囲（個人での視聴）でお使いいただき、翻訳結果の公開・転載は控えてください。',
};

function selectSource(src) {
  if (state.running) return;
  state.source = src;
  document.querySelectorAll('#sources [role=radio]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.source === src)));
  let hint = SOURCE_HINT[src];
  if (src === 'tab' && !canCaptureTab()) hint = 'タブ音声の取り込みはパソコンの Chrome・Edge のみ対応です。スマートフォンでは「マイク・受信機」をお使いください。';
  if (src === 'file' && state.file) hint = `選択中：${state.file.name}`;
  $('hint').textContent = hint;
  if (src === 'file' && !state.file) $('fileInput').click();
  updateStartButton();
}

/* ---------- 開始・停止 ---------- */
const SOURCE_NAME = { sample: 'デモ交信', file: '音声ファイル', mic: 'マイク・受信機', tab: 'タブ音声' };
let sessionStart = 0;

async function start() {
  if (state.running) return stop();
  if (state.source === 'file' && !state.file) {
    $('fileInput').click();
    return;
  }
  if (state.source === 'tab' && !canCaptureTab()) return;
  speaker.unlock();
  if (!ensureEngine()) return;
  try {
    state.running = true;
    state.warnedBacklog = false;
    sessionStart = performance.now();
    updateStartButton();
    if (state.source === 'sample') await capture.startMedia(`${import.meta.env.BASE_URL}samples/demo-dispatch.mp3`, { label: 'デモ交信' });
    else if (state.source === 'file') await capture.startMedia(URL.createObjectURL(state.file), { label: state.file.name });
    else if (state.source === 'mic') await capture.startMic();
    else if (state.source === 'tab') await capture.startTab();
    $('sourceNow').textContent = state.source === 'file' ? state.file.name : SOURCE_NAME[state.source];
  } catch (e) {
    state.running = false;
    updateStartButton();
    const msg = e?.name === 'NotAllowedError' ? '音声の利用が許可されませんでした。ブラウザのアドレスバー付近の設定から許可してください。' : e?.message || String(e);
    $('hint').textContent = msg;
  }
}

async function stop() {
  await capture.stop();
}

function updateStartButton() {
  const btn = $('startBtn');
  const label = $('startLabel');
  btn.classList.toggle('is-running', state.running);
  if (state.running) label.textContent = '停止';
  else if (state.engineStatus === 'loading') label.textContent = '準備中…';
  else label.textContent = '翻訳を開始';
  btn.disabled = !state.running && (state.engineStatus === 'loading' || (state.source === 'tab' && !canCaptureTab()));
  $('onair').hidden = !state.running;
}

capture.addEventListener('stop', () => {
  state.running = false;
  updateStartButton();
  $('meterFill').style.transform = 'scaleX(0)';
});
capture.addEventListener('failed', (ev) => ($('hint').textContent = ev.detail.message));
capture.addEventListener('level', (ev) => {
  const v = Math.min(1, ev.detail.level * 6);
  $('meterFill').style.transform = `scaleX(${v.toFixed(3)})`;
  $('meterFill').classList.toggle('active', ev.detail.active);
});
capture.addEventListener('segment', (ev) => {
  if (state.engineStatus !== 'ready') return;
  const seg = ev.detail;
  const id = engine.process(seg.audio, { start: seg.start });
  liveIds.add(id);
  addPendingRow(id);
  if (liveIds.size >= 3 && !state.warnedBacklog) {
    state.warnedBacklog = true;
    $('hint').textContent = 'AIの処理が音声に追いついていません。字幕が遅れる場合は、設定で音声認識を「標準」または「軽量」にしてください。';
  }
});

/* ---------- 字幕と履歴 ---------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

function addPendingRow(id) {
  const li = el('li', 'entry pending');
  li.dataset.pending = String(id);
  li.append(el('span', 'entry-time', fmtTime(Date.now())), el('p', 'entry-ja', '聞き取り中…'));
  $('logList').prepend(li);
  $('logEmpty').hidden = true;
}

function markPendingFailed(id, message) {
  const li = document.querySelector(`[data-pending="${id}"]`);
  if (!li) return;
  li.classList.remove('pending');
  li.classList.add('failed');
  li.querySelector('.entry-ja').textContent = `この交信は翻訳できませんでした（${message || '不明なエラー'}）`;
}

function onResult({ id, caption, ms }) {
  if (!liveIds.delete(id)) return;
  const row = document.querySelector(`[data-pending="${id}"]`);
  if (!caption) {
    row?.remove();
    if (!$('logList').children.length) $('logEmpty').hidden = false;
    return;
  }
  const item = history.add({ ...caption, source: state.source === 'file' && state.file ? state.file.name : SOURCE_NAME[state.source], ms });
  renderCaption(item);
  const li = renderEntry(item);
  if (row) row.replaceWith(li);
  else $('logList').prepend(li);
  $('logEmpty').hidden = true;
  speaker.speak(item.ja);
}

function tagsFor(item) {
  const frag = document.createDocumentFragment();
  const cat = item.category || 'other';
  frag.append(el('span', `tag tag-${cat}`, TYPE_LABEL[cat]));
  for (const u of item.units || []) frag.append(el('span', `unit unit-${u.kind}`, u.ja));
  for (const c of item.codes || []) {
    const chip = el('span', 'code', `${c.code}＝${c.ja}`);
    chip.title = '無線コードの一般的な意味です。機関によって異なる場合があります。';
    frag.append(chip);
  }
  return frag;
}

function renderCaption(item) {
  const cap = $('caption');
  cap.replaceChildren();
  cap.dataset.category = item.category || 'other';
  const meta = el('div', 'caption-meta');
  meta.append(tagsFor(item));
  const ja = el('p', 'caption-ja-wrap');
  ja.append(el('span', 'caption-ja', item.ja));
  const en = el('p', 'caption-en', item.en);
  cap.append(meta, ja, en);
  cap.classList.remove('flash');
  void cap.offsetWidth;
  cap.classList.add('flash');
}

function renderEntry(item) {
  const li = el('li', `entry cat-${item.category || 'other'}`);
  const head = el('div', 'entry-head');
  head.append(el('span', 'entry-time', fmtTime(item.ts)), tagsFor(item));
  li.append(head, el('p', 'entry-ja', item.ja), el('p', 'entry-en', item.en));
  return li;
}

function renderHistory() {
  const list = $('logList');
  list.replaceChildren();
  const recent = history.items.slice(-200).reverse();
  for (const item of recent) list.append(renderEntry(item));
  $('logEmpty').hidden = recent.length > 0;
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- ライブ提供元 ---------- */
function renderProviders() {
  const ul = $('providers');
  for (const p of LIVE_PROVIDERS) {
    const li = el('li', `provider status-${p.status}`);
    const head = el('div', 'provider-head');
    head.append(el('b', null, p.name), el('span', 'provider-status', p.statusText));
    const meta = el('p', 'provider-meta', `${p.countries.join('、')} ／ ${p.types.map((t) => TYPE_LABEL[t]).join('・')}`);
    const note = el('p', 'provider-note', p.note);
    const link = el('a', 'provider-link', '公式サイトを開く');
    link.href = p.url;
    link.target = '_blank';
    link.rel = 'noopener';
    li.append(head, meta, note, link);
    ul.append(li);
  }
}

/* ---------- 時計 ---------- */
function tickClock() {
  $('clock').textContent = state.running ? elapsed() : '';
}
function elapsed() {
  const s = Math.floor((performance.now() - sessionStart) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- 設定画面 ---------- */
function openSettings() {
  const f = $('settings').querySelector('form');
  const s = state.settings;
  f.asr.value = s.asr;
  f.mt.value = s.mt;
  f.showEn.checked = s.showEn;
  f.rate.value = s.rate;
  f.size.value = s.size;
  f.forceWasm.checked = s.forceWasm;
  $('settings').showModal();
}

$('settings').addEventListener('close', () => {
  if ($('settings').returnValue !== 'save') return;
  const f = $('settings').querySelector('form');
  Object.assign(state.settings, { asr: f.asr.value, mt: f.mt.value, showEn: f.showEn.checked, rate: Number(f.rate.value), size: Number(f.size.value), forceWasm: f.forceWasm.checked });
  saveSettings();
  if (state.engineStatus === 'ready' && state.loadedKey !== modelKey()) setEngineStatus('idle', 'モデル変更あり（次回読み込み）');
});

$('consent').addEventListener('close', () => {
  if ($('consent').returnValue === 'ok') beginLoad();
});

/* ---------- 初期化 ---------- */
function init() {
  state.settings = loadSettings();
  applySettings();
  renderHistory();
  renderProviders();
  selectSource('sample');
  setEngineStatus('idle', useMock ? 'テストモード' : 'AIモデル未準備');
  document.querySelectorAll('#sources [role=radio]').forEach((b) => b.addEventListener('click', () => selectSource(b.dataset.source)));
  $('fileInput').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) {
      state.file = f;
      selectSource('file');
    }
  });
  $('startBtn').addEventListener('click', start);
  $('ttsToggle').addEventListener('change', (e) => {
    state.settings.tts = e.target.checked;
    if (e.target.checked) speaker.unlock();
    else speaker.stop();
    saveSettings();
  });
  $('openSettings').addEventListener('click', openSettings);
  $('exportTxt').addEventListener('click', () => download(`radio-lingua-${Date.now()}.txt`, history.toText(), 'text/plain'));
  $('exportJson').addEventListener('click', () => download(`radio-lingua-${Date.now()}.json`, history.toJSON(), 'application/json'));
  $('clearLog').addEventListener('click', () => {
    if (!history.items.length) return;
    if (confirm('この端末に保存された交信ログをすべて消去します。元に戻せません。')) {
      history.clear();
      renderHistory();
    }
  });
  if (!speaker.supported) $('ttsToggle').closest('label').hidden = true;
  setInterval(tickClock, 500);
  // テスト・精度測定用（例: await __rl.bench('samples/demo-dispatch.mp3', [...]))
  window.__rl = {
    state,
    history,
    get engine() {
      return engine;
    },
    bench: (url, expected) => runBench(engine, new URL(url, location.href).href, expected),
  };
}

init();
