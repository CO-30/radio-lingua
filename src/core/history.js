// 翻訳履歴。端末内（localStorage）だけに保存し、外部には送らない。

const KEY = 'radiolingua.history.v1';
const MAX = 1000;

export class History {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.items = this._read();
  }
  _read() {
    try {
      const raw = this.storage?.getItem(KEY);
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  _write() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.items));
    } catch {
      // 容量超過時は古いものから半分捨てて再試行
      this.items = this.items.slice(-Math.floor(MAX / 2));
      try {
        this.storage?.setItem(KEY, JSON.stringify(this.items));
      } catch {}
    }
  }
  add(entry) {
    const item = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), ...entry };
    this.items.push(item);
    if (this.items.length > MAX) this.items.splice(0, this.items.length - MAX);
    this._write();
    return item;
  }
  clear() {
    this.items = [];
    this._write();
  }
  toText() {
    return this.items
      .map((i) => {
        const d = new Date(i.ts);
        const time = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${d.toTimeString().slice(0, 8)}`;
        return `[${time}] ${i.source || ''}\n${i.ja}\n${i.en}\n`;
      })
      .join('\n');
  }
  toJSON() {
    return JSON.stringify({ app: 'RADIO LINGUA', exportedAt: new Date().toISOString(), items: this.items }, null, 2);
  }
}
