// 画面の操作（受信開始・停止、局の追加、お気に入り、履歴、設定）と、AI・音声の部品をつなぐ。
import { WorkerEngine, MockEngine } from '../core/engine.js';
import { Capture } from '../core/capture.js';
import { History } from '../core/history.js';
import { Speaker } from '../core/tts.js';
import { ASR_MODELS, MT_MODELS, defaultModelConfig, estimateDownloadMB, isMobileUA } from '../core/models.js';
import { DEMO_STATION, makeUserStation } from '../core/stations.js';
import { initState, getState, setState, EMPTY_SESSION, type Session, type Settings, type Station, type Transmission } from './store';
import { countryCenter } from './geo';
import { runBench } from '../core/bench.js';
import { matchAlerts } from '../core/alerts.js';
import { playChime } from '../core/chime.js';
import { shouldAutoStart } from '../core/autostart.js';

const SETTINGS_KEY = 'radiolingua.settings.v1';
const STATIONS_KEY = 'radiolingua.stations.v1';
const FAVORITES_KEY = 'radiolingua.favorites.v1';

export const useMock = new URLSearchParams(location.search).get('engine') === 'mock';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 容量不足などは無視（機能は続行） */
  }
}

function loadSettings(): Settings {
  const base: Settings = {
    ...(defaultModelConfig({ webgpu: !!(navigator as any).gpu, mobile: isMobileUA() }) as Pick<Settings, 'asr' | 'mt'>),
    showEn: true,
    rate: 1.15,
    size: 1,
    forceWasm: false,
    autoSpeak: false,
    saveHistory: true,
    alertsOn: false,
    alertKeywords: [],
    alertSound: true,
    alertNotify: false,
  };
  const saved = readJSON<Partial<Settings> & { tts?: boolean }>(SETTINGS_KEY, {});
  if (saved.tts !== undefined && saved.autoSpeak === undefined) saved.autoSpeak = saved.tts; // v0.2 からの引き継ぎ
  return { ...base, ...saved };
}

const settings = loadSettings();
export const history = new History(globalThis.localStorage, { persist: settings.saveHistory });
export const speaker = new Speaker();
/** 同時に受信できる局の数（AIは1つを共有するため、増やすと字幕が遅れやすい） */
export const MAX_SESSIONS = 3;
const captures = new Map<string, any>();
let engine: any = null;
const liveIds = new Map<number, string>(); // 処理待ちの交信 → 局ID
let loadedKey: string | null = null;

initState({
  engine: { status: 'idle', device: null, progress: 0, detail: '', error: null },
  sessions: {},
  focus: null,
  stations: [DEMO_STATION as Station, ...readJSON<Station[]>(STATIONS_KEY, [])],
  favorites: readJSON<string[]>(FAVORITES_KEY, []),
  history: history.items,
  historyVersion: 0,
  settings,
  consent: { open: false, mb: 0, asrLabel: '', mtLabel: '' },
  speakingId: null,
  settingsOpen: false,
  addStationOpen: false,
});
applySettings(settings);

function applySettings(s: Settings) {
  speaker.rate = s.rate;
  speaker.enabled = s.autoSpeak;
  document.documentElement.style.setProperty('--cap-scale', String(s.size));
  document.body.classList.toggle('hide-en', !s.showEn);
}

export function updateSettings(patch: Partial<Settings>) {
  const s = { ...getState().settings, ...patch };
  writeJSON(SETTINGS_KEY, s);
  applySettings(s);
  if (patch.saveHistory !== undefined) history.setPersist(patch.saveHistory);
  setState({ settings: s });
  if (getState().engine.status === 'ready' && loadedKey !== modelKey()) setEngine({ status: 'idle', detail: 'モデル変更あり（次回読み込み）' });
}

/* ---------- AIエンジン ---------- */
function modelKey() {
  const s = getState().settings;
  return `${s.asr}|${s.mt}|${s.forceWasm}`;
}
function setEngine(patch: Partial<ReturnType<typeof getState>['engine']>) {
  setState((st) => ({ engine: { ...st.engine, ...patch } }));
}

function createEngine() {
  const e = useMock ? new MockEngine() : new WorkerEngine();
  const files = new Map<string, { loaded: number; total: number }>();
  e.addEventListener('device', (ev: any) => setEngine({ device: ev.detail.device }));
  e.addEventListener('progress', (ev: any) => {
    const d = ev.detail;
    if (d.stage === 'warmup') {
      setEngine({ progress: 1, detail: d.message });
      return;
    }
    if (d.file) files.set(`${d.stage}:${d.file}`, { loaded: d.loaded || 0, total: d.total || 0 });
    let loaded = 0;
    let total = 0;
    files.forEach((f) => {
      loaded += f.loaded;
      total += f.total;
    });
    setEngine({
      progress: total ? Math.min(1, loaded / total) : 0,
      detail: `${d.stage === 'asr' ? '音声認識' : '翻訳'}モデルを読み込み中 ${total ? `${Math.round(loaded / 1048576)} / ${Math.round(total / 1048576)} MB` : ''}`,
    });
  });
  e.addEventListener('ready', (ev: any) => {
    loadedKey = modelKey();
    setEngine({ status: 'ready', device: ev.detail.device, progress: 1, detail: '', error: null });
    if (pendingStart) {
      const p = pendingStart;
      pendingStart = null;
      if (shouldAutoStart(p.at, Date.now(), document.visibilityState === 'visible')) void startLive(p.stationId, p.file);
      else patchSession(p.stationId, { notice: 'AIの準備ができました。「受信して翻訳」を押すと受信を始めます。' });
    }
  });
  e.addEventListener('error', (ev: any) => {
    const d = ev.detail;
    if (d.stage === 'process') {
      const sid = liveIds.get(d.id);
      if (sid) {
        liveIds.delete(d.id);
        patchSession(sid, (x) => ({ pending: Math.max(0, x.pending - 1), notice: `1件の交信を翻訳できませんでした（${d.message}）` }));
      }
      return;
    }
    pendingStart = null;
    setEngine({ status: 'error', error: d.message || '不明なエラー', detail: '' });
  });
  e.addEventListener('log', (ev: any) => (ev.detail.level === 'info' ? console.info : console.warn)(ev.detail.message));
  e.addEventListener('result', (ev: any) => onResult(ev.detail));
  return e;
}

let pendingStart: { stationId: string; file?: File; at: number } | null = null;

function needsConsent() {
  return !useMock && !localStorage.getItem('radiolingua.downloaded.' + modelKey());
}

function beginLoad() {
  if (engine && loadedKey && loadedKey !== modelKey()) engine.worker?.terminate?.();
  if (!engine || (loadedKey && loadedKey !== modelKey())) engine = createEngine();
  setEngine({ status: 'loading', progress: 0, detail: '準備しています', error: null });
  writeJSONRaw('radiolingua.downloaded.' + modelKey(), '1');
  const s = getState().settings;
  engine.load({ asrKey: s.asr, mtKey: s.mt, forceWasm: s.forceWasm });
}
function writeJSONRaw(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

export function answerConsent(ok: boolean) {
  setState((st) => ({ consent: { ...st.consent, open: false } }));
  if (ok) beginLoad();
  else pendingStart = null;
}

/** AIが使える状態か。使えなければ準備を始めて false */
function ensureEngine(): boolean {
  const st = getState();
  if (st.engine.status === 'ready' && loadedKey === modelKey()) return true;
  if (st.engine.status === 'loading') return false;
  if (needsConsent()) {
    const s = st.settings;
    const device = (navigator as any).gpu && !s.forceWasm ? 'gpu' : 'cpu';
    setState({ consent: { open: true, mb: estimateDownloadMB(s, device), asrLabel: (ASR_MODELS as any)[s.asr].label, mtLabel: (MT_MODELS as any)[s.mt].label } });
    return false;
  }
  beginLoad();
  return false;
}

/* ---------- 受信（局ごと・同時受信） ---------- */
export function stationById(id: string | null | undefined) {
  return getState().stations.find((s) => s.id === id) || null;
}

function patchSession(id: string, patch: Partial<Session> | ((x: Session) => Partial<Session>)) {
  setState((st) => {
    const cur = st.sessions[id] || EMPTY_SESSION;
    const p = typeof patch === 'function' ? patch(cur) : patch;
    return { sessions: { ...st.sessions, [id]: { ...cur, ...p } } };
  });
}

function runningCount() {
  return Object.values(getState().sessions).filter((x) => x.running).length;
}

/** 局ごとの取り込み口。初回に作り、その局の交信として処理する */
function captureFor(stationId: string) {
  let c = captures.get(stationId);
  if (c) return c;
  c = new Capture();
  c.addEventListener('stop', () => patchSession(stationId, { running: false }));
  c.addEventListener('failed', (ev: any) => patchSession(stationId, { notice: ev.detail.message }));
  c.addEventListener('segment', (ev: any) => {
    if (getState().engine.status !== 'ready') return;
    const id = engine.process(ev.detail.audio, { start: ev.detail.start });
    liveIds.set(id, stationId);
    const st = getState();
    const backlog = liveIds.size;
    const tip =
      runningCount() > 1
        ? '同時に受信する局を減らしてください'
        : st.settings.asr === 'accurate'
          ? '設定で音声認識を「標準」にしてください'
          : st.settings.asr === 'standard'
            ? '設定で音声認識を「軽量」にするか、他のアプリを閉じてください'
            : '他のアプリやタブを閉じると改善することがあります';
    patchSession(stationId, (x) => ({
      pending: x.pending + 1,
      notice: backlog >= 3 ? `AIの処理が音声に追いついていません。字幕が遅れる場合は、${tip}。` : x.notice,
    }));
  });
  captures.set(stationId, c);
  return c;
}

/** 波形表示用：局の取り込み口（受信していなければ null） */
export function getCapture(stationId: string | null | undefined) {
  return (stationId && captures.get(stationId)) || null;
}

export async function startLive(stationId: string, file?: File) {
  const station = stationById(stationId);
  if (!station) return;
  speaker.unlock();
  setState({ focus: stationId });
  patchSession(stationId, { notice: null });
  if (!getState().sessions[stationId]?.running && runningCount() >= MAX_SESSIONS) {
    patchSession(stationId, { notice: `同時に受信できるのは${MAX_SESSIONS}局までです。ほかの局を停止してから始めてください。` });
    return;
  }
  if (!ensureEngine()) {
    pendingStart = { stationId, file, at: Date.now() };
    return;
  }
  const c = captureFor(stationId);
  try {
    patchSession(stationId, { running: true, startedAt: Date.now(), pending: 0, notice: null, fileName: file?.name || null });
    if (file) await c.startMedia(URL.createObjectURL(file), { label: file.name });
    else if (station.input === 'sample') await c.startMedia(`${import.meta.env.BASE_URL}samples/demo-dispatch.mp3`, { label: 'デモ音声' });
    else if (station.input === 'mic') await c.startMic();
    else if (station.input === 'tab') await c.startTab();
    else if (station.input === 'stream' && station.url) await c.startStream(station.url);
  } catch (e: any) {
    const msg = e?.name === 'NotAllowedError' ? '音声の利用が許可されませんでした。ブラウザの設定で許可してください。' : e?.message || String(e);
    patchSession(stationId, { running: false, notice: msg });
  }
}

export async function stopLive(stationId: string) {
  if (pendingStart?.stationId === stationId) pendingStart = null;
  await captures.get(stationId)?.stop();
}

export async function stopAll() {
  pendingStart = null;
  await Promise.all([...captures.values()].map((c) => c.stop()));
}

function onResult({ id, caption, ms }: { id: number; caption: any; ms: any }) {
  const stationId = liveIds.get(id);
  if (!stationId) return;
  liveIds.delete(id);
  const session = getState().sessions[stationId] || EMPTY_SESSION;
  patchSession(stationId, (x) => ({ pending: Math.max(0, x.pending - 1) }));
  if (!caption) return;
  const st = getState();
  const station = stationById(stationId);
  const alerts = st.settings.alertsOn ? matchAlerts(caption, st.settings.alertKeywords) : [];
  const item: Transmission = history.add({
    ...caption,
    stationId,
    stationName: station?.name,
    source: session.fileName || station?.name,
    ms,
    ...(alerts.length ? { alerts } : {}),
  });
  setState((s) => ({ history: [...history.items], historyVersion: s.historyVersion + 1 }));
  if (alerts.length) notifyAlert(item, alerts);
  if (st.settings.autoSpeak) speaker.speak(runningCount() > 1 ? `${station?.name || ''}。${item.ja}` : item.ja);
}

/* ---------- キーワード通知 ---------- */
function notifyAlert(item: Transmission, alerts: string[]) {
  const s = getState().settings;
  if (s.alertSound) playChime();
  // 画面を見ていないときだけ、端末の通知を出す（許可済みの場合）
  if (s.alertNotify && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    try {
      new Notification(`RADIO LINGUA：${alerts.join('、')}`, { body: `${item.stationName || ''} ${item.ja}`.trim(), tag: item.id, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
    } catch {
      /* 通知が使えない環境では音と画面表示のみ */
    }
  }
}

/** 端末の通知の許可を求める（利用者が通知をオンにしたときだけ呼ぶ） */
export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/* ---------- 読み上げ（交信ごと） ---------- */
export function toggleSpeak(item: Transmission) {
  if (getState().speakingId === item.id) {
    speaker.stop();
    setState({ speakingId: null });
    return;
  }
  const ok = speaker.speakNow(item.ja, () => {
    if (getState().speakingId === item.id) setState({ speakingId: null });
  });
  setState({ speakingId: ok ? item.id : null });
}

/* ---------- 局・お気に入り・履歴 ---------- */
export function addStation(input: { name: string; types: string[]; country: string; region: string; input: string; url: string }) {
  const stations = getState().stations;
  const sameCountry = stations.filter((s) => s.country === input.country).length;
  const st = makeUserStation(input, countryCenter(input.country), sameCountry) as Station;
  const next = [...stations, st];
  writeJSON(STATIONS_KEY, next.filter((s) => s.kind === 'user'));
  setState({ stations: next, addStationOpen: false });
  return st;
}

export function removeStation(id: string) {
  const next = getState().stations.filter((s) => s.id !== id || s.kind === 'demo');
  writeJSON(STATIONS_KEY, next.filter((s) => s.kind === 'user'));
  const favorites = getState().favorites.filter((f) => f !== id);
  writeJSON(FAVORITES_KEY, favorites);
  setState({ stations: next, favorites });
}

export function toggleFavorite(id: string) {
  const f = getState().favorites;
  const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
  writeJSON(FAVORITES_KEY, next);
  setState({ favorites: next });
}

export function toggleStar(item: Transmission) {
  history.update(item.id, { starred: !item.starred });
  setState((s) => ({ history: [...history.items], historyVersion: s.historyVersion + 1 }));
}

export function clearHistory() {
  history.clear();
  setState((s) => ({ history: [...history.items], historyVersion: s.historyVersion + 1 }));
}

export function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// テスト・不具合調査用
(window as any).__rl = {
  getState,
  history,
  get capture() {
    return captures.get(getState().focus || 'demo') || null;
  },
  captures,
  startLive,
  get engine() {
    return engine;
  },
  // 実モデルの精度測定（例: await __rl.bench('samples/demo-dispatch.mp3', [...正解文])）。結果は履歴に混ざらない
  bench: (url: string, expected: string[]) => runBench(engine, new URL(url, location.href).href, expected),
};
