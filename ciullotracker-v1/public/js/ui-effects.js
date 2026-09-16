/* ============================================================
   MOTION — interazioni fisiche
   Principi applicati:
   · il riscontro arriva alla pressione, non al rilascio
   · il trascinamento segue il dito 1:1 e rispetta il punto di presa
   · ogni animazione è interrompibile e riparte dal valore a schermo
   · alla fine del gesto la velocità passa alla molla, senza scalino
   · ai bordi si resiste in modo progressivo, non si blocca di colpo
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var isReduced = function () { return reduced.matches; };

  /* --- Molle (equivalenti a damping/response, non a "durata") --- */
  var SPRING = 'linear(0, .0088, .0344, .0754, .13, .1957, .2707, .3529, .4403, .5311,' +
    ' .6235, .7157, .7628, .8062, .8458, .8815, .9134, .9414, .9656, .9862, 1)';
  var EASE_FALLBACK = 'cubic-bezier(.16, 1, .3, 1)';

  var supportsLinearEasing = (function () {
    try {
      var el = document.createElement('div');
      el.style.transitionTimingFunction = SPRING;
      return el.style.transitionTimingFunction !== '';
    } catch (e) { return false; }
  })();
  var spring = supportsLinearEasing ? SPRING : EASE_FALLBACK;

  /* Proiezione del punto di arrivo di un lancio.
     Decadimento esponenziale, come la decelerazione dello scroll. */
  function project(velocity, decelerationRate) {
    var d = decelerationRate || 0.998;
    return (velocity / 1000) * d / (1 - d);
  }

  /* Resistenza progressiva oltre il bordo: più tiri, meno segue. */
  function rubberband(overshoot, dimension, constant) {
    var c = constant || 0.55;
    return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
  }

  /* ============================================================
     1. RISCONTRO ALLA PRESSIONE
     ============================================================ */
  var PRESSABLE = [
    '.btn', '.nav-link', '.bottom-nav-item', '.sheet-item', '.bottom-nav-fab',
    '.qty-btn', '.quick-amount-btn', '.chart-fullscreen', '.chart-download',
    '.breadcrumb-btn', '.segmented-item', '.accordion-header', '.switch',
    '.hamburger-btn', '.theme-toggle-btn', '.account-btn', '.splash-skip',
    '.popup-cancel', '.popup-confirm'
  ].join(', ');

  function spawnRipple(target, x, y) {
    if (isReduced()) return;
    var rect = target.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (x - rect.left - size / 2) + 'px';
    ripple.style.top = (y - rect.top - size / 2) + 'px';
    target.appendChild(ripple);
    var cleanup = function () { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); };
    ripple.addEventListener('animationend', cleanup);
    setTimeout(cleanup, 700);
  }

  document.addEventListener('pointerdown', function (e) {
    if (!e.target.closest) return;
    var target = e.target.closest(PRESSABLE);
    if (!target || target.disabled) return;
    target.classList.add('is-pressed');
    spawnRipple(target, e.clientX, e.clientY);
  }, true);

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
    document.addEventListener(evt, function () {
      var pressed = document.querySelectorAll('.is-pressed');
      for (var i = 0; i < pressed.length; i++) pressed[i].classList.remove('is-pressed');
    }, true);
  });

  /* ============================================================
     2. SHEET TRASCINABILE
     Il pannello segue il dito, resiste verso l'alto, e al rilascio
     decide in base alla velocità — non alla sola posizione.
     ============================================================ */
  function initSheet() {
    var overlay = document.getElementById('moreSheetOverlay');
    var sheet = document.getElementById('moreSheet');
    if (!overlay || !sheet) return;

    var dragging = false;
    var committed = false;
    var startY = 0;
    var offset = 0;
    var history = [];
    var height = 0;
    var pointerId = null;

    function setOffset(y) {
      offset = y;
      sheet.style.transform = 'translateY(' + y + 'px)';
    }

    function settleTo(y, velocity, onDone) {
      var from = offset;
      sheet.classList.remove('is-dragging');
      if (isReduced() || !sheet.animate) {
        setOffset(y);
        if (onDone) onDone();
        return;
      }
      var distance = Math.abs(y - from) || 1;
      // Più quantità di moto porta il gesto, più corta è la coda dell'animazione
      var duration = Math.min(520, Math.max(180, distance / Math.max(0.35, Math.abs(velocity) / 1000) * 0.9));
      var anim = sheet.animate(
        [{ transform: 'translateY(' + from + 'px)' }, { transform: 'translateY(' + y + 'px)' }],
        { duration: duration, easing: spring, fill: 'forwards' }
      );
      setOffset(y);
      anim.onfinish = function () {
        anim.cancel();
        sheet.style.transform = 'translateY(' + y + 'px)';
        if (onDone) onDone();
      };
    }

    function close(velocity) {
      settleTo(height || sheet.offsetHeight, velocity || 0, function () {
        overlay.classList.remove('show');
        sheet.style.transform = '';
      });
    }

    function open() {
      overlay.classList.add('show');
      sheet.style.transform = '';
      offset = 0;
    }

    sheet.addEventListener('pointerdown', function (e) {
      // Non rubare il gesto ai controlli o al contenuto che sta scorrendo
      if (e.target.closest('input, textarea, select')) return;
      if (sheet.scrollTop > 0 && !e.target.closest('.sheet-handle')) return;

      pointerId = e.pointerId;
      dragging = true;
      committed = false;
      startY = e.clientY;
      height = sheet.offsetHeight;
      history = [{ y: e.clientY, t: performance.now() }];
    });

    sheet.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pointerId) return;
      var dy = e.clientY - startY;

      // Isteresi: ~10px prima di impegnarsi nella direzione
      if (!committed) {
        if (Math.abs(dy) < 10) return;
        committed = true;
        sheet.classList.add('is-dragging');
        try { sheet.setPointerCapture(pointerId); } catch (err) { /* ignorato */ }
      }

      history.push({ y: e.clientY, t: performance.now() });
      if (history.length > 6) history.shift();

      // Verso l'alto non c'è nulla: resistenza progressiva
      setOffset(dy >= 0 ? dy : -rubberband(-dy, height));
      e.preventDefault();
    });

    function release(e) {
      if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
      dragging = false;
      pointerId = null;
      if (!committed) return;
      committed = false;

      // Velocità dagli ultimi campioni, non dall'intero gesto
      var last = history[history.length - 1];
      var first = history[0];
      var dt = Math.max(1, last.t - first.t);
      var velocity = (last.y - first.y) / dt * 1000; // px/s

      var projected = offset + project(velocity);
      if (projected > height * 0.35 || velocity > 550) {
        close(velocity);
      } else {
        settleTo(0, velocity);
      }
      history = [];
    }

    sheet.addEventListener('pointerup', release);
    sheet.addEventListener('pointercancel', release);

    // API condivisa con nav.ejs
    window.CiulloSheet = {
      open: open,
      close: function () { close(0); },
      isOpen: function () { return overlay.classList.contains('show'); }
    };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('show')) close(0);
    });
  }

  /* ============================================================
     3. BORDO DI SCORRIMENTO
     Il bordo sotto la barra appare solo quando il contenuto ci passa
     sotto: niente divisori permanenti.
     ============================================================ */
  function initScrollEdge() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;
    var ticking = false;
    function update() {
      topbar.classList.toggle('is-scrolled', window.scrollY > 4);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ============================================================
     4. CIFRE CHE SALGONO
     Solo al primo ingresso e solo sui KPI: dice "questo è il numero
     che conta" senza aggiungere decorazione.
     ============================================================ */
  function parseAmount(text) {
    // Formato italiano: 1.234,56 €
    var cleaned = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  function countUp(el) {
    var original = el.textContent;
    var target = parseAmount(original);
    if (target === null || Math.abs(target) < 0.01) return;

    var decimals = (original.match(/,(\d+)/) || [, ''])[1].length;
    var prefix = original.slice(0, original.search(/[\d-]/));
    var suffix = original.slice(original.search(/[\d-]/)).replace(/^[\d.,\s-]+/, '');
    var start = performance.now();
    var duration = 620;

    el.classList.add('is-counting');
    function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      // decelerazione: veloce all'inizio, si posa alla fine
      var eased = 1 - Math.pow(1 - t, 3);
      var value = target * eased;
      el.textContent = prefix + value.toLocaleString('it-IT', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      }) + suffix;
      if (t < 1) requestAnimationFrame(frame);
      else { el.textContent = original; el.classList.remove('is-counting'); }
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     5. COMPARSA PROGRESSIVA
     ============================================================ */
  function initReveal() {
    var targets = document.querySelectorAll(
      '.main-content .card, .main-content .expense-item,' +
      ' .main-content table.data-table tbody tr, .main-content .promemoria-table tbody tr'
    );
    var counters = document.querySelectorAll('.main-content .kpi-value');

    if (isReduced() || !('IntersectionObserver' in window)) return;

    if (targets.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('reveal-in');
          io.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

      var delay = 0;
      Array.prototype.forEach.call(targets, function (el) {
        el.classList.add('reveal');
        el.style.setProperty('--reveal-delay', Math.min(delay, 320) + 'ms');
        delay += 35;
        io.observe(el);
      });
    }

    if (counters.length) {
      var ioCount = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          ioCount.unobserve(entry.target);
          countUp(entry.target);
        });
      }, { threshold: 0.4 });
      Array.prototype.forEach.call(counters, function (el) { ioCount.observe(el); });
    }
  }

  function boot() {
    initSheet();
    initScrollEdge();
    initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
