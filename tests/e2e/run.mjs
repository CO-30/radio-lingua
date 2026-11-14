// 画面の通しテスト。ビルド済みの dist を配信し、Chrome で PC とスマホの画面幅を確認する。
// AIモデルの代わりにモック（?engine=mock）を使い、音声の取り込み→区切り→字幕表示→履歴保存までを検証する。
// 実行: npm run build && npm run test:e2e
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'silent' });
const base = 'http://localhost:4174/';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};

async function run(name, contextOpts) {
  console.log(`\n== ${name} ==`);
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?engine=mock`);
  await page.screenshot({ path: `${OUT}${name}-0-initial.png`, fullPage: true });

  check(await page.locator('#captionEmpty').isVisible(), '初期表示で字幕の案内が出る');
  check(!(await page.locator('#onair').isVisible()), '開始前は「受信中」を表示しない');
  check(!(await page.locator('#prep').isVisible()), '開始前はモデル準備欄を表示しない');
  check((await page.locator('#sources [aria-checked=true]').getAttribute('data-source')) === 'sample', 'デモ交信が選ばれている');

  await page.click('#startBtn');
  await page.waitForFunction(() => window.__rl.state.engineStatus === 'ready', null, { timeout: 10000 });
  check(true, 'AIエンジン（モック）の準備が完了する');
  await page.waitForFunction(() => window.__rl.state.running, null, { timeout: 10000 });
  check(await page.locator('#onair').isVisible(), '受信中の表示が出る');
  check((await page.locator('#startLabel').textContent()) === '停止', 'ボタンが「停止」に変わる');

  await page.waitForSelector('.caption-ja', { timeout: 20000 });
  await page.screenshot({ path: `${OUT}${name}-1-first-caption.png` });
  const first = await page.locator('.caption-ja').textContent();
  check(first.includes('消防車12'), `最初の字幕が表示される: ${first.slice(0, 30)}…`);

  await page.waitForFunction(() => !window.__rl.state.running, null, { timeout: 70000 });
  const entries = await page.locator('.log-list .entry:not(.pending)').count();
  check(entries === 6, `デモ音声の6交信がすべて字幕になる（${entries}件）`);
  check((await page.locator('.log-list .entry.pending').count()) === 0, '処理待ちが残らない');
  check((await page.locator('.code').count()) >= 2, '10コードの意味が表示される');
  await page.screenshot({ path: `${OUT}${name}-2-finished.png`, fullPage: true });

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('radiolingua.history.v1')).length);
  check(stored === 6, `履歴が端末に保存される（${stored}件）`);

  await page.reload();
  check((await page.locator('.log-list .entry').count()) === 6, '再読み込み後も履歴が残る');

  // 設定画面
  await page.click('#openSettings');
  check(await page.locator('#settings').isVisible(), '設定画面が開く');
  await page.locator('#settings input[name=showEn]').uncheck();
  await page.click('#settings button[value=save]');
  await page.waitForFunction(() => document.body.classList.contains('hide-en'), null, { timeout: 3000 }).catch(() => {});
  check(!(await page.locator('.entry-en').first().isVisible()), '英語原文を非表示にできる');

  // 横はみ出しがないか
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `横方向にはみ出さない（${overflow}px）`);

  check(errors.length === 0, `コンソールエラーなし${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

try {
  await run('desktop', { viewport: { width: 1366, height: 900 } });
  await run('mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

console.log(failures.length ? `\n${failures.length}件失敗` : '\nすべて成功');
process.exit(failures.length ? 1 : 0);
