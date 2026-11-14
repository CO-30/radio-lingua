import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 本番ビルドに付与するセキュリティ設定（CSP）の確認
const cfg = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8');

describe('コンテンツセキュリティポリシー', () => {
  it('スクリプトは自サイトのみ', () => expect(cfg).toContain(`"script-src 'self'"`));
  it('利用者の配信URL（https）の音声を再生できる', () => expect(cfg).toMatch(/media-src 'self' blob: https:/));
  it('AIモデルの取得先は Hugging Face に限る', () => expect(cfg).toContain('connect-src \'self\' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co'));
  it('プラグイン類は禁止', () => expect(cfg).toContain(`"object-src 'none'"`));
});
