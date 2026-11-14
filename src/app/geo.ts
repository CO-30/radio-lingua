// 世界地図の座標計算と国名。点描データは scripts/build-worldmap.mjs で生成。
import worldmap from '../data/worldmap.json';

export interface Country {
  a2: string;
  en: string;
  c: [number, number];
  b: [number, number, number, number];
}

export const WORLD = worldmap as unknown as {
  step: number;
  lon0: number;
  latMax: number;
  cols: number;
  rows: number;
  countries: Country[];
  dots: number[];
};

/** 地図座標：経度 -180〜180 を x=0〜cols、緯度 latMax〜 を y=0〜rows（格子単位） */
export const MAP_W = WORLD.cols;
export const MAP_H = WORLD.rows;
export function project(lon: number, lat: number): [number, number] {
  return [(lon - WORLD.lon0) / WORLD.step, (WORLD.latMax - lat) / WORLD.step + 0.5];
}

const names = (() => {
  try {
    return new Intl.DisplayNames(['ja'], { type: 'region' });
  } catch {
    return null;
  }
})();

const byA2 = new Map(WORLD.countries.map((c, i) => [c.a2, i]));

export function countryName(a2: string) {
  if (!a2) return '';
  try {
    const n = names?.of(a2);
    if (n && n !== a2) return n;
  } catch {}
  const c = WORLD.countries[byA2.get(a2) ?? -1];
  return c?.en || a2;
}

export function countryIndex(a2: string) {
  return byA2.get(a2) ?? -1;
}

/** 国の点の重心（本土の中心に近い）。局の初期位置に使う */
const centers = new Map<string, [number, number]>();
export function countryCenter(a2: string): [number, number] {
  if (centers.has(a2)) return centers.get(a2)!;
  const ci = countryIndex(a2);
  const pts: [number, number][] = [];
  for (let i = 0; i < WORLD.dots.length; i += 3) {
    if (WORLD.dots[i + 2] !== ci) continue;
    pts.push([WORLD.lon0 + (WORLD.dots[i] + 0.5) * WORLD.step, WORLD.latMax - WORLD.dots[i + 1] * WORLD.step]);
  }
  let res: [number, number];
  if (!pts.length) res = WORLD.countries[ci]?.c || [0, 0];
  else {
    // 飛び地（アラスカ等）に引っ張られないよう中央値を使う
    const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
    const ys = pts.map((p) => p[1]).sort((a, b) => a - b);
    res = [xs[xs.length >> 1], ys[ys.length >> 1]];
  }
  centers.set(a2, res);
  return res;
}

/** 国の表示範囲（格子単位）。点の分布の5〜95%で、飛び地を除いた本土に寄せる */
export function countryView(a2: string): { x: number; y: number; w: number; h: number } | null {
  const ci = countryIndex(a2);
  if (ci < 0) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < WORLD.dots.length; i += 3) {
    if (WORLD.dots[i + 2] !== ci) continue;
    xs.push(WORLD.dots[i]);
    ys.push(WORLD.dots[i + 1]);
  }
  if (!xs.length) return null;
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))];
  const x0 = q(xs, 0.04);
  const x1 = q(xs, 0.96) + 1;
  const y0 = q(ys, 0.04);
  const y1 = q(ys, 0.96) + 1;
  const pad = Math.max(6, (x1 - x0) * 0.35);
  return { x: x0 - pad, y: y0 - pad * 0.6, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 1.2 };
}

/** 一覧用：日本語の国名で並べた国の一覧 */
export function countryOptions() {
  return WORLD.countries.map((c) => ({ a2: c.a2, name: countryName(c.a2) })).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

/** 提供元の対応国（契約・許諾待ち） */
export const PROVIDER_COUNTRIES: Record<string, string[]> = {
  'broadcastify-calls': ['US', 'CA', 'AU'],
  openmhz: ['US'],
};
