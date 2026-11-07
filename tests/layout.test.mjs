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

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const width of [360, 768, 1440]) {
    const page = await browser.newPage();
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

    // До/после: горизонтальный ряд, все 7 одной высоты, сколько видно сразу
    const row = await page.evaluate(() => {
      const t = document.querySelector('#results .row__track');
      const vs = [...t.querySelectorAll('video')];
      // offsetHeight/offsetTop — без учёта масштаба «витрины» (соседние видео визуально уменьшены transform-ом)
      const hs = vs.map((v) => v.offsetHeight);
      const tops = vs.map((v) => v.parentElement.offsetTop);
      const w = vs[0].offsetWidth;
      return { n: vs.length, sameH: new Set(hs).size === 1, sameTop: new Set(tops).size === 1, visible: +(t.clientWidth / (w + parseFloat(getComputedStyle(t).columnGap))).toFixed(2), scrolls: t.scrollWidth > t.clientWidth };
    });
    ok(row.n === 7 && row.sameH && row.sameTop && row.scrolls, `${width}px: results row ${JSON.stringify(row)}`);
    if (width < 700) ok(row.visible > 1.05 && row.visible < 1.5, `${width}px: phone should show ~1.2 videos, shows ${row.visible}`);
    if (width >= 1180) ok(row.visible >= 2.9 && row.visible <= 4.2, `${width}px: desktop should show 3–4 videos, shows ${row.visible}`);
    if (width >= 900) {
      const rt = await page.$('#results .row__track');
      await rt.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const r0 = await rt.evaluate((el) => el.scrollLeft);
      await page.click('#results .row__next');
      await new Promise((r) => setTimeout(r, 700));
      const r1 = await rt.evaluate((el) => el.scrollLeft);
      ok(r1 > r0, `${width}px: results arrow did not scroll (${r0} → ${r1})`);
      await rt.evaluate((el) => { el.scrollLeft = 0; });
      await new Promise((r) => setTimeout(r, 300));
    }

    // Видео до/после начинает играть в зоне видимости
    await page.$eval('#results video', (v) => v.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 800));
    const inView = await page.$eval('#results video', (v) => ({ playing: !v.paused, rs: v.readyState, top: Math.round(v.getBoundingClientRect().top), h: Math.round(v.getBoundingClientRect().height), sy: Math.round(scrollY) }));
    ok(inView.playing, `${width}px: before/after video should play when in view ${JSON.stringify(inView)}`);

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
} finally {
  await browser.close();
  server.kill();
}
console.log(`${fails ? 'LAYOUT: FAILED' : 'LAYOUT: ALL PASS'} — ok ${passes}, fail ${fails}`);
process.exit(fails ? 1 : 0);
