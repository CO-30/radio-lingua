// アプリ側の実装（src/core/supertonic.js）が公式サンプルと同じ結果になるかを確かめる。
// node ours.mjs <supertonicのnodejsディレクトリ> <モデルdir> <出力dir>
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { synthesize, styleTensors, SUPERTONIC } from '../../src/core/supertonic.js';
const [, , helperDir, modelDir, outDir] = process.argv;
const ref = await import(path.resolve(helperDir, 'helper.js'));
// 同じプロセスで2つの版を読み込むと衝突するので、公式サンプルと同じ ONNX Runtime を使う
const ort = createRequire(path.resolve(helperDir, 'package.json'))('onnxruntime-node');
const lines = JSON.parse(fs.readFileSync(new URL('./lines.json', import.meta.url)));
const onnx = path.join(modelDir, 'onnx');
const cfgs = JSON.parse(fs.readFileSync(path.join(onnx, 'tts.json')));
const indexer = JSON.parse(fs.readFileSync(path.join(onnx, 'unicode_indexer.json')));
const sessions = {};
for (const n of SUPERTONIC.models) sessions[n] = await ort.InferenceSession.create(path.join(onnx, `${n}.onnx`));
const styleJson = JSON.parse(fs.readFileSync(path.join(modelDir, 'voice_styles', 'F2.json')));
const style = styleTensors(ort, styleJson);
const refTts = await ref.loadTextToSpeech(onnx, false);
const refStyle = ref.loadVoiceStyle([path.join(modelDir, 'voice_styles', 'F2.json')]);
const all = [];
let ok = true;
for (const text of lines) {
  const t0 = Date.now();
  const r = await synthesize(ort, sessions, cfgs, indexer, style, text);
  const ms = Date.now() - t0;
  const { duration } = await refTts.call(text, 'ja', refStyle, 8, 1.0, 0);
  const rms = Math.sqrt(r.pcm.reduce((a, x) => a + x * x, 0) / r.pcm.length);
  const diff = Math.abs(r.duration - duration[0]) / duration[0];
  console.log(JSON.stringify({ text, ours: +r.duration.toFixed(3), ref: +duration[0].toFixed(3), diff: +diff.toFixed(4), rms: +rms.toFixed(4), ms }));
  if (diff > 0.01 || rms < 0.01) ok = false;
  for (const x of r.pcm) all.push(x);
  for (let i = 0; i < 0.25 * r.sampleRate; i++) all.push(0);
}
fs.mkdirSync(outDir, { recursive: true });
ref.writeWavFile(path.join(outDir, 'app-F2.wav'), all, cfgs.ae.sample_rate);
if (!ok) {
  console.error('公式サンプルと結果が一致しません');
  process.exit(1);
}
console.log('アプリの実装は公式サンプルと一致');
