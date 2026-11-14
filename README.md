# RADIO LINGUA

海外の警察・消防・救急の無線（英語）を、**端末の中のAI**で日本語字幕と日本語音声にするWebアプリです。
音声も字幕も外部のサーバーに送らず、運用費は0円で動きます。

- 公開URL：https://co-30.github.io/radio-lingua/
- 対応：PC（Chrome・Edge・Safari・Firefox）／スマートフォン（iPhone Safari・Android Chrome）

## できること（v1）
- 世界地図（点描）で受信状況を見渡し、国・局を選んでライブ翻訳へ
- 5画面：地図／無線局／ライブ翻訳／お気に入り／履歴（PCは縦メニュー、スマホは下部メニュー）
- 英語の無線音声を交信ごとに区切って文字起こし（Whisper）。聞き取りが不確かな語を確信度で明示
- 日本語へ翻訳し、原文と並べて表示。呼出符号・専門用語の補足説明つき
- 10コード（10-4 など）や code 4 の意味を併記
- 日本語の読み上げ（交信ごと・自動）、重要な交信の☆、局のお気に入り
- お手持ちの受信機（マイク）・タブ音声・配信URLを局として追加
- ホーム画面に追加してアプリのように使える（PWA）。圏外でも画面は開く
- アプリ内に「このアプリについて」・利用規約（案）・プライバシーポリシー（案）・ライセンス
- 交信ログを端末内に保存し、テキスト・JSONで書き出し

実測：音声認識の単語誤り率 4.0%（デモ交信）、1交信あたり認識 約3〜4秒（PC）。詳細は [docs/PROGRESS.md](docs/PROGRESS.md)。

## 開発
```sh
npm ci --ignore-scripts   # onnxruntime-node の不要なダウンロードを避ける（精度測定を手元で行う場合は npm ci）
npm run dev               # 開発サーバー
node scripts/build-worldmap.mjs   # 地図データの再生成（通常は不要）
npm test                  # 単体テスト
npm run build && npm run test:e2e   # 画面の通しテスト（Chrome使用、AIはモック）
```
URL に `?engine=mock` を付けると、AIモデルをダウンロードせずに画面の動作を確認できます。

## 資料
- 操作マニュアル：[docs/MANUAL.md](docs/MANUAL.md)
- 技術構成資料：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 商用販売に向けた改善提案：[docs/COMMERCIAL.md](docs/COMMERCIAL.md)
- 提供元への問い合わせ文案：[docs/outreach/](docs/outreach/)
- セキュリティ監査：[docs/SECURITY.md](docs/SECURITY.md)
- 実モデル精度測定（自動）：[docs/benchmarks/latest.md](docs/benchmarks/latest.md)
- 設計：[docs/superpowers/specs/2026-11-14-radio-lingua-mvp-design.md](docs/superpowers/specs/2026-11-14-radio-lingua-mvp-design.md)
- 進捗・残課題：[docs/PROGRESS.md](docs/PROGRESS.md)
- 利用許諾・法的確認：[docs/LEGAL.md](docs/LEGAL.md)
- 運用費：[docs/COSTS.md](docs/COSTS.md)
- 使用モデルとライセンス：[docs/CREDITS.md](docs/CREDITS.md)
- 技術調査：[docs/research/phase1-feasibility.md](docs/research/phase1-feasibility.md)
