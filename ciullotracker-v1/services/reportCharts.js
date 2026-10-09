'use strict';

// Grafici SVG generati lato server: nessuna libreria, nessun eval (compatibili con la CSP),
// stampabili in PDF e identici su schermo e carta.

const PALETTE = ['#2F6FED', '#8B5CF6', '#0EA5A4', '#F59E0B', '#EC4899', '#84CC16', '#EF4444'];
const OTHER_COLOR = '#94A3B8';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n1 = (n) => Math.round(n * 10) / 10;

function compact(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e4) return `${Math.round(v / 1e3)} k`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString('it-IT', { maximumFractionDigits: 1 })} k`;
  return String(Math.round(v));
}

// Massimo "tondo" e numero di intervalli che producono tacche tonde (es. 0, 1k, 2k, 3k, 4k, 5k).
function niceScale(v) {
  if (v <= 0) return { max: 1, steps: 4 };
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return { max: nice * exp, steps: nice === 2 ? 4 : 5 };
}

function barsChart(buckets) {
  if (!buckets.length || buckets.every((b) => !b.income && !b.expenses)) return '';
  const W = 720; const H = 250; const L = 52; const R = 10; const T = 12; const B = 30;
  const pw = W - L - R; const ph = H - T - B;
  const { max, steps } = niceScale(Math.max(...buckets.map((b) => Math.max(b.income, b.expenses))));
  const y = (v) => T + ph - (v / max) * ph;
  const slot = pw / buckets.length;
  const bw = Math.max(2, Math.min(30, slot * 0.34));
  const every = Math.ceil(buckets.length / 12);
  let g = '';
  for (let i = 0; i <= steps; i += 1) {
    const v = (max / steps) * i;
    g += `<line class="rp-grid" x1="${L}" x2="${W - R}" y1="${n1(y(v))}" y2="${n1(y(v))}"/><text class="rp-axis" x="${L - 8}" y="${n1(y(v) + 3.5)}" text-anchor="end">${compact(v)}</text>`;
  }
  let bars = '';
  buckets.forEach((b, i) => {
    const cx = L + slot * i + slot / 2;
    if (b.income > 0) bars += `<rect class="rp-bar-income" x="${n1(cx - bw - 1)}" y="${n1(y(b.income))}" width="${n1(bw)}" height="${n1(T + ph - y(b.income))}" rx="2"><title>${esc(b.label)} · entrate ${Math.round(b.income)} €</title></rect>`;
    if (b.expenses > 0) bars += `<rect class="rp-bar-expense" x="${n1(cx + 1)}" y="${n1(y(b.expenses))}" width="${n1(bw)}" height="${n1(T + ph - y(b.expenses))}" rx="2"><title>${esc(b.label)} · uscite ${Math.round(b.expenses)} €</title></rect>`;
    if (i % every === 0) bars += `<text class="rp-axis" x="${n1(cx)}" y="${H - 10}" text-anchor="middle">${esc(b.label)}</text>`;
  });
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entrate e uscite per periodo">${g}${bars}</svg>`;
}

function balanceChart(buckets) {
  if (buckets.length < 2) return '';
  const W = 720; const H = 190; const L = 52; const R = 14; const T = 14; const B = 28;
  const pw = W - L - R; const ph = H - T - B;
  const vals = buckets.map((b) => b.cumulative);
  let lo = Math.min(0, ...vals); let hi = Math.max(0, ...vals);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.08; lo -= lo < 0 ? pad : 0; hi += pad;
  const x = (i) => L + (pw * i) / (buckets.length - 1);
  const y = (v) => T + ph - ((v - lo) / (hi - lo)) * ph;
  const pts = buckets.map((b, i) => `${n1(x(i))},${n1(y(b.cumulative))}`);
  const zero = y(0);
  const area = `M${n1(x(0))},${n1(zero)} L${pts.join(' L')} L${n1(x(buckets.length - 1))},${n1(zero)} Z`;
  const every = Math.ceil(buckets.length / 12);
  let g = '';
  for (let i = 0; i <= 3; i += 1) {
    const v = lo + ((hi - lo) / 3) * i;
    g += `<line class="rp-grid" x1="${L}" x2="${W - R}" y1="${n1(y(v))}" y2="${n1(y(v))}"/><text class="rp-axis" x="${L - 8}" y="${n1(y(v) + 3.5)}" text-anchor="end">${compact(v)}</text>`;
  }
  let labels = '';
  buckets.forEach((b, i) => { if (i % every === 0) labels += `<text class="rp-axis" x="${n1(x(i))}" y="${H - 8}" text-anchor="middle">${esc(b.label)}</text>`; });
  const last = buckets[buckets.length - 1];
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo cumulato nel periodo">${g}<line class="rp-zero" x1="${L}" x2="${W - R}" y1="${n1(zero)}" y2="${n1(zero)}"/><path class="rp-area" d="${area}"/><polyline class="rp-line" points="${pts.join(' ')}" fill="none"/><circle class="rp-dot" cx="${n1(x(buckets.length - 1))}" cy="${n1(y(last.cumulative))}" r="3.5"/>${labels}</svg>`;
}

// Raggruppa le categorie oltre la settima in "Altre" e assegna i colori.
function legendItems(categories) {
  const top = categories.slice(0, 7);
  const rest = categories.slice(7);
  const items = top.map((c, i) => ({ ...c, color: PALETTE[i] }));
  if (rest.length) {
    items.push({ label: `Altre (${rest.length})`, amount: rest.reduce((s, c) => s + c.amount, 0), share: rest.reduce((s, c) => s + c.share, 0), count: rest.reduce((s, c) => s + c.count, 0), color: OTHER_COLOR });
  }
  return items;
}

function donutChart(items, totalLabel) {
  if (!items.length) return '';
  const S = 200; const c = S / 2; const r = 74; const sw = 30;
  const circ = 2 * Math.PI * r;
  let offset = 0; let segs = '';
  items.forEach((it) => {
    const len = Math.max(0, it.share) * circ;
    segs += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${sw}" stroke-dasharray="${n1(len)} ${n1(circ - len)}" stroke-dashoffset="${n1(-offset)}" transform="rotate(-90 ${c} ${c})"><title>${esc(it.label)}</title></circle>`;
    offset += len;
  });
  return `<svg class="rp-donut" viewBox="0 0 ${S} ${S}" role="img" aria-label="Ripartizione delle uscite per categoria"><circle cx="${c}" cy="${c}" r="${r}" fill="none" class="rp-donut-track" stroke-width="${sw}"/>${segs}<text class="rp-donut-label" x="${c}" y="${c - 4}" text-anchor="middle">Uscite</text><text class="rp-donut-value" x="${c}" y="${c + 16}" text-anchor="middle">${esc(totalLabel)}</text></svg>`;
}

module.exports = { barsChart, balanceChart, donutChart, legendItems, esc };
