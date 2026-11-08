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

# 1б. Новые до/после (video/new_video, 1080×1920) → video/web/ba_NN.mp4 (720×1280, без звука) + постер WebP.
#     Номер — по алфавиту имени файла. Постер с 3-й секунды: видно и «ДО», и «ПОСЛЕ».
n=0
for src in video/new_video/*.mp4; do
  [ -f "$src" ] || continue
  n=$((n+1)); out=$(printf "video/web/ba_%02d.mp4" $n)
  if need "$out"; then
    echo "ba     $src → $out"
    $FF -i "$src" -vf scale=720:1280 -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart -an "$out"
  fi
  if need "${out%.mp4}.webp"; then
    $FF -ss 3 -i "$out" -frames:v 1 -q:v 3 "${out%.mp4}.jpg" && cwebp -quiet -q 70 -m 6 "${out%.mp4}.jpg" -o "${out%.mp4}.webp"
  fi
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
for src in images/device_procedures/*.png; do
  out="images/web/$(basename "$src" .png).jpg"
  need "$out" && sips -s format jpeg -s formatOptions 80 -Z 1400 "$src" --out "$out" >/dev/null && echo "image  $out"
done

# 3б. Логотип: прозрачный PNG, обрезанный по буквам (белый фон убирается colorkey)
need images/web/logo_ideal.png && $FF -i images/logo/logo_ideal.png -vf "colorkey=0xFCFCFC:0.12:0.08,crop=1350:370:395:140,scale=640:-1" -pix_fmt rgba images/web/logo_ideal.png && echo "logo   images/web/logo_ideal.png"

# 3в. Быстрая загрузка: AVIF + WebP в нескольких ширинах (браузер сам берёт нужный размер через srcset).
#     Фото на странице не шире ~520px (кроме procedure_face_neck — до ~1170px), поэтому 480/800/1200.
#     JPEG из шага 3 остаётся запасным вариантом для старых браузеров.
RTMP=$(mktemp -d)
for src in images/device_procedures/*.png; do
  name=$(basename "$src" .png); sw=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
  for w in 480 800 1200; do
    [ "$w" -gt "$sw" ] && w=$sw
    base="images/web/$name-$w"
    if need "$base.avif" || need "$base.webp"; then
      sips -s format png --resampleWidth "$w" "$src" --out "$RTMP/r.png" >/dev/null
      cwebp -quiet -q 76 -m 6 "$RTMP/r.png" -o "$base.webp"
      avifenc -q 55 -s 4 -j all "$RTMP/r.png" "$base.avif" >/dev/null
      echo "resp   $base.{avif,webp}"
    fi
  done
done
# Аппарат без фона: WebP/AVIF с прозрачностью вместо PNG
for src in images/device_photos/*.png; do
  base="${src%.png}"
  if need "$base.webp" || need "$base.avif"; then
    cwebp -quiet -q 82 -alpha_q 90 -m 6 "$src" -o "$base.webp"
    avifenc -q 62 -s 4 -j all "$src" "$base.avif" >/dev/null
    echo "device $base.{avif,webp}"
  fi
done
# Врачи
for src in images/doctors/doctor-*.jpg; do
  need "${src%.jpg}.webp" && cwebp -quiet -q 78 -m 6 "$src" -o "${src%.jpg}.webp" && echo "doctor ${src%.jpg}.webp"
done
# Логотип: на странице ≤132px, WebP 280px (для ретины)
if need images/web/logo_ideal-280.webp; then
  sips --resampleWidth 280 images/web/logo_ideal.png --out "$RTMP/logo.png" >/dev/null
  cwebp -quiet -q 90 -alpha_q 100 -m 6 "$RTMP/logo.png" -o images/web/logo_ideal-280.webp && echo "logo   images/web/logo_ideal-280.webp"
fi
# Постеры видео: WebP (грузятся сразу при открытии страницы, поэтому их вес важен)
for jpg in video/web/*.jpg video_reels/web/*.jpg; do
  need "${jpg%.jpg}.webp" && cwebp -quiet -q 70 -m 6 "$jpg" -o "${jpg%.jpg}.webp" && echo "poster ${jpg%.jpg}.webp"
done
rm -rf "$RTMP"

# 3г. Лицензии: исходники images/licenses/src/license_NN.(png|jpg) →
#     images/licenses/license_NN.jpg (для лайтбокса, ≤1600px) + превью license_NN-thumb.{avif,webp} (520px)
LTMP=$(mktemp -d)
for src in images/licenses/src/license_*.png images/licenses/src/license_*.jpg; do
  [ -f "$src" ] || continue
  name=$(basename "${src%.*}"); out="images/licenses/$name"
  if need "$out.jpg"; then
    sips -s format jpeg -s formatOptions 82 -Z 1600 "$src" --out "$out.jpg" >/dev/null && echo "lic    $out.jpg"
  fi
  if need "$out-thumb.webp" || need "$out-thumb.avif"; then
    sips -s format png --resampleWidth 520 "$src" --out "$LTMP/t.png" >/dev/null
    cwebp -quiet -q 74 -m 6 "$LTMP/t.png" -o "$out-thumb.webp"
    avifenc -q 52 -s 4 -j all "$LTMP/t.png" "$out-thumb.avif" >/dev/null
    echo "lic    $out-thumb.{avif,webp}"
  fi
done
rm -rf "$LTMP"

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
