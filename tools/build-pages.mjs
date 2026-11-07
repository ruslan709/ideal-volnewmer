// node tools/build-pages.mjs — собирает licenses.html и privacy.html.
// Шапка, подвал, форма записи, плашка cookie и иконки берутся ИЗ index.html,
// поэтому меняем их только в index.html и перезапускаем скрипт (он же вызывается из npm run build).
// Содержимое страниц: pages/licenses.html + pages/licenses.json, pages/privacy.html + pages/privacy.src.txt.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const has = (p) => existsSync(new URL(p, root));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const index = read('index.html');
const cut = (from, to, src = index) => {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`index.html: не найден фрагмент ${from} … ${to}`);
  return src.slice(a, b + to.length);
};

const headTop = index.slice(0, index.indexOf('<title>'));
const headBottom = cut('<link rel="icon"', '</head>');
const sprite = cut('<svg class="sprite"', '</svg>');
// На других страницах якоря ведут на главную (кроме «Контакты» — подвал есть на каждой странице)
const header = cut('<header class="site-header"', '</header>')
  .replace(/ data-block="\d+"/g, '')
  .replace(/href="#(?!contacts"|i-)([\w-]+)"/g, 'href="index.html#$1"');
const footer = cut('<footer class="site-footer"', '</footer>').replace(/ data-block="\d+"/g, '');
const tail = cut('<!-- Форма записи', '</html>');

function page(tplPath, body) {
  const tpl = read(tplPath);
  const meta = tpl.match(/<!-- page: title=(.+?) \| description=(.+?) -->/);
  if (!meta) throw new Error(`${tplPath}: нет строки <!-- page: title=… | description=… -->`);
  return `${headTop}<title>${meta[1]}</title>
  <meta name="description" content="${esc(meta[2])}">
  <meta name="robots" content="index, follow">
  ${headBottom}
<body class="subpage">

${sprite}

<!-- Шапка и подвал сгенерированы из index.html (tools/build-pages.mjs) — правьте их там -->
${header}

${body}

${footer}

${tail}
`;
}

/* ——— Лицензии ——— */
const docs = JSON.parse(read('pages/licenses.json'));
const missing = [];
const cards = docs.map((d, i) => {
  const full = `images/licenses/${d.file}.jpg`;
  const thumb = `images/licenses/${d.file}-thumb`;
  const ok = has(full) && has(thumb + '.webp');
  if (!ok) missing.push(d.file);
  const scan = ok
    ? `<picture><source type="image/avif" srcset="${thumb}.avif"><source type="image/webp" srcset="${thumb}.webp"><img src="${thumb}.webp" alt="" width="520" height="740" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async"></picture>`
    : `<span class="doc__placeholder">скан документа</span>`;
  return `        <li class="doc"${ok ? ` data-doc data-full="${full}"` : ''}>
          <button class="doc__open" type="button"${ok ? '' : ' disabled'} aria-label="Открыть скан: ${esc(d.title)}">
            <span class="doc__scan">${scan}<span class="doc__zoom" aria-hidden="true"><svg class="icon"><use href="#i-plus"/></svg></span></span>
          </button>
          <h2 class="doc__title">${esc(d.title)}</h2>
          <p class="doc__text">${esc(d.text)}</p>
        </li>`;
}).join('\n');
writeFileSync(new URL('licenses.html', root), page('pages/licenses.html', read('pages/licenses.html').replace(/<!-- page:.*?-->\n/, '').replace('<!-- docs -->', cards)));

/* ——— Политика ——— */
// Реквизиты Оператора — из выписки из реестра лицензий (images/licenses/src/license_08.png)
const OPERATOR = 'Обществом с ограниченной ответственностью «Обновление» (ООО «Обновление», ИНН 7714970906, ОГРН 1177746085967, адрес места нахождения: 121248, г. Москва, наб. Тараса Шевченко, д. 3, корп. 3, эт. 1, пом. 1, ком. 21; Студия IDEAL)';
const SITE = 'Студии IDEAL';
// Отдельной почты для обращений по ПДн нет — обращения принимаются письменно по адресу Оператора и по телефону
const CONTACT = 'по адресу: 121248, г. Москва, наб. Тараса Шевченко, д. 3, корп. 3, эт. 1, пом. 1, ком. 21, или по телефону 8 495 992-23-45';
const fill = (s) => esc(s
  .replace(/предпринимаемые \{OPERATOR\}/g, `предпринимаемые ${OPERATOR}`)
  .replace(/веб-сайта \{SITE\}/g, `веб-сайта ${SITE}`)
  .replace(/по сетевому адресу \{SITE\}/g, `(сайт Студии IDEAL, на котором размещена настоящая Политика)`)
  .replace(/на адрес электронной почты Оператора \{EMAIL\}/g, CONTACT)
  .replace(/посредством электронной почты на электронный адрес Оператора \{EMAIL\}/g, CONTACT)
  .replace(/с помощью электронной почты \{EMAIL\}/g, CONTACT)
  .replace(/по адресу \{SITE\}\/privacy\.html/g, 'на сайте Студии IDEAL на странице «Политика конфиденциальности»'));
const table6 = `<div class="legal__table-wrap"><table class="legal__table">
          <tbody>
            <tr><th scope="row">Цель обработки</th><td>обработка заявок на запись на процедуру и обратная связь с Пользователем</td></tr>
            <tr><th scope="row">Персональные данные</th><td>имя, номер телефона</td></tr>
            <tr><th scope="row">Правовые основания</th><td>согласие субъекта персональных данных на обработку его персональных данных (Федеральный закон от 27.07.2006 № 152-ФЗ «О персональных данных»)</td></tr>
            <tr><th scope="row">Виды обработки персональных данных</th><td>сбор, запись, хранение, использование, удаление</td></tr>
          </tbody>
        </table></div>`;
let html = '', list = false;
for (const raw of read('pages/privacy.src.txt').split('\n')) {
  const line = raw.trim();
  if (!line) continue;
  const isItem = line.startsWith('— ');
  if (list && !isItem) { html += '        </ul>\n'; list = false; }
  if (line.startsWith('# ')) {
    const [, n, t] = line.match(/^# (\d+)\. (.+)$/);
    html += `        <h2 class="legal__h" id="p${n}"><span class="legal__num">${n}.</span> ${esc(t)}</h2>\n`;
  } else if (line === '{TABLE6}') {
    html += `        ${table6}\n`;
  } else if (isItem) {
    if (!list) { html += '        <ul class="legal__list">\n'; list = true; }
    html += `          <li>${fill(line.slice(2))}</li>\n`;
  } else {
    const m = line.match(/^(\d+\.\d+\.)\s(.+)$/);
    html += m
      ? `        <p class="legal__p"><span class="legal__num">${m[1]}</span> ${fill(m[2])}</p>\n`
      : `        <p class="legal__p">${fill(line)}</p>\n`;
  }
}
if (list) html += '        </ul>\n';
writeFileSync(new URL('privacy.html', root), page('pages/privacy.html', read('pages/privacy.html').replace(/<!-- page:.*?-->\n/, '').replace('<!-- policy -->\n', html)));

if (/\{(OPERATOR|SITE|EMAIL)\}|TODO|ПРОВЕРИТЬ/.test(html)) throw new Error('privacy: остались заглушки');
console.log(`pages: licenses.html (${docs.length} док., без скана: ${missing.length ? missing.join(', ') : 'нет'}), privacy.html`);
