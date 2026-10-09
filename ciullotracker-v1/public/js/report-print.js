(function () {
  'use strict';

  var doc = document.getElementById('reportDocument');
  var form = document.getElementById('reportForm');

  // ---- Stampa -------------------------------------------------------------
  var printButton = document.getElementById('reportPrintButton');
  if (printButton) {
    printButton.addEventListener('click', function () { window.print(); });
  }

  // ---- Sezioni on/off dal menu in alto (istantaneo, senza ricaricare) ------
  function syncUrl() {
    if (!window.history || !window.history.replaceState) return;
    var params = new URLSearchParams(window.location.search);
    params.delete('sezioni');
    params.set('sez_set', '1');
    document.querySelectorAll('[data-toggle-section]').forEach(function (box) {
      if (box.checked) params.append('sezioni', box.value);
    });
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
  }

  document.querySelectorAll('[data-toggle-section]').forEach(function (box) {
    box.addEventListener('change', function () {
      var section = doc && doc.querySelector('[data-section="' + box.value + '"]');
      if (section) section.hidden = !box.checked;
      syncUrl();
    });
  });

  // ---- Analisi AI ----------------------------------------------------------
  var aiButton = document.getElementById('reportAiButton');
  var aiLabel = document.getElementById('reportAiLabel');
  var aiBody = document.getElementById('rpAiBody');
  var aiBox = document.querySelector('[data-toggle-section="ai"]');
  if (!aiButton || !aiBody || !doc) return;

  function cacheKey() {
    return 'rp-ai:' + (doc.getAttribute('data-query') || '');
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function list(title, items) {
    if (!items || !items.length) return null;
    var box = el('div', 'rp-ai-box');
    box.appendChild(el('h4', '', title));
    var ul = document.createElement('ul');
    items.forEach(function (item) { ul.appendChild(el('li', '', item)); });
    box.appendChild(ul);
    return box;
  }

  // Tutto con textContent: il testo dell'AI non viene mai interpretato come HTML.
  function renderAnalysis(a, when) {
    aiBody.textContent = '';
    if (a.sintesi) aiBody.appendChild(el('p', 'rp-ai-summary', a.sintesi));
    var cols = el('div', 'rp-ai-cols');
    var strengths = list('Punti di forza', a.punti_di_forza);
    var issues = list('Criticità', a.criticita);
    if (strengths) cols.appendChild(strengths);
    if (issues) cols.appendChild(issues);
    if (cols.childNodes.length) aiBody.appendChild(cols);
    var tips = list('Consigli', a.consigli);
    if (tips) aiBody.appendChild(tips);
    if (a.obiettivo) aiBody.appendChild(el('div', 'rp-ai-goal', 'Obiettivo: ' + a.obiettivo));
    var stamp = when ? new Date(when).toLocaleString('it-IT') : '';
    aiBody.appendChild(el('p', 'rp-ai-note', 'Analisi generata dall\u2019AI sui dati aggregati del periodo' + (stamp ? ' (' + stamp + ')' : '') + '. Ha valore indicativo e non sostituisce un consulente.'));
  }

  function showSection() {
    var section = document.getElementById('rpAiSection');
    if (section) section.hidden = false;
    if (aiBox && !aiBox.checked) { aiBox.checked = true; syncUrl(); }
  }

  function loadCached() {
    try {
      var raw = window.sessionStorage.getItem(cacheKey());
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && saved.analysis) renderAnalysis(saved.analysis, saved.generatedAt);
    } catch (e) { /* storage non disponibile: pazienza */ }
  }

  function buildBody() {
    var fd = new FormData(form);
    var body = {};
    ['dal', 'al', 'categoria', 'tipo'].forEach(function (k) { body[k] = fd.get(k) || ''; });
    return body;
  }

  aiButton.addEventListener('click', function () {
    showSection();
    aiButton.disabled = true;
    aiLabel.textContent = 'Analisi in corso…';
    aiBody.textContent = '';
    aiBody.appendChild(el('div', 'rp-ai-loading', 'Jonny sta leggendo i tuoi numeri…'));

    fetch('/reports/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(buildBody())
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.success) throw new Error(data.error || 'Analisi non disponibile.');
          return data;
        });
      })
      .then(function (data) {
        renderAnalysis(data.analysis, data.generatedAt);
        try { window.sessionStorage.setItem(cacheKey(), JSON.stringify(data)); } catch (e) { /* ignora */ }
        aiLabel.textContent = 'Rigenera analisi AI';
      })
      .catch(function (err) {
        aiBody.textContent = '';
        aiBody.appendChild(el('p', 'rp-ai-error rp-no-print', err.message));
        aiLabel.textContent = 'Riprova analisi AI';
      })
      .then(function () { aiButton.disabled = false; });
  });

  loadCached();
})();
