# セキュリティ監査（2026-11-14）

対象：RADIO LINGUA v0.2（https://co-30.github.io/radio-lingua/ ）

## 結論
重大な問題はありません。サーバーを持たない静的サイトで、利用者の音声・字幕・履歴は端末の外に出ません。
下記「残るリスク」は商用化までに対応します。

## 確認項目
| 項目 | 結果 | 確認方法 |
|---|---|---|
| 秘密情報（APIキー・トークン）のリポジトリ混入 | なし | 全ファイルを検索。APIキーを使う機能自体が存在しない |
| 依存パッケージの既知の脆弱性 | 0件 | `npm audit`（本番・開発とも） |
| XSS（不正なスクリプトの埋め込み） | 対策済み | 画面の文字はすべて `textContent` で表示（`innerHTML`・`eval` 不使用）。CSPで自サイト以外のスクリプトを禁止 |
| 通信先 | 自サイト（GitHub Pages）と Hugging Face（モデル取得）のみ | 実ブラウザで通信先を確認。CSPの `connect-src` でも制限 |
| 利用者データの送信 | なし | 音声認識・翻訳はブラウザ内（Web Worker）で実行。履歴は localStorage のみ |
| 端末の権限 | マイク・画面共有は、利用者が該当ボタンを押したときだけ要求 | コード確認 |
| AIモデルの改ざん・すり替え | 版（コミットID）を固定 | `src/core/models.js` の `REVISIONS` |
| 実行環境（ONNX Runtime）の配信 | 自サイトから配信（外部CDNに依存しない） | `scripts/copy-ort.mjs` |
| リファラー送信 | 送らない | `<meta name="referrer" content="no-referrer">` |
| Cookie・解析ツール・広告 | 使用していない | コード確認 |
| 暗号化通信の復号・不正アクセス | 該当機能なし | コード確認 |

## コンテンツセキュリティポリシー（本番ビルドに自動付与）
```
default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self';
img-src 'self' data:; media-src 'self' blob:;
connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co;
object-src 'none'; base-uri 'self'; form-action 'self'
```

## 残るリスクと対策予定
| リスク | 影響 | 対策 |
|---|---|---|
| GitHub Pages ではHTTPヘッダーを設定できず、Web Worker にCSPがかからない | 低（Worker は自サイトのコードのみ実行） | 商用化時に Cloudflare Pages（無料）へ移行し、ヘッダーでCSPを設定 |
| モデル配布元（Hugging Face）の障害・規約変更 | 中（新規利用者がモデルを取得できない） | 商用化時にモデルを自前配信へ切り替え（ライセンス上の再配布条件を確認済み：MIT／LFM Open License／CC BY-SA） |
| 端末に保存される履歴（無線の翻訳内容） | 低〜中（共用端末で他人に見られる） | 「履歴を消去」を用意済み。今後「履歴を保存しない」設定を追加 |
| 翻訳の誤り | 中（誤った理解） | 画面と説明書で「緊急時の判断に使わない」旨を明記 |
