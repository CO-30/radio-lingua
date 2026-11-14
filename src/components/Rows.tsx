// 交信1件の行と、無線局のカード。
import { useMemo, useState } from 'react';
import { markText, uncertainWords } from '../core/confidence.js';
import { findTerms } from '../core/glossary.js';
import { INPUT_LABEL } from '../core/stations.js';
import { TYPE_LABEL } from '../data/sources.js';
import { useApp, useSession, type Station, type Transmission } from '../app/store';
import { toggleSpeak, toggleStar, toggleFavorite } from '../app/services';
import { countryName } from '../app/geo';
import { navigate } from '../app/router';
import { KindIcon, IconSpeaker, IconStop, IconStar } from './Icons';

export function fmtTime(ts: number) {
  return new Date(ts).toTimeString().slice(0, 8);
}

export function TransmissionRow({ item, showStation = false }: { item: Transmission; showStation?: boolean }) {
  const speakingId = useApp((s) => s.speakingId);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const parts = useMemo(() => markText(item.en, item.words || []), [item.en, item.words]);
  const unsure = useMemo(() => uncertainWords(item.words || []), [item.words]);
  const terms = useMemo(() => findTerms(item.enForMt || item.en), [item.en, item.enForMt]);
  const speaking = speakingId === item.id;
  const cat = item.category || 'other';
  // 届いた直後の交信だけ、ほのかに光らせる（一覧を開いただけでは光らせない）
  const [isNew] = useState(() => Date.now() - item.ts < 3000);
  return (
    <li className={`tx cat-${cat}${item.starred ? ' is-starred' : ''}${isNew ? ' is-new' : ''}${item.alerts?.length ? ' is-alert' : ''}`}>
      <div className="tx-meta">
        <time className="tx-time" dateTime={new Date(item.ts).toISOString()}>
          {fmtTime(item.ts)}
        </time>
        <span className={`kind kind-${cat}`}>
          <KindIcon kind={cat} size={14} />
          {TYPE_LABEL[cat]}
        </span>
        {showStation && item.stationName && <span className="tx-station">{item.stationName}</span>}
        {item.alerts?.length ? (
          <span className="alert-tag" title="キーワード通知に一致">
            {item.alerts.join('・')}
          </span>
        ) : null}
      </div>
      <div className="tx-body">
        <p className="tx-en" lang="en">
          {parts.map((p, i) =>
            p.uncertain ? (
              <mark key={i} className="unsure" title={`聞き取りが不確か（確信度 ${Math.round((p.p ?? 0) * 100)}%）`}>
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </p>
        <div className="tx-ja-wrap">
          {(item.units?.length > 0 || item.codes?.length > 0) && (
            <div className="tx-tags">
              {item.units.map((u) => (
                <span key={u.label} className={`unit unit-${u.kind}`}>
                  {u.ja}
                </span>
              ))}
              {item.codes.map((c) => (
                <span key={c.code} className="code" title="無線コードの一般的な意味です。機関によって異なる場合があります。">
                  {c.code}＝{c.ja}
                </span>
              ))}
            </div>
          )}
          <p className="tx-ja">{item.ja}</p>
          {unsure.length > 0 && <p className="tx-unsure">聞き取りが不確かな語：{unsure.join('、')}（訳にも誤りがある可能性があります）</p>}
          {terms.length > 0 && (
            <div className="terms">
              {terms.map((t) => (
                <button key={t.key} className={`term${openTerm === t.key ? ' is-open' : ''}`} aria-expanded={openTerm === t.key} onClick={() => setOpenTerm(openTerm === t.key ? null : t.key)}>
                  {t.ja}
                </button>
              ))}
              {openTerm && (
                <p className="term-desc">
                  <b>{terms.find((t) => t.key === openTerm)?.en}</b>　{terms.find((t) => t.key === openTerm)?.desc}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="tx-actions">
        <button className={`icon-btn${speaking ? ' is-on' : ''}`} onClick={() => toggleSpeak(item)} aria-label={speaking ? '読み上げを止める' : '日本語で読み上げる'} title={speaking ? '読み上げを止める' : '日本語で読み上げる'}>
          {speaking ? <IconStop size={16} /> : <IconSpeaker size={18} />}
        </button>
        <button className={`icon-btn${item.starred ? ' is-star' : ''}`} onClick={() => toggleStar(item)} aria-pressed={!!item.starred} aria-label={item.starred ? '重要を外す' : '重要な交信として残す'} title={item.starred ? '重要を外す' : '重要な交信として残す'}>
          <IconStar size={18} filled={item.starred} />
        </button>
      </div>
    </li>
  );
}

export function StationCard({ station, compact = false }: { station: Station; compact?: boolean }) {
  const fav = useApp((s) => s.favorites.includes(station.id));
  const live = useSession(station.id).running;
  return (
    <article className={`station${live ? ' is-live' : ''}`}>
      <div className="station-types" aria-label={station.types.map((t) => TYPE_LABEL[t]).join('・')}>
        {station.types.map((t) => (
          <span key={t} className={`kind-dot kind-${t}`} title={TYPE_LABEL[t]}>
            <KindIcon kind={t} size={14} />
          </span>
        ))}
      </div>
      <div className="station-main">
        <h3 className="station-name">
          {station.name}
          {station.kind === 'demo' && <span className="badge badge-demo">デモ</span>}
        </h3>
        <p className="station-sub">
          {countryName(station.country)}
          {station.region ? `・${station.region}` : ''}
        </p>
        {!compact && (
          <p className="station-input">
            {live ? <span className="status status-live">受信中</span> : <span className="status status-ok">受信可能</span>}
            {INPUT_LABEL[station.input]}
          </p>
        )}
      </div>
      <div className="station-actions">
        <button className={`icon-btn${fav ? ' is-star' : ''}`} onClick={() => toggleFavorite(station.id)} aria-pressed={fav} aria-label={fav ? 'お気に入りから外す' : 'お気に入りに追加'} title={fav ? 'お気に入りから外す' : 'お気に入りに追加'}>
          <IconStar size={18} filled={fav} />
        </button>
        <button className="btn btn-primary btn-small" onClick={() => navigate(`/live/${station.id}`)}>
          {live ? '翻訳を見る' : '聞く'}
        </button>
      </div>
    </article>
  );
}
