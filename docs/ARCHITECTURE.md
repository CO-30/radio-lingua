# 技術構成資料（v1・2026-11-14）

## 全体像
```
[利用者の端末（ブラウザ）]
 ├─ 画面（React + TypeScript）  地図 / 無線局 / ライブ翻訳 / お気に入り / 履歴 / このアプリについて
 │    └─ 状態管理 src/app/store.ts ・ 操作 src/app/services.ts
 ├─ 音声の取り込み src/core/capture.js（局ごとに1つ。最大3局を同時に受信。AIエンジンは共有し、交信ごとに局を追跡）
 │    デモ音声・録音ファイル・マイク（受信機）・タブ音声・配信URL
│    音声処理専用スレッド（AudioWorklet、src/core/capture-worklet.js）。使えない環境は ScriptProcessor
 │    → 16kHz化 src/core/resample.js → 交信の区切り src/core/segmenter.js
 ├─ AIエンジン（Web Worker）src/worker/engine.worker.js
 │    Whisper（音声認識）→ 無線用語の正規化 src/core/radio.js → 翻訳（LFM2 / FuguMT）
 │    確信度の記録 → 不確かな語 src/core/confidence.js
 │    WebGPU優先・WASM（CPU）予備。初回ウォームアップと応答なし時のCPU自動切替
 ├─ キーワード通知 src/core/alerts.js（一致判定）・src/core/chime.js（通知音）・端末の通知（許可時のみ）
├─ 端末内の保存（localStorage）履歴・設定・追加した局・お気に入り
 ├─ 読み上げ src/core/tts.js（OS標準の音声合成）
 └─ Service Worker public/sw.js（画面の保存・圏外でも起動）

[GitHub Pages]  画面・AI実行環境（ONNX Runtime の wasm）・地図データ・書体・デモ音声を配信
[Hugging Face]  AIモデル（版を固定）を利用者の端末へ直接配信。端末に保存され2回目以降は不要
```
運営側のサーバーはありません。音声・字幕・履歴は端末の外に出ません。

## ディレクトリ
| 場所 | 内容 |
|---|---|
| `src/App.tsx` / `src/views/` / `src/components/` | 画面 |
| `src/app/` | 状態・操作・画面遷移・地図の座標計算 |
| `src/core/` | 画面に依存しない処理（単体テスト対象） |
| `src/worker/` | AIエンジン |
| `src/data/` | 地図データ（生成物）・提供元カタログ・規約本文 |
| `scripts/` | 地図データ生成、デモ音声生成、開発用スクリプト |
| `tests/unit/` `tests/e2e/` `tests/bench/` | 単体／画面通し／実モデル精度測定 |
| `docs/` | 設計・進捗・法的確認・費用・監査・マニュアル・本資料 |

## 主な技術と選定理由
| 用途 | 採用 | 理由 |
|---|---|---|
| 画面 | React 19 + TypeScript + Vite | 画面数・状態が多く保守性を優先。依存は最小限 |
| 音声認識 | Whisper base.en / small.en / tiny.en（ONNX） | 無料・高精度・ブラウザで動作 |
| 翻訳 | LFM2-350M-ENJP-MT（主）・FuguMT（予備） | 英日専用で品質が高い。商用条件を確認済み |
| 推論 | Transformers.js + ONNX Runtime Web | WebGPU / WASM 両対応 |
| 地図 | Natural Earth を点描化（ビルド時生成） | 外部地図サービス不要・費用ゼロ・独自の見た目 |
| 配信 | GitHub Pages + GitHub Actions | 無料。テスト通過時のみ自動公開 |

## 品質の仕組み
- push ごとに GitHub Actions で：単体テスト → ビルド → 画面通しテスト（Chrome、PC/スマホ幅、圏外起動、https 配信の取り込み、同時受信）→ 公開
- 品質監査（Lighthouse）：docs/QUALITY.md
- 実モデル精度測定（Whisper + 翻訳を CPU で実行し WER を記録）を自動実行 → `docs/benchmarks/latest.md`
- AIモデルは版（コミットID）を固定し、更新時は精度測定で確認してから切り替える

## 拡張のしかた
| やりたいこと | 変更する場所 |
|---|---|
| 許諾が取れた提供元・局を追加 | `src/data/sources.js`（提供元）、局データの読み込み処理を `src/core/stations.js` に追加 |
| 対応国の追加 | 局データに国コードを入れるだけで地図・一覧に反映（地図は全235か国を収録済み） |
| モデルの追加・差し替え | `src/core/models.js`（`REVISIONS` で版を固定） |
| 英語以外の言語 | Whisper の多言語版と翻訳モデルを `models.js` に追加し、言語ごとの用語正規化を `src/core/` に追加 |
| 無線用語・用語説明の追加 | `src/core/radio.js`（10コード・定型句・誤訳補正）、`src/core/glossary.js` |

## 制約と既知の限界
- 初回はAIモデルのダウンロード（PC既定 約500MB）が必要
- 端末の性能に依存。GPUの初回準備に時間がかかる端末があり、CPU自動切替で対処
- 取り込みは AudioWorklet を優先（v1.2）。使えない環境では ScriptProcessor に自動で切り替える（両方式でデモ6交信を確認済み）
- GitHub Pages では HTTP ヘッダーを設定できず、Web Worker に CSP がかからない（docs/SECURITY.md）
