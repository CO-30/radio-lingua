import { defineConfig } from 'vite';

// GitHub Pages（https://co-30.github.io/radio-lingua/）でも動くよう相対パスで出力
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  server: { host: true },
});
