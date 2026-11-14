// このアプリについて・利用規約（案）・プライバシーポリシー（案）・ライセンス
import { useState } from 'react';
import { LEGAL_STATUS, PRIVACY, TERMS, type Section } from '../data/legal';
import { ASR_MODELS, MT_MODELS } from '../core/models.js';

const TABS = [
  ['about', 'このアプリについて'],
  ['terms', '利用規約'],
  ['privacy', 'プライバシー'],
  ['licenses', 'ライセンス'],
] as const;

function Sections({ list }: { list: Section[] }) {
  return (
    <div className="legal">
      <p className="notice notice-warn">{LEGAL_STATUS}</p>
      {list.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function AboutView({ tab }: { tab: string }) {
  const [cur, setCur] = useState<string>(TABS.some(([k]) => k === tab) ? tab : 'about');
  return (
    <section className="pageview" aria-labelledby="aboutTitle">
      <header className="page-head">
        <div>
          <h1 id="aboutTitle">RADIO LINGUA について</h1>
          <p className="page-lead">世界の警察・消防・救急の無線を、端末の中のAIで日本語にするアプリです。</p>
        </div>
      </header>
      <div className="chips tabs" role="tablist" aria-label="項目">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={cur === k}
            className={`chip${cur === k ? ' is-on' : ''}`}
            onClick={() => {
              setCur(k);
              history.replaceState(null, '', `#/about/${k}`);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {cur === 'about' && (
        <div className="legal">
          <section>
            <h2>しくみ</h2>
            <p>受信した英語の音声を交信ごとに区切り、音声認識AI（Whisper）で文字にし、翻訳AIで日本語にします。AIはすべてこの端末の中で動き、音声や翻訳結果が外部に送られることはありません。</p>
          </section>
          <section>
            <h2>音声について</h2>
            <p>現在受信できるのは、デモ局（架空の交信）と、利用者ご自身が追加した局（お手持ちの受信機・タブ音声・配信URL）です。実在の警察・消防・救急の配信は、提供元の利用許諾を確認してから追加します。</p>
          </section>
          <section>
            <h2>ご注意</h2>
            <p>AIの翻訳には誤りがあります。聞き取りが不確かな語は黄色の下線で示します。緊急時の判断や公式情報の代わりには使わないでください。無線の内容や翻訳結果を公開・転載しないでください。</p>
          </section>
          <section>
            <h2>費用</h2>
            <p>現在は無料です。AIを端末で動かすため、運営側のサーバー費用がかからない設計です。</p>
          </section>
        </div>
      )}
      {cur === 'terms' && <Sections list={TERMS} />}
      {cur === 'privacy' && <Sections list={PRIVACY} />}
      {cur === 'licenses' && (
        <div className="legal">
          <section>
            <h2>AIモデル</h2>
            <ul>
              {Object.values(ASR_MODELS).map((m: any) => (
                <li key={m.id}>
                  {m.label}：{m.id}（{m.license}）
                </li>
              ))}
              {Object.values(MT_MODELS).map((m: any) => (
                <li key={m.id}>
                  {m.label}：{m.id}（{m.license}）
                </li>
              ))}
            </ul>
            <p>FuguMT：© staka, CC BY-SA 4.0（https://huggingface.co/staka/fugumt-en-ja）</p>
            <p>AI音声（任意）：Supertone Supertonic 3（BigScience Open RAIL-M、https://huggingface.co/Supertone/supertonic-3）。推論手順は Supertone 社のサンプルコード（MIT）に基づきます。AI音声の読み上げは機械で合成した音声です。</p>
          </section>
          <section>
            <h2>ソフトウェア・データ・書体</h2>
            <ul>
              <li>Transformers.js（Apache-2.0）、ONNX Runtime Web（MIT）、React（MIT）、Vite（MIT）</li>
              <li>世界地図：Natural Earth（パブリックドメイン）、world-atlas（ISC）</li>
              <li>書体：Chakra Petch（SIL Open Font License 1.1）</li>
              <li>デモ音声：本プロジェクトで作成（音声合成 Kokoro-82M、Apache-2.0）。架空の交信です。</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}
