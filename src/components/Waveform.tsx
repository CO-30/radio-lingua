// 受信中の音声波形と信号レベル。取り込みの解析ノードから直接描く。
import { useEffect, useRef } from 'react';
import { getCapture } from '../app/services';

export function Waveform({ active, stationId }: { active: boolean; stationId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const buf = new Float32Array(2048);
    let raf = 0;
    let peak = 0;
    const draw = () => {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const has = active && !!getCapture(stationId)?.readWaveform(buf);
      // 中央線
      ctx.strokeStyle = 'rgba(32,185,232,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      let rms = 0;
      if (has) {
        const bars = Math.max(24, Math.floor(w / 5));
        const per = Math.floor(buf.length / bars);
        ctx.fillStyle = '#20B9E8';
        for (let b = 0; b < bars; b++) {
          let m = 0;
          for (let i = 0; i < per; i++) m = Math.max(m, Math.abs(buf[b * per + i]));
          rms += m;
          const bh = Math.max(1.5, Math.min(1, m * 3.2) * (h - 4));
          ctx.globalAlpha = 0.35 + Math.min(0.65, m * 3);
          ctx.fillRect(b * (w / bars) + 1, (h - bh) / 2, Math.max(1.5, w / bars - 2.5), bh);
        }
        ctx.globalAlpha = 1;
        rms /= bars;
      }
      peak = Math.max(rms, peak * 0.94);
      if (levelRef.current) levelRef.current.style.transform = `scaleX(${Math.min(1, peak * 5).toFixed(3)})`;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, stationId]);
  return (
    <div className="wave">
      <canvas ref={ref} className="wave-canvas" aria-hidden="true" />
      <div className="wave-level" aria-hidden="true">
        <div className="wave-level-fill" ref={levelRef} />
      </div>
    </div>
  );
}
