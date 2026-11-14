const meSpeak = require('mespeak');
const fs = require('fs');
meSpeak.loadConfig(require('mespeak/src/mespeak_config.json'));
meSpeak.loadVoice(require('mespeak/voices/en/en-us.json'));
const lines = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
lines.forEach((l,i)=>{
  const buf = meSpeak.speak(l.text, {rawdata:'buffer', speed: l.speed||165, pitch: l.pitch||45, variant: l.variant||'m3'});
  fs.writeFileSync(`out/line${String(i).padStart(2,'0')}.wav`, Buffer.from(buf));
});
console.log('ok', lines.length);
