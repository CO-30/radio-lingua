# 実モデル精度測定（自動）

- 日時: 2026-11-14T10:19:49.449Z
- コミット: 26df4fb2ac3c5c6c002369d5d7e19092e6a81d87
- 音声: デモ交信（検出 6 / 正解 6 交信）
- 実行環境: GitHub Actions（CPU）。ブラウザのGPU実行より遅い

## onnx-community/whisper-base.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **4.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to Engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車12号へ出動願います。メープルアベニュー421番地で発生した建物火災の報告に応じる。交差道路はオーク・ドライブだ。 | 1029/1163 |
| 20% | Engine 12 copies and route. | 消防車12、コピーとルート。 | 692/269 |
| 6% | Medic 7, Priority 1 call. 65-year-old male with chest pain at the Riverside Shopping Center. | 救急車7、最優先の出動要請。リバーサイド・ショッピングセンターで胸の痛みに苦しむ65歳の男性。 | 966/598 |
| 0% | Medic 7 responding, ETA 6 minutes. | 救急車7、出動する、到着予定時刻は約6分です。 | 703/331 |
| 6% | Unit 23, traffic stop on Highway 9, Southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイ9号線の南行き、40マイル地点近くの40マイル地点付近で、交通停止です。銀色のセダン、乗車者2名。 | 958/1112 |
| 0% | 10-4-23 is on scene. Code 4 no further assistance needed. | 了解。23、現着。応援不要。 | 1206/1 |

## onnx-community/whisper-small.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **2.7%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車12号へ出動願います。メープルアベニュー421番地で発生した建物火災の報告に応じる。交差道路はオーク・ドライブだ。 | 2930/1140 |
| 0% | Engine 12 copies en route | 消防車12、了解、現場へ向かう。 | 1782/1 |
| 6% | Medic 7, priority 1 call. 65 year old male with chest pain at the Riverside Shopping Center. | 救急車7、最優先の出動要請。リバーサイド・ショッピングセンターで胸の痛みに苦しむ65歳の男性。 | 2118/612 |
| 0% | Medic 7 responding. ETA 6 minutes. | 救急車7、出動する。到着予定時刻は約6分です。 | 1968/365 |
| 6% | Unit 23, traffic stop on Highway 9, southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイ9号線、南行き、40マイル地点付近の40マイル地点近くの交通停止だ。銀色のセダン、乗車者2名。 | 2286/1225 |
| 0% | 10-4 23 is on scene. Code 4 no further assistance needed. | 了解。23、現着。応援不要。 | 2049/1 |

## onnx-community/whisper-base.en (q8) + Kadonox/fugumt-en-ja-onnx (q8)

単語誤り率（WER）: **4.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to Engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車第12号へ発送。421メープル通りで報告された火災に対応します。交差道路はオークドライブです。 | 957/376 |
| 20% | Engine 12 copies and route. | 消防車12、コピーとルート。 | 762/70 |
| 6% | Medic 7, Priority 1 call. 65-year-old male with chest pain at the Riverside Shopping Center. | 救急車7、最優先の出動要請。症例は65歳男性, 胸痛を主訴に川沿いショッピングセンターを受診した。 | 949/304 |
| 0% | Medic 7 responding, ETA 6 minutes. | 救急車7、出動する、推定時間6分。 | 844/87 |
| 6% | Unit 23, traffic stop on Highway 9, Southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイZの交通機関停止、マイルマーカ40近くのサウスバウンド。シルバーセダン、二人の乗員。 | 992/445 |
| 0% | 10-4-23 is on scene. Code 4 no further assistance needed. | 了解。23、現着。応援不要。 | 859/1 |

