# Broadcastify Calls API 利用申請の記入案（英語）

申請先: https://bcfy.io/dev/apply/ （RadioReference / Broadcastify アカウントが必要）
料金: 前払いの従量課金（最低5ドル、読み出した件数に応じて課金、月の上限額を設定可）
注意: 地域を絞った申請が前提（州・全国規模は Enterprise 契約）。まず1つの都市圏で申請する。

---

**What the app does**
RADIO LINGUA is a web app (PWA) for Japanese speakers. It plays Broadcastify Calls audio for a single selected metro area and shows live Japanese captions. Speech recognition (Whisper) and translation run entirely on the listener's device. No audio is uploaded or re-hosted by us.

**Who uses it**
Japanese-speaking scanner enthusiasts, researchers, and English learners. Each listener uses their own account on our app. Audio is only played to that listener through our own player.

**Geographic / subject coverage**
Initially one metro area: 〔都市圏を選ぶ。例：対応の多い米国の大都市圏〕 — police, fire, and EMS talkgroups as provided by Broadcastify Calls.

**App store distribution**
Web only (installable PWA). No app-store distribution at this stage.

**Data needed**
Calls Client API: list of systems and talkgroups for the selected area, and live/recent calls (audio URL, timestamps, talkgroup metadata) requested when a listener is actively listening.

**Use of AI**
Inference only (speech-to-text and translation on the listener's device). No model training, no dataset retention, no redistribution of audio or transcripts.

**Commercial use**
Company: 〔運営者名〕. Expected users at launch: 〔人数〕. Business model: free tier without Broadcastify audio; a paid monthly plan that includes Broadcastify Calls listening. Expected volume: 〔件数/月〕.
