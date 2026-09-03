/* ============================================================
   calc-input.js
   Trasforma un normale input numerico in un "mini calcolatore":
   l'utente può scrivere 90+10, 120-20, 50*2, (10+5)/3 ecc. e il
   valore viene risolto in automatico mostrando un'anteprima live
   e sostituendo il contenuto del campo con il risultato finale
   quando serve (blur, invio, submit del form).
   ============================================================ */
(function (global) {
  'use strict';

  // Solo cifre, spazi, punto/virgola decimale e i 4 operatori base + parentesi.
  var SAFE_EXPR = /^[0-9+\-*/().,\s]+$/;

  /**
   * Valuta in modo sicuro una piccola espressione aritmetica.
   * Ritorna un numero oppure null se l'espressione non è valida.
   */
  function evaluate(raw) {
    if (raw === null || raw === undefined) return null;
    var expr = String(raw).trim();
    if (expr === '') return null;

    // Virgola come separatore decimale -> punto
    expr = expr.replace(/,/g, '.');

    // Se non contiene alcun operatore, è già un numero semplice.
    var isPlainNumber = /^-?\d+(\.\d+)?$/.test(expr);
    if (isPlainNumber) {
      var n = parseFloat(expr);
      return isNaN(n) ? null : n;
    }

    if (!SAFE_EXPR.test(expr)) return null;
    // Evita doppi operatori/espressioni sospette (es. "--", "**", parentesi vuote)
    if (/[+\-*/]{2,}/.test(expr.replace(/\s+/g, ''))) return null;
    if (/^[*/]/.test(expr.trim())) return null;

    try {
      // A questo punto la stringa è filtrata: solo cifre/operatori/parentesi.
      // eslint-disable-next-line no-new-func
      var result = Function('"use strict"; return (' + expr + ');')();
      if (typeof result !== 'number' || !isFinite(result)) return null;
      return result;
    } catch (e) {
      return null;
    }
  }

  function formatEuro(n) {
    return '€ ' + n.toFixed(2).replace('.', ',');
  }

  function isExpression(raw) {
    var expr = String(raw || '').replace(/,/g, '.').trim();
    return /^-?\d+(\.\d+)?$/.test(expr) === false && SAFE_EXPR.test(expr);
  }

  /**
   * Collega il "motore calcolo" a un input di testo.
   * options.preview: elemento (o selettore) dove mostrare il risultato live.
   * options.onResolve: callback(value:number) chiamata quando il valore viene confermato.
   * options.min: valore minimo accettato (default null = nessun limite).
   */
  function attach(input, options) {
    if (!input || input.__calcAttached) return;
    input.__calcAttached = true;
    options = options || {};

    var preview = null;
    if (options.preview) {
      preview = typeof options.preview === 'string' ? document.querySelector(options.preview) : options.preview;
    } else {
      preview = document.createElement('div');
      preview.className = 'calc-preview';
      input.insertAdjacentElement('afterend', preview);
    }

    input.setAttribute('autocomplete', 'off');
    if (!input.getAttribute('inputmode')) input.setAttribute('inputmode', 'decimal');

    function refresh() {
      var raw = input.value;
      var value = evaluate(raw);
      var expr = isExpression(raw);

      input.classList.toggle('calc-has-formula', !!expr);

      if (preview) {
        if (raw.trim() === '') {
          preview.textContent = '';
          preview.classList.remove('show', 'is-error');
        } else if (value === null) {
          preview.textContent = 'Espressione non valida';
          preview.classList.add('show', 'is-error');
        } else if (expr) {
          preview.textContent = '= ' + formatEuro(value);
          preview.classList.add('show');
          preview.classList.remove('is-error');
        } else {
          preview.textContent = '';
          preview.classList.remove('show', 'is-error');
        }
      }
      return value;
    }

    function resolveAndCommit() {
      var value = refresh();
      if (value === null) return;
      if (typeof options.min === 'number' && value < options.min) return;
      var fixed = Math.round(value * 100) / 100;
      if (isExpression(input.value)) {
        input.value = fixed.toFixed(2);
      }
      if (preview) {
        preview.textContent = '';
        preview.classList.remove('show', 'is-error');
      }
      if (typeof options.onResolve === 'function') options.onResolve(fixed);
    }

    input.addEventListener('input', refresh);
    input.addEventListener('blur', resolveAndCommit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        resolveAndCommit();
      }
    });

    var form = input.closest('form');
    if (form) {
      form.addEventListener('submit', function () {
        resolveAndCommit();
      });
    }
  }

  function autoInit(root) {
    (root || document).querySelectorAll('[data-calc]').forEach(function (el) {
      attach(el, { min: el.hasAttribute('data-calc-min') ? parseFloat(el.getAttribute('data-calc-min')) : null });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    autoInit(document);
  });

  global.CalcInput = { evaluate: evaluate, attach: attach, autoInit: autoInit, isExpression: isExpression, formatEuro: formatEuro };
})(window);
