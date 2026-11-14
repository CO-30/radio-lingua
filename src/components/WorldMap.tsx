// 点描の世界地図。点はキャンバスに描き、局のマーカーは操作できるようにHTMLのボタンで重ねる。
import { useEffect, useMemo, useRef, useState } from 'react';
import { WORLD, MAP_W, MAP_H, project, countryIndex, countryName, countryView } from '../app/geo';
import type { Station } from '../app/store';
import { KindIcon, IconPlus, IconGlobe } from './Icons';

type View = { x: number; y: number; w: number; h: number };
const FULL: View = { x: 0, y: -2, w: MAP_W, h: MAP_H + 4 };

interface Props {
  stations: Station[];
  selectedCountry: string | null;
  selectedStation: string | null;
  liveStation: string | null;
  pendingCountries: Set<string>;
  onSelectCountry: (a2: string | null) => void;
  onSelectStation: (id: string) => void;
}

const COLOR = {
  base: 'rgba(125, 175, 215, 0.34)',
  hasStation: 'rgba(32, 185, 232, 0.72)',
  pending: 'rgba(245, 166, 35, 0.55)',
  selected: 'rgba(32, 185, 232, 1)',
  hover: 'rgba(160, 225, 245, 0.85)',
};

/**
 * 初期表示：横長・正方形に近い画面は世界全体。縦長（スマホ）は全局が入る範囲に寄せ、
 * 局が世界中に散らばっていて寄せる意味がない場合は世界全体にする。
 */
function defaultView(aspect: number, stations: Station[]): View {
  if (aspect >= 1 || !stations.length) return FULL;
  const pts = stations.map((s) => project(s.lon, s.lat));
  const x0 = Math.min(...pts.map((p) => p[0]));
  const x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1]));
  const y1 = Math.max(...pts.map((p) => p[1]));
  const w = Math.max(MAP_W / 2.6, x1 - x0 + 50);
  if (w >= MAP_W * 0.8) return FULL;
  const h = w / aspect;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x: cx - w / 2, y: Math.min(MAP_H * 0.42, cy) - h / 2, w, h };
}

function clampView(v: View): View {
  const w = Math.min(MAP_W * 1.4, Math.max(14, v.w));
  const h = v.h * (w / v.w);
  return { w, h, x: Math.min(MAP_W - w * 0.25, Math.max(-w * 0.75, v.x)), y: Math.min(MAP_H - h * 0.25, Math.max(-h * 0.75, v.y)) };
}

function fitView(v: View, aspect: number): View {
  // 画面の縦横比に合わせて範囲を広げる（歪めない）
  const cur = v.w / v.h;
  if (cur > aspect) {
    const h = v.w / aspect;
    return { x: v.x, y: v.y - (h - v.h) / 2, w: v.w, h };
  }
  const w = v.h * aspect;
  return { x: v.x - (w - v.w) / 2, y: v.y, w, h: v.h };
}

export function WorldMap({ stations, selectedCountry, selectedStation, liveStation, pendingCountries, onSelectCountry, onSelectStation }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const [hover, setHover] = useState<number>(-1);
  const viewRef = useRef<View>(FULL);
  const [view, setView] = useState<View>(FULL);
  const [resetKey, setResetKey] = useState(0);
  const drag = useRef<{ x: number; y: number; v: View; moved: boolean; id: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; v: View } | null>(null);
  const suppressClick = useRef(false);

  const stationCountries = useMemo(() => new Set(stations.map((s) => countryIndex(s.country))), [stations]);
  const pendingIdx = useMemo(() => new Set([...pendingCountries].map(countryIndex)), [pendingCountries]);
  const selIdx = selectedCountry ? countryIndex(selectedCountry) : -1;

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 国を選ぶとその国へ寄る（なめらかに）
  useEffect(() => {
    const aspect = size.w / Math.max(1, size.h);
    const target = fitView((selectedCountry && countryView(selectedCountry)) || defaultView(aspect, stations), aspect);
    const from = fitView(viewRef.current, aspect);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const dur = reduce ? 0 : 650;
    let raf = 0;
    const step = (t: number) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      const v = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      viewRef.current = v;
      setView(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [selectedCountry, size.w, size.h, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyView(v: View) {
    const c = clampView(v);
    viewRef.current = c;
    setView(c);
  }
  function zoomAt(factor: number, cx = size.w / 2, cy = size.h / 2, base = viewRef.current) {
    const gx = base.x + (cx / size.w) * base.w;
    const gy = base.y + (cy / size.h) * base.h;
    const w = base.w * factor;
    const h = base.h * factor;
    applyView({ x: gx - (cx / size.w) * w, y: gy - (cy / size.h) * h, w, h });
  }

  // 点を描く
  useEffect(() => {
    const cv = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const sx = size.w / view.w;
    const sy = size.h / view.h;
    const r = Math.max(0.7, Math.min(4.6, sx * 0.34));
    // 赤道と回帰線（うっすら）
    ctx.strokeStyle = 'rgba(32,185,232,0.10)';
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1;
    for (const lat of [0, 23.44, -23.44]) {
      const y = (project(0, lat)[1] - view.y) * sy;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    const d = WORLD.dots;
    for (let i = 0; i < d.length; i += 3) {
      const x = (d[i] + 0.5 - view.x) * sx;
      const y = (d[i + 1] + 0.5 - view.y) * sy;
      if (x < -5 || y < -5 || x > size.w + 5 || y > size.h + 5) continue;
      const ci = d[i + 2];
      ctx.fillStyle = ci === selIdx ? COLOR.selected : ci === hover ? COLOR.hover : stationCountries.has(ci) ? COLOR.hasStation : pendingIdx.has(ci) ? COLOR.pending : COLOR.base;
      ctx.beginPath();
      ctx.arc(x, y, ci === selIdx ? r * 1.15 : r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [size, view, hover, selIdx, stationCountries, pendingIdx]);

  function dotAt(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const gx = view.x + ((clientX - rect.left) / rect.width) * view.w;
    const gy = view.y + ((clientY - rect.top) / rect.height) * view.h;
    let best = -1;
    let bestD = 2.2; // 格子2マス以内
    const d = WORLD.dots;
    for (let i = 0; i < d.length; i += 3) {
      const dx = d[i] + 0.5 - gx;
      const dy = d[i + 1] + 0.5 - gy;
      const dist = Math.hypot(dx, dy);
      if (dist < bestD) {
        bestD = dist;
        best = d[i + 2];
      }
    }
    return best;
  }

  const toScreen = (lon: number, lat: number) => {
    const [gx, gy] = project(lon, lat);
    return [((gx - view.x) / view.w) * size.w, ((gy - view.y) / view.h) * size.h];
  };

  const hoverName = hover >= 0 ? countryName(WORLD.countries[hover].a2) : '';

  return (
    <div className="worldmap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="worldmap-canvas"
        style={{ width: size.w, height: size.h }}
        role="img"
        aria-label="世界地図。国をクリックすると、その国の無線局を表示します。"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), v: viewRef.current };
            drag.current = null;
          } else drag.current = { x: e.clientX, y: e.clientY, v: viewRef.current, moved: false, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch.current && pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            const rect = canvasRef.current!.getBoundingClientRect();
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            zoomAt(pinch.current.d / Math.max(10, d), (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, pinch.current.v);
            suppressClick.current = true;
            return;
          }
          const dr = drag.current;
          if (dr && dr.id === e.pointerId) {
            const dx = e.clientX - dr.x;
            const dy = e.clientY - dr.y;
            if (!dr.moved && Math.hypot(dx, dy) > 5) dr.moved = true;
            if (dr.moved) {
              applyView({ ...dr.v, x: dr.v.x - (dx / size.w) * dr.v.w, y: dr.v.y - (dy / size.h) * dr.v.h });
              suppressClick.current = true;
            }
            return;
          }
          if (e.pointerType === 'mouse') setHover(dotAt(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          drag.current = null;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = null;
          drag.current = null;
        }}
        onPointerLeave={() => setHover(-1)}
        onWheel={(e) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
        }}
        onClick={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          const ci = dotAt(e.clientX, e.clientY);
          onSelectCountry(ci >= 0 ? WORLD.countries[ci].a2 : null);
        }}
      />
      {hoverName && <div className="worldmap-hover">{hoverName}</div>}
      <div className="map-zoom" role="group" aria-label="地図の拡大・縮小">
        <button className="icon-btn" onClick={() => zoomAt(1 / 1.5)} aria-label="拡大" title="拡大">
          <IconPlus size={18} />
        </button>
        <button className="icon-btn" onClick={() => zoomAt(1.5)} aria-label="縮小" title="縮小">
          <span className="minus" aria-hidden="true" />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            onSelectCountry(null);
            setResetKey((k) => k + 1);
          }}
          aria-label="最初の表示に戻す"
          title="最初の表示に戻す"
        >
          <IconGlobe size={18} />
        </button>
      </div>
      {stations.map((s) => {
        const [x, y] = toScreen(s.lon, s.lat);
        if (x < -20 || y < -20 || x > size.w + 20 || y > size.h + 20) return null;
        const live = s.id === liveStation;
        const sel = s.id === selectedStation;
        return (
          <button
            key={s.id}
            className={`marker${live ? ' is-live' : ''}${sel ? ' is-selected' : ''}${s.kind === 'demo' ? ' is-demo' : ''}`}
            style={{ transform: `translate(${x}px, ${y}px)` }}
            onClick={() => onSelectStation(s.id)}
            aria-label={`${s.name}（${countryName(s.country)}）${live ? '・受信中' : ''}`}
          >
            <span className="marker-ring" aria-hidden="true" />
            <span className="marker-core" aria-hidden="true">
              <KindIcon kind={s.types[0]} size={12} />
            </span>
            <span className="marker-label">
              {s.name}
              {s.kind === 'demo' && <em>DEMO</em>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
