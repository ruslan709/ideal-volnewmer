#!/usr/bin/env bash
# Готовит медиа для сайта: сжатые видео + постеры, оптимизированные картинки, фавиконки, OG.
# Оригиналы не трогает. Повторный запуск пропускает готовые файлы; --force пересобирает всё.
set -euo pipefail
cd "$(dirname "$0")/.."
FORCE=0; [ "${1:-}" = "--force" ] && FORCE=1
need() { [ $FORCE = 1 ] || [ ! -f "$1" ]; }
FF="ffmpeg -hide_banner -loglevel error -y"

mkdir -p video/web video_reels/web images/web

# 1. До/после: 1080×1920 → H.264 720×1280, без звука
for src in video/before_after_face_0?.mp4; do
  out="video/web/$(basename "$src")"
  if need "$out"; then
    echo "video  $src"
    $FF -i "$src" -vf scale=720:1280 -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart -an "$out"
  fi
  need "${out%.mp4}.jpg" && $FF -i "$out" -frames:v 1 -q:v 3 "${out%.mp4}.jpg"
done

# 2. Рилсы: ширина ≤720, два длинных со звуком (AAC 96k), остальные без звука
for src in video_reels/reel_*.mp4; do
  name=$(basename "$src" .mp4); out="video_reels/web/$name.mp4"
  case "$name" in *_159s|*_89s) audio="-c:a aac -b:a 96k";; *) audio="-an";; esac
  if need "$out"; then
    echo "reel   $src"
    $FF -i "$src" -vf "scale='min(720,iw)':-2" -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart $audio "$out"
  fi
  need "${out%.mp4}.jpg" && $FF -ss 1 -i "$out" -frames:v 1 -q:v 3 "${out%.mp4}.jpg"
done

# 3. Фото: JPEG q80, длинная сторона ≤1400
for src in images/device_procedures/*.png images/logo/logo_ideal.png; do
  out="images/web/$(basename "$src" .png).jpg"
  need "$out" && sips -s format jpeg -s formatOptions 80 -Z 1400 "$src" --out "$out" >/dev/null && echo "image  $out"
done

# 4. Фавиконки: квадрат с «A» и точкой из логотипа (2149×732, «A» с точкой ≈ x 1120–1520, y 150–550)
TMP=$(mktemp -d)
if need apple-touch-icon.png || need favicon-32.png || need favicon.ico; then
  sips -s format png -c 360 360 --cropOffset 147 1151 images/logo/logo_ideal.png --out "$TMP/sq.png" >/dev/null
  sips -z 180 180 "$TMP/sq.png" --out apple-touch-icon.png >/dev/null
  sips -z 32 32 "$TMP/sq.png" --out favicon-32.png >/dev/null
  $FF -i favicon-32.png favicon.ico
  echo "icons  favicon.ico favicon-32.png apple-touch-icon.png"
fi

# 5. Open Graph 1200×630 из главной картинки
if need og-image.jpg; then
  sips -c 658 1254 --cropOffset 40 0 images/device_procedures/procedure_face_volnewmer.png --out "$TMP/og.png" >/dev/null
  sips -s format jpeg -s formatOptions 82 -z 630 1200 "$TMP/og.png" --out og-image.jpg >/dev/null
  echo "og     og-image.jpg"
fi
rm -rf "$TMP"
echo "done"
