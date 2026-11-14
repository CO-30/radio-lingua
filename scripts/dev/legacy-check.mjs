// 従来方式（ScriptProcessor）での取り込みが動くかを確認する開発用スクリプト
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const server = await preview({ preview: { port: 4177, strictPort: true }, logLevel: 'silent' });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:4177/?engine=mock#/live/demo');
await p.waitForSelector('.live-controls .btn-primary');
await p.evaluate(() => (window.__rl.capture.forceLegacy = true));
await p.click('.live-controls .btn-primary');
await p.waitForFunction(() => window.__rl.getState().live.running, null, { timeout: 15000 });
await p.waitForFunction(() => !window.__rl.getState().live.running, null, { timeout: 70000 });
await p.waitForTimeout(500);
console.log('mode', await p.evaluate(() => window.__rl.capture.mode), 'transmissions', await p.locator('.tx-list .tx:not(.tx-pending)').count());
await b.close();
server.httpServer.close();
