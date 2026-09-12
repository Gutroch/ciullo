// public/js/ui-effects.js
// Micro-interazioni globali in stile Material 3: ripple sui controlli
// interattivi e reveal-on-scroll per card, righe spesa e tabelle.
// Rispetta prefers-reduced-motion.
(function () {
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- RIPPLE ----------------
  var RIPPLE_SELECTOR = [
    '.btn', '.nav-link', '.bottom-nav-item', '.sheet-item', '.fab-circle',
    '.qty-btn', '.quick-amount-btn', '.chart-fullscreen', '.chart-download',
    '.breadcrumb-btn', '.segmented-item', '.accordion-header', '.switch',
    '.hamburger-btn', '.theme-toggle-btn', '.account-btn'
  ].join(', ');

  function spawnRipple(target, x, y) {
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

  if (!prefersReducedMotion) {
    document.addEventListener('click', function (e) {
      var target = e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
      if (!target || target.disabled) return;
      spawnRipple(target, e.clientX || 0, e.clientY || 0);
    }, true);
  }

  // ---------------- REVEAL ON SCROLL ----------------
  function initReveal() {
    var targets = document.querySelectorAll(
      '.main-content .card, .main-content .expense-item, .main-content table.data-table tbody tr, .main-content .promemoria-table tbody tr'
    );
    if (!targets.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      return; // lascia tutto visibile, nessun effetto necessario
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    var delay = 0;
    targets.forEach(function (el) {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', Math.min(delay, 320) + 'ms');
      delay += 35;
      io.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
})();
