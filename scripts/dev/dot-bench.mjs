// 地図の点の描き方3通りの速さを比べる（開発用）
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await b.newPage();
const res = await p.evaluate(() => {
  const W = 1300, H = 520, N = 9875;
  const pts = Array.from({ length: N }, (_, i) => [((i * 37) % 280) * 4.6, (((i * 13) % 110) * 4.6) % H]);
  const cv = document.createElement('canvas');
  cv.width = W * 2; cv.height = H * 2;
  const ctx = cv.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const r = 1.5;
  const t = (f) => { const t0 = performance.now(); for (let k = 0; k < 5; k++) { ctx.clearRect(0, 0, W, H); f(); } ctx.getImageData(0, 0, 1, 1); return Math.round((performance.now() - t0) / 5); };
  const each = t(() => { for (const [x, y] of pts) { ctx.fillStyle = 'rgba(125,175,215,.34)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); } });
  const path = t(() => { const g = new Path2D(); for (const [x, y] of pts) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.283); } ctx.fillStyle = 'rgba(125,175,215,.34)'; ctx.fill(g); });
  const spr = document.createElement('canvas'); const s = Math.ceil(r * 2 * 2) + 2; spr.width = spr.height = s; const sc = spr.getContext('2d'); sc.fillStyle = 'rgba(125,175,215,.34)'; sc.beginPath(); sc.arc(s / 2, s / 2, r * 2, 0, 6.283); sc.fill();
  const sprite = t(() => { for (const [x, y] of pts) ctx.drawImage(spr, x - s / 4, y - s / 4, s / 2, s / 2); });
  return { each, path, sprite };
});
console.log('ms per frame', res);
await b.close();
