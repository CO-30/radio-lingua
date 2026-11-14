# 使用しているAIモデル・ソフトウェアとライセンス

## AIモデル（利用者のブラウザが Hugging Face から直接取得）
| 用途 | モデル | ライセンス |
|---|---|---|
| 音声認識 | OpenAI Whisper base.en / tiny.en（ONNX版: onnx-community, Xenova） | MIT |
| 英日翻訳（高品質） | Liquid AI LFM2-350M-ENJP-MT（ONNX版: onnx-community） | LFM Open License v1.0（年商1,000万ドル未満は商用利用無料） |
| 英日翻訳（省メモリ） | FuguMT en-ja（作者: staka、ONNX版: Kadonox） | CC BY-SA 4.0 |

FuguMT の翻訳には © staka, CC BY-SA 4.0（https://huggingface.co/staka/fugumt-en-ja ）の表示が必要です。

## ソフトウェア
| 名称 | ライセンス |
|---|---|
| Transformers.js（Hugging Face） | Apache-2.0 |
| ONNX Runtime Web（Microsoft） | MIT |
| Vite | MIT |

## デモ音声
`public/samples/demo-dispatch.mp3` は本プロジェクトで作成した架空の交信の合成音声です（音声合成: meSpeak.js / eSpeak、生成スクリプトは開発記録に記載）。実在の交信ではありません。
