// 画面の通しテスト（v1：管制センター）。ビルド済みの dist を配信し、Chrome で PC とスマホの画面幅を確認する。
// AIモデルの代わりにモック（?engine=mock）を使い、音声の取り込み→区切り→字幕→履歴・お気に入りまでを検証する。
// 実行: npm run build && npm run test:e2e
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import https from 'node:https';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'silent' });
const base = 'http://localhost:4174/?engine=mock';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
};

async function run(name, contextOpts, mobile) {
  console.log(`\n== ${name} ==`);
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  const shot = (n) => page.screenshot({ path: `${OUT}${name}-${n}.png` });

  // 1. 地図
  await page.goto(`${base}#/map`);
  await page.waitForSelector('.worldmap-canvas');
  check((await page.locator('.stat-num.ok').textContent()) === '1', '地図：受信可能な局の数（デモ局1）');
  check((await page.locator('.stat-num.warn').textContent()) === '2', '地図：許諾確認中の提供元は2（利用不可は数えない）');
  check((await page.locator('.marker').count()) === 1, '地図：局のマーカーが表示される');
  await shot('1-map');
  await page.locator('.marker').first().click();
  await page.waitForSelector('.map-panel .panel-title');
  check((await page.locator('.map-panel .panel-title').textContent()) === 'アメリカ合衆国', 'マーカーを押すと国のパネルが開く');
  check((await page.locator('.map-panel .station-name').first().textContent()).includes('デモ局'), 'パネルにデモ局が出る');
  check((await page.locator('.provider-line').count()) === 2, '米国の準備中の提供元が2件表示される');
  await page.waitForTimeout(700);
  await shot('1b-map-country');
  await page.locator('.map-panel .station .btn-primary').first().click();

  // 2. ライブ翻訳（先にキーワード通知を設定）
  await page.waitForSelector('.liveview');
  check(page.url().includes('#/live/demo'), '「聞く」でライブ翻訳画面へ移る');
  await page.click('.alert-state');
  await page.waitForSelector('#settings-title');
  await page.locator('dialog[open] .kw-suggest .chip', { hasText: 'structure fire' }).click();
  check((await page.locator('dialog[open] .chip.kw').count()) === 1, 'キーワードを提案から登録できる');
  await page.click('dialog[open] button[type=submit]');
  await page.waitForTimeout(200);
  check((await page.locator('.alert-state').textContent()).includes('1語'), 'ライブ画面にキーワード通知の状態が出る');
  await page.click('.live-controls .btn-primary');
  await page.waitForFunction(() => window.__rl.getState().sessions.demo?.running, null, { timeout: 15000 });
  check((await page.locator('.live-status-text').textContent()) === '受信中', '受信中の表示');
  check(await page.locator('.nav-live').isVisible(), 'メニューに受信中の印が付く');
  await page.waitForSelector('.tx-list .tx:not(.tx-pending)', { timeout: 20000 });
  await page.waitForTimeout(600);
  await shot('2-live-first');
  await page.waitForFunction(() => !window.__rl.getState().sessions.demo?.running, null, { timeout: 70000 });
  await page.waitForTimeout(500);
  const n = await page.locator('.tx-list .tx:not(.tx-pending)').count();
  check(n === 6, `デモの6交信がすべて字幕になる（${n}件）`);
  check((await page.locator('.tx-pending').count()) === 0, '聞き取り中が残らない');
  check((await page.locator('mark.unsure').count()) >= 1, '聞き取りが不確かな語が強調される');
  check((await page.locator('.tx-unsure').count()) >= 1, '不確かな語の注意書きが訳の下に出る');
  check((await page.locator('.code').count()) >= 2, '10コードの意味が表示される');
  check((await page.locator('.tx.is-alert').count()) === 1, 'キーワードに一致した交信だけが強調される');
  check((await page.locator('.tx.is-alert .alert-tag').textContent()) === 'structure fire', '一致した語が表示される');
  check(await page.evaluate(() => window.__rl.capture.mode === 'worklet'), '音声は AudioWorklet で取り込む（Chrome）');
  await page.locator('.term').first().click();
  check(await page.locator('.term-desc').first().isVisible(), '用語を押すと補足説明が出る');
  await page.locator('.tx .icon-btn[aria-pressed]').first().click();
  check((await page.locator('.tx.is-starred').count()) === 1, '交信に重要マークを付けられる');
  await shot('3-live-done');

  // 3. 無線局・お気に入り
  await page.goto(`${base}#/stations`);
  await page.waitForSelector('.station');
  await page.locator('.station .icon-btn').first().click();
  check((await page.locator('.station .icon-btn.is-star').count()) === 1, '局をお気に入りに追加できる');
  await page.locator('.filters .chip', { hasText: '警察' }).click();
  check((await page.locator('.station').count()) === 1, '種別で絞り込める（デモ局は警察も含む）');
  await page.fill('.search input', '存在しない局');
  check((await page.locator('.station').count()) === 0, '検索で絞り込める');
  await page.fill('.search input', '');
  await shot('3b-stations');
  await page.goto(`${base}#/favorites`);
  await page.waitForSelector('.pageview');
  check((await page.locator('.station').count()) === 1, 'お気に入りの局が表示される');
  check((await page.locator('.tx').count()) === 1, '重要な交信が表示される');
  await shot('4-favorites');

  // 4. 履歴
  await page.goto(`${base}#/history`);
  await page.waitForSelector('.tx');
  check((await page.locator('.tx').count()) === 6, '履歴に6件');
  await page.locator('.filters .chip', { hasText: '警察' }).click();
  check((await page.locator('.tx').count()) === 2, '履歴を種別で絞り込める（警察2件）');
  await page.locator('.filters .chip', { hasText: 'すべて' }).click();
  await page.locator('.filters .switch', { hasText: '通知のみ' }).click();
  check((await page.locator('.tx').count()) === 1, '履歴を「通知のみ」で絞り込める');
  await page.locator('.filters .switch', { hasText: '通知のみ' }).click();
  await page.fill('.search input', '救急車7');
  check((await page.locator('.tx').count()) === 2, '履歴を文字で検索できる');
  await page.fill('.search input', '');
  await shot('5-history');

  // 5. 局の追加
  await page.goto(`${base}#/stations`);
  await page.click('.page-head .btn-primary');
  await page.waitForSelector('#addst-title');
  await page.fill('dialog[open] input[placeholder^="例：自宅"]', 'テスト受信機');
  await page.locator('dialog[open] .chip', { hasText: '消防' }).click();
  await page.selectOption('dialog[open] select', 'JP');
  await page.locator('dialog[open] .option', { hasText: 'マイク・受信機' }).click();
  await page.click('dialog[open] button[type=submit]');
  check(await page.locator('dialog[open] [role=alert]').isVisible(), '利用条件の確認なしでは追加できない');
  await page.locator('dialog[open] .option.agree').click();
  await page.click('dialog[open] button[type=submit]');
  await page.waitForSelector('.liveview');
  check((await page.locator('.live-title h1').textContent()).includes('テスト受信機'), '追加した局のライブ画面が開く');
  await page.goto(`${base}#/map`);
  await page.waitForSelector('.marker');
  await page.locator('.map-zoom .icon-btn').last().click();
  await page.waitForTimeout(800);
  check((await page.locator('.marker').count()) === 2, '追加した局が地図に出る');
  check((await page.locator('.stat-num.ok').textContent()) === '2', '受信可能な局の数が増える');

  // 6. 設定
  await page.goto(`${base}#/live/demo`);
  await page.waitForSelector('.tx');
  await page.click('.topbar .icon-btn');
  await page.waitForSelector('#settings-title');
  await page.locator('dialog[open] .option', { hasText: '英語の原文も表示' }).click();
  await page.click('dialog[open] button[type=submit]');
  await page.waitForTimeout(200);
  check(!(await page.locator('.tx-en').first().isVisible()), '設定で英語の原文を隠せる');

  // 7. 再読み込みしても残る
  await page.reload();
  await page.waitForSelector('.tx');
  check((await page.locator('.tx').count()) === 6, '再読み込み後も履歴が残る');

  // 8. このアプリについて・規約
  await page.goto(`${base}#/about/terms`);
  await page.waitForSelector('.legal');
  check((await page.locator('.legal h2').first().textContent()).includes('第1条'), '利用規約（案）が表示される');
  check(await page.locator('.legal .notice-warn').isVisible(), '規約が弁護士確認前の案であると明示される');
  await page.locator('.tabs .chip', { hasText: 'ライセンス' }).click();
  check((await page.locator('.legal').textContent()).includes('Natural Earth'), 'ライセンス表示');

  // 9. 複数局の同時受信（デモ局＋追加した局のマイク）
  if (!mobile) {
    const userId = await page.evaluate(() => window.__rl.getState().stations.find((x) => x.kind === 'user').id);
    await page.goto(`${base}#/live/demo`);
    await page.click('.live-controls .btn-primary');
    await page.waitForFunction(() => window.__rl.getState().sessions.demo?.running, null, { timeout: 15000 });
    await page.goto(`${base}#/live/${userId}`);
    await page.click('.live-controls .btn-primary');
    await page.waitForFunction((id) => window.__rl.getState().sessions[id]?.running, userId, { timeout: 15000 });
    const both = await page.evaluate((id) => {
      const s = window.__rl.getState().sessions;
      return !!(s.demo?.running && s[id]?.running);
    }, userId);
    check(both, '2つの局を同時に受信できる（デモ＋マイク）');
    check((await page.locator('.other-chip').textContent()).includes('デモ局'), 'ほかに受信中の局が表示され、切り替えられる');
    await page.goto(`${base}#/map`);
    await page.waitForSelector('.marker');
    await page.locator('.map-zoom .icon-btn').last().click();
    await page.waitForTimeout(800);
    check((await page.locator('.marker.is-live').count()) === 2, '地図で受信中の2局が光る');
    check((await page.locator('.stat-num.live').textContent()) === '2', '地図に受信中の局数が出る');
    await shot('6-multi-map');
    await page.goto(`${base}#/live/${userId}`);
    await page.click('.btn-stop');
    await page.goto(`${base}#/live/demo`);
    await page.click('.btn-stop');
    await page.waitForFunction(() => !Object.values(window.__rl.getState().sessions).some((x) => x.running), null, { timeout: 10000 });
    check(true, '局ごとに停止できる');
  }

  if (mobile) {
    const box = await page.locator('.rail').boundingBox();
    check(box && box.y > 700, 'スマホ：メニューは画面下にある');
  }
  let overflowOk = true;
  for (const r of ['map', 'stations', 'live/demo', 'favorites', 'history', 'about/privacy']) {
    await page.goto(`${base}#/${r}`);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) {
      overflowOk = false;
      console.log(`  はみ出し: ${r}（${overflow}px）`);
    }
  }
  check(overflowOk, '全画面で横方向にはみ出さない');
  check(errors.length === 0, `コンソールエラーなし${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}

/** ホーム画面アプリとして：Service Worker が登録され、圏外でも画面が開く */
async function runOffline() {
  console.log('\n== offline ==');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4174/#/map');
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 15000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.waitForSelector('.worldmap-canvas');
  const manifest = await page.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
  check(manifest.short_name === 'RADIO LINGUA' && manifest.icons.length === 3, 'アプリ情報（manifest）とアイコンがある');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.worldmap-canvas', { timeout: 10000 }).catch(() => {});
  check(await page.locator('.worldmap-canvas').isVisible(), '圏外でも保存済みの画面が開く');
  await ctx.close();
}

/**
 * 利用者が追加した「配信URL」の局：本番ビルドのCSPの下で https の配信を取り込み、翻訳まで届くか。
 * 自己署名の https サーバー（取り込み許可あり／なし）を立てて確認する。openssl がない環境では省略。
 */
async function runStream() {
  console.log('\n== stream ==');
  let dir;
  try {
    dir = mkdtempSync(`${tmpdir()}/rl-https-`);
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/key.pem -out ${dir}/cert.pem -days 1 -subj /CN=localhost`, { stdio: 'ignore' });
  } catch {
    console.log('（openssl がないため省略）');
    return;
  }
  const body = readFileSync(new URL('../../public/samples/demo-dispatch.mp3', import.meta.url));
  const srv = https
    .createServer({ key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) }, (req, res) => {
      const cors = !req.url.includes('nocors');
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': body.length, ...(cors ? { 'Access-Control-Allow-Origin': '*' } : {}) });
      res.end(body);
    })
    .listen(8443);
  const b2 = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--ignore-certificate-errors'] });
  const page = await (await b2.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const csp = [];
  page.on('console', (m) => /Content Security Policy/.test(m.text()) && csp.push(m.text()));
  const run1 = async (id, url) => {
    await page.goto(`${base}#/stations`);
    await page.evaluate(
      ([id, url]) => localStorage.setItem('radiolingua.stations.v1', JSON.stringify([{ id, name: '配信テスト', country: 'US', region: '', lat: 40, lon: -100, types: ['fire'], kind: 'user', input: 'stream', url, status: 'available', note: '' }])),
      [id, url],
    );
    await page.goto(`${base}#/live/${id}`);
    await page.reload();
    await page.click('.live-controls .btn-primary');
    await page.waitForFunction((id) => window.__rl.getState().sessions[id]?.running || window.__rl.getState().sessions[id]?.notice, id, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction((id) => !window.__rl.getState().sessions[id]?.running, id, { timeout: 70000 }).catch(() => {});
    await page.waitForTimeout(600);
    return { n: await page.locator('.tx-list .tx:not(.tx-pending)').count(), notice: await page.evaluate((id) => window.__rl.getState().sessions[id]?.notice, id) };
  };
  const ok = await run1('u-stream', 'https://localhost:8443/demo.mp3');
  check(ok.n === 6, `配信URL（https）の音声を取り込んで翻訳できる（${ok.n}件）`);
  check(csp.length === 0, `配信の再生がセキュリティ設定（CSP）で遮断されない${csp.length ? `: ${csp[0]}` : ''}`);
  const ng = await run1('u-stream2', 'https://localhost:8443/nocors.mp3');
  check(ng.n === 0 && /配信に接続できませんでした/.test(ng.notice || ''), '取り込みを許可していない配信は分かりやすく案内する');
  await b2.close();
  srv.close();
}

try {
  await runOffline();
  await runStream();
  await run('desktop', { viewport: { width: 1440, height: 900 } }, false);
  await run('mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, true);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

console.log(failures.length ? `\n${failures.length}件失敗` : '\nすべて成功');
process.exit(failures.length ? 1 : 0);
