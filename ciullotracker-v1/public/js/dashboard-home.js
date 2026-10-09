/* dashboard-home.js — contatori, anelli, sparkline, heatmap, scheletri, colori categoria condivisi. */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = function (n, d) { return n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }); };

  // Colori categoria: arrivano dal server (utils/categoryColors.js) come window.CiulloCategoryMap,
  // gli stessi usati in storico e report. Per nomi sconosciuti (es. sottocategorie) c'è un ripiego stabile.
  var FALLBACK = ['#3b6fd4', '#1f9d63', '#e08a1e', '#8b5cf6', '#d6336c', '#0ea5b7', '#8a6d3b', '#6b7280'];
  window.CiulloCategoryColor = function (name) {
    var map = window.CiulloCategoryMap || {};
    if (map[name]) return map[name];
    var h = 0, s = String(name || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return FALLBACK[h % FALLBACK.length];
  };

  function counters() {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var to = parseFloat(el.dataset.count) || 0, d = parseInt(el.dataset.decimals || '2', 10);
      var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      var paint = function (v) { el.textContent = pre + nf(v, d) + suf; };
      if (reduce) return paint(to);
      var t0 = performance.now();
      (function step(n) {
        var p = Math.min(1, (n - t0) / 1000);
        paint(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  function rings() {
    document.querySelectorAll('.budget-ring[data-pct]').forEach(function (el) {
      var pct = parseFloat(el.dataset.pct) || 0, c = el.querySelector('.bar'), r = c.r.baseVal.value, L = 2 * Math.PI * r;
      el.classList.toggle('is-warn', pct >= 80 && pct < 100);
      el.classList.toggle('is-bad', pct >= 100);
      c.style.strokeDasharray = L;
      c.style.strokeDashoffset = L;
      requestAnimationFrame(function () { c.style.strokeDashoffset = L * (1 - Math.min(pct, 100) / 100); });
      var lab = el.querySelector('.budget-ring-pct'); if (lab) lab.textContent = Math.round(pct) + '%';
    });
  }

  function sparks() {
    document.querySelectorAll('svg[data-spark]').forEach(function (svg) {
      var t = (window.dashboardChartData || {}).trend || {}, k = svg.dataset.spark, u = t.dataUscite || [], e = t.dataIngressi || [];
      var a = k === 'uscite' ? u : k === 'ingressi' ? e : e.map(function (x, i) { return (+x || 0) - (+u[i] || 0); });
      if (a.length < 2) { svg.style.display = 'none'; return; }
      var mx = Math.max.apply(null, a), mn = Math.min.apply(null, a);
      var d = a.map(function (y, i) { return (i ? 'L' : 'M') + (i * 100 / (a.length - 1)).toFixed(1) + ' ' + (28 - (y - mn) / (mx - mn || 1) * 24).toFixed(1); }).join(' ');
      svg.innerHTML = '<path class="area" d="' + d + ' L100 32 L0 32Z"/><path class="line" d="' + d + '"/>';
    });
  }

  // Heatmap: legge dashboardChartData.giornaliero (labels = giorno del mese, dataUscite = importi).
  function heatmap() {
    var box = document.getElementById('spendHeatmap'), src = (window.dashboardChartData || {}).giornaliero; if (!box || !src) return;
    var y = +box.dataset.year, m = +box.dataset.month, n = new Date(y, m, 0).getDate();
    var vals = {}, max = 0;
    (src.labels || []).forEach(function (l, i) { var d = parseInt(l, 10), v = +(src.dataUscite || [])[i] || 0; vals[d] = v; if (v > max) max = v; });
    var html = ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(function (x) { return '<div class="heatmap-dow">' + x + '</div>'; }).join('');
    for (var p = (new Date(y, m - 1, 1).getDay() + 6) % 7; p > 0; p--) html += '<div class="heatmap-cell is-pad"></div>';
    for (var d = 1; d <= n; d++) {
      var v = vals[d] || 0, l = !v ? 0 : Math.max(1, Math.ceil(v / (max || 1) * 4));
      html += '<div class="heatmap-cell" data-l="' + l + '" title="' + d + '/' + m + ': € ' + nf(v, 2) + '">' + d + '</div>';
    }
    box.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    sparks(); heatmap(); rings(); counters();
    document.querySelectorAll('.is-loading').forEach(function (el) { el.classList.remove('is-loading'); });
  });
})();
