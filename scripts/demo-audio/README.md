# デモ音声の作り方

架空の交信文（`lines.json`）を合成音声にし、無線らしい帯域制限・スケルチ音・雑音を加えています。

```sh
cd scripts/demo-audio && npm i --no-save mespeak && mkdir -p out && node gen.cjs lines.json
# 各行を22.05kHzに揃え、スケルチ音(0.18秒)と無音(1.4秒)を挟んで連結
# → highpass 320Hz / lowpass 3100Hz / コンプレッサー / ピンクノイズ を合成 → mp3 48kbps
```
詳細な ffmpeg コマンドは開発記録（docs/PROGRESS.md 2026-11-14）を参照。
