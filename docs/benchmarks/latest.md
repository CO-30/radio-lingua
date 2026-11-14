# 実モデル精度測定（自動）

- 日時: 2026-11-14T10:16:02.396Z
- コミット: f58d7209b9e705d5ce9d2d93a0eac4215736811d
- 音声: デモ交信（検出 6 / 正解 6 交信）
- 実行環境: GitHub Actions（CPU）。ブラウザのGPU実行より遅い

## onnx-community/whisper-base.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **4.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to Engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車12号へ出動願います。メープルアベニュー421番地で発生した構造物の火災の報告に応じる。クロス・ストリートはオーク・ドライブだ。 | 1041/2050 |
| 20% | Engine 12 copies and route. | 消防車12、コピーとルート。 | 946/433 |
| 6% | Medic 7, Priority 1 call. 65-year-old male with chest pain at the Riverside Shopping Center. | 救急車7、優先度１　コール。リバーサイド・ショッピングセンターで胸の痛みに苦しむ65歳の男性。 | 1497/1009 |
| 0% | Medic 7 responding, ETA 6 minutes. | 救急車7、出動する、到着予定時刻は約6分です。 | 788/339 |
| 6% | Unit 23, traffic stop on Highway 9, Southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイ9号線の南行き、40マイル地点近くの40マイル地点付近で、交通検問所です。銀色のセダン、乗車者2名。 | 957/1243 |
| 0% | 10-4-23 is on scene. Code 4 no further assistance needed. | ロジャー23は現場にいる。応援不要。 | 890/316 |

## onnx-community/whisper-small.en (q8) + onnx-community/LFM2-350M-ENJP-MT-ONNX (q4)

単語誤り率（WER）: **2.7%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車12号へ出動願います。メープルアベニュー421番地で発生した構造物の火災の報告に応じる。クロス・ストリートはオーク・ドライブだ。 | 2278/1263 |
| 0% | Engine 12 copies en route | 消防車12、コピーを送る"、"途中まわりにコピーしてくる。 | 1820/453 |
| 6% | Medic 7, priority 1 call. 65 year old male with chest pain at the Riverside Shopping Center. | 救急車7、コール1番優先。リバーサイド・ショッピングセンターで胸の痛みに苦しむ65歳の男性。 | 2244/885 |
| 0% | Medic 7 responding. ETA 6 minutes. | 救急車7、出動する。到着予定時刻は約6分です。 | 1951/342 |
| 6% | Unit 23, traffic stop on Highway 9, southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイ9号線、南行き、40マイル地点付近の40マイル地点近くの停止信号だ。銀色のセダン、乗車者2名。 | 2234/1301 |
| 0% | 10-4 23 is on scene. Code 4 no further assistance needed. | ロジャー23号が現場にいます。応援不要。 | 2086/382 |

## onnx-community/whisper-base.en (q8) + Kadonox/fugumt-en-ja-onnx (q8)

単語誤り率（WER）: **4.0%**

| WER | 認識結果 | 翻訳 | 認識/翻訳 ms |
|---|---|---|---|
| 0% | Dispatch to Engine 12. Respond to a reported structure fire at 421 Maple Avenue. Cross Street is Oak Drive. | 消防車第12号へ発送。421メープル通りで報告された火災に対応します。クロスストリートはオークドライブです。 | 988/443 |
| 20% | Engine 12 copies and route. | 消防車12、コピーとルート。 | 772/98 |
| 6% | Medic 7, Priority 1 call. 65-year-old male with chest pain at the Riverside Shopping Center. | 救急車7、優先度1を呼び出します。症例は65歳男性, 胸痛を主訴に川沿いショッピングセンターを受診した。 | 985/503 |
| 0% | Medic 7 responding, ETA 6 minutes. | 救急車7、出動する、推定時間6分。 | 762/94 |
| 6% | Unit 23, traffic stop on Highway 9, Southbound near mile marker 40. Silver sedan, two occupants. | ユニット23、ハイウェイZの交通機関停止、マイルマーカ40近くのサウスバウンド。シルバーセダン、二人の乗員。 | 1008/415 |
| 0% | 10-4-23 is on scene. Code 4 no further assistance needed. | Roger-23が舞台です。応援不要。 | 921/196 |

