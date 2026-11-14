# 実モデル精度測定（自動）

- 日時: 2026-11-14T13:43:30.722Z
- コミット: 407bc581869714762e8e29cc4aeb5746f916ffc2
- 音声: デモ交信（検出 6 / 正解 6 交信）
- 実行環境: GitHub Actions（CPU）。ブラウザのGPU実行より遅い

## onnx-community/whisper-base.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **4.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to Engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車12番へ出動願います。メープル通り421番地で発生した建物火災の報告に応じる。交差道路はオーク・ドライブだ。 | 1261/1319 |
| 20% | Engine 12 copies and route. | 消防車12、了解、現場へ向かう。 | 1288/5 |
| 6% | Medic 7, Priority 1 call. 65-year-old male with chest pain at the Riverside Shopping Center. | 救急車7、最優先の出動要請。リバーサイド・ショッピングセンターで胸の痛みに苦しむ65歳男性。 | 1967/964 |
| 0% | Medic 7 responding, ETA 6 minutes. | 救急車7、出動する、到着予定時刻は、6分後です。 | 1397/836 |
| 6% | Unit 23, traffic stop on Highway 9, Southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイ9号線の南行き、40マイル地点付近で、交通停止です。銀色のセダン、乗車者2名。 | 1184/1339 |
| 0% | 10-4-23 is on scene. Code 4 no further assistance needed. | 了解。23、現着。応援不要。 | 1073/1 |

## onnx-community/whisper-small.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **2.7%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車12番へ出動願います。メープル通り421番地で発生した建物火災の報告に応じる。交差道路はオーク・ドライブだ。 | 2917/1396 |
| 0% | Engine 12 copies en route | 消防車12、了解、現場へ向かう。 | 2402/1 |
| 6% | Medic 7, priority 1 call. 65 year old male with chest pain at the Riverside Shopping Center. | 救急車7、最優先の出動要請。リバーサイド・ショッピングセンターで胸の痛みに苦しむ65歳の男性。 | 2709/722 |
| 0% | Medic 7 responding. ETA 6 minutes. | 救急車7、出動する。到着予定時刻は、6分後です。 | 2435/379 |
| 6% | Unit 23, traffic stop on Highway 9, southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイ9号線、南行き、40マイル地点近くの交通停止だ。銀色のセダン、乗車者2名。 | 2860/1266 |
| 0% | 10-4 23 is on scene. Code 4 no further assistance needed. | 了解。23、現着。応援不要。 | 2653/1 |

## onnx-community/whisper-base.en (q8) + Kadonox/fugumt-en-ja-onnx (q8)

単語誤り率（WER）: **4.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to Engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車第12号へ発送。421メープル通りで報告された火災に対応します。交差道路はオークドライブです。 | 1271/534 |
| 20% | Engine 12 copies and route. | 消防車12、了解、現場へ向かう。 | 937/1 |
| 6% | Medic 7, Priority 1 call. 65-year-old male with chest pain at the Riverside Shopping Center. | 救急車7、最優先の出動要請。症例は65歳男性, 胸痛を主訴に川沿いショッピングセンターを受診した。 | 1214/359 |
| 0% | Medic 7 responding, ETA 6 minutes. | 救急車7、出動する、推定時間6分。 | 1017/97 |
| 6% | Unit 23, traffic stop on Highway 9, Southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイZの交通機関停止、マイルマーカ40近くのサウスバウンド。シルバーセダン、二人の乗員。 | 1229/372 |
| 0% | 10-4-23 is on scene. Code 4 no further assistance needed. | 了解。23、現着。応援不要。 | 1112/1 |

