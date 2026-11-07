/* Volnewmer — Студия IDEAL. Без зависимостей. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ——— Студии: один источник (js/studios.js) → шапка и подвал. Пустые записи не выводятся ——— */
  function renderStudios() {
    var all = Array.isArray(window.IDEAL_STUDIOS) ? window.IDEAL_STUDIOS : [];
    var studios = all.filter(function (s) {
      return s && String(s.city || '').trim() && String(s.address || '').trim();
    });

    function card(s, tag, cls) {
      var li = el(tag, cls);
      li.appendChild(el('p', cls + '__city', s.city));
      li.appendChild(el('p', cls + '__address', s.address));
      if (s.hours) li.appendChild(el('p', cls + '__hours', s.hours));
      if (s.phone) {
        var a = el('a', cls + '__phone', s.phone);
        a.href = 'tel:' + String(s.tel || s.phone).replace(/[^\d+]/g, '');
        li.appendChild(a);
      }
      return li;
    }

    var headerList = document.querySelector('[data-studios="header"] .studios-menu__list');
    if (headerList) {
      headerList.textContent = '';
      studios.forEach(function (s) { headerList.appendChild(card(s, 'li', 'studio-mini')); });
    }

    var footerGrid = document.querySelector('[data-studios="footer"]');
    if (footerGrid) {
      footerGrid.textContent = '';
      footerGrid.setAttribute('data-count', String(studios.length));
      studios.forEach(function (s) { footerGrid.appendChild(card(s, 'li', 'studio-card')); });
      initStudiosMap(footerGrid, studios);
    }

    // Закрывать выпадающий список по клику вне его и по Esc
    var menu = document.querySelector('.studios-menu');
    if (menu) {
      document.addEventListener('click', function (e) {
        if (menu.open && !menu.contains(e.target)) menu.open = false;
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
      });
    }
  }

  /* ——— Шапка: верхняя строка уезжает, полоса с логотипом липнет и становится полупрозрачной ——— */
  function initHeader() {
    var header = document.querySelector('.site-header');
    var topbar = header && header.querySelector('.topbar');
    if (!header || !topbar) return;
    function measure() {
      var h = Math.ceil(topbar.getBoundingClientRect().height);
      header.style.top = -h + 'px';
      document.documentElement.style.setProperty('--header-h', Math.round(header.getBoundingClientRect().height - h) + 'px');
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle('is-scrolled', window.scrollY > topbar.offsetHeight + 4);
        ticking = false;
      });
    }
    measure();
    onScroll();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ——— Яндекс Карта под «Наши студии». Виджет без API-ключа; адрес ищется по тексту «город, адрес».
     iframe создаётся только когда карта подъезжает к экрану, чтобы не тормозить загрузку страницы. ——— */
  function initStudiosMap(grid, studios) {
    var box = document.querySelector('[data-studios-map]');
    if (!box) return;
    if (!studios.length) { box.hidden = true; return; }
    var frameWrap = box.querySelector('.studios-map__frame');
    var cityEl = box.querySelector('.studios-map__city');
    var openLink = box.querySelector('.studios-map__open');
    var cards = grid.querySelectorAll('.studio-card');
    var iframe = null, current = 0;

    function query(s) { return s.city + ', ' + s.address; }
    function widgetUrl(s) { return 'https://yandex.ru/map-widget/v1/?mode=search&z=16&text=' + encodeURIComponent(query(s)); }

    function show(i) {
      current = i;
      var s = studios[i];
      cityEl.textContent = s.city + ' · ' + s.address;
      openLink.href = 'https://yandex.ru/maps/?text=' + encodeURIComponent(query(s));
      cards.forEach(function (c, k) {
        c.classList.toggle('is-active', k === i);
        var b = c.querySelector('.studio-card__map');
        if (b) b.setAttribute('aria-pressed', String(k === i));
      });
      if (iframe) {
        box.classList.add('is-loading');
        iframe.src = widgetUrl(s);
      }
    }

    function mount() {
      if (iframe) return;
      iframe = document.createElement('iframe');
      iframe.title = 'Карта студий IDEAL';
      iframe.setAttribute('allowfullscreen', '');
      iframe.addEventListener('load', function () { box.classList.remove('is-loading'); });
      box.classList.add('is-loading');
      iframe.src = widgetUrl(studios[current]);
      frameWrap.appendChild(iframe);
    }

    cards.forEach(function (c, i) {
      var b = el('button', 'studio-card__map', 'Показать на карте');
      b.type = 'button';
      b.addEventListener('click', function () {
        mount();
        show(i);
        if (box.getBoundingClientRect().top > window.innerHeight * 0.6) {
          box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
      });
      c.appendChild(b);
    });
    show(0);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { mount(); io.disconnect(); }
      }, { rootMargin: '400px 0px' });
      io.observe(box);
    } else {
      mount();
    }
  }

  /* ——— Плавное появление при скролле. Без JS и при reduce-motion всё видно сразу (см. CSS .js) ——— */
  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    document.documentElement.classList.add('reveal-on');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ——— «УЗНАТЬ»: текст скрыт, плавно раскрывается и сворачивается ——— */
  function initExpanders() {
    document.querySelectorAll('[data-expand] > button[aria-controls]').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      var timer;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        clearTimeout(timer);
        btn.setAttribute('aria-expanded', String(!open));
        if (!open) {
          panel.hidden = false;
          // следующий кадр — чтобы переход сработал после снятия hidden
          requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.add('is-open'); }); });
        } else {
          panel.classList.remove('is-open');
          timer = setTimeout(function () { panel.hidden = true; }, reduceMotion ? 0 : 450);
        }
      });
    });
  }

  /* ——— FAQ: нативные <details>, плавное раскрытие ответа ——— */
  function initFaq() {
    if (reduceMotion || !Element.prototype.animate) return;
    document.querySelectorAll('.faq__item').forEach(function (item) {
      var summary = item.querySelector('summary');
      var answer = item.querySelector('.faq__answer');
      summary.addEventListener('click', function (e) {
        e.preventDefault();
        if (item.open) {
          var h = answer.offsetHeight;
          answer.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 280, easing: 'ease' })
            .onfinish = function () { item.open = false; };
        } else {
          item.open = true;
          var target = answer.offsetHeight;
          answer.animate([{ height: '0px', opacity: 0 }, { height: target + 'px', opacity: 1 }], { duration: 320, easing: 'ease' });
        }
      });
    });
  }

  /* ——— До/после: играют без звука только в зоне видимости ——— */
  function initInViewVideos(selector) {
    var videos = document.querySelectorAll(selector);
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          v.muted = true;
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.5 });
    videos.forEach(function (v) { io.observe(v); });
  }

  /* ——— Горизонтальные ряды: звёзды (.slider) и до/после (.row). Свайп = нативный скролл, стрелки — на шаг одного видео ——— */
  function initSlider(root, prefix, itemSel) {
    var track = root.querySelector('.' + prefix + '__track');
    var prev = root.querySelector('.' + prefix + '__prev');
    var next = root.querySelector('.' + prefix + '__next');
    if (!track) return;

    function step() {
      var slide = track.querySelector(itemSel);
      if (!slide) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return slide.getBoundingClientRect().width + gap;
    }
    var bar = root.querySelector('.' + prefix + '__bar');
    var cur = root.querySelector('.' + prefix + '__cur');
    var items = Array.prototype.slice.call(track.querySelectorAll(itemSel));
    // «Витрина»: чем дальше видео от центра, тем оно меньше и бледнее (--d от 0 до 1); счётчик и линия прогресса
    function updateFocus() {
      if (!cur && !bar) return;
      var box = track.getBoundingClientRect();
      var mid = box.left + box.width / 2;
      var best = 0, bestDist = Infinity;
      items.forEach(function (it, i) {
        var r = it.getBoundingClientRect();
        var w = it.offsetWidth || 1;
        var dist = Math.abs(r.left + r.width / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
        if (!reduceMotion) it.style.setProperty('--d', Math.min(1, dist / (w * 1.1)).toFixed(3));
      });
      if (cur) cur.textContent = (best < 9 ? '0' : '') + (best + 1);
      if (bar) bar.style.width = ((best + 1) / items.length * 100) + '%';
    }
    function updateNav() {
      var max = track.scrollWidth - track.clientWidth - 2;
      updateFocus();
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    }
    function pauseHidden() {
      if (prefix === 'row') return; // до/после управляет IntersectionObserver
      var box = track.getBoundingClientRect();
      track.querySelectorAll('video').forEach(function (v) {
        var r = v.getBoundingClientRect();
        var visible = r.left >= box.left - 2 && r.right <= box.right + 2;
        if (!visible && !v.paused) v.pause();
      });
    }
    // Если запустили одно видео со звуком — остальные на паузу (только у звёзд)
    if (prefix === 'slider') track.querySelectorAll('video').forEach(function (v) {
      v.addEventListener('play', function () {
        track.querySelectorAll('video').forEach(function (o) { if (o !== v && !o.paused) o.pause(); });
      });
    });

    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });

    var t;
    track.addEventListener('scroll', function () {
      clearTimeout(t);
      if (bar || cur) requestAnimationFrame(updateFocus);
      t = setTimeout(function () { updateNav(); pauseHidden(); }, 150);
    }, { passive: true });
    window.addEventListener('resize', updateNav);
    // Витрина стартует с середины, чтобы видео были по обе стороны от центрального
    if (prefix === 'row' && items.length > 2) {
      var mid = items[Math.floor(items.length / 2)];
      track.scrollLeft = mid.offsetLeft - track.offsetLeft - (track.clientWidth - mid.offsetWidth) / 2;
    }
    updateNav();
  }

  /* ——— Запись: одна форма для всех кнопок ——— */
  function initBooking() {
    var dialog = document.getElementById('booking');
    var form = document.getElementById('booking-form');
    if (!dialog || !form) return;
    var status = form.querySelector('.booking__status');
    var submit = form.querySelector('[type="submit"]');
    var opener = null;

    function open(e) {
      opener = e.currentTarget;
      status.textContent = '';
      status.className = 'booking__status';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.body.classList.add('is-locked');
      var name = form.querySelector('[name="name"]');
      setTimeout(function () { name.focus(); }, 30);
    }
    function close() {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    document.querySelectorAll('[data-open-booking]').forEach(function (b) { b.addEventListener('click', open); });
    dialog.querySelectorAll('[data-close-booking]').forEach(function (b) { b.addEventListener('click', close); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); }); // клик по подложке
    dialog.addEventListener('close', function () {
      document.body.classList.remove('is-locked');
      if (opener) opener.focus();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.hasAttribute('open')) close(); });

    function validate() {
      var ok = true;
      ['name', 'phone'].forEach(function (n) {
        var input = form.elements[n];
        var valid = input.value.trim() !== '' && input.checkValidity();
        if (n === 'phone') valid = valid && input.value.replace(/\D/g, '').length >= 10;
        input.classList.toggle('is-invalid', !valid);
        if (!valid && ok) { input.focus(); ok = false; }
      });
      return ok;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      if (!validate()) {
        status.className = 'booking__status is-error';
        status.textContent = 'Укажите имя и телефон.';
        return;
      }
      submit.disabled = true;
      status.className = 'booking__status';
      status.textContent = 'Отправляем…';
      fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (data) {
          if (data && data.ok) {
            status.className = 'booking__status is-ok';
            status.textContent = 'Заявка отправлена, мы вам перезвоним';
            form.reset();
          } else {
            throw new Error('send failed');
          }
        })
        .catch(function () {
          status.className = 'booking__status is-error';
          status.textContent = 'Не удалось отправить заявку. Позвоните нам: 8 495 992-23-45';
        })
        .then(function () { submit.disabled = false; });
    });
  }

  renderStudios();
  initHeader();
  initReveal();
  initExpanders();
  initFaq();
  initInViewVideos('#results video');
  document.querySelectorAll('[data-slider]').forEach(function (r) { initSlider(r, 'slider', '.slide'); });
  document.querySelectorAll('[data-row]').forEach(function (r) { initSlider(r, 'row', '.row__item'); });
  initBooking();
})();
