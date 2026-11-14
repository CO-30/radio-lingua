// アプリのアイコン（PNG）を SVG から作る。ヘッドレス Chrome で描画して保存する。
import { chromium } from 'playwright-core';
const out = new URL('../../public/icons/', import.meta.url).pathname;
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#16314d"/><stop offset="1" stop-color="#101B2B"/></radialGradient></defs>
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.9})" fill="none" stroke="#20B9E8" stroke-linecap="round" stroke-width="22">
    <circle r="30" fill="#20B9E8" stroke="none"/>
    <path d="M-80 -80a113 113 0 000 160M80 -80a113 113 0 010 160"/>
    <path d="M-140 -140a198 198 0 000 280M140 -140a198 198 0 010 280" opacity=".55"/>
  </g>
  <circle cx="${pad ? 330 : 352}" cy="${pad ? 182 : 160}" r="${pad ? 16 : 20}" fill="#27C99A"/>
</svg>`;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: out + name, omitBackground: !pad });
}
await b.close();
console.log('icons written');
