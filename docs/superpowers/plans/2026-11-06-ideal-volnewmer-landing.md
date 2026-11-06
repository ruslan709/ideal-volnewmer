# Лендинг «Volnewmer — Студия IDEAL» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Для вёрстки и визуала каждой задачи с UI — навык `frontend-design:frontend-design`.

**Goal:** Одностраничный адаптивный статический лендинг из 14 блоков (0–13) строго по ТЗ, готовый к заливке на виртуальный хостинг REG.RU.

**Architecture:** Чистые HTML + CSS + JS без сборщика. Весь контент — в `index.html` (тексты дословно из ТЗ, каждый блок — `<section data-block="N">`). Список студий задаётся один раз в `js/studios.js` и рендерится в шапку и подвал. Заявки уходят `fetch` → `send.php` (почта и/или Telegram). Медиа пережимаются скриптом в `video/web/`, `video_reels/web/`, `images/web/`; `tools/build-dist.sh` собирает в `dist/` только то, что идёт на хостинг.

**Tech Stack:** HTML5, CSS (custom properties, grid, `scroll-snap`), vanilla JS (ES2020, без зависимостей), PHP 7.4+ (`send.php`), Apache `.htaccess`, ffmpeg, `sips` (macOS), Node 18+ для тестов (`puppeteer-core` + установленный Google Chrome — только dev-зависимость).

**Spec:** `TZ_IDEAL_Volnewmer_dlya_Claude_Code.md` (дальше «ТЗ», ссылки на строки — `ТЗ:NN`). Исполнитель читает ТЗ целиком вместе с этим планом.

## Global Constraints

- Порядок блоков 0→13 как в ТЗ; ни один не объединять, не пропускать, не добавлять новых (ТЗ:7).
- Тексты копировать из ТЗ **символ в символ** (кавычки «», "", тире –/—, пробел в «ЕСЛИ :», смешанный регистр «НА АППАРАТЕ Volnewmer»). Опечатки уже исправлены в самом ТЗ (ТЗ:316–324), значит копировать как написано.
- **Никакого `text-transform`** на текстах из ТЗ: регистр в HTML = регистр в ТЗ. Капс только там, где он в ТЗ.
- Пометки для разработчика (всё в скобках «картинка…», «сделай…», «Оформить как…», «Поведение:…») на сайт не выводить.
- Всё, чего нет в ТЗ → видимый на странице элемент `<span class="todo">[TODO: …]</span>` (рамка пунктиром, чтобы бросалось в глаза) + пункт в итоговом отчёте. Конкретный список TODO — в задачах.
- Только относительные пути (`images/…`, `video/web/…`), без `/` в начале, без `localhost`.
- Телефон: текст `8 495 992-23-45`, ссылка `tel:+74959922345`.
- Все кнопки записи имеют `data-open-booking` и открывают одно модальное окно `#booking`.
- Видео: `muted playsinline preload="metadata"` + `poster`; ни одного автозапуска со звуком.
- Палитра (CSS-переменные в `:root`): `--white #ffffff`, `--mist #f3f8fc` (фон-подложка), `--sky #e2eff8` (карточки/линии), `--azure #2b82c0` (акцент, близко к голубому «A» логотипа), `--azure-deep #1b5f93` (hover/текст на светлом), `--ink #10243f` (тёмно-синий как в логотипе — основной текст), `--muted #5d6f85`. Никаких других насыщенных цветов. Радиусы 20–28px, тени мягкие голубоватые (`0 20px 50px -24px rgb(27 95 147 / .25)`).
- Шрифты (Google Fonts, `subset` cyrillic): заголовки — `Cormorant Garamond` 500/600 (перекликается с засечками логотипа), текст и кнопки — `Manrope` 400/500/600/700.
- Ширины: от 360px до 1440px+, никакой горизонтальной прокрутки. Длинные слова капсом («КОСМЕТОЛОГИЧЕСКИМИ», «ПРОФИЛАКТИКИ») не должны вылезать: `overflow-wrap: anywhere; hyphens: auto;` с `lang="ru"` на `<html>`.
- Вертикальные видео на десктопе: ширина карточки ≤ 400px.
- На хостинг идут только сжатые видео (`video/web/`, `video_reels/web/`); оригиналы не удаляются и в `dist/` не попадают.

## Визуальное направление (для frontend-design)

«Светлый медицинский кабинет утром»: белый и туманно-голубой фон, крупные заголовки с засечками, много воздуха. Сквозной мотив, связывающий сайт: **тонкие голубые дуги-стрелки лифтинга** (как пунктирные стрелки на `face_before_after.png`) — inline SVG в фоне первого экрана, разделители секций и стрелки слайдера; **точка над «A» из логотипа** как маркер списков и номеров 01–06. Фото — в мягко скруглённых рамках с тонкой голубой обводкой и подложкой `--mist`. Кнопки — пилюли `--azure`, белый текст, на hover темнее и чуть приподнимаются. Анимация сдержанная: плавное появление секций (`IntersectionObserver`, `prefers-reduced-motion` отключает).

## Файлы

| Файл | Ответственность |
|---|---|
| `index.html` | Вся разметка и все тексты, блоки 0–13, модалка записи, SVG-спрайт иконок |
| `css/style.css` | Токены, типографика, сетки, компоненты, адаптив |
| `js/studios.js` | Единственный источник списка студий `window.IDEAL_STUDIOS` |
| `js/main.js` | Рендер студий, раскрывашки «УЗНАТЬ», FAQ-аккордеон, слайдер, автоплей видео в зоне видимости, модалка и отправка формы |
| `send.php` | Приём POST, валидация, письмо и/или Telegram, JSON-ответ |
| `.htaccess` | HTTPS, www → без www, gzip, кэш, MIME для mp4/webp |
| `images/doctors/doctor-placeholder.svg` | Силуэт-заглушка фото врача |
| `images/web/*.jpg`, `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `og-image.jpg` | Оптимизированная графика (генерируется) |
| `video/web/*.mp4` + `*.jpg`, `video_reels/web/*.mp4` + `*.jpg` | Сжатые видео и постеры (генерируются) |
| `tools/compress-media.sh` | Пережимает видео, делает постеры, оптимизирует картинки, фавиконки, OG |
| `tools/build-dist.sh` | Собирает `dist/` для хостинга |
| `tests/expected-copy.mjs` | Эталонные тексты из ТЗ |
| `tests/content.test.mjs` | Проверка HTML: порядок блоков, дословные тексты, счётчики, отсутствие пометок |
| `tests/media.test.sh` | Проверка сгенерированных медиа |
| `tests/layout.test.mjs` | Headless Chrome: нет горизонтального скролла на 360/768/1440, работают модалка, раскрывашки, FAQ, слайдер |
| `DEPLOY.md` | Инструкция по загрузке на REG.RU + список TODO |

## Review Focus

1. **Телефон 360px, длинные слова капсом** («ЭФФЕКТИВНО ДЛЯ КОРРЕКЦИИ УЖЕ ИМЕЮЩИХСЯ…», заголовок блока 7, вопросы FAQ) — должны переноситься, не ломать ширину. Тест: `layout.test.mjs` → `scrollWidth <= innerWidth` на 360 (Task 7).
2. **Семь видео до/после подряд на мобильном** — не должны качаться и играть одновременно: грузятся по `preload="metadata"`, играют (без звука, `loop`) только в зоне видимости, вне её на паузе. Тест: в `layout.test.mjs` после загрузки страницы `[...videos].filter(v => !v.paused).length === 0` до скролла (Task 7, код в Task 3).
3. **Слайдер звёзд: видео со звуком продолжает играть после перелистывания** — при смене слайда все остальные видео ставятся на паузу. Тест в `layout.test.mjs` (Task 7, код в Task 4).
4. **Форма: пустой или мусорный телефон, двойное нажатие, прямой GET на `send.php`, спам-боты** — клиентская валидация (`required`, `pattern`), кнопка блокируется на время запроса; `send.php` отвечает 405 на не-POST, 422 на невалидные данные, молча «успех» при заполненном honeypot `website`. Тест: `php` + `curl` в Task 6.
5. **Модалка на телефоне** — открывается с любой из кнопок записи, Esc/крестик/клик по фону закрывают, фокус уходит в поле «Имя» и возвращается на кнопку, страница под модалкой не скроллится. Тест в `layout.test.mjs` (Task 7, код в Task 6).

---

### Task 1: Инструменты, git и медиа-конвейер

**Files:**
- Create: `.gitignore` (`dist/`, `node_modules/`, `.DS_Store`)
- Create: `tools/compress-media.sh`
- Create: `tests/media.test.sh`
- Generated: `video/web/before_after_face_0{1..7}.{mp4,jpg}`, `video_reels/web/<имя>.{mp4,jpg}` ×5, `images/web/*.jpg`, `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `og-image.jpg`

**Interfaces:**
- Produces: пути к медиа, на которые ссылаются Tasks 2–5 (имена = исходные имена файлов, расширение `.jpg` для картинок):
  `images/web/procedure_face_volnewmer.jpg`, `images/web/face_lifting_lines.jpg`, `images/web/body_contouring_lines.jpg`, `images/web/face_before_after.jpg`, `images/web/result_mirror.jpg`, `images/web/procedure_face_neck.jpg`, `images/web/logo_ideal.jpg`; прозрачные PNG аппаратов используются как есть (`images/device_photos/device_front_nobg.png`, `device_side_nobg.png` — они уже по 70–100 КБ).

- [ ] **Step 1:** `git init` в корне проекта, создать `.gitignore`, первый коммит с ТЗ, планом и исходными медиа.
- [ ] **Step 2:** Поставить инструменты: `brew install ffmpeg php` (ffmpeg и php в системе нет; php нужен только для локальной проверки `send.php`). Проверка: `ffmpeg -version && php -v` печатают версии.
- [ ] **Step 3: Написать падающий тест `tests/media.test.sh`** (`set -e`), проверяющий:
  - для каждого из 7 `video/web/before_after_face_0N.mp4`: `ffprobe` даёт `codec_name=h264`, `width=720`, `height=1280`, аудиопотока нет; рядом есть `.jpg`;
  - для каждого из 5 рилсов `video_reels/web/*.mp4`: h264, высота ≤ 1280; у `reel_face_neck_procedure_159s` и `reel_client_review_89s` **есть** аудиопоток (`aac`), у трёх коротких — нет; есть `.jpg`-постер;
  - каждый `images/web/*.jpg` существует, длинная сторона ≤ 1400px, размер < 400 КБ;
  - `favicon.ico`, `favicon-32.png` (32×32), `apple-touch-icon.png` (180×180), `og-image.jpg` (1200×630) существуют;
  - оригиналы в `video/` и `video_reels/` на месте (7 и 5 файлов).
- [ ] **Step 4:** Запустить `bash tests/media.test.sh` → FAIL (файлов нет).
- [ ] **Step 5: Написать `tools/compress-media.sh`**, идемпотентный (пропускает уже готовые файлы, флаг `--force` пересобирает):
  - до/после: `ffmpeg -i in -vf scale=720:1280 -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart -an out` (ТЗ:34); постер: `ffmpeg -i out -frames:v 1 -q:v 3 out.jpg`;
  - рилсы (уже 720×1280, один 720×960, но 2–25 МБ): `scale='min(720,iw)':-2`, те же `-crf 26 -preset veryfast -movflags +faststart`; для `*_159s` и `*_89s` — `-c:a aac -b:a 96k`, для остальных `-an`; постер — кадр на 1-й секунде (`-ss 1`), т.к. первый кадр рилса бывает чёрным;
  - картинки: `sips -s format jpeg -s formatOptions 80 -Z 1400 in --out images/web/<имя>.jpg`;
  - фавиконка: квадрат с «A» и точкой из логотипа — `sips -c 732 732 --cropOffset 0 960 images/logo/logo_ideal.png` → ресайз в 180 (`apple-touch-icon.png`), 32 (`favicon-32.png`), `favicon.ico` через `ffmpeg -i favicon-32.png favicon.ico`. Посмотреть результат глазами; если «A» не в центре, поправить offset;
  - OG: из `procedure_face_volnewmer.png` кадрирование 1254×658 по центру → `-z 630 1200` → `og-image.jpg`.
- [ ] **Step 6:** `bash tools/compress-media.sh && bash tests/media.test.sh` → PASS. Записать в отчёт суммарный вес `du -sh video/web video_reels/web` (ожидаем ~в 2–3 раза меньше оригиналов).
- [ ] **Step 7:** Коммит `chore: media pipeline, compressed videos, favicons` (сгенерированные медиа тоже коммитим — их и заливать).

### Task 2: Каркас страницы, дизайн-система, шапка (блок 0), подвал (блок 13), студии

**Files:**
- Create: `index.html`, `css/style.css`, `js/studios.js`, `js/main.js`, `images/doctors/doctor-placeholder.svg`
- Create: `tests/expected-copy.mjs`, `tests/content.test.mjs`

**Interfaces:**
- Produces:
  - `window.IDEAL_STUDIOS: Array<{ city: string, address: string }>` в `js/studios.js` — сейчас ровно один элемент `{ city: 'Москва', address: 'Цветной бульвар 26' }` и комментарий `// [TODO: адреса студий в других городах] — добавлять сюда, шапка и подвал подхватят сами`.
  - `renderStudios()` в `js/main.js`: наполняет `[data-studios="header"]` (выпадающий список «Наши студии ▾», `<details>`) и `[data-studios="footer"]` (сетка карточек «город + адрес»). Если городов больше одного — показывает их все; в подвале после карточек — `<span class="todo">[TODO: адреса студий в других городах]</span>`.
  - Каждый блок — `<section id="…" data-block="N">`, `N` от 0 до 13 (шапка — `<header data-block="0">`, подвал — `<footer data-block="13">`). Id секций: `promo`, `method`, `if`, `results`, `device`, `prevention`, `stars`, `about-device`, `benefits`, `price`, `about`, `faq`.
  - Кнопка записи: `<button class="btn" type="button" data-open-booking>ТЕКСТ</button>`.
  - Утилиты CSS для Tasks 3–5: `.section`, `.section--mist`, `.container` (max 1180px, поля 16px на мобиле / 32px), `.h-display`, `.h-section`, `.btn`, `.btn--ghost`, `.card`, `.media-frame`, `.todo`, `.reveal` (появление при скролле).
  - Тестовые хелперы: `tests/content.test.mjs` экспортирует нечего; запускается `node tests/content.test.mjs`, печатает `ok N` / `FAIL: …`, код выхода 1 при ошибках.

- [ ] **Step 1: Написать `tests/expected-copy.mjs`** — `export const blocks = { 0: [...], 1: [...], …, 13: [...] }`: массивы строк, **скопированных из ТЗ буквально** (Ctrl+C из файла, не набирать руками): блок 0 — ТЗ:67–70; 1 — ТЗ:78–83; 2 — ТЗ:93–96; 3 — ТЗ:105–117; 4 — ТЗ:123, 128; 5 — ТЗ:132, 137–142 (номер и текст отдельными строками: `'01'`, `'Подходит даже … области;'`); 6 — ТЗ:146, 149; 7 — ТЗ:153; 8 — ТЗ:167, `'УЗНАТЬ'`, каждый абзац и пункт ТЗ:174–184; 9 — 10 надписей ТЗ:191–200; 10 — ТЗ:208, абзацы ТЗ:212–218, ТЗ:224; 11 — ТЗ:228, `'УЗНАТЬ'`, абзацы ТЗ:234–242, три ФИО ТЗ:245–247; 12 — ТЗ:253, 13 вопросов и все абзацы ответов ТЗ:259–302; 13 — ТЗ:308–312 (строки без markdown). Ещё `export const forbidden = ['картинка', 'для разработчика', 'Поведение:', 'Оформить как', 'Дополнение от клиента', 'В ТЗ', 'в ТЗ']`.
- [ ] **Step 2: Написать `tests/content.test.mjs`** (только `node:fs`): читает `index.html`, вырезает `<script>`/`<style>`/комментарии, режет на секции по `data-block`, текст секции = теги убраны, сущности раскодированы (`&nbsp;`→пробел, `&laquo;`…), пробелы схлопнуты. Проверки:
  - `data-block` встречается ровно 14 раз, в порядке 0,1,…,13;
  - каждая строка `blocks[N]` (тоже со схлопнутыми пробелами) — подстрока текста секции N;
  - ни одна строка `forbidden` не встречается в видимом тексте страницы;
  - счётчики: `#results video` = 7; `#stars video` = 5; `#faq` — 13 элементов `details`; `#benefits .benefit` = 10, в каждом есть `svg`; `#about .doctor` = 3; кнопки `[data-open-booking]` есть в блоках 0, 1, 4, 6, 10, 13 (всего ≥ 6);
  - каждый `src`/`href`/`poster` в `index.html` относительный (не начинается с `/`, `http://localhost`, `file:`) и, кроме `https://fonts.*`, указывает на существующий файл; ни один не ведёт в `video/before_after_*` или `video_reels/reel_*` вне `web/`;
  - в HTML нет `text-transform` в style-атрибутах, а в `css/style.css` нет `text-transform: uppercase`;
  - `tel:+74959922345` встречается и в блоке 0, и в блоке 13.
- [ ] **Step 3:** `node tests/content.test.mjs` → FAIL (нет `index.html`).
- [ ] **Step 4: Каркас `index.html`**: `<html lang="ru">`, meta charset/viewport, `<title>Volnewmer — Студия IDEAL, Москва</title>`, `<meta name="description" content="Volnewmer — РЕВОЛЮЦИОННАЯ ПЕРЕДОВАЯ АППАРАТНАЯ МЕТОДИКА ДЛЯ ПРОФИЛАКТИКИ И КОРРЕКЦИИ ПРОЯВЛЕНИЯ ВОЗРАСТНЫХ ИЗМЕНЕНИЙ. Студия IDEAL Москва Цветной бульвар 26">` (собрано только из фраз ТЗ), Open Graph (`og:title`, `og:description` — те же, `og:image` = `og-image.jpg`, `og:type=website`, `og:locale=ru_RU`), фавиконки, Google Fonts `preconnect` + `link`. 14 пустых секций с правильными `data-block`/`id` — их наполняют Tasks 3–5. В конце `body`: `js/studios.js`, затем `js/main.js` (оба `defer`).
- [ ] **Step 5: Шапка (блок 0)** — фиксированная полупрозрачно-белая с размытием (`backdrop-filter`). Слева логотип (`images/web/logo_ideal.jpg`, alt «IDEAL»; белый фон логотипа сливается с белой шапкой). Дальше тексты ТЗ:67–69, телефон — `<a href="tel:+74959922345">`, «Наши студии ▾» (`<details data-studios="header">`), кнопка ЗАПИСАТЬСЯ. На < 900px: строка «логотип · телефон-иконка · ЗАПИСАТЬСЯ», адрес/часы/студии уходят во вторую строку мелким шрифтом (не в бургер — их немного и они важны для доверия).
- [ ] **Step 6: Подвал (блок 13)** на светлом фоне `--mist` (не тёмный — гамма бело-голубая): блок «Наши студии» (сетка карточек из `renderStudios`), логотип, ТЗ:308–311 (телефон-ссылка), кнопка ЗАПИСАТЬСЯ, `<span class="todo">[TODO: номер медицинской лицензии]</span>`, мелким: «Имеются противопоказания. Необходима консультация специалиста.» Заголовок группы «Наши студии» — это текст из ТЗ:306, использовать его.
- [ ] **Step 7:** `js/studios.js`, `renderStudios()`, `doctor-placeholder.svg` (силуэт по плечи, линии `--azure` на `--sky`, без текста — подпись «фото врача» даётся в HTML). Дизайн-токены и утилиты в `css/style.css` по Global Constraints.
- [ ] **Step 8:** `node tests/content.test.mjs` → проверки блоков 0 и 13 и порядка проходят (остальные блоки ещё падают — это ожидаемо). Открыть `index.html` в браузере, посмотреть шапку на 360 и 1440.
- [ ] **Step 9:** Коммит `feat: page skeleton, design tokens, header, footer, studios source`.

### Task 3: Блоки 1–4 (акция, методика, «ЕСЛИ :», результаты до/после)

**Files:**
- Modify: `index.html` (секции `promo`, `method`, `if`, `results`), `css/style.css`, `js/main.js`

**Interfaces:**
- Consumes: утилиты CSS и `data-open-booking` из Task 2; медиа из Task 1.
- Produces: `initInViewVideos(selector: string)` в `js/main.js` — `IntersectionObserver` (threshold 0.5): в зоне — `play()` (ошибку промиса глотать), вне — `pause()`. Task 4 не использует (рилсы без автоплея).

- [ ] **Step 1: Блок 1 (`#promo`)** — первый экран, без картинки (в ТЗ для него файла нет; таблица ТЗ:19–31 файлы к блоку 1 не назначает). Крупно «Volnewmer» (Cormorant), затем «ВСЕ ЛИЦО + ШЕЯ», «ДО 11.11.2026», строка ТЗ:81 дословно, но с разметкой: `Стоимость <strong class="price-new">29900</strong> вместо <s class="price-old">59900</s> ДЛЯ МОДЕЛЕЙ` (29900 крупно, 59900 зачёркнута — ТЗ:85). Кнопка ЗАПИСАТЬСЯ. Фон: градиент white → `--sky` + декоративные SVG-дуги-стрелки (`aria-hidden`).
- [ ] **Step 2: Блок 2 (`#method`)** — главная картинка `procedure_face_volnewmer.jpg` (alt: «Процедура на аппарате Volnewmer»), тексты ТЗ:93–96 («Volnewmer» отдельно, заголовок, «ДЛЯ ЛИЦА И ТЕЛА»). Под блоком — ряд из трёх фото в рамках: `device_front_nobg.png` (на подложке `--mist`), `face_lifting_lines.jpg`, `body_contouring_lines.jpg`; без подписей (в ТЗ их нет). Десктоп: 3 колонки; мобила: колонка.
- [ ] **Step 3: Блок 3 (`#if`)** — заголовок «ЕСЛИ :», 6 пунктов ТЗ:108–113 (маркер — голубая точка), итоговая строка ТЗ:117 крупно в выделенной плашке, рядом `face_before_after.jpg`. Десктоп: список слева, фото справа, итоговая строка на всю ширину под ними.
- [ ] **Step 4: Блок 4 (`#results`)** — заголовок «РЕЗУЛЬТАТЫ ДО/ПОСЛЕ», 7 `<video>` **вертикальным списком** (одна колонка, `max-width: 400px; margin-inline: auto`, отступ между ~24px), для каждого `src="video/web/before_after_face_0N.mp4" poster="video/web/before_after_face_0N.jpg" muted playsinline loop preload="metadata"`, без `autoplay` в атрибутах — запуск через `initInViewVideos('#results video')`. Кнопка «Записаться на процедуру».
- [ ] **Step 5:** `node tests/content.test.mjs` → блоки 0–4 зелёные. Глазами: 360px и 1440px.
- [ ] **Step 6:** Коммит `feat: blocks 1-4 (promo, method, if, before/after videos)`.

### Task 4: Блоки 5–9 (6 преимуществ, профилактика, звёзды-слайдер, «Об аппарате», инфографика)

**Files:**
- Modify: `index.html` (секции `device`, `prevention`, `stars`, `about-device`, `benefits` + SVG-спрайт иконок в начале `body`), `css/style.css`, `js/main.js`

**Interfaces:**
- Consumes: утилиты Task 2.
- Produces (для Task 5 и тестов Task 7):
  - Раскрывашка: `<div class="reveal-more" data-expand>` с кнопкой `<button class="btn btn--ghost" aria-expanded="false" aria-controls="ID">УЗНАТЬ</button>` и панелью `<div id="ID" class="reveal-more__panel" hidden>`. `initExpanders()` в `js/main.js`: по клику переключает `aria-expanded`, анимирует высоту (`grid-template-rows: 0fr → 1fr` или измеренная `max-height`, 400ms ease), `hidden` снимается до анимации и ставится после сворачивания. Текст кнопки не меняется (в ТЗ есть только «УЗНАТЬ»); состояние видно по повороту стрелки-иконки.
  - Слайдер: `<div class="slider" data-slider>` → `.slider__track` (`display:flex; overflow-x:auto; scroll-snap-type:x mandatory`) из `.slide`, кнопки `.slider__prev` / `.slider__next` (`aria-label` «Назад»/«Вперёд»), видимые от 768px. `initSlider(root: HTMLElement)`: стрелки скроллят на ширину слайда; на `scroll` (debounce 150ms) ставит на паузу все видео, кроме тех, что целиком во вьюпорте трека; стрелки `disabled` на краях.

- [ ] **Step 1: Блок 5 (`#device`)** — заголовок «Аппарат Volnewmer», `device_side_nobg.png` на подложке-круге `--sky`, список 01–06 ТЗ:137–142 (номер крупно в Cormorant `--azure`, текст рядом, `;` в конце строк сохранить). Десктоп: фото слева, список 2×3 справа; мобила: фото, затем список.
- [ ] **Step 2: Блок 6 (`#prevention`)** — `result_mirror.jpg` + «ЭФФЕКТИВНО ДЛЯ ПРОФИЛАКТИКИ СТАРЕНИЯ» крупно + кнопка «Записаться на процедуру».
- [ ] **Step 3: Блок 7 (`#stars`)** — заголовок ТЗ:153, слайдер из 5 рилсов **в порядке ТЗ:157–161**, `src="video_reels/web/<имя>.mp4"`, постер рядом, `controls playsinline preload="metadata"`, без автозапуска; три коротких — `muted` (звука в них нет после Task 1), два длинных (`_159s`, `_89s`) — без `muted`, со звуком. Под каждым: `<p class="slide__caption"><span class="todo">[TODO: имя звезды]</span></p>`. Ширина слайда: 78vw на мобиле (виден край следующего — подсказка свайпа), 340px на десктопе. `initSlider` (свайп — нативный скролл).
- [ ] **Step 4: Блок 8 (`#about-device`)** — заголовок «Об аппарате Volnewmer», `device_front_nobg.png`, кнопка «УЗНАТЬ», скрытая панель с текстом ТЗ:174–184 (три абзаца + список из 5 пунктов). `initExpanders()`.
- [ ] **Step 5: Блок 9 (`#benefits`)** — 10 карточек `.benefit` (иконка + надпись ТЗ:191–200, каждая отдельной карточкой — так счёт «10 надписей, у каждой иконка» однозначен). Иконки — SVG-спрайт `<symbol id="i-…">`, 24×24, `stroke: currentColor; stroke-width:1.5; fill:none`, цвет `--azure`, в кружке `--sky`. Соответствие: НЕТ БОЛИ — перечёркнутая молния; НЕТ ТРАВМАТИЧНОСТИ — щит с галочкой; НЕТ РЕАБИЛИТАЦИИ — календарь с галочкой; РЕЗУЛЬТАТ ЗАМЕТЕН СРАЗУ — искра/звёздочка; ЭФФЕКТ НАРАСТАЕТ… — растущий график-стрелка; МИНИМУМ ПРОТИВОПОКАЗАНИЙ — список с одной строкой; МОЖНО СОВМЕЩАТЬ… — два пересекающихся круга; ЭФФЕКТИВНО ДЛЯ КОРРЕКЦИИ… — дуга-стрелка лифтинга вверх; И ДЛЯ ПРОФИЛАКТИКИ СТАРЕНИЯ — песочные часы; РАБОТАЕТ ПО ТЕЛУ И ЛИЦУ — силуэт. Сетка: 2 колонки на мобиле, 3 на планшете, 5 на десктопе. Под сеткой — `procedure_face_neck.jpg` широким кадром (ТЗ:204 и таблица ТЗ:29).
- [ ] **Step 6:** `node tests/content.test.mjs` → блоки 0–9 зелёные. Глазами: слайдер свайпается на мобиле (DevTools touch), стрелки работают на десктопе, «УЗНАТЬ» раскрывает и сворачивает.
- [ ] **Step 7:** Коммит `feat: blocks 5-9 (advantages, prevention, stars slider, about device, benefits)`.

### Task 5: Блоки 10–12 (стоимость, «О нас», FAQ)

**Files:**
- Modify: `index.html` (секции `price`, `about`, `faq`), `css/style.css`, `js/main.js`

**Interfaces:**
- Consumes: `initExpanders()` и разметка раскрывашки из Task 4.
- Produces: FAQ на нативных `<details class="faq__item"><summary>ВОПРОС</summary><div class="faq__answer">…</div></details>`; `initFaq()` — плавная анимация открытия/закрытия (по желанию — одновременно открыт только один; по умолчанию все закрыты).

- [ ] **Step 1: Блок 10 (`#price`)** — заголовок «Стоимость», четыре абзаца ТЗ:212–218 дословно, затем три карточки цен (текст из ТЗ:220):
  1. «Лицо + шея» / «MAXIMUM 600 импульсов» / «59 900 ₽»;
  2. «Тело (1 зона)» / «NORMAL 450 импульсов» / «44 900 ₽»;
  3. выделенная (фон `--azure`, белый текст, лёгкое свечение): «Для моделей до 11.11» / «лицо + шея 600 импульсов» / `<s>59 900 ₽</s>` `<strong>29 900 ₽</strong>`.
  Под карточками: `* <span class="todo">[TODO: текст сноски *]</span>`. Кнопка «Записаться на процедуру». Числа в карточках — `&nbsp;` между разрядами, чтобы цена не рвалась.
- [ ] **Step 2: Блок 11 (`#about`)** — заголовок «О нас», «УЗНАТЬ» + скрытый текст ТЗ:234–242 (5 абзацев). **Под раскрывашкой, всегда видимые**, 3 карточки `.doctor`: `<img src="images/doctors/doctor-placeholder.svg" alt="">`, подпись «фото врача» мелко поверх/под силуэтом, ФИО (ТЗ:245–247), должность «Врач-косметолог». ФИО временные — в коде комментарий `<!-- ФИО временные, заменить -->`, на сайте никакой пометки.
- [ ] **Step 3: Блок 12 (`#faq`)** — заголовок «ВОПРОС – ОТВЕТ», 13 `details` в порядке ТЗ. Вопрос — дословно, без «1.» (в ТЗ это нумерация markdown-списка); номер выводится отдельным декоративным элементом `<span class="faq__num" aria-hidden="true">01</span>`. Ответы: каждый абзац ТЗ — отдельный `<p>` (в ответе 2 «Результат будет…» — три строки ТЗ:263–265 = три `<p>`). Значок «+» превращается в «−».
- [ ] **Step 4:** `node tests/content.test.mjs` → **все** проверки зелёные, код выхода 0.
- [ ] **Step 5:** Коммит `feat: blocks 10-12 (price, about us, FAQ)`.

### Task 6: Модальное окно записи и `send.php`

**Files:**
- Modify: `index.html` (модалка перед `</body>`), `css/style.css`, `js/main.js`
- Create: `send.php`, `tests/send.test.sh`

**Interfaces:**
- Consumes: все `[data-open-booking]` из Tasks 2–5.
- Produces:
  - Разметка: `<dialog id="booking" class="booking">` с формой `<form id="booking-form" action="send.php" method="post">`: поле `name` (`required`, `maxlength=100`, autocomplete `name`), `phone` (`type=tel`, `required`, `inputmode=tel`, `pattern="[0-9+()\s-]{10,20}"`, autocomplete `tel`), скрытое honeypot-поле `website` (вне экрана, `tabindex=-1`, `autocomplete=off`), кнопка отправки, `<p class="booking__status" role="status" aria-live="polite">`. Заголовок модалки — «ЗАПИСАТЬСЯ» (текст из ТЗ). Подписи полей: «Имя», «Телефон», кнопка «Отправить» (ТЗ:37: «имя + телефон + кнопка отправки»).
  - `initBooking()`: клик по любому `[data-open-booking]` → `dialog.showModal()`, фокус в «Имя», `document.body` получает класс `is-locked` (`overflow:hidden`); закрытие — крестик (`aria-label="Закрыть"`), Esc (нативно у `dialog`), клик по подложке; при закрытии фокус возвращается на нажатую кнопку. Отправка: `preventDefault`, кнопка `disabled`, `fetch('send.php', { method:'POST', body:new FormData(form) })`; ответ `{ ok: true }` → статус «Заявка отправлена, мы вам перезвоним», форма сбрасывается; иначе/сетевая ошибка → «Не удалось отправить заявку. Позвоните нам: 8 495 992-23-45» (служебное сообщение, в ТЗ его нет — указать в отчёте) и кнопка снова активна.
  - `send.php` → JSON `{ "ok": bool, "error"?: string }`:
    - константы в начале: `const MAIL_TO = ''; // [TODO: почта для заявок]`, `const TG_BOT_TOKEN = ''; const TG_CHAT_ID = ''; // [TODO: Telegram для заявок]`, `const MAIL_FROM = 'no-reply@' . $_SERVER['HTTP_HOST']`;
    - не POST → 405; honeypot `website` непустой → 200 `{ok:true}` без отправки; `name` после `trim` пуст или > 100 символов, или в `phone` меньше 10 цифр → 422 `{ok:false,error:'invalid'}`;
    - ни почта, ни Telegram не заданы → 500 `{ok:false,error:'not_configured'}`;
    - текст заявки: «Заявка с сайта Volnewmer\nИмя: …\nТелефон: …\nДата: d.m.Y H:i» (время `Europe/Moscow`); всё экранировать (`htmlspecialchars` для Telegram с `parse_mode=HTML`, `\r\n` вырезать из имени для заголовков письма);
    - почта: `mail()` с `Content-Type: text/plain; charset=UTF-8` и темой через `=?UTF-8?B?…?=`; Telegram: `https://api.telegram.org/bot{TOKEN}/sendMessage` через `curl` (если нет — `file_get_contents` со stream context), таймаут 10с;
    - `ok:true`, если сработал хотя бы один канал.

- [ ] **Step 1: Написать падающий `tests/send.test.sh`**: поднимает `php -S 127.0.0.1:8765` в фоне (kill на выходе), проверяет `curl -s -o /dev/null -w '%{http_code}'`:
  - `GET /send.php` → `405`;
  - `POST name=&phone=123` → `422`;
  - `POST name=Анна&phone=%2B7 999 123-45-67&website=spam` → `200` и тело содержит `"ok":true`;
  - `POST name=Анна&phone=%2B7 999 123-45-67` при пустых константах → `500` и `not_configured`;
  - `php -l send.php` → `No syntax errors`.
- [ ] **Step 2:** `bash tests/send.test.sh` → FAIL.
- [ ] **Step 3:** Реализовать `send.php` и модалку по Interfaces. Модалка: белая карточка, радиус 28px, мягкая тень, подложка `rgb(16 36 63 / .35)` + blur; на мобиле — во всю ширину с отступами 16px.
- [ ] **Step 4:** `bash tests/send.test.sh` → PASS. В браузере через `php -S`: открыть модалку с трёх разных кнопок, отправить — увидеть сообщение об ошибке конфигурации (константы пустые — это правильно).
- [ ] **Step 5:** Коммит `feat: booking modal and send.php`.

### Task 7: `.htaccess`, сборка `dist/`, проверка вёрстки, отчёт и инструкция

**Files:**
- Create: `.htaccess`, `tools/build-dist.sh`, `tests/layout.test.mjs`, `package.json` (только `devDependencies: { "puppeteer-core": "^23" }`, `scripts.test`), `DEPLOY.md`

**Interfaces:**
- Consumes: всё выше.
- Produces: папка `dist/` — ровно то, что заливается на хостинг.

- [ ] **Step 1: `.htaccess`**: `RewriteEngine On`; редирект на HTTPS (`RewriteCond %{HTTPS} off` + `X-Forwarded-Proto` для REG.RU-прокси) и `www.` → без `www` одним 301 (`RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]` → `https://%1%{REQUEST_URI}`); `AddType video/mp4 .mp4`, `AddType image/webp .webp`; `mod_deflate` для html/css/js/svg/json; `mod_expires`: картинки/видео/шрифты 1 год, css/js 1 месяц, html — без кэша; `Options -Indexes`. Каждый блок обернуть в `<IfModule>`, чтобы при отсутствии модуля не было 500.
- [ ] **Step 2: `tools/build-dist.sh`**: `rm -rf dist && mkdir dist`, копирует `index.html send.php .htaccess favicon.ico favicon-32.png apple-touch-icon.png og-image.jpg css js images/web images/doctors images/device_photos video/web video_reels/web` с сохранением путей. **Не** копирует оригиналы `video/*.mp4`, `video_reels/*.mp4`, исходные большие PNG из `images/device_procedures`, `images/logo`, а также `tests tools docs node_modules ТЗ`. В конце печатает `du -sh dist` и проверяет, что `find dist -name '*.mp4' -not -path '*/web/*'` пуст (иначе `exit 1`).
- [ ] **Step 3: Написать `tests/layout.test.mjs`** (puppeteer-core, `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`, страница по `http://127.0.0.1:8765/` из `php -S` в `dist/`):
  - на ширине 360, 768, 1440: `document.documentElement.scrollWidth <= window.innerWidth`; ни один элемент не правее `innerWidth` (вывести селекторы нарушителей);
  - сразу после загрузки, до скролла, ни одно видео не играет;
  - клик по каждому `[data-open-booking]` → `#booking[open]`, `document.activeElement.name === 'name'`, Esc закрывает;
  - «УЗНАТЬ» в `#about-device` и `#about`: до клика панель `hidden`, после — видна, повторный клик — снова `hidden`;
  - FAQ: клик по 3-му `summary` открывает именно его;
  - слайдер на 1440: клик `.slider__next` сдвигает `scrollLeft`; если запустить видео в слайде 4 и нажать «Вперёд» дважды, видео встанет на паузу;
  - нет ошибок в консоли и запросов с 404.
- [ ] **Step 4:** `npm i && bash tools/build-dist.sh && node tests/content.test.mjs && bash tests/media.test.sh && bash tests/send.test.sh && node tests/layout.test.mjs` → всё PASS. Сделать скриншоты 360 и 1440 (полная страница) в scratchpad и **посмотреть глазами**: гамма, воздух, ничего не наезжает.
- [ ] **Step 5: `DEPLOY.md`** — коротко: в ISPmanager → «Сайты» → папка `www/<домен>/` → загрузить **содержимое** `dist/` (не саму папку) через файловый менеджер (архивом zip + «Распаковать») или FTP; включить SSL (Let's Encrypt) в панели до проверки редиректа; вписать почту/Telegram в начало `send.php`; проверить отправку заявки. Плюс список всех TODO.
- [ ] **Step 6:** Пройти чек-лист ТЗ:328–344 и для каждого пункта записать в итоговый ответ: ✅/❌ + чем подтверждено (какой тест/скриншот). Сводный список TODO:
  - `[TODO: адреса студий в других городах]` — `js/studios.js` + подвал;
  - `[TODO: имена звёзд]` — 5 подписей в блоке 7;
  - `[TODO: текст сноски *]` — блок 10;
  - `[TODO: номер медицинской лицензии]` — подвал;
  - `[TODO: почта и/или Telegram для заявок]` — константы в `send.php`;
  - фото врачей и настоящие ФИО — `images/doctors/`, блок 11;
  - текст ошибки отправки формы и подписи полей формы («Имя», «Телефон», «Отправить») — служебные, в ТЗ их нет.
- [ ] **Step 7:** Коммит `feat: htaccess, dist build, layout tests, deploy guide`.
