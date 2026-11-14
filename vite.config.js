import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// コンテンツセキュリティポリシー（本番ビルドのみ。開発サーバーはインラインスクリプトを使うため除外）
// 画面側は自サイトの資源だけを読み込む。AIモデルの取得は Web Worker 側で行う。
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  // 利用者が追加した配信URL（https のみ受け付け）の音声を再生できるようにする
  "media-src 'self' blob: https:",
  "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const cspPlugin = {
  name: 'radio-lingua-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`);
  },
};

// GitHub Pages（https://co-30.github.io/radio-lingua/）でも動くよう相対パスで出力
export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin],
  worker: { format: 'es' },
  // 小さなフォント等を data: に埋め込まない（CSP の font-src 'self' を保つため）
  build: { target: 'es2022', chunkSizeWarningLimit: 2000, assetsInlineLimit: 0 },
  server: { host: true },
});
