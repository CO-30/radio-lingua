// 「配信URL」の局が、本番ビルド（CSPあり）で翻訳まで届くかを確認する開発用スクリプト。
// 自己署名の https サーバーから、外部取り込み許可（CORS）つきでデモ音声を配信する。
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const dir = process.argv[2] || '/tmp/https-srv';
const cors = process.argv[3] !== 'nocors';
const srv = https
  .createServer({ key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) }, (req, res) => {
    const body = readFileSync(`${dir}/demo-dispatch.mp3`);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': body.length, ...(cors ? { 'Access-Control-Allow-Origin': '*' } : {}) });
    res.end(body);
  })
  .listen(8443);
const server = await preview({ preview: { port: 4178, strictPort: true }, logLevel: 'silent' });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--ignore-certificate-errors'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:4178/?engine=mock#/stations');
await p.evaluate(() => {
  const st = [{ id: 'u-stream', name: '配信テスト', country: 'US', region: '', lat: 40, lon: -100, types: ['fire'], kind: 'user', input: 'stream', url: 'https://localhost:8443/demo.mp3', status: 'available', note: '' }];
  localStorage.setItem('radiolingua.stations.v1', JSON.stringify(st));
});
await p.goto('http://localhost:4178/?engine=mock#/live/u-stream');
await p.reload();
await p.waitForSelector('.live-controls .btn-primary');
await p.click('.live-controls .btn-primary');
const t0 = Date.now();
await p.waitForFunction(() => window.__rl.getState().sessions['u-stream']?.running || window.__rl.getState().sessions['u-stream']?.notice, null, { timeout: 20000 }).catch(() => {});
await p.waitForFunction(() => !window.__rl.getState().sessions['u-stream']?.running, null, { timeout: 70000 }).catch(() => {});
await p.waitForTimeout(800);
const n = await p.locator('.tx-list .tx:not(.tx-pending)').count();
const notice = await p.evaluate(() => window.__rl.getState().sessions['u-stream']?.notice);
console.log(JSON.stringify({ cors, transmissions: n, seconds: Math.round((Date.now() - t0) / 1000), notice, cspErrors: errors.filter((e) => /Content Security Policy/.test(e)) }));
await b.close();
server.httpServer.close();
srv.close();
