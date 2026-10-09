// utils/categoryColors.js — UNICA fonte dei colori categoria (dashboard, storico, report).
// Il colore dipende dalla posizione della categoria nell'elenco dell'app, quindi è uguale
// per tutti gli utenti e in tutte le pagine, senza doppioni finché le categorie sono <= 12.
const Expenses = require('../models/expenses');

const PALETTE = ['#3b6fd4', '#1f9d63', '#e08a1e', '#8b5cf6', '#d6336c', '#0ea5b7',
  '#8a6d3b', '#6b7280', '#f9ab00', '#c2185b', '#4c8c2b', '#7a4fd6'];

const names = (x) => (Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.keys(x) : []));
const ORDER = [...new Set([...names(Expenses.CATEGORIE_SPESE), ...names(Expenses.CATEGORIE_ENTRATE)])];

function colorFor(name) {
  const i = ORDER.indexOf(name);
  if (i >= 0) return PALETTE[i % PALETTE.length];
  let h = 0; const s = String(name || '');
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function colorMap() {
  const out = {};
  ORDER.forEach((n) => { out[n] = colorFor(n); });
  return out;
}

module.exports = { colorFor, colorMap, PALETTE };
