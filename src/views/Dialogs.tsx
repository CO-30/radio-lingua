// 設定・局の追加・AIモデルのダウンロード確認。
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp, setState, type Settings } from '../app/store';
import { addStation, answerConsent, requestNotifyPermission, updateSettings } from '../app/services';
import { addKeyword, SUGGESTED_ALERTS } from '../core/alerts.js';
import { countryOptions } from '../app/geo';
import { navigate } from '../app/router';
import { canCaptureTab } from '../core/capture.js';
import { KindIcon, IconClose } from '../components/Icons';

function Modal({ open, onClose, title, children, id }: { open: boolean; onClose: () => void; title: string; children: ReactNode; id: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-labelledby={`${id}-title`} onClose={onClose} onCancel={onClose}>
      <div className="sheet-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="閉じる">
          <IconClose size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function SettingsDialog() {
  const open = useApp((s) => s.settingsOpen);
  const settings = useApp((s) => s.settings);
  const [draft, setDraft] = useState<Settings>(settings);
  const [kw, setKw] = useState('');
  const [notifyNote, setNotifyNote] = useState('');
  useEffect(() => {
    if (open) {
      setDraft(settings);
      setKw('');
      setNotifyNote('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => setState({ settingsOpen: false });
  const set = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }));
  const addKw = (raw: string) => {
    const next = addKeyword(draft.alertKeywords, raw);
    set({ alertKeywords: next, alertsOn: next.length > draft.alertKeywords.length ? true : draft.alertsOn });
    setKw('');
  };
  return (
    <Modal open={open} onClose={close} title="設定" id="settings">
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          updateSettings(draft);
          close();
        }}
      >
        <fieldset>
          <legend>音声認識</legend>
          {(
            [
              ['standard', '標準', 'おすすめ・約80〜200MB'],
              ['accurate', '高精度', '高性能PC・録音向け・約390MB'],
              ['light', '軽量', 'スマホ向け・約40〜70MB'],
            ] as const
          ).map(([v, l, d]) => (
            <label key={v} className="option">
              <input type="radio" name="asr" value={v} checked={draft.asr === v} onChange={() => set({ asr: v })} />
              <span>{l}</span>
              <small>{d}</small>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>翻訳</legend>
          {(
            [
              ['lfm2', '高品質', 'LFM2・約300MB'],
              ['fugu', '省メモリ', 'FuguMT・約110MB'],
            ] as const
          ).map(([v, l, d]) => (
            <label key={v} className="option">
              <input type="radio" name="mt" value={v} checked={draft.mt === v} onChange={() => set({ mt: v })} />
              <span>{l}</span>
              <small>{d}</small>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>表示と読み上げ</legend>
          <label className="option">
            <input type="checkbox" checked={draft.showEn} onChange={(e) => set({ showEn: e.target.checked })} />
            <span>英語の原文も表示</span>
          </label>
          <label className="option">
            <input type="checkbox" checked={draft.autoSpeak} onChange={(e) => set({ autoSpeak: e.target.checked })} />
            <span>新しい交信を自動で読み上げ</span>
          </label>
          <label className="range">
            読み上げの速さ
            <input type="range" min="0.8" max="1.6" step="0.05" value={draft.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
          </label>
          <label className="range">
            文字の大きさ
            <input type="range" min="0.85" max="1.4" step="0.05" value={draft.size} onChange={(e) => set({ size: Number(e.target.value) })} />
          </label>
        </fieldset>
        <fieldset className="alerts">
          <legend>キーワード通知</legend>
          <label className="option">
            <input type="checkbox" checked={draft.alertsOn} onChange={(e) => set({ alertsOn: e.target.checked })} />
            <span>登録した語を含む交信を知らせる</span>
          </label>
          <div className="kw-input">
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addKw(kw);
                }
              }}
              placeholder="例：structure fire、火災"
              aria-label="通知するキーワード"
              maxLength={40}
            />
            <button type="button" className="btn btn-ghost btn-small" onClick={() => addKw(kw)} disabled={!kw.trim()}>
              追加
            </button>
          </div>
          {draft.alertKeywords.length > 0 && (
            <div className="chips" aria-label="登録中のキーワード">
              {draft.alertKeywords.map((k) => (
                <button key={k} type="button" className="chip is-on kw" onClick={() => set({ alertKeywords: draft.alertKeywords.filter((x) => x !== k) })} aria-label={`${k}を削除`} title="押すと削除">
                  {k} ×
                </button>
              ))}
            </div>
          )}
          <div className="chips kw-suggest" aria-label="よく使われる語">
            {SUGGESTED_ALERTS.filter((k) => !draft.alertKeywords.includes(k)).map((k) => (
              <button key={k} type="button" className="chip" onClick={() => addKw(k)}>
                ＋ {k}
              </button>
            ))}
          </div>
          <label className="option">
            <input type="checkbox" checked={draft.alertSound} onChange={(e) => set({ alertSound: e.target.checked })} />
            <span>通知音を鳴らす</span>
          </label>
          <label className="option">
            <input
              type="checkbox"
              checked={draft.alertNotify}
              onChange={async (e) => {
                if (!e.target.checked) return set({ alertNotify: false });
                const ok = await requestNotifyPermission();
                set({ alertNotify: ok });
                setNotifyNote(ok ? '' : '端末の通知が許可されていません。ブラウザの設定から許可してください。');
              }}
            />
            <span>別の画面を見ているときは端末に通知</span>
          </label>
          {notifyNote && <p className="sheet-note">{notifyNote}</p>}
          <p className="sheet-note">英語は単語の先頭から一致（「evacuat」で evacuate・evacuation）、日本語は訳文で一致します。</p>
        </fieldset>
        <fieldset>
          <legend>プライバシーと動作</legend>
          <label className="option">
            <input type="checkbox" checked={draft.saveHistory} onChange={(e) => set({ saveHistory: e.target.checked })} />
            <span>交信の履歴をこの端末に保存</span>
          </label>
          <label className="option">
            <input type="checkbox" checked={draft.forceWasm} onChange={(e) => set({ forceWasm: e.target.checked })} />
            <span>GPUを使わない</span>
            <small>動作が不安定なとき</small>
          </label>
        </fieldset>
        <p className="sheet-note">AIのモデルを変えた場合は、次に受信を始めたときに読み込み直します。</p>
        <p className="sheet-note">
          <a href="#/about" onClick={close}>
            このアプリについて・利用規約・プライバシー・ライセンス
          </a>
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>
            閉じる
          </button>
          <button type="submit" className="btn btn-primary">
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ConsentDialog() {
  const c = useApp((s) => s.consent);
  return (
    <Modal open={c.open} onClose={() => answerConsent(false)} title="AIモデルをダウンロードします" id="consent">
      <div className="sheet-body">
        <p>
          音声認識「{c.asrLabel}」と翻訳「{c.mtLabel}」で、合計 約{c.mb}MB です。モバイル回線ではWi-Fiへの切り替えをおすすめします。
        </p>
        <p className="sheet-note">ダウンロードは初回のみです。2回目以降は端末に保存されたモデルを使います。音声や翻訳結果が外部に送られることはありません。</p>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => answerConsent(false)}>
            やめる
          </button>
          <button className="btn btn-primary" onClick={() => answerConsent(true)}>
            ダウンロードして開始
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AddStationDialog() {
  const open = useApp((s) => s.addStationOpen);
  const [name, setName] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [country, setCountry] = useState('US');
  const [region, setRegion] = useState('');
  const [input, setInput] = useState(canCaptureTab() ? 'tab' : 'mic');
  const [url, setUrl] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const options = useRef(countryOptions()).current;
  useEffect(() => {
    if (open) {
      setName('');
      setTypes([]);
      setRegion('');
      setUrl('');
      setAgree(false);
      setError('');
      setCountry(typeof open === 'string' ? open : 'US');
    }
  }, [open]);
  const close = () => setState({ addStationOpen: false });
  return (
    <Modal open={!!open} onClose={close} title="局を追加" id="addst">
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!agree) return setError('利用条件の確認にチェックしてください。');
          try {
            const st = addStation({ name, types, country, region, input, url });
            navigate(`/live/${st.id}`);
          } catch (err: any) {
            setError(err.message);
          }
        }}
      >
        <label className="field">
          <span>局の名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：自宅の受信機（消防）" maxLength={40} />
        </label>
        <fieldset>
          <legend>種別（複数選択可）</legend>
          <div className="chips">
            {(['police', 'fire', 'ems'] as const).map((k) => (
              <label key={k} className={`chip kind-${k}${types.includes(k) ? ' is-on' : ''}`}>
                <input type="checkbox" className="visually-hidden" checked={types.includes(k)} onChange={(e) => setTypes(e.target.checked ? [...types, k] : types.filter((t) => t !== k))} />
                <KindIcon kind={k} size={14} />
                {k === 'police' ? '警察' : k === 'fire' ? '消防' : '救急'}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field-row">
          <label className="field">
            <span>国・地域</span>
            <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}>
              {options.map((o) => (
                <option key={o.a2} value={o.a2}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>地域・都市（任意）</span>
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="例：カリフォルニア州" maxLength={40} />
          </label>
        </div>
        <fieldset>
          <legend>音声の取り込み方法</legend>
          <label className="option">
            <input type="radio" name="input" checked={input === 'mic'} onChange={() => setInput('mic')} />
            <span>マイク・受信機</span>
            <small>受信機の音を端末のマイクで拾う</small>
          </label>
          <label className={`option${canCaptureTab() ? '' : ' is-disabled'}`}>
            <input type="radio" name="input" disabled={!canCaptureTab()} checked={input === 'tab'} onChange={() => setInput('tab')} />
            <span>ブラウザのタブ音声</span>
            <small>{canCaptureTab() ? '配信を再生中のタブから取り込む' : 'パソコンの Chrome・Edge のみ'}</small>
          </label>
          <label className="option">
            <input type="radio" name="input" checked={input === 'stream'} onChange={() => setInput('stream')} />
            <span>配信URL</span>
            <small>ご自身の受信機の配信など（https）</small>
          </label>
          {input === 'stream' && (
            <label className="field">
              <span>配信URL</span>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
            </label>
          )}
        </fieldset>
        <label className="option agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>この音声を受信・翻訳する権利があることを確認しました。翻訳結果は公開・転載しません。</span>
        </label>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>
            やめる
          </button>
          <button type="submit" className="btn btn-primary">
            追加して開く
          </button>
        </div>
      </form>
    </Modal>
  );
}
