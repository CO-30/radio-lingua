// 無線局一覧・お気に入り・履歴の画面。
import { useMemo, useState } from 'react';
import { useApp, setState, type Kind } from '../app/store';
import { clearHistory, download, history, removeStation } from '../app/services';
import { countryName } from '../app/geo';
import { filterStations } from '../core/stations.js';
import { LIVE_PROVIDERS, TYPE_LABEL } from '../data/sources.js';
import { StationCard, TransmissionRow } from '../components/Rows';
import { KindIcon, IconPlus, IconSearch, IconTrash } from '../components/Icons';

const KINDS: (Kind | 'all')[] = ['all', 'police', 'fire', 'ems'];

function KindChips({ value, onChange, withOther = false }: { value: string; onChange: (v: any) => void; withOther?: boolean }) {
  const list = withOther ? [...KINDS, 'other'] : KINDS;
  return (
    <div className="chips" role="radiogroup" aria-label="種別">
      {list.map((k) => (
        <button key={k} role="radio" aria-checked={value === k} className={`chip${value === k ? ' is-on' : ''}${k !== 'all' ? ` kind-${k}` : ''}`} onClick={() => onChange(k)}>
          {k !== 'all' && <KindIcon kind={k as Kind} size={14} />}
          {k === 'all' ? 'すべて' : TYPE_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

export function StationsView() {
  const stations = useApp((s) => s.stations);
  const favorites = useApp((s) => s.favorites);
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('all');
  const [country, setCountry] = useState('all');
  const countries = useMemo(() => [...new Set(stations.map((s) => s.country))].map((a2) => ({ a2, name: countryName(a2) })), [stations]);
  const list = filterStations(stations, { q, type, country, favorites }, countryName);
  return (
    <section className="pageview" aria-labelledby="stationsTitle">
      <header className="page-head">
        <div>
          <h1 id="stationsTitle">無線局</h1>
          <p className="page-lead">受信できる局の一覧です。お持ちの受信機や、利用権のある配信を局として追加できます。</p>
        </div>
        <button className="btn btn-primary" onClick={() => setState({ addStationOpen: true })}>
          <IconPlus size={16} />
          局を追加
        </button>
      </header>
      <div className="filters">
        <label className="search">
          <IconSearch size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="局名・国・地域で検索" aria-label="局名・国・地域で検索" />
        </label>
        <KindChips value={type} onChange={setType} />
        <select className="select" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="国・地域">
          <option value="all">すべての国・地域</option>
          {countries.map((c) => (
            <option key={c.a2} value={c.a2}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {list.length ? (
        <div className="station-grid">
          {list.map((s) => (
            <div key={s.id} className="station-cell">
              <StationCard station={s} />
              {s.kind === 'user' && (
                <button
                  className="text-btn danger remove"
                  onClick={() => {
                    if (confirm(`「${s.name}」を削除します。この局の交信ログは履歴に残ります。`)) removeStation(s.id);
                  }}
                >
                  <IconTrash size={14} />
                  削除
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">条件に合う局はありません。</p>
      )}

      <h2 className="section-title">準備中の提供元</h2>
      <p className="page-lead">実在の警察・消防・救急の配信は、提供元の利用許諾を確認してから追加します。</p>
      <div className="provider-grid">
        {LIVE_PROVIDERS.map((p: any) => (
          <article key={p.id} className={`provider status-${p.status}`}>
            <h3>{p.name}</h3>
            <p className="provider-status">
              <span className={`status ${p.status === 'blocked' ? 'status-bad' : 'status-warn'}`}>{p.status === 'blocked' ? '利用不可' : '未確認'}</span>
              {p.statusText}
            </p>
            <p className="provider-meta">
              {p.countries.join('、')}／{p.types.map((t: string) => TYPE_LABEL[t]).join('・')}
            </p>
            <p className="provider-note">{p.note}</p>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              公式サイトを開く
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FavoritesView() {
  const stations = useApp((s) => s.stations);
  const favorites = useApp((s) => s.favorites);
  const all = useApp((s) => s.history);
  const favStations = stations.filter((s) => favorites.includes(s.id));
  const starred = all.filter((h) => h.starred).slice().reverse();
  return (
    <section className="pageview" aria-labelledby="favTitle">
      <header className="page-head">
        <div>
          <h1 id="favTitle">お気に入り</h1>
          <p className="page-lead">よく聞く局と、重要な交信（☆を付けたもの）をまとめて確認できます。</p>
        </div>
      </header>
      <h2 className="section-title">お気に入りの局</h2>
      {favStations.length ? (
        <div className="station-grid">
          {favStations.map((s) => (
            <StationCard key={s.id} station={s} />
          ))}
        </div>
      ) : (
        <p className="empty">局の☆を押すと、ここに表示されます。</p>
      )}
      <h2 className="section-title">重要な交信</h2>
      {starred.length ? (
        <ol className="tx-list">
          {starred.map((it) => (
            <TransmissionRow key={it.id} item={it} showStation />
          ))}
        </ol>
      ) : (
        <p className="empty">ライブ翻訳や履歴で交信の☆を押すと、ここに残ります。</p>
      )}
    </section>
  );
}

function dateLabel(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function HistoryView() {
  const all = useApp((s) => s.history);
  const saveHistory = useApp((s) => s.settings.saveHistory);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all
      .filter((h) => (type === 'all' || h.category === type) && (!starredOnly || h.starred) && (!query || `${h.ja} ${h.en} ${h.stationName || ''}`.toLowerCase().includes(query)))
      .slice()
      .reverse();
  }, [all, q, type, starredOnly]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const it of list) {
      const k = dateLabel(it.ts);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return [...m.entries()];
  }, [list]);
  return (
    <section className="pageview" aria-labelledby="histTitle">
      <header className="page-head">
        <div>
          <h1 id="histTitle">履歴</h1>
          <p className="page-lead">{saveHistory ? '翻訳した交信はこの端末にだけ保存されます（最大1,000件）。' : '履歴を保存しない設定です。画面を閉じると消えます。'}</p>
        </div>
        <div className="page-tools">
          <button className="btn btn-ghost btn-small" disabled={!all.length} onClick={() => download(`radio-lingua-${Date.now()}.txt`, history.toText(), 'text/plain')}>
            テキストで保存
          </button>
          <button className="btn btn-ghost btn-small" disabled={!all.length} onClick={() => download(`radio-lingua-${Date.now()}.json`, history.toJSON(), 'application/json')}>
            JSONで保存
          </button>
          <button
            className="btn btn-ghost btn-small danger"
            disabled={!all.length}
            onClick={() => {
              if (confirm('この端末に保存された交信ログをすべて消去します。元に戻せません。')) clearHistory();
            }}
          >
            すべて消去
          </button>
        </div>
      </header>
      <div className="filters">
        <label className="search">
          <IconSearch size={16} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="訳文・原文・局名で検索" aria-label="訳文・原文・局名で検索" />
        </label>
        <KindChips value={type} onChange={setType} withOther />
        <label className="switch">
          <input type="checkbox" checked={starredOnly} onChange={(e) => setStarredOnly(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          重要のみ
        </label>
      </div>
      <p className="count">{list.length}件</p>
      {groups.length ? (
        groups.map(([label, items]) => (
          <section key={label} className="day">
            <h2 className="day-title">{label}</h2>
            <ol className="tx-list">
              {items.map((it) => (
                <TransmissionRow key={it.id} item={it} showStation />
              ))}
            </ol>
          </section>
        ))
      ) : (
        <p className="empty">{all.length ? '条件に合う交信はありません。' : 'まだ交信はありません。ライブ翻訳を始めると、ここに記録されます。'}</p>
      )}
    </section>
  );
}
