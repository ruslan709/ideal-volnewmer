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

  /* ——— Студии: один источник (js/studios.js) → шапка и подвал ——— */
  function renderStudios() {
    var studios = Array.isArray(window.IDEAL_STUDIOS) ? window.IDEAL_STUDIOS : [];

    var headerList = document.querySelector('[data-studios="header"] .studios-menu__list');
    if (headerList) {
      headerList.textContent = '';
      studios.forEach(function (s) {
        var li = el('li');
        li.appendChild(el('span', 'studios-menu__city', s.city));
        li.appendChild(el('span', 'studios-menu__address', s.address));
        headerList.appendChild(li);
      });
    }

    var footerGrid = document.querySelector('[data-studios="footer"]');
    if (footerGrid) {
      footerGrid.textContent = '';
      studios.forEach(function (s) {
        var li = el('li', 'studio-card');
        li.appendChild(el('p', 'studio-card__city', s.city));
        li.appendChild(el('p', 'studio-card__address', s.address));
        footerGrid.appendChild(li);
      });
      var todo = el('li', 'studio-card studio-card--todo');
      todo.appendChild(el('span', 'todo', '[TODO: адреса студий в других городах]'));
      footerGrid.appendChild(todo);
    }

    // Закрывать выпадающий список по клику вне его
    var menu = document.querySelector('.studios-menu');
    if (menu) {
      document.addEventListener('click', function (e) {
        if (menu.open && !menu.contains(e.target)) menu.open = false;
      });
    }
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

  /* ——— Слайдер звёзд: свайп (нативный скролл) + стрелки ——— */
  function initSlider(root) {
    var track = root.querySelector('.slider__track');
    var prev = root.querySelector('.slider__prev');
    var next = root.querySelector('.slider__next');
    if (!track) return;

    function step() {
      var slide = track.querySelector('.slide');
      if (!slide) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return slide.getBoundingClientRect().width + gap;
    }
    function updateNav() {
      var max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    }
    function pauseHidden() {
      var box = track.getBoundingClientRect();
      track.querySelectorAll('video').forEach(function (v) {
        var r = v.getBoundingClientRect();
        var visible = r.left >= box.left - 2 && r.right <= box.right + 2;
        if (!visible && !v.paused) v.pause();
      });
    }
    // Если запустили одно видео — остальные на паузу
    track.querySelectorAll('video').forEach(function (v) {
      v.addEventListener('play', function () {
        track.querySelectorAll('video').forEach(function (o) { if (o !== v && !o.paused) o.pause(); });
      });
    });

    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });

    var t;
    track.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () { updateNav(); pauseHidden(); }, 150);
    }, { passive: true });
    window.addEventListener('resize', updateNav);
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
  initExpanders();
  initFaq();
  initInViewVideos('#results video');
  document.querySelectorAll('[data-slider]').forEach(initSlider);
  initBooking();
})();
