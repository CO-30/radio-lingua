// Supertonic 3 で日本語読み上げの聞き比べ用サンプルを作る（GitHub Actions で実行）。
// node gen.mjs <supertonicのnodejsディレクトリ> <モデルdir> <ラベル> <出力dir>
import fs from 'fs';
import path from 'path';
const [, , helperDir, modelDir, label, outDir] = process.argv;
const { loadTextToSpeech, loadVoiceStyle, writeWavFile } = await import(path.resolve(helperDir, 'helper.js'));
const lines = JSON.parse(fs.readFileSync(new URL('./lines.json', import.meta.url)));
const voices = label === 'int8' ? ['F1', 'F2', 'F3', 'M1', 'M2', 'M3'] : ['F2', 'M1'];
fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const tts = await loadTextToSpeech(path.join(modelDir, 'onnx'), false);
const report = { label, loadMs: Date.now() - t0, items: [] };
for (const v of voices) {
  const style = loadVoiceStyle([path.join(modelDir, 'voice_styles', `${v}.json`)]);
  const parts = [];
  let audioSec = 0;
  const s = Date.now();
  for (const text of lines) {
    const { wav, duration } = await tts.call(text, 'ja', style, 8, 1.0, 0.45);
    for (const x of wav) parts.push(x);
    audioSec += duration[0];
  }
  const ms = Date.now() - s;
  writeWavFile(path.join(outDir, `${label}-${v}.wav`), parts, tts.sampleRate);
  report.items.push({ voice: v, audioSec: +audioSec.toFixed(1), synthMs: ms, rtf: +(ms / 1000 / audioSec).toFixed(3) });
  console.log(label, v, ms, 'ms for', audioSec.toFixed(1), 's');
}
fs.writeFileSync(path.join(outDir, `${label}-report.json`), JSON.stringify(report, null, 2));
