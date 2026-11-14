// 画面の骨組み：PCは左の縦メニュー、スマホは下部メニュー。
import { useEffect, useState } from 'react';
import { useApp, setState, runningIds } from './app/store';
import { useRoute, navigate } from './app/router';
import { useMock } from './app/services';
import { MapView } from './views/MapView';
import { LiveView } from './views/LiveView';
import { StationsView, FavoritesView, HistoryView } from './views/ListViews';
import { SettingsDialog, ConsentDialog, AddStationDialog } from './views/Dialogs';
import { AboutView } from './views/AboutView';
import { IconGlobe, IconTower, IconWave, IconStar, IconClock, IconSliders } from './components/Icons';

const NAV = [
  { name: 'map', label: '地図', Icon: IconGlobe },
  { name: 'stations', label: '無線局', Icon: IconTower },
  { name: 'live', label: 'ライブ翻訳', Icon: IconWave },
  { name: 'favorites', label: 'お気に入り', Icon: IconStar },
  { name: 'history', label: '履歴', Icon: IconClock },
] as const;

/** 管制センターらしく、世界標準時と日本時間を表示（実際の時刻） */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (tz: string) => now.toLocaleTimeString('ja-JP', { timeZone: tz, hour12: false });
  return (
    <div className="clock-utc" aria-label="現在時刻">
      <span>
        <b>UTC</b>
        {fmt('UTC')}
      </span>
      <span>
        <b>JST</b>
        {fmt('Asia/Tokyo')}
      </span>
    </div>
  );
}

function EngineBadge() {
  const e = useApp((s) => s.engine);
  const text =
    e.status === 'ready'
      ? `AI準備完了（${e.device === 'webgpu' ? 'GPU' : e.device === 'mock' ? 'テスト' : e.device === 'mixed' ? 'GPU＋CPU' : 'CPU'}）`
      : e.status === 'loading'
        ? `AI準備中 ${Math.round(e.progress * 100)}%`
        : e.status === 'error'
          ? 'AI読み込み失敗'
          : useMock
            ? 'テストモード'
            : 'AI未準備';
  return (
    <span className={`engine engine-${e.status}`} role="status" aria-live="polite">
      <span className="engine-dot" aria-hidden="true" />
      {text}
    </span>
  );
}

export function App() {
  const route = useRoute();
  const anyLive = useApp((s) => runningIds(s).length > 0);
  const lastStation = useApp((s) => s.focus) || 'demo';
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);
  const liveHref = `/live/${route.name === 'live' && route.arg ? route.arg : lastStation}`;

  return (
    <div className={`shell view-${route.name}`}>
      <a className="skip" href="#main">
        本文へ移動
      </a>
      <nav className="rail" aria-label="メインメニュー">
        <a className="brand" href="#/map" aria-label="RADIO LINGUA 地図へ">
          <svg viewBox="0 0 32 32" aria-hidden="true" className="brand-glyph">
            <circle cx="16" cy="16" r="3" />
            <path d="M9.5 9.5a9.2 9.2 0 000 13M22.5 9.5a9.2 9.2 0 010 13M5.4 5.4a15 15 0 000 21.2M26.6 5.4a15 15 0 010 21.2" />
          </svg>
          <span className="brand-word">
            RADIO<b>LINGUA</b>
          </span>
        </a>
        <ul className="nav">
          {NAV.map(({ name, label, Icon }) => {
            const href = name === 'live' ? liveHref : `/${name}`;
            const on = route.name === name;
            return (
              <li key={name}>
                <a href={`#${href}`} className={`nav-item${on ? ' is-on' : ''}`} aria-current={on ? 'page' : undefined}>
                  <Icon size={22} />
                  <span>{label}</span>
                  {name === 'live' && anyLive && <span className="nav-live" aria-label="受信中" />}
                </a>
              </li>
            );
          })}
        </ul>
        <a className={`rail-about${route.name === 'about' ? ' is-on' : ''}`} href="#/about">
          このアプリ
          <br />
          について
        </a>
      </nav>
      <div className="frame">
        <header className="topbar">
          <a className="brand brand-mobile" href="#/map" aria-label="RADIO LINGUA 地図へ">
            <span className="brand-word">
              RADIO<b>LINGUA</b>
            </span>
          </a>
          <Clock />
          <EngineBadge />
          <button className="icon-btn" onClick={() => setState({ settingsOpen: true })} aria-label="設定" title="設定">
            <IconSliders size={20} />
          </button>
        </header>
        <main id="main" className="main">
          {route.name === 'map' && <MapView />}
          {route.name === 'stations' && <StationsView />}
          {route.name === 'live' && <LiveView stationId={route.arg || lastStation} />}
          {route.name === 'favorites' && <FavoritesView />}
          {route.name === 'history' && <HistoryView />}
          {route.name === 'about' && <AboutView tab={route.arg} />}
          {!NAV.some((n) => n.name === route.name) && route.name !== 'about' && (
            <section className="pageview">
              <p className="empty">
                ページが見つかりません。<button className="text-btn" onClick={() => navigate('/map')}>地図へ戻る</button>
              </p>
            </section>
          )}
        </main>
      </div>
      <SettingsDialog />
      <ConsentDialog />
      <AddStationDialog />
    </div>
  );
}
