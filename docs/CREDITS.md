# 使用しているAIモデル・ソフトウェアとライセンス

## AIモデル（利用者のブラウザが Hugging Face から直接取得）
| 用途 | モデル | ライセンス |
|---|---|---|
| 音声認識 | OpenAI Whisper base.en / tiny.en（ONNX版: onnx-community, Xenova） | MIT |
| 英日翻訳（高品質） | Liquid AI LFM2-350M-ENJP-MT（ONNX版: onnx-community） | LFM Open License v1.0（年商1,000万ドル未満は商用利用無料） |
| 英日翻訳（省メモリ） | FuguMT en-ja（作者: staka、ONNX版: Kadonox） | CC BY-SA 4.0 |

FuguMT の翻訳には © staka, CC BY-SA 4.0（https://huggingface.co/staka/fugumt-en-ja ）の表示が必要です。

## ソフトウェア・データ・書体
| 名称 | ライセンス |
|---|---|
| Transformers.js（Hugging Face） | Apache-2.0 |
| ONNX Runtime Web（Microsoft） | MIT |
| React / React DOM | MIT |
| Vite | MIT |
| 世界地図：Natural Earth（1:50m） | パブリックドメイン |
| world-atlas（地図データの変換、ビルド時のみ） | ISC |
| d3-geo・topojson-client（ビルド時のみ） | ISC |
| i18n-iso-countries（国コード変換、ビルド時のみ） | MIT |
| 書体：Chakra Petch（Cadson Demak、@fontsource 経由で自前配信） | SIL Open Font License 1.1 |
| 国名の日本語表記 | ブラウザ標準（Intl.DisplayNames） |

## デモ音声
`public/samples/demo-dispatch.mp3` は本プロジェクトで作成した架空の交信の合成音声です。実在の交信ではありません。
音声合成：Kokoro-82M（hexgrad、Apache-2.0）。生成手順は `scripts/demo-audio/` を参照。
