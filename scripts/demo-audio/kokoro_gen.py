"""デモ交信の音声を Kokoro-82M（Apache-2.0）で合成する。GitHub Actions 上で実行。"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

lines = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
pipes = {}
for i, line in enumerate(lines):
    voice = line.get("voice", "af_heart")
    lang = voice[0]  # a=米国英語, b=英国英語
    pipes.setdefault(lang, KPipeline(lang_code=lang))
    chunks = []
    for _, _, audio in pipes[lang](line["text"], voice=voice, speed=line.get("speed", 1.08)):
        chunks.append(audio.numpy() if hasattr(audio, "numpy") else np.asarray(audio))
    sf.write(out / f"line{i:02d}.wav", np.concatenate(chunks), 24000, subtype="PCM_16")
    print("wrote", i, voice)
