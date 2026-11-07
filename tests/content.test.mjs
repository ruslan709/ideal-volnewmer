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
ok(count(section(4), /<video\b/g) === 7, `block 4 must have 7 videos, has ${count(section(4), /<video\b/g)}`);
ok(!/data-slider/.test(section(4)) && /data-row/.test(section(4)), 'block 4 must be a horizontal row (data-row), not the stars slider');
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
ok(/<s\b[^>]*>59900<\/s>/.test(section(1)), 'block 1: 59900 must be struck through');
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
