// node tests/layout.test.mjs — проверка собранного dist/ в настоящем Chrome (headless)
// Требует: bash tools/build-dist.sh, php в PATH, Google Chrome.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const SHOTS = process.env.SHOTS_DIR; // если задан — сохраняем полноэкранные скриншоты
const PORT = 8766;
const URL_ = `http://127.0.0.1:${PORT}/index.html`;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let fails = 0, passes = 0;
const ok = (c, m) => (c ? passes++ : (fails++, console.log('FAIL: ' + m)));

const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', ROOT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

// Внешние запросы (виджет Яндекс Карт) в тесте блокируем: проверяем только свой сайт,
// а WebGL карты в headless-Chrome может уронить вкладку
async function localOnly(page) {
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().startsWith(`http://127.0.0.1:${PORT}/`) || r.url().startsWith('data:') ? r.continue() : r.abort()));
}
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const width of [360, 768, 1440]) {
    const page = await browser.newPage(); await localOnly(page);
    const errors = [], notFound = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/send\.php|500|Failed to load resource/.test(m.text()) && errors.push(m.text()));
    // только наши файлы: внутренние запросы виджета Яндекс Карт (трекеры и т.п.) нас не касаются
    page.on('response', (r) => r.status() === 404 && r.url().startsWith(`http://127.0.0.1:${PORT}/`) && notFound.push(r.url()));
    await page.setViewport({ width, height: width < 700 ? 760 : 900, isMobile: width < 700, hasTouch: width < 700 });
    await page.goto(URL_, { waitUntil: 'networkidle2' });
    await page.evaluate(() => document.fonts.ready);
    // Кириллические шрифты действительно загрузились (а не системный fallback)
    const fonts = await page.evaluate(async () => {
      await Promise.all([document.fonts.load('500 40px "Cormorant Garamond"', 'Жж'), document.fonts.load('300 16px "Manrope"', 'Жж')]);
      return { serif: document.fonts.check('500 40px "Cormorant Garamond"', 'Жж'), sans: document.fonts.check('300 16px "Manrope"', 'Жж'), h: getComputedStyle(document.querySelector('.h-display')).fontFamily };
    });
    ok(fonts.serif && fonts.sans, `${width}px: cyrillic fonts not loaded ${JSON.stringify(fonts)}`);
    // В тесте прокрутка мгновенная, иначе scrollIntoView ещё анимируется, когда идут проверки
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });

    // Cookie: плашка видна при первом визите, «Понятно» прячет её (выбор запоминается — проверяем ниже, после reload)
    const cookieShown = await page.$eval('#cookie', (c) => !c.hidden);
    if (cookieShown) { await page.click('#cookie .cookie__ok'); }
    ok(await page.$eval('#cookie', (c) => c.hidden), `${width}px: cookie banner must hide after «Понятно»`);
    if (width === 360) ok(cookieShown, '360px: cookie banner must show on first visit');

    // Горизонтальный скролл
    const overflow = await page.evaluate(() => {
      const w = window.innerWidth;
      const bad = [];
      document.querySelectorAll('body *').forEach((el) => {
        if (el.closest('.slider__track, .row__track, .sprite, .hp, svg')) return;
        const r = el.getBoundingClientRect();
        if (r.width && r.right > w + 1) bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → ${Math.round(r.right)}`);
      });
      return { sw: document.documentElement.scrollWidth, w, bad: bad.slice(0, 8) };
    });
    ok(overflow.sw <= overflow.w, `${width}px: scrollWidth ${overflow.sw} > ${overflow.w}`);
    ok(overflow.bad.length === 0, `${width}px: elements overflow: ${overflow.bad.join('; ')}`);

    // До скролла ни одно видео не играет
    const playing = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length);
    ok(playing === 0, `${width}px: ${playing} videos playing before scroll`);

    // Модалка с каждой кнопки
    const buttons = await page.$$('[data-open-booking]');
    ok(buttons.length >= 6, `${width}px: booking buttons ${buttons.length}`);
    for (const [i, b] of buttons.entries()) {
      await b.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await b.click();
      await new Promise((r) => setTimeout(r, 120));
      const st = await page.evaluate(() => ({ open: document.getElementById('booking').open, focus: document.activeElement?.name, locked: document.body.classList.contains('is-locked') }));
      ok(st.open && st.focus === 'name' && st.locked, `${width}px: button #${i} → modal ${JSON.stringify(st)}`);
      await page.keyboard.press('Escape');
      // событие close асинхронное — ждём его, а не фиксированные 80 мс (карта в подвале грузит iframe)
      await page.waitForFunction(() => !document.getElementById('booking').open && !document.body.classList.contains('is-locked'), { timeout: 1500 }).catch(() => {});
      const after = await page.evaluate(() => ({ open: document.getElementById('booking').open, locked: document.body.classList.contains('is-locked'), focus: document.activeElement?.tagName + '.' + document.activeElement?.name }));
      ok(!after.open && !after.locked, `${width}px: Esc must close modal (button #${i}) ${JSON.stringify(after)}`);
    }

    // УЗНАТЬ
    for (const id of ['about-device-text', 'about-text']) {
      const btn = await page.$(`[aria-controls="${id}"]`);
      const hidden0 = await page.$eval(`#${id}`, (p) => p.hidden);
      await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await btn.click();
      await new Promise((r) => setTimeout(r, 600));
      const shown = await page.$eval(`#${id}`, (p) => !p.hidden && p.getBoundingClientRect().height > 50);
      await btn.click();
      await new Promise((r) => setTimeout(r, 700));
      const hidden2 = await page.$eval(`#${id}`, (p) => p.hidden);
      ok(hidden0 && shown && hidden2, `${width}px: #${id} expand cycle hidden=${hidden0} shown=${shown} hiddenAgain=${hidden2}`);
    }

    // FAQ: третий вопрос
    const sums = await page.$$('.faq__item summary');
    ok(sums.length === 13, `${width}px: FAQ count ${sums.length}`);
    await sums[2].evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await sums[2].click();
    await new Promise((r) => setTimeout(r, 450));
    const openIdx = await page.$$eval('.faq__item', (els) => els.map((e, i) => (e.open ? i : -1)).filter((i) => i >= 0));
    ok(JSON.stringify(openIdx) === '[2]', `${width}px: FAQ open ${JSON.stringify(openIdx)}`);

    // Слайдер (стрелки только на ширине ≥768)
    if (width >= 768) {
      const track = await page.$('.slider__track');
      await track.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const x0 = await track.evaluate((el) => el.scrollLeft);
      await page.click('.slider__next');
      await new Promise((r) => setTimeout(r, 700));
      const x1 = await track.evaluate((el) => el.scrollLeft);
      ok(x1 > x0, `${width}px: slider next did not scroll (${x0} → ${x1})`);
      // играющее видео ставится на паузу, когда уезжает из вида
      await page.evaluate(() => { const t = document.querySelector('.slider__track'); t.scrollLeft = 0; });
      await new Promise((r) => setTimeout(r, 400));
      await page.evaluate(() => { const v = document.querySelectorAll('.slider__track video')[0]; v.muted = true; return v.play().catch(() => {}); });
      await new Promise((r) => setTimeout(r, 300));
      await page.evaluate(() => { const t = document.querySelector('.slider__track'); t.scrollLeft = t.scrollWidth; });
      await new Promise((r) => setTimeout(r, 600));
      const stillPlaying = await page.evaluate(() => !document.querySelectorAll('.slider__track video')[0].paused);
      ok(!stillPlaying, `${width}px: reel kept playing after sliding away`);
    }

    // До/после: ролики раскиданы по странице — каждый начинает играть, когда попадает в экран, и не обрезается
    const baCount = await page.$$eval('[data-ba] video:not(.zone__video)', (v) => v.length);
    ok(baCount >= 7, `${width}px: 7 scattered before/after videos, has ${baCount}`);
    await page.$eval('#results [data-ba] video', (v) => v.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 800));
    const inView = await page.$eval('#results [data-ba] video', (v) => ({ playing: !v.paused, ratio: +(v.offsetHeight / v.offsetWidth).toFixed(2) }));
    ok(inView.playing && Math.abs(inView.ratio - 16 / 9) < 0.05, `${width}px: before/after video should play in view, 9:16 ${JSON.stringify(inView)}`);

    // ——— Правки заказчика — на свежей вкладке (длинный прогон с видео перегружает headless-Chrome) ———
    const pg = await browser.newPage(); await localOnly(pg);
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.setViewport({ width, height: width < 700 ? 760 : 900, isMobile: width < 700, hasTouch: width < 700 });
    await pg.goto(URL_, { waitUntil: 'networkidle2' });
    await pg.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    // Красный — только на первом экране
    const reds = await pg.evaluate(() => {
      const isRed = (c) => /rgb\(196, 30, 58|rgb\(163, 22, 47/.test(c);
      const promo = document.getElementById('promo');
      return [...document.querySelectorAll('main *, header *, footer *')].filter((el) => !promo.contains(el) && !(el instanceof SVGElement)).filter((el) => {
        const cs = getComputedStyle(el);
        return isRed(cs.color) || isRed(cs.backgroundColor) || isRed(cs.borderTopColor);
      }).map((el) => el.tagName + '.' + el.className).slice(0, 5);
    });
    ok(reds.length === 0, `${width}px: red outside first screen: ${reds.join(', ')}`);

    // Меню: каждый пункт-якорь прокручивает к своему блоку, заголовок не прячется под шапкой
    const mobileNav = width < 1200;
    async function clickNav(sel) {
      if (mobileNav) {
        await pg.click('.burger');
        await new Promise((r) => setTimeout(r, 450));
        const vis = await pg.$eval('#site-nav', (n) => getComputedStyle(n).visibility === 'visible' && n.getBoundingClientRect().height >= innerHeight - 1);
        ok(vis, `${width}px: burger must open full-screen menu (${sel})`);
        const li = await pg.$(`${sel}`);
        if (sel.includes('faq-')) { await pg.click('.nav__sub-toggle'); await new Promise((r) => setTimeout(r, 150)); }
        await li.click();
      } else if (sel.includes('faq-')) {
        await pg.hover('.nav__item--sub > .nav__link');
        await new Promise((r) => setTimeout(r, 350));
        await pg.click(sel);
      } else {
        await pg.click(sel);
      }
      // ждём, пока плавная прокрутка остановится
      let last = -1;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 120));
        const y = await pg.evaluate(() => scrollY);
        if (y === last) break;
        last = y;
      }
    }
    for (const id of ['method', 'results', 'device', 'price', 'about', 'faq', 'contacts']) {
      await clickNav(`#site-nav a.nav__link[href="#${id}"]`);
      const st = await pg.evaluate((id) => {
        const t = document.getElementById(id).getBoundingClientRect().top;
        const bar = document.querySelector('.header__bar').getBoundingClientRect().bottom;
        const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
        return { t: Math.round(t), bar: Math.round(bar), atBottom, menuOpen: document.documentElement.classList.contains('nav-open'), cur: document.querySelector('.nav__link.is-current')?.getAttribute('href') };
      }, id);
      ok(!st.menuOpen, `${width}px: menu must close after click (#${id})`);
      ok((st.t >= st.bar - 2 && st.t <= st.bar + 60) || (st.atBottom && st.t >= st.bar - 2), `${width}px: #${id} not under header after nav click ${JSON.stringify(st)}`);
      ok(st.cur === `#${id}`, `${width}px: current section highlight for #${id}: ${st.cur}`);
    }
    // Популярные вопросы: прокрутка к FAQ + раскрыт нужный вопрос
    for (const id of ['faq-process', 'faq-contra']) {
      await pg.evaluate(() => { document.querySelectorAll('.faq__item').forEach((d) => (d.open = false)); scrollTo(0, 0); });
      await clickNav(`#site-nav a[href="#${id}"]`);
      const st = await pg.evaluate((id) => { const d = document.getElementById(id); const r = d.getBoundingClientRect(); return { open: d.open, top: Math.round(r.top), inView: r.top >= 0 && r.top < innerHeight / 2, q: d.querySelector('.faq__q').textContent.slice(0, 30) }; }, id);
      ok(st.open && st.inView, `${width}px: ${id} must open and scroll into view ${JSON.stringify(st)}`);
    }
    await pg.evaluate(() => { document.querySelectorAll('.faq__item').forEach((d) => (d.open = false)); scrollTo(0, 0); });

    // Согласие: без галочки «Отправить» неактивна
    await pg.evaluate(() => scrollTo(0, 0));
    await pg.click('.promo [data-open-booking]');
    await new Promise((r) => setTimeout(r, 150));
    const c0 = await pg.evaluate(() => ({ checked: document.querySelector('[name="consent"]').checked, disabled: document.querySelector('#booking-form [type="submit"]').disabled }));
    await pg.click('.consent__mark');
    const c1 = await pg.evaluate(() => ({ checked: document.querySelector('[name="consent"]').checked, disabled: document.querySelector('#booking-form [type="submit"]').disabled }));
    await pg.click('.consent__mark');
    const c2 = await pg.evaluate(() => document.querySelector('#booking-form [type="submit"]').disabled);
    ok(!c0.checked && c0.disabled && c1.checked && !c1.disabled && c2, `${width}px: consent gating ${JSON.stringify({ c0, c1, c2 })}`);
    await pg.keyboard.press('Escape');
    await pg.waitForFunction(() => !document.getElementById('booking').open, { timeout: 1500 }).catch(() => {});

    await pg.close();

    ok(errors.length === 0, `${width}px: console errors: ${errors.join(' | ')}`);
    ok(notFound.length === 0, `${width}px: 404: ${notFound.join(', ')}`);

    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.addStyleTag({ content: '.site-header{position:relative!important}' });
      await page.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
        await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r)))));
        window.scrollTo(0, 0);
      });
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((n) => n.classList.add('is-in')));
      await new Promise((r) => setTimeout(r, 1300));
      await page.screenshot({ path: `${SHOTS}/page-${width}.png`, fullPage: true });
      // Chrome обрезает fullPage после ~16k px — блоки 10–13 снимаем отдельно
      for (const sel of ['#price', '#faq', 'footer']) {
        const h = await page.$(sel);
        await h.screenshot({ path: `${SHOTS}/part-${width}-${sel.replace('#', '')}.png` });
      }
    }
    await page.close();
  }
  // Телефон: заголовок → цена → кнопка помещаются на первом экране без прокрутки
  // …и на десктопе первый экран целиком (кнопка и арка с аппаратом) помещается в окно
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080]]) {
    const page = await browser.newPage(); await localOnly(page);
    await page.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
    await page.goto(URL_, { waitUntil: 'networkidle2' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 1400)); // анимация появления
    const st = await page.evaluate(() => {
      const b = (s) => Math.round(document.querySelector(s).getBoundingClientRect().bottom);
      return { title: b('.promo__title'), price: b('.price-new'), btn: b('.promo__cta .btn'), device: b('.promo__device'), vh: innerHeight, cookie: !document.getElementById('cookie').hidden };
    });
    ok(st.btn <= st.vh, `${w}×${h}: first-screen button below the fold ${JSON.stringify(st)}`);
    if (w >= 960) ok(st.device + 14 <= st.vh, `${w}×${h}: device arch cut off ${JSON.stringify(st)}`);
    if (w === 360) ok(!st.cookie, 'cookie banner must stay hidden after «Понятно» (remembered)');
    await page.close();
  }

  // Страницы «Лицензии» и «Политика»
  for (const width of [390, 1440]) {
    for (const f of ['licenses.html', 'privacy.html']) {
      const page = await browser.newPage(); await localOnly(page);
      const errors = [], notFound = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => r.status() === 404 && r.url().startsWith(`http://127.0.0.1:${PORT}/`) && notFound.push(r.url()));
      await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
      await page.goto(`http://127.0.0.1:${PORT}/${f}`, { waitUntil: 'networkidle2' });
      const ov = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      ok(ov, `${width}px ${f}: horizontal overflow`);
      if (f === 'licenses.html') {
        const n = await page.$$eval('.doc', (d) => d.length);
        ok(n === 14, `${f}: 14 docs, has ${n}`);
        await page.click('.doc[data-doc] .doc__open');
        await page.waitForFunction(() => document.getElementById('lightbox').open && document.querySelector('.lightbox__img').complete && document.querySelector('.lightbox__img').naturalWidth > 0, { timeout: 4000 }).catch(() => {});
        const a = await page.evaluate(() => ({ open: document.getElementById('lightbox').open, count: document.querySelector('.lightbox__count').textContent }));
        await page.keyboard.press('ArrowRight');
        const b = await page.$eval('.lightbox__count', (c) => c.textContent);
        await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
        const c = await page.$eval('.lightbox__count', (c) => c.textContent);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('lightbox').open, { timeout: 1500 }).catch(() => {});
        const closedEsc = await page.$eval('#lightbox', (d) => !d.open);
        await page.click('.doc[data-doc] .doc__open');
        await new Promise((r) => setTimeout(r, 200));
        await page.click('.lightbox__close');
        await page.waitForFunction(() => !document.getElementById('lightbox').open, { timeout: 1500 }).catch(() => {});
        const closedX = await page.$eval('#lightbox', (d) => !d.open);
        await page.click('.doc[data-doc] .doc__open');
        await new Promise((r) => setTimeout(r, 200));
        await page.mouse.click(5, Math.round((await page.evaluate(() => innerHeight)) / 2) - 120);
        await page.waitForFunction(() => !document.getElementById('lightbox').open, { timeout: 1500 }).catch(() => {});
        const closedBg = await page.$eval('#lightbox', (d) => !d.open);
        ok(a.open && a.count === '1 / 14' && b === '2 / 14' && c === '14 / 14' && closedEsc && closedX && closedBg, `${width}px lightbox ${JSON.stringify({ a, b, c, closedEsc, closedX, closedBg })}`);
        // «Вопросы → Противопоказания» с другой страницы: главная + раскрытый вопрос
        if (width === 1440) {
          await page.hover('.nav__item--sub > .nav__link');
          await new Promise((r) => setTimeout(r, 350));
          await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('#site-nav a[href="index.html#faq-contra"]')]);
          await new Promise((r) => setTimeout(r, 900));
          const st = await page.evaluate(() => { const d = document.getElementById('faq-contra'); const r = d.getBoundingClientRect(); return { open: d.open, top: Math.round(r.top), vh: innerHeight }; });
          ok(st.open && st.top >= 0 && st.top < st.vh / 2, `licenses → index.html#faq-contra ${JSON.stringify(st)}`);
        }
      } else {
        const n = await page.$$eval('.legal__h', (d) => d.length);
        ok(n === 12, `${f}: 12 sections, has ${n}`);
      }
      ok(errors.length === 0, `${width}px ${f}: errors ${errors.join(' | ')}`);
      ok(notFound.length === 0, `${width}px ${f}: 404 ${notFound.join(', ')}`);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.goto(`http://127.0.0.1:${PORT}/${f}`, { waitUntil: 'networkidle2' });
        await page.addStyleTag({ content: '.site-header{position:relative!important}' });
        await page.screenshot({ path: `${SHOTS}/${f.replace('.html', '')}-${width}.png`, fullPage: true });
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`${fails ? 'LAYOUT: FAILED' : 'LAYOUT: ALL PASS'} — ok ${passes}, fail ${fails}`);
process.exit(fails ? 1 : 0);
