// ONNX Runtime Web の実行ファイルを自前で配信する（外部CDNに依存しないため）。
// transformers.js が要求するバージョンと必ず一致させるため、同梱版をコピーする。
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const candidates = [
  join(root, 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist'),
  join(root, 'node_modules/onnxruntime-web/dist'),
];
const dist = candidates.find((d) => existsSync(d));
if (!dist) throw new Error('onnxruntime-web が見つかりません。npm install を実行してください。');
const out = join(root, 'public/ort');
mkdirSync(out, { recursive: true });
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) copyFileSync(join(dist, f), join(out, f));
console.log(`copied ORT runtime from ${dist}`);
