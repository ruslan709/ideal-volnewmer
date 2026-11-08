// node tests/content.test.mjs — проверка index.html против ТЗ
import { readFileSync, existsSync } from 'node:fs';
import { blocks, forbidden } from './expected-copy.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const css = existsSync(new URL('css/style.css', root)) ? readFileSync(new URL('css/style.css', root), 'utf8') : '';

let failures = 0, passes = 0;
const ok = (cond, msg) => (cond ? passes++ : (failures++, console.log('FAIL: ' + msg)));

const ENT = { nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', amp: '&', quot: '"', lt: '<', gt: '>', rub: '₽', thinsp: ' ', hellip: '…' };
const norm = (s) => s.replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
const toText = (h) =>
  norm(
    h
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?(p|li|h\d|div|section|header|footer|summary|details|span|strong|s|button|a|dt|dd|figcaption)\b[^>]*>/gi, (m) => (/^<\/?(span|strong|s|a)\b/i.test(m) ? '' : ' '))
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(\w+);/g, (m, e) => ENT[e] ?? m)
      .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)),
  );

// 1. Порядок блоков
const order = [...html.matchAll(/data-block="(\d+)"/g)].map((m) => +m[1]);
ok(JSON.stringify(order) === JSON.stringify([...Array(14).keys()]), `data-block order is ${order.join(',')}, want 0..13`);

// Нарезка по блокам: от data-block="N" до data-block="N+1" (последний — до конца footer)
const section = (n) => {
  const start = html.indexOf(`data-block="${n}"`);
  if (start < 0) return '';
  const from = html.lastIndexOf('<', start);
  const next = html.indexOf(`data-block="${n + 1}"`, start);
  const to = next < 0 ? html.indexOf('</footer>', start) : html.lastIndexOf('<', next);
  return html.slice(from, to);
};

// 2. Дословные тексты
for (const [n, strings] of Object.entries(blocks)) {
  const text = toText(section(+n));
  for (const s of strings) ok(text.includes(norm(s)), `block ${n}: missing text «${norm(s).slice(0, 90)}»`);
}

// 3. Запрещённые пометки
const pageText = toText(html.replace(/<dialog[\s\S]*?<\/dialog>/, ''));
for (const f of forbidden) ok(!pageText.includes(f), `developer note leaked: «${f}»`);

// 4. Счётчики
const count = (h, re) => (h.match(re) || []).length;
const byId = (id) => { const i = html.indexOf(`id="${id}"`); if (i < 0) return ''; const n = html.slice(i).search(/data-block="/); const rest = html.slice(i); const j = rest.indexOf('data-block="', rest.indexOf('data-block="') + 1); return j < 0 ? rest : rest.slice(0, j); };
// Слайдер до/после временно скрыт (<template>), новые ролики до/после раскиданы по странице по одному
ok(/<template id="results-slider">[\s\S]*data-row[\s\S]*<\/template>/.test(section(4)) && count(section(4).match(/<template[\s\S]*<\/template>/)?.[0] || '', /<video\b/g) === 7, 'block 4: old slider kept inside <template id="results-slider"> with 7 videos');
const baVideos = [...html.matchAll(/video\/web\/(ba_\d\d)\.mp4/g)].map((m) => m[1]);
ok(new Set(baVideos).size === 7, `all 7 new before/after videos placed once each: ${baVideos.join(',')}`);
ok(count(html, /class="ba-anchor /g) >= 5, 'before/after cards overlaid on section photos across page');
ok(!/фото готовится/.test(html), 'body photo placeholders removed for now');
ok(!/face_lifting_lines|body_contouring_lines/.test(html), 'line drawings replaced by before/after');
ok(count(section(7), /<video\b/g) === 5, `block 7 must have 5 videos, has ${count(section(7), /<video\b/g)}`);
ok(/data-slider/.test(section(7)), 'block 7 must be a slider');
ok(count(section(7), /class="slide__name"/g) === 5, 'block 7 needs 5 star-name captions');
ok(count(section(12), /<details\b/g) === 13, `FAQ must have 13 details, has ${count(section(12), /<details\b/g)}`);
const benefits = section(9).split(/class="benefit[ "]/).slice(1);
ok(benefits.length === 10, `block 9 must have 10 .benefit, has ${benefits.length}`);
ok(benefits.every((b) => /<svg\b/.test(b.split('</li>')[0])), 'every benefit needs an svg icon');
ok(count(section(11), /class="doctor[ "]/g) === 3, 'block 11 must have 3 .doctor cards');
for (const n of [0, 1, 4, 6, 10, 13]) ok(/data-open-booking/.test(section(n)), `block ${n} needs a booking button`);
for (const n of [8, 11]) ok(/<div[^>]+hidden[^>]*>|<div[^>]*class="reveal-more__panel"[^>]*hidden/.test(section(n)) && /aria-expanded="false"/.test(section(n)), `block ${n}: text must be hidden behind УЗНАТЬ`);
for (const n of [0, 13]) ok(section(n).includes('href="tel:+74959922345"'), `block ${n}: phone must be tel: link`);
ok(/<s\b[^>]*>59(?:&nbsp;| | )900/.test(section(1)), 'block 1: 59 900 must be struck through');

// Правки заказчика: красный только на первом экране, меню, страницы, согласие
const redUses = css.split('\n').filter((l) => /var\(--accent-red/.test(l)).map((l) => l.trim().split(/\s*\{/)[0]);
ok(redUses.length > 0 && redUses.every((sel) => /^\.(promo|price-old|price-new|btn--red)\b/.test(sel) || /^(content|background|color|box-shadow|border)/.test(sel)), `--accent-red used outside first screen: ${redUses.join(' | ')}`);
ok(!/accent-red|btn--red/.test(html.replace(section(1), '').replace(/<!--[\s\S]*?-->/g, '')), 'red classes used outside block 1');
for (const h of ['#method', '#results', '#device', '#price', '#about', '#faq', '#faq-process', '#faq-contra', 'licenses.html', '#contacts'])
  ok(section(0).includes(`href="${h}"`), `menu link missing: ${h}`);
for (const id of ['method', 'results', 'device', 'price', 'about', 'faq', 'faq-process', 'faq-contra', 'contacts']) ok(html.includes(`id="${id}"`), `anchor target missing: #${id}`);
ok(/<input[^>]*name="consent"[^>]*type="checkbox"(?![^>]*checked)[^>]*required/.test(html), 'consent checkbox: required and not pre-checked');
ok(/<button[^>]*type="submit"[^>]*disabled/.test(html), 'submit disabled by default (until consent)');
ok(/href="privacy\.html"/.test(section(13)) && /href="licenses\.html"/.test(section(13)), 'footer links to licenses.html and privacy.html');
for (const f of ['licenses.html', 'privacy.html']) {
  ok(existsSync(new URL(f, root)), `${f} missing (npm run pages)`);
  if (!existsSync(new URL(f, root))) continue;
  const pg = readFileSync(new URL(f, root), 'utf8');
  ok(/class="site-header"/.test(pg) && /class="site-footer"/.test(pg) && /href="privacy\.html"/.test(pg), `${f}: needs header, footer, privacy link`);
  ok(!/thismywebsite|Михайлов/.test(pg), `${f}: generator placeholders left`);
  for (const m of pg.matchAll(/\b(?:src|href|srcset)="([^"#][^"]*)"/g)) {
    const p = m[1].split(' ')[0];
    if (/^(https?:|tel:|mailto:)/.test(p)) continue;
    ok(existsSync(new URL(p.split('#')[0], root)), `${f}: missing file ${p}`);
  }
}
const lic = existsSync(new URL('licenses.html', root)) ? readFileSync(new URL('licenses.html', root), 'utf8') : '';
ok((lic.match(/class="doc"/g) || []).length === 14, 'licenses.html: 14 documents');
const pol = existsSync(new URL('privacy.html', root)) ? readFileSync(new URL('privacy.html', root), 'utf8') : '';
ok((pol.match(/class="legal__h"/g) || []).length === 12 && /<table class="legal__table"/.test(pol) && !/ПРОВЕРИТЬ|TODO|class="todo"|\{(OPERATOR|SITE|EMAIL)\}/.test(pol) && !/философские/.test(pol) && /7714970906/.test(pol), 'privacy.html: 12 sections, table 6 replaced, no TODO plates');
ok(/<s\b[^>]*>59[  ]|<s\b[^>]*>59&nbsp;900/.test(section(10)), 'block 10: promo card old price struck through');

// Порядок рилсов
const reels = [...section(7).matchAll(/video_reels\/web\/(reel_[\w]+)\.mp4/g)].map((m) => m[1]);
ok(JSON.stringify(reels) === JSON.stringify(['reel_wow_effect_1_procedure_20s', 'reel_before_after_procedure_29s', 'reel_monopolar_procedure_28s', 'reel_face_neck_procedure_159s', 'reel_client_review_89s']), `reel order: ${reels.join(', ')}`);

// Видео-атрибуты
for (const v of html.match(/<video\b[^>]*>/g) || []) {
  ok(/\bplaysinline\b/.test(v) && /preload="metadata"/.test(v) && /poster="/.test(v), `video attrs: ${v.slice(0, 120)}`);
  ok(!/\bautoplay\b/.test(v) || /\bmuted\b/.test(v), `autoplay with sound: ${v.slice(0, 120)}`);
}

// 5. Пути
for (const m of html.matchAll(/\b(?:src|href|poster|content)="([^"]+)"/g)) {
  const p = m[1];
  if (/^(https?:|tel:|mailto:|#|data:|width=|text\/|website|ru_RU|IE=)/.test(p) || !/[./]/.test(p) || /\s/.test(p)) continue;
  ok(!p.startsWith('/') && !p.includes('localhost') && !p.startsWith('file:'), `absolute path: ${p}`);
  ok(existsSync(new URL(p.split('#')[0].split('?')[0], root)), `missing file: ${p}`);
  ok(!/^video\/before_after|^video_reels\/reel_/.test(p), `original (uncompressed) video referenced: ${p}`);
}

// 6. Регистр не меняем через CSS
ok(!/text-transform\s*:\s*(uppercase|lowercase|capitalize)/.test(css + html), 'text-transform must not change case');

console.log(`${failures ? 'CONTENT: FAILED' : 'CONTENT: ALL PASS'} — ok ${passes}, fail ${failures}`);
process.exit(failures ? 1 : 0);
