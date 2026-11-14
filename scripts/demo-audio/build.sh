#!/usr/bin/env bash
# 合成した各行を無線らしく加工して1本のデモ音声にする。
#  - 各交信の後にスケルチ音(0.18秒) と無音(1.4秒)
#  - 帯域制限 250-3600Hz、弱いコンプレッサー、ピンクノイズ
set -euo pipefail
cd "$(dirname "$0")"
work=$(mktemp -d)
ffmpeg -hide_banner -loglevel error -f lavfi -i anullsrc=r=22050:cl=mono -t 1.4 -y "$work/sil.wav"
ffmpeg -hide_banner -loglevel error -f lavfi -i "anoisesrc=r=22050:a=0.2:c=white" -t 0.18 -y "$work/sq.wav"
: > "$work/list.txt"
for f in out/line*.wav; do
  b=$(basename "$f" .wav)
  ffmpeg -hide_banner -loglevel error -i "$f" -ar 22050 -ac 1 -y "$work/$b.wav"
  printf "file '%s'\nfile '%s'\nfile '%s'\n" "$work/$b.wav" "$work/sq.wav" "$work/sil.wav" >> "$work/list.txt"
done
ffmpeg -hide_banner -loglevel error -f concat -safe 0 -i "$work/list.txt" -y "$work/raw.wav"
ffmpeg -hide_banner -loglevel error -i "$work/raw.wav" -f lavfi -i "anoisesrc=r=22050:a=0.008:c=pink" \
  -filter_complex "[0:a]highpass=f=250,lowpass=f=3600,acompressor=threshold=0.25:ratio=3[v];[v][1:a]amix=inputs=2:duration=first:normalize=0,volume=1.5" \
  -ar 22050 -ac 1 -c:a pcm_s16le -y ../../tests/fixtures/demo-dispatch.wav
ffmpeg -hide_banner -loglevel error -i ../../tests/fixtures/demo-dispatch.wav -c:a libmp3lame -b:a 48k -y ../../public/samples/demo-dispatch.mp3
ffprobe -v error -show_entries format=duration -of default=nw=1 ../../public/samples/demo-dispatch.mp3
