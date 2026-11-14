import { chromium } from 'playwright-core';
import { preview } from 'vite';
const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'silent' });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const errs = [];
for (const [name, opts] of [['d', { viewport: { width: 1440, height: 900 } }], ['m', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(name + ': ' + m.text()));
  for (const r of (process.argv[2] || 'map').split(',')) {
    await p.goto(`http://localhost:4175/?engine=mock#/${r}`);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `/tmp/shot-${name}-${r.replace(/\//g, '_')}.png` });
  }
  await ctx.close();
}
await b.close();
server.httpServer.close();
console.log(errs.length ? errs.join('\n') : 'no errors');
