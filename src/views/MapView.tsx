// 地図画面：世界の受信状況を見渡し、国・局を選んでライブ翻訳へ進む。
import { useMemo, useState } from 'react';
import { WorldMap } from '../components/WorldMap';
import { StationCard, fmtTime } from '../components/Rows';
import { KindIcon, IconClose, IconPlus } from '../components/Icons';
import { useApp, setState } from '../app/store';
import { countryName, PROVIDER_COUNTRIES } from '../app/geo';
import { navigate } from '../app/router';
import { LIVE_PROVIDERS } from '../data/sources.js';

export function MapView() {
  const stations = useApp((s) => s.stations);
  const live = useApp((s) => s.live);
  const history = useApp((s) => s.history);
  const [country, setCountry] = useState<string | null>(null);
  const [selStation, setSelStation] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const pending = useMemo(() => new Set(Object.values(PROVIDER_COUNTRIES).flat()), []);
  const inCountry = country ? stations.filter((s) => s.country === country) : [];
  const providersHere = country ? LIVE_PROVIDERS.filter((p: any) => PROVIDER_COUNTRIES[p.id]?.includes(country)) : [];
  const latest = history[history.length - 1];
  const countries = new Set(stations.map((s) => s.country)).size;

  const selectCountry = (a2: string | null) => {
    setCountry(a2);
    setSelStation(null);
    if (a2) setSheetOpen(true);
  };

  return (
    <section className="mapview" aria-label="世界の通信マップ">
      <div className="map-stage">
        <div className="map-stats" aria-label="受信状況">
          <div className="stat">
            <span className="stat-num ok">{stations.length}</span>
            <span className="stat-label">受信可能な局</span>
          </div>
          <div className="stat">
            <span className="stat-num">{countries}</span>
            <span className="stat-label">国・地域</span>
          </div>
          <div className="stat">
            <span className="stat-num warn">{LIVE_PROVIDERS.filter((p: any) => p.status === 'contract' || p.status === 'permission').length}</span>
            <span className="stat-label">許諾確認中の提供元</span>
          </div>
        </div>
        <WorldMap
          stations={stations}
          selectedCountry={country}
          selectedStation={selStation}
          liveStation={live.running ? live.stationId : null}
          pendingCountries={pending}
          onSelectCountry={selectCountry}
          onSelectStation={(id) => {
            const st = stations.find((s) => s.id === id);
            setCountry(st?.country || null);
            setSelStation(id);
            setSheetOpen(true);
          }}
        />
        <ul className="legend" aria-label="凡例">
          <li>
            <span className="legend-dot dot-station" />
            受信できる局がある国
          </li>
          <li>
            <span className="legend-dot dot-pending" />
            提供元の許諾・契約待ち
          </li>
          <li className="legend-kinds">
            <span className="kind kind-police">
              <KindIcon kind="police" size={14} />
              警察
            </span>
            <span className="kind kind-fire">
              <KindIcon kind="fire" size={14} />
              消防
            </span>
            <span className="kind kind-ems">
              <KindIcon kind="ems" size={14} />
              救急
            </span>
          </li>
        </ul>
      </div>

      <aside className={`map-panel${sheetOpen ? ' is-open' : ''}`} aria-label={country ? `${countryName(country)}の無線局` : '受信状況'}>
        <button className="sheet-handle" onClick={() => setSheetOpen(!sheetOpen)} aria-expanded={sheetOpen} aria-label={sheetOpen ? 'パネルを閉じる' : 'パネルを開く'}>
          <span />
        </button>
        {country ? (
          <>
            <header className="panel-head">
              <div>
                <p className="panel-kicker">選択中の国・地域</p>
                <h2 className="panel-title">{countryName(country)}</h2>
              </div>
              <button className="icon-btn" onClick={() => selectCountry(null)} aria-label="世界全体に戻る" title="世界全体に戻る">
                <IconClose size={18} />
              </button>
            </header>
            {inCountry.length > 0 ? (
              <div className="station-list">
                {[...inCountry].sort((a, b) => (a.id === selStation ? -1 : b.id === selStation ? 1 : 0)).map((s) => (
                  <StationCard key={s.id} station={s} />
                ))}
              </div>
            ) : (
              <p className="empty">この国で受信できる局はまだありません。お手持ちの受信機や、利用権のある配信があれば局として追加できます。</p>
            )}
            {providersHere.length > 0 && (
              <div className="providers-here">
                <h3 className="sub-title">準備中の提供元</h3>
                {providersHere.map((p: any) => (
                  <p key={p.id} className="provider-line">
                    <span className="status status-warn">未確認</span>
                    {p.name}：{p.statusText}
                  </p>
                ))}
              </div>
            )}
            <button className="btn btn-ghost" onClick={() => setState({ addStationOpen: country })}>
              <IconPlus size={16} />
              {countryName(country)}に局を追加
            </button>
          </>
        ) : (
          <>
            <header className="panel-head">
              <div>
                <p className="panel-kicker">ライブ</p>
                <h2 className="panel-title">世界の受信状況</h2>
              </div>
            </header>
            <p className="panel-lead">地図の国をタップすると、その国の無線局が表示されます。英語の交信を端末の中のAIが日本語に翻訳します。</p>
            {latest ? (
              <button className="latest" onClick={() => navigate(`/live/${latest.stationId || 'demo'}`)}>
                <span className="latest-head">
                  <span className="latest-label">最新の交信</span>
                  <time>{fmtTime(latest.ts)}</time>
                  <span className="latest-station">{latest.stationName}</span>
                </span>
                <span className="latest-ja">{latest.ja}</span>
              </button>
            ) : null}
            <div className="station-list">
              {stations.slice(0, 3).map((s) => (
                <StationCard key={s.id} station={s} />
              ))}
            </div>
            <p className="panel-note">
              実在の警察・消防・救急の配信は、提供元の利用許諾が確認でき次第ここに追加されます。現在はアンバーの国で確認中です。
            </p>
          </>
        )}
      </aside>
    </section>
  );
}
