// 無線局カタログ。受信できる局は「デモ局」と「利用者が追加した局」だけ。
// 提供元（契約・許諾待ち）は国単位の状態として扱い、局としては載せない（docs/LEGAL.md）。

export const DEMO_STATION = Object.freeze({
  id: 'demo',
  name: 'デモ局',
  nameEn: 'Demo Dispatch',
  country: 'US',
  region: '架空の地域（デモ）',
  lat: 41.6,
  lon: -93.6,
  types: ['fire', 'ems', 'police'],
  kind: 'demo',
  input: 'sample',
  status: 'available',
  note: '架空の交信を合成音声で再現したデモです。実在の局・交信ではありません。',
});

export const INPUT_LABEL = { sample: 'デモ音声', mic: 'マイク・受信機', tab: 'ブラウザのタブ音声', stream: '配信URL' };

/** 利用者が追加する局を作る。位置は国の中心付近（同じ国の局が重ならないよう少しずらす） */
export function makeUserStation({ name, types, country, region = '', input, url = '' }, center, nth = 0) {
  const n = String(name || '').trim();
  if (!n) throw new Error('局の名前を入力してください。');
  if (!types?.length) throw new Error('警察・消防・救急のいずれかを選んでください。');
  if (!country) throw new Error('国・地域を選んでください。');
  if (!INPUT_LABEL[input] || input === 'sample') throw new Error('音声の取り込み方法を選んでください。');
  if (input === 'stream' && !/^https:\/\/\S+$/i.test(url)) throw new Error('配信URLは https:// で始まるアドレスを入力してください。');
  const angle = nth * 2.4;
  const r = nth ? 1.2 + 0.4 * Math.sqrt(nth) : 0;
  return {
    id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: n,
    country,
    region: String(region).trim(),
    lat: (center?.[1] ?? 0) + r * Math.sin(angle),
    lon: (center?.[0] ?? 0) + r * Math.cos(angle),
    types: [...types],
    kind: 'user',
    input,
    url: input === 'stream' ? url.trim() : '',
    status: 'available',
    note: '利用者が追加した局です。音声の利用条件は利用者ご自身でご確認ください。',
  };
}

/**
 * 一覧の絞り込み
 * @param {any[]} list
 * @param {{q?: string, type?: string, country?: string, favoritesOnly?: boolean, favorites?: string[]}} [opts]
 * @param {(c: string) => string} [countryName]
 * @returns {any[]}
 */
export function filterStations(list, { q = '', type = 'all', country = 'all', favoritesOnly = false, favorites = [] } = {}, countryName = (c) => c) {
  const query = q.trim().toLowerCase();
  return list.filter((s) => {
    if (type !== 'all' && !s.types.includes(type)) return false;
    if (country !== 'all' && s.country !== country) return false;
    if (favoritesOnly && !favorites.includes(s.id)) return false;
    if (!query) return true;
    return [s.name, s.nameEn, s.region, countryName(s.country), s.country].some((x) => x && String(x).toLowerCase().includes(query));
  });
}

export function countByCountry(list) {
  const m = new Map();
  for (const s of list) m.set(s.country, (m.get(s.country) || 0) + 1);
  return m;
}
