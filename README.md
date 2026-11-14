# RADIO LINGUA

海外の警察・消防・救急の無線（英語）を、**端末の中のAI**で日本語字幕と日本語音声にするWebアプリです。
音声も字幕も外部のサーバーに送らず、運用費は0円で動きます。

- 公開URL：https://co-30.github.io/radio-lingua/
- 対応：PC（Chrome・Edge・Safari・Firefox）／スマートフォン（iPhone Safari・Android Chrome）

## できること（v0.1）
- 英語の無線音声を交信ごとに区切って文字起こし（Whisper）
- 日本語へ翻訳し、テレビ字幕のように表示（呼出符号を警察・消防・救急の色で表示）
- 10コード（10-4 など）や code 4 の意味を併記
- 日本語の読み上げ（OS標準の音声）
- 交信ログを端末内に保存し、テキスト・JSONで書き出し
- 取り込み元：デモ交信／音声ファイル／マイク・受信機／ブラウザのタブ音声（PC）

## 開発
```sh
npm ci --ignore-scripts   # onnxruntime-node の不要なダウンロードを避ける
npm run dev               # 開発サーバー
npm test                  # 単体テスト
npm run build && npm run test:e2e   # 画面の通しテスト（Chrome使用、AIはモック）
```
URL に `?engine=mock` を付けると、AIモデルをダウンロードせずに画面の動作を確認できます。

## 資料
- 設計：[docs/superpowers/specs/2026-11-14-radio-lingua-mvp-design.md](docs/superpowers/specs/2026-11-14-radio-lingua-mvp-design.md)
- 進捗・残課題：[docs/PROGRESS.md](docs/PROGRESS.md)
- 利用許諾・法的確認：[docs/LEGAL.md](docs/LEGAL.md)
- 運用費：[docs/COSTS.md](docs/COSTS.md)
- 使用モデルとライセンス：[docs/CREDITS.md](docs/CREDITS.md)
- 技術調査：[docs/research/phase1-feasibility.md](docs/research/phase1-feasibility.md)
