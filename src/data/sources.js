// ライブ音声の提供元カタログ。対応国・局を増やすときはここに追記する。
// status: 'available' = 利用可, 'contract' = 有料契約と審査が必要, 'permission' = 運営者の許諾待ち
// 局を個別に載せるのは、提供元の許諾が取れてから（docs/LEGAL.md 参照）。

export const LIVE_PROVIDERS = [
  {
    id: 'broadcastify-calls',
    name: 'Broadcastify Calls',
    countries: ['米国', 'カナダ', 'オーストラリアほか'],
    types: ['police', 'fire', 'ems'],
    status: 'contract',
    statusText: '有料API（従量課金）の契約と審査が必要',
    note: '翻訳アプリでの利用が規約上認められている唯一の大手。地域ごとの申請が必要。',
    url: 'https://www.broadcastify.com/calls/',
  },
  {
    id: 'openmhz',
    name: 'OpenMHz',
    countries: ['米国'],
    types: ['police', 'fire', 'ems'],
    status: 'permission',
    statusText: '利用条件が未公開のため運営者へ確認中',
    note: '無料・オープンソースの交信アーカイブ。商用利用の可否が未確認。',
    url: 'https://openmhz.com/',
  },
  {
    id: 'broadcastify-feeds',
    name: 'Broadcastify ライブフィード',
    countries: ['米国ほか'],
    types: ['police', 'fire', 'ems'],
    status: 'blocked',
    statusText: '規約で再配信アプリは不可',
    note: 'ご自身で公式サイトを開き「タブ音声」で取り込む使い方のみ想定。',
    url: 'https://www.broadcastify.com/',
  },
];

export const TYPE_LABEL = { police: '警察', fire: '消防', ems: '救急', other: 'その他' };
