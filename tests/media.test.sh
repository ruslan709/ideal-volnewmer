#!/usr/bin/env bash
# Проверка сгенерированных медиа (tools/compress-media.sh)
set -u
cd "$(dirname "$0")/.."
fail=0
ok()  { echo "ok   $*"; }
bad() { echo "FAIL $*"; fail=1; }

probe() { ffprobe -v error -select_streams "$2" -show_entries "stream=$3" -of default=nw=1:nk=1 "$1" 2>/dev/null | head -1; }

for n in 1 2 3 4 5 6 7; do
  f="video/web/before_after_face_0$n.mp4"
  [ -f "$f" ] || { bad "$f missing"; continue; }
  [ "$(probe "$f" v:0 codec_name)" = h264 ] && ok "$f h264" || bad "$f not h264"
  [ "$(probe "$f" v:0 width)x$(probe "$f" v:0 height)" = 720x1280 ] && ok "$f 720x1280" || bad "$f size $(probe "$f" v:0 width)x$(probe "$f" v:0 height)"
  [ -z "$(probe "$f" a:0 codec_name)" ] && ok "$f no audio" || bad "$f has audio"
  [ -f "${f%.mp4}.jpg" ] && ok "${f%.mp4}.jpg" || bad "${f%.mp4}.jpg missing"
done

for name in reel_wow_effect_1_procedure_20s reel_before_after_procedure_29s reel_monopolar_procedure_28s reel_face_neck_procedure_159s reel_client_review_89s; do
  f="video_reels/web/$name.mp4"
  [ -f "$f" ] || { bad "$f missing"; continue; }
  [ "$(probe "$f" v:0 codec_name)" = h264 ] && ok "$f h264" || bad "$f not h264"
  h=$(probe "$f" v:0 height); [ "${h:-9999}" -le 1280 ] && ok "$f h=$h" || bad "$f height $h"
  a=$(probe "$f" a:0 codec_name)
  case "$name" in
    *_159s|*_89s) [ "$a" = aac ] && ok "$f has aac" || bad "$f audio='$a' (want aac)";;
    *)            [ -z "$a" ] && ok "$f no audio" || bad "$f has audio";;
  esac
  [ -f "${f%.mp4}.jpg" ] && ok "${f%.mp4}.jpg" || bad "${f%.mp4}.jpg missing"
done

for name in procedure_face_volnewmer face_lifting_lines body_contouring_lines face_before_after result_mirror procedure_face_neck; do
  f="images/web/$name.jpg"
  [ -f "$f" ] || { bad "$f missing"; continue; }
  w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}'); h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
  m=$(( w > h ? w : h )); [ "$m" -le 1400 ] && ok "$f ${w}x$h" || bad "$f too big ${w}x$h"
  s=$(stat -f %z "$f"); [ "$s" -lt 409600 ] && ok "$f $((s/1024))KB" || bad "$f $((s/1024))KB >= 400KB"
done

[ -f images/web/logo_ideal.png ] && sips -g hasAlpha images/web/logo_ideal.png | grep -q yes && ok "logo png with alpha" || bad "images/web/logo_ideal.png (transparent) missing"
dim() { echo "$(sips -g pixelWidth "$1" | awk '/pixelWidth/{print $2}')x$(sips -g pixelHeight "$1" | awk '/pixelHeight/{print $2}')"; }
[ -f favicon.ico ] && ok favicon.ico || bad "favicon.ico missing"
[ -f favicon-32.png ] && [ "$(dim favicon-32.png)" = 32x32 ] && ok favicon-32.png || bad "favicon-32.png"
[ -f apple-touch-icon.png ] && [ "$(dim apple-touch-icon.png)" = 180x180 ] && ok apple-touch-icon.png || bad "apple-touch-icon.png"
[ -f og-image.jpg ] && [ "$(dim og-image.jpg)" = 1200x630 ] && ok og-image.jpg || bad "og-image.jpg"

[ "$(ls video/before_after_face_0?.mp4 2>/dev/null | wc -l | tr -d ' ')" = 7 ] && ok "7 originals" || bad "originals in video/ missing"
[ "$(ls video_reels/reel_*.mp4 2>/dev/null | wc -l | tr -d ' ')" = 5 ] && ok "5 reel originals" || bad "originals in video_reels/ missing"

[ $fail = 0 ] && echo "MEDIA: ALL PASS" || { echo "MEDIA: FAILED"; exit 1; }
