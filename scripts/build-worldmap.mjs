// 点描の世界地図データを作る（ビルド前に1回）。
// 元データ: Natural Earth（パブリックドメイン）を world-atlas（ISC）経由で使用。
// 出力: src/data/worldmap.json — 格子点ごとに所属国を持つ点の一覧と、国ごとの中心・範囲。
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoContains, geoBounds, geoCentroid } from 'd3-geo';
import countriesLib from 'i18n-iso-countries';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const fc = feature(topo, topo.objects.countries);

const STEP = 1.25;
const LAT_MAX = 82;
const LAT_MIN = -56; // 南極は除く
const LON0 = -180;
const cols = Math.round(360 / STEP);
const rows = Math.round((LAT_MAX - LAT_MIN) / STEP) + 1;

const countries = [];
const index = new Map();
for (const f of fc.features) {
  const a2 = countriesLib.numericToAlpha2(String(f.id).padStart(3, '0'));
  if (!a2 || f.properties.name === 'Antarctica') continue;
  const [[w, s], [e, n]] = geoBounds(f);
  const [cx, cy] = geoCentroid(f);
  index.set(f, countries.length);
  countries.push({ a2, en: f.properties.name, c: [round(cx), round(cy)], b: [round(w), round(s), round(e), round(n)], f });
}

function round(v) {
  return Math.round(v * 100) / 100;
}

const dots = [];
const hasDot = new Set();
for (let r = 0; r < rows; r++) {
  const lat = LAT_MAX - r * STEP;
  for (let c = 0; c < cols; c++) {
    const lon = LON0 + (c + 0.5) * STEP;
    for (const [ci, ct] of countries.entries()) {
      const [w, s, e, n] = ct.b;
      const inBox = lat >= s - 0.01 && lat <= n + 0.01 && (w <= e ? lon >= w - 0.01 && lon <= e + 0.01 : lon >= w || lon <= e);
      if (!inBox) continue;
      if (geoContains(ct.f, [lon, lat])) {
        dots.push(c, r, ci);
        hasDot.add(ci);
        break;
      }
    }
  }
}
// 点が1つも落ちない小さな国・島は中心に1点置く（選べるように）
for (const [ci, ct] of countries.entries()) {
  if (hasDot.has(ci)) continue;
  const c = Math.min(cols - 1, Math.max(0, Math.floor((ct.c[0] - LON0) / STEP)));
  const r = Math.min(rows - 1, Math.max(0, Math.round((LAT_MAX - ct.c[1]) / STEP)));
  dots.push(c, r, ci);
}

const out = {
  source: 'Natural Earth 1:50m (public domain) via world-atlas',
  step: STEP,
  lon0: LON0,
  latMax: LAT_MAX,
  cols,
  rows,
  countries: countries.map(({ a2, en, c, b }) => ({ a2, en, c, b })),
  dots,
};
writeFileSync(new URL('../src/data/worldmap.json', import.meta.url), JSON.stringify(out));
console.log(`countries ${countries.length}, dots ${dots.length / 3}, grid ${cols}x${rows}`);
