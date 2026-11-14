// ライブ翻訳画面：無線を聞きながら、原文と日本語訳を並べて確認する。
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, setState, useSession, runningIds } from '../app/store';
import { startLive, stopLive, stationById, updateSettings, MAX_SESSIONS } from '../app/services';
import { countryName } from '../app/geo';
import { navigate } from '../app/router';
import { INPUT_LABEL } from '../core/stations.js';
import { TYPE_LABEL } from '../data/sources.js';
import { Waveform } from '../components/Waveform';
import { TransmissionRow } from '../components/Rows';
import { KindIcon, IconBack, IconFile, IconPlay, IconStop } from '../components/Icons';
import { canCaptureTab } from '../core/capture.js';

function useElapsed(running: boolean, startedAt: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);
  if (!running) return '00:00';
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function LiveView({ stationId }: { stationId: string }) {
  const station = useApp((s) => s.stations.find((x) => x.id === stationId) || s.stations[0]);
  const session = useSession(stationId);
  const others = useApp((s) => runningIds(s).filter((id) => id !== stationId).join(','));
  const focus = useApp((s) => s.focus);
  const engine = useApp((s) => s.engine);
  const allHistory = useApp((s) => s.history);
  const autoSpeak = useApp((s) => s.settings.autoSpeak);
  const alertsOn = useApp((s) => s.settings.alertsOn);
  const alertCount = useApp((s) => s.settings.alertKeywords.length);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [stick, setStick] = useState(true);

  const isThis = focus === station.id; // AIの準備を待っているのがこの局か
  const running = session.running;
  const otherIds = others ? others.split(',') : [];
  const full = !running && otherIds.length >= MAX_SESSIONS;
  const elapsed = useElapsed(running, session.startedAt);
  const items = useMemo(() => allHistory.filter((h) => h.stationId === station.id).slice(-150), [allHistory, station.id]);

  // 新しい交信が来たら一番下へ（利用者が上を読んでいるときは動かさない）
  useEffect(() => {
    if (stick) listRef.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [items.length, stick]);
  useEffect(() => {
    const onScroll = () => setStick(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tabUnsupported = station.input === 'tab' && !canCaptureTab();
  const loading = engine.status === 'loading';

  let statusText = '待機中';
  if (running) statusText = '受信中';
  else if (loading && isThis) statusText = 'AI準備中';

  return (
    <section className="liveview" aria-label={`${station.name}のライブ翻訳`}>
      <header className={`live-head${running ? ' is-live' : ''}`}>
        <button className="icon-btn back" onClick={() => navigate('/stations')} aria-label="無線局一覧へ戻る" title="無線局一覧へ">
          <IconBack size={18} />
        </button>
        <div className="live-title">
          <p className="live-kicker">
            {countryName(station.country)}
            {station.region ? `・${station.region}` : ''}
          </p>
          <h1>
            {station.name}
            {station.kind === 'demo' && <span className="badge badge-demo">デモ</span>}
          </h1>
          <p className="live-kinds">
            {station.types.map((t) => (
              <span key={t} className={`kind kind-${t}`}>
                <KindIcon kind={t} size={14} />
                {TYPE_LABEL[t]}
              </span>
            ))}
            <span className="live-input">{INPUT_LABEL[station.input]}</span>
          </p>
        </div>
        <div className="live-status" role="status" aria-live="polite">
          <span className={`signal${running ? ' on' : ''}`} aria-hidden="true" />
          <span className="live-status-text">{statusText}</span>
          <span className="live-clock">{elapsed}</span>
        </div>
      </header>

      <div className="live-console">
        <Waveform active={running} stationId={station.id} />
        <div className="live-controls">
          {running ? (
            <button className="btn btn-stop" onClick={() => stopLive(station.id)}>
              <IconStop size={16} />
              停止
            </button>
          ) : (
            <button className="btn btn-primary btn-big" disabled={loading || full || tabUnsupported} onClick={() => startLive(station.id)}>
              <IconPlay size={16} />
              {loading && isThis ? 'AI準備中…' : '受信して翻訳'}
            </button>
          )}
          <button className="btn btn-ghost" disabled={running || loading || full} onClick={() => fileRef.current?.click()}>
            <IconFile size={16} />
            録音ファイルを翻訳
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,video/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void startLive(station.id, f);
              e.target.value = '';
            }}
          />
          <label className="switch">
            <input type="checkbox" checked={autoSpeak} onChange={(e) => updateSettings({ autoSpeak: e.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
            新しい交信を読み上げ
          </label>
          <button className={`text-btn alert-state${alertsOn && alertCount ? ' is-on' : ''}`} onClick={() => setState({ settingsOpen: true })}>
            {alertsOn && alertCount ? `キーワード通知：${alertCount}語` : 'キーワード通知を設定'}
          </button>
        </div>
        {loading && isThis && (
          <div className="prep">
            <p>端末の中で動くAIを準備しています。初回は数分かかることがあります。</p>
            <div className="progress" aria-hidden="true">
              <div className="progress-fill" style={{ transform: `scaleX(${engine.progress})` }} />
            </div>
            <p className="prep-detail">{engine.detail}</p>
          </div>
        )}
        {engine.status === 'error' && (
          <p className="notice notice-error">AIモデルを読み込めませんでした（{engine.error}）。通信状況を確認して、もう一度お試しください。</p>
        )}
        {otherIds.length > 0 && (
          <div className="others" aria-label="同時に受信中の局">
            <span className="others-label">同時に受信中</span>
            {otherIds.map((id) => (
              <button key={id} className="other-chip" onClick={() => navigate(`/live/${id}`)}>
                <span className="other-dot" aria-hidden="true" />
                {stationById(id)?.name}
              </button>
            ))}
            {full && <span className="others-note">同時に受信できるのは{MAX_SESSIONS}局までです</span>}
          </div>
        )}
        {tabUnsupported && <p className="notice">タブ音声の取り込みはパソコンの Chrome・Edge のみ対応です。</p>}
        {session.notice && <p className="notice notice-warn">{session.notice}</p>}
        {station.kind === 'demo' && !running && <p className="hint">架空の通報を合成音声で再現したデモです（約44秒）。実在の交信ではありません。</p>}
        {station.input === 'mic' && !running && <p className="hint">受信機のスピーカーの近くに端末を置いてください。読み上げを使う場合はイヤホンをおすすめします。</p>}
      </div>

      <div className="tx-head" aria-hidden="true">
        <span>時刻・種別</span>
        <span>原文（英語）</span>
        <span>日本語訳</span>
        <span />
      </div>
      {items.length ? (
        <ol className="tx-list" ref={listRef} aria-label="交信">
          {items.map((it) => (
            <TransmissionRow key={it.id} item={it} />
          ))}
          {session.pending > 0 && (
            <li className="tx tx-pending" aria-live="polite">
              <span className="pending-dots" aria-hidden="true" />
              聞き取り中… {session.pending > 1 ? `（${session.pending}件）` : ''}
            </li>
          )}
        </ol>
      ) : (
        <div className="empty-live">
          {session.pending > 0 ? <p>聞き取り中…</p> : <p>「受信して翻訳」を押すと、交信がここに原文と日本語訳で並びます。</p>}
        </div>
      )}
      <p className="disclaimer">AIによる翻訳には誤りが含まれます。黄色の下線は聞き取りが不確かな語です。緊急時の判断や公式情報の代わりには使わないでください。</p>
    </section>
  );
}
