#!/bin/bash
# ورقة تواصل: يجمع لقطات كثيرة بصورة وحدة — كلود يشوفها بقراءة وحدة بدل عشر قراءات (توفير توكنز كبير).
# ./07_contact_sheet.sh <workdir> <sheet.jpg> <t1> <t2> ...    (المصدر: ad-final.mp4 إن وُجد، وإلا مجلد prev/)
set -e
W="$(cd "$1" && pwd)"; OUT="$2"; shift 2
TMP="$W/.sheet"; rm -rf "$TMP"; mkdir -p "$TMP"; i=0; INPUTS=(); LAYOUT=""
VID=""
for n in reel-master.mp4 reel-final.mp4 ad-master.mp4 ad-final.mp4; do [ -f "$W/$n" ] && VID="$W/$n" && break; done
for t in "$@"; do
  i=$((i+1)); f="$TMP/$(printf %02d $i).jpg"
  if [ -n "$VID" ]; then ffmpeg -v error -ss "$t" -i "$VID" -frames:v 1 -vf "scale=300:-1" -y "$f"
  else ffmpeg -v error -i "$W/prev/t$(printf %.2f $t).jpg" -vf "scale=300:-1" -y "$f"; fi
  ffmpeg -v error -i "$f" -vf "drawtext=text='${t}s':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5" -y "$f.l.jpg" 2>/dev/null || cp "$f" "$f.l.jpg"
  INPUTS+=( -i "$f.l.jpg" )
  col=$(( (i-1)%3 )); row=$(( (i-1)/3 )); pos="$((col*300))_$((row*534))"
  [ -n "$LAYOUT" ] && LAYOUT="$LAYOUT|"; LAYOUT="$LAYOUT$pos"
done
ffmpeg -v error "${INPUTS[@]}" -filter_complex "xstack=inputs=$i:layout=$LAYOUT:fill=#1A2A4A" -y "$OUT"
rm -rf "$TMP"; echo "✅ $OUT  ($i لقطة)"
