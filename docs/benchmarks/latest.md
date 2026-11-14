# 実モデル精度測定（自動）

- 日時: 2026-11-14T10:10:32.259Z
- コミット: 7cafe692c39f63e3f9811fcdd79ad807e08ace39
- 音声: デモ交信（検出 6 / 正解 6 交信）
- 実行環境: GitHub Actions（CPU）。ブラウザのGPU実行より遅い

## onnx-community/whisper-base.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **32.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 11% | Dispatch to engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross street remote drive. | 消防車12号へ出動願います。メープルアベニュー421番地で発生した構造物の火災の報告に応じる。交差点のリモートドライブ。 | 960/1287 |
| 100% | And get well copied, unroot. | そして完治して根を抜かずして 取り戻せ。 | 750/401 |
| 35% | Medic Salmon, priority 1 call 65-year-old male with chest pain at the reverse eye chopping tender | メディックスアルマトウミスールム」、優先順位1「コール65才の男性、胸痛を訴える逆眼切開性胸部痛症男性。 | 964/1070 |
| 50% | Magic 7 responding, 86 minutes. | マジック7応答 86分後。 | 747/335 |
| 25% | Unit 23, traffic stop on highway 9 southbound near mile marker 4D, Silver Civan, 2makjupint. | ユニット23、マイル4D付近のハイウェイ9号線南行きの信号で、9号線を止めて、4Dマイルの近くにいる場所だ、シルバー・シベン、2マクジュピント。 | 996/1191 |
| 33% | 10-4. When the 3-1 scene. Code 4. No further assistance needed. | 了解。3-1の場面では、いつかあの3つの1の場面が起こるとき。応援不要。 | 898/605 |

## onnx-community/whisper-small.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **16.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 16% | Dispatch to engine 12. Respond to reported structure fire at 421 Maple Avenue. Cross-street emote drive. | 消防車12号へ出動願います。メープルアベニュー421番地で発生した構造火災の報告に応じる。交差点のエモートドライブ。 | 2306/1282 |
| 0% | Engine 12 copies en route. | 消防車12、代理が途中まわりに写しを取ってます"。 | 1869/427 |
| 6% | Medic salmon, priority one call. 65 year old male with chest pain at the Riverside shopping center. | “メディックサーモン”.、最優先の出動要請。リバーサイド・ショッピングセンターで胸の痛みに苦しむ65歳の男性。 | 2153/856 |
| 50% | Medic salmon responding. It's in 6 minutes. | メディックサーモン応答中。あと6分だ。 | 1988/491 |
| 6% | Unit 23, traffic stop on highway 9, southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイ9号線、40マイル地点近くの南行き、40マイル地点付近で交通検問所だ。銀色のセダン、乗車者2名。 | 2283/1182 |
| 33% | 10-4. When the freedom's seen, code 4, no further assistance needed. | 了解。自由が認められるようになると、応援不要。 | 2205/236 |

## onnx-community/whisper-base.en (q8) + Kadonox/fugumt-en-ja-onnx (q8)

単語誤り率（WER）: **32.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 11% | Dispatch to engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross street remote drive. | 消防車第12号へ発送。421メープル通りで報告された火災に対応します。クロスストリートリモートドライブ。 | 856/428 |
| 100% | And get well copied, unroot. | よくコピーして解き放て。 | 798/95 |
| 35% | Medic Salmon, priority 1 call 65-year-old male with chest pain at the reverse eye chopping tender | 痛を主訴に来院した65歳男性を優先的に治療した医療用サーモン。 | 971/300 |
| 50% | Magic 7 responding, 86 minutes. | マジック 7 応答、 86 分。 | 821/122 |
| 25% | Unit 23, traffic stop on highway 9 southbound near mile marker 4D, Silver Civan, 2makjupint. | ユニット23、マイルマーカ4D近くの南行きの高速道路の交通停止、シルバー・シヴァン、2人組。 | 1055/331 |
| 33% | 10-4. When the 3-1 scene. Code 4. No further assistance needed. | 了解。3-1シーン。応援不要。 | 935/151 |

