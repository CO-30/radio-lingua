// 画面全体の状態。React からは useApp(selector) で読む。
import { useSyncExternalStore } from 'react';

export type Kind = 'police' | 'fire' | 'ems' | 'other';
export type Input = 'sample' | 'mic' | 'tab' | 'stream';

export interface Station {
  id: string;
  name: string;
  nameEn?: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  types: Kind[];
  kind: 'demo' | 'user';
  input: Input;
  url?: string;
  status: 'available';
  note: string;
}

export interface Word {
  w: string;
  p: number;
}

export interface Transmission {
  id: string;
  ts: number;
  en: string;
  enForMt?: string;
  ja: string;
  codes: { code: string; ja: string }[];
  units: { label: string; ja: string; kind: Kind }[];
  category: Kind;
  words?: Word[];
  stationId?: string;
  stationName?: string;
  source?: string;
  starred?: boolean;
  ms?: { asr: number; mt: number };
}

export interface Settings {
  asr: 'accurate' | 'standard' | 'light';
  mt: 'lfm2' | 'fugu';
  showEn: boolean;
  rate: number;
  size: number;
  forceWasm: boolean;
  autoSpeak: boolean;
  saveHistory: boolean;
}

export interface AppState {
  engine: { status: 'idle' | 'loading' | 'ready' | 'error'; device: string | null; progress: number; detail: string; error: string | null };
  live: { stationId: string | null; running: boolean; startedAt: number; pending: number; notice: string | null; fileName: string | null };
  stations: Station[];
  favorites: string[];
  history: Transmission[];
  historyVersion: number;
  settings: Settings;
  consent: { open: boolean; mb: number; asrLabel: string; mtLabel: string };
  speakingId: string | null;
  settingsOpen: boolean;
  addStationOpen: boolean | string; // 文字列＝国を指定して開く
}

type Listener = () => void;
let state: AppState;
const listeners = new Set<Listener>();

export function initState(s: AppState) {
  state = s;
}
export function getState() {
  return state;
}
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}
