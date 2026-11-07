#!/usr/bin/env bash
# Собирает dist/ — ровно то, что загружается на хостинг REG.RU.
# Оригиналы видео (1080×1920) и большие исходные PNG в dist/ НЕ попадают.
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/build-pages.mjs
rm -rf dist && mkdir dist

cp index.html licenses.html privacy.html send.php .htaccess favicon.ico favicon-32.png apple-touch-icon.png og-image.jpg dist/
for dir in css js fonts images/web images/doctors images/device_photos video/web video_reels/web; do
  mkdir -p "dist/$dir"
  cp -R "$dir/." "dist/$dir/"
done
# Лицензии: только готовые для сайта файлы (исходники src/ и README не нужны на хостинге)
mkdir -p dist/images/licenses
find images/licenses -maxdepth 1 -type f \( -name 'license_*.jpg' -o -name 'license_*-thumb.*' \) -exec cp {} dist/images/licenses/ \;
find dist -name '.DS_Store' -delete

if [ -n "$(find dist -name '*.mp4' -not -path '*/web/*')" ]; then
  echo "ERROR: в dist попали несжатые видео"; exit 1
fi
echo "dist/ готов: $(du -sh dist | cut -f1)"
