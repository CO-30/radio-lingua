# デモ音声の作り方

架空の交信文（`lines.json`）を Kokoro-82M（Apache-2.0、自然な英語音声）で合成し、無線らしく加工しています。
GitHub Actions の「Generate demo audio」で自動生成し、`public/samples/demo-dispatch.mp3` と
`tests/fixtures/demo-dispatch.wav` を更新します（`lines.json` を変更して push すると実行）。

ローカルで行う場合：
```sh
pip install kokoro soundfile && sudo apt-get install -y espeak-ng ffmpeg
python scripts/demo-audio/kokoro_gen.py scripts/demo-audio/lines.json scripts/demo-audio/out
scripts/demo-audio/build.sh
```
旧版（v0.1）は meSpeak（eSpeak）で合成していましたが、機械的な声のため認識精度が落ちるので置き換えました。
