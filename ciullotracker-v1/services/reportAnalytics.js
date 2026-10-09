'use strict';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const DAY_MS = 86400000;

const eurFormatter = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fmt = {
  eur: (n) => eurFormatter.format(Number(n) || 0),
  pct: (n, digits = 0) => `${(Number(n) * 100).toLocaleString('it-IT', { maximumFractionDigits: digits })}%`,
  date: (iso) => {
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
  },
};

const amountOf = (e) => Number(e.importo) || 0;
const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toIso = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = parseIso(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / DAY_MS) + 1;
const daysInMonth = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();

function totalsOf(list) {
  const t = list.reduce((acc, e) => {
    if (e.tipo === 'ingresso') acc.income += amountOf(e);
    else acc.expenses += amountOf(e);
    return acc;
  }, { income: 0, expenses: 0 });
  return { ...t, net: t.income - t.expenses, count: list.length };
}

function buildSeries(list, from, to) {
  const len = daysBetween(from, to);
  const daily = len <= 40;
  const keys = [];
  if (daily) {
    for (let i = 0; i < len; i += 1) keys.push(addDays(from, i));
  } else {
    let [y, m] = from.slice(0, 7).split('-').map(Number);
    const [ey, em] = to.slice(0, 7).split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      keys.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  }
  const map = new Map(keys.map((k) => [k, { key: k, income: 0, expenses: 0 }]));
  list.forEach((e) => {
    const b = map.get(daily ? e.data_spesa : e.data_spesa.slice(0, 7));
    if (!b) return;
    if (e.tipo === 'ingresso') b.income += amountOf(e);
    else b.expenses += amountOf(e);
  });
  let run = 0;
  let buckets = [...map.values()].map((b) => {
    run += b.income - b.expenses;
    return {
      ...b,
      net: b.income - b.expenses,
      cumulative: run,
      label: daily ? String(Number(b.key.slice(8))) : `${MONTHS_SHORT[Number(b.key.slice(5, 7)) - 1]} ${b.key.slice(2, 4)}`,
    };
  });
  if (buckets.length > 36) buckets = buckets.slice(-36);
  return { granularity: daily ? 'giorno' : 'mese', buckets };
}

function breakdown(list, keyFn, tipo) {
  const map = new Map();
  let total = 0;
  list.forEach((e) => {
    if (tipo === 'uscita' ? e.tipo === 'ingresso' : e.tipo !== 'ingresso') return;
    const key = keyFn(e);
    const cur = map.get(key) || { label: key, amount: 0, count: 0 };
    cur.amount += amountOf(e);
    cur.count += 1;
    total += amountOf(e);
    map.set(key, cur);
  });
  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({ ...c, share: total > 0 ? c.amount / total : 0 }));
}

function summaryBy(list, group) {
  const grouped = new Map();
  list.forEach((e) => {
    let key = e.categoria || 'Senza categoria';
    if (group === 'mese') key = e.data_spesa.slice(0, 7);
    if (group === 'beneficiario') key = e.per_conto_di || 'Non indicato';
    const cur = grouped.get(key) || { label: key, income: 0, expenses: 0, count: 0 };
    if (e.tipo === 'ingresso') cur.income += amountOf(e);
    else cur.expenses += amountOf(e);
    cur.count += 1;
    grouped.set(key, cur);
  });
  const rows = [...grouped.values()].map((i) => ({ ...i, net: i.income - i.expenses }));
  if (group === 'mese') {
    rows.sort((a, b) => a.label.localeCompare(b.label));
    rows.forEach((i) => { const [y, m] = i.label.split('-'); i.label = `${MONTHS[Number(m) - 1]} ${y}`; });
  } else {
    rows.sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income));
  }
  return rows;
}

function buildInsights(c) {
  const out = [];
  const { totals, prev, categories, prevCategories, top, projection, days } = c;
  if (!totals.count) return out;

  if (totals.income > 0) {
    const rate = totals.net / totals.income;
    if (totals.net < 0) {
      out.push({ tone: 'warn', title: 'Saldo negativo', text: `Nel periodo hai speso ${fmt.eur(-totals.net)} più di quanto hai incassato. Controlla le uscite non essenziali e valuta di rimandare le spese non urgenti.` });
    } else if (rate >= 0.2) {
      out.push({ tone: 'ok', title: `Ottimo tasso di risparmio (${fmt.pct(rate, 1)})`, text: `Ti restano ${fmt.eur(totals.net)} sulle entrate del periodo. Una parte può andare in un fondo di emergenza o nell'estinzione anticipata di un debito.` });
    } else if (rate < 0.1) {
      out.push({ tone: 'warn', title: `Margine ridotto (${fmt.pct(rate, 1)})`, text: 'Rimane meno del 10% delle entrate. Un obiettivo realistico è mettere da parte il 10-20% appena arriva lo stipendio, prima di spendere.' });
    } else {
      out.push({ tone: 'info', title: `Tasso di risparmio ${fmt.pct(rate, 1)}`, text: 'Sei in territorio positivo. Per arrivare al 20% bastano piccoli tagli sulle categorie principali.' });
    }
  }

  if (categories.length > 1 && categories[0].share >= 0.35) {
    const c0 = categories[0];
    out.push({ tone: 'info', title: `${c0.label} pesa il ${fmt.pct(c0.share)} delle uscite`, text: `È la voce dominante (${fmt.eur(c0.amount)}). Anche un taglio del 10% qui vale ${fmt.eur(c0.amount * 0.1)} nel periodo.` });
  }

  const debt = categories.filter((x) => /DEBIT|PRESTIT/i.test(x.label)).reduce((s, x) => s + x.amount, 0);
  if (totals.income > 0 && debt / totals.income >= 0.3) {
    out.push({ tone: 'warn', title: 'Rate e prestiti pesanti', text: `Debiti e prestiti assorbono il ${fmt.pct(debt / totals.income)} delle entrate (${fmt.eur(debt)}). Oltre il 30-35% la sostenibilità diventa delicata: valuta rinegoziazioni o estinzioni anticipate.` });
  }

  if (prev.hasData && prev.totals.expenses > 0) {
    const delta = (totals.expenses - prev.totals.expenses) / prev.totals.expenses;
    if (delta >= 0.1) {
      let extra = '';
      const prevMap = new Map(prevCategories.map((x) => [x.label, x.amount]));
      const grow = categories
        .map((x) => ({ label: x.label, diff: x.amount - (prevMap.get(x.label) || 0) }))
        .sort((a, b) => b.diff - a.diff)[0];
      if (grow && grow.diff >= 50) extra = ` L'aumento maggiore è su ${grow.label} (+${fmt.eur(grow.diff)}).`;
      out.push({ tone: 'warn', title: `Uscite in aumento del ${fmt.pct(delta)}`, text: `Rispetto al periodo precedente spendi ${fmt.eur(totals.expenses - prev.totals.expenses)} in più.${extra}` });
    } else if (delta <= -0.1) {
      out.push({ tone: 'ok', title: `Uscite in calo del ${fmt.pct(-delta)}`, text: `Rispetto al periodo precedente risparmi ${fmt.eur(prev.totals.expenses - totals.expenses)}. Buon segnale: mantieni le abitudini che hanno funzionato.` });
    }
  }

  if (top.length >= 1 && totals.expenses > 0 && totals.count >= 4 && top[0].importo / totals.expenses >= 0.25) {
    out.push({ tone: 'info', title: 'Una sola spesa pesa molto', text: `"${top[0].descrizione}" vale ${fmt.eur(top[0].importo)}, il ${fmt.pct(top[0].importo / totals.expenses)} delle uscite del periodo. Se è una spesa straordinaria, leggi il resto dei dati al netto di questa.` });
  }

  const subs = categories.find((x) => /ABBONAMENT|TECNOLOG/i.test(x.label));
  if (subs && subs.share >= 0.08) {
    out.push({ tone: 'info', title: 'Controlla gli abbonamenti', text: `Tecnologia e abbonamenti valgono ${fmt.eur(subs.amount)} (${fmt.pct(subs.share)} delle uscite). Rivedi le offerte telefoniche e disdici ciò che non usi.` });
  }

  if (projection) {
    out.push({ tone: 'info', title: 'Proiezione di fine mese', text: `Al ritmo attuale (${fmt.eur(totals.expenses / days)} al giorno) il mese chiuderebbe con circa ${fmt.eur(projection)} di uscite. Stima indicativa: le rate fisse pesano all'inizio del mese.` });
  }
  return out.slice(0, 6);
}

function analyze(allExpenses, params, todayIso) {
  const { from, to, category, type, group } = params;
  const match = (e, f, t) => e.data_spesa >= f && e.data_spesa <= t && (!category || e.categoria === category) && (!type || e.tipo === type);
  const valid = from <= to;
  const list = valid ? allExpenses.filter((e) => match(e, from, to)) : [];
  const days = valid ? daysBetween(from, to) : 0;
  const totals = totalsOf(list);

  // Periodo di confronto: per i mesi (anche parziali) si confronta con lo stesso
  // tratto del mese precedente; altrimenti con il periodo di pari durata subito prima.
  let prevFrom;
  let prevTo;
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (valid && sameMonth && from.endsWith('-01')) {
    const first = parseIso(from);
    first.setUTCMonth(first.getUTCMonth() - 1);
    prevFrom = toIso(first);
    const pdim = daysInMonth(prevFrom);
    const isLastDay = Number(to.slice(8)) === daysInMonth(to);
    prevTo = `${prevFrom.slice(0, 8)}${String(isLastDay ? pdim : Math.min(Number(to.slice(8)), pdim)).padStart(2, '0')}`;
  } else {
    prevTo = addDays(from, -1);
    prevFrom = addDays(prevTo, -(Math.max(days, 1) - 1));
  }
  const prevList = valid ? allExpenses.filter((e) => match(e, prevFrom, prevTo)) : [];
  const prevTotals = totalsOf(prevList);
  const prev = { from: prevFrom, to: prevTo, totals: prevTotals, hasData: prevList.length > 0 };

  const categories = breakdown(list, (e) => e.categoria || 'Senza categoria', 'uscita');
  const prevCategories = breakdown(prevList, (e) => e.categoria || 'Senza categoria', 'uscita');
  const incomeSources = breakdown(list, (e) => e.categoria || 'Senza categoria', 'ingresso');
  const beneficiaries = breakdown(list, (e) => e.per_conto_di || 'Non indicato', 'uscita');
  const spend = list.filter((e) => e.tipo !== 'ingresso');
  const top = spend
    .slice()
    .sort((a, b) => amountOf(b) - amountOf(a))
    .slice(0, 5)
    .map((e) => ({ data: e.data_spesa, descrizione: e.note || e.sottocategoria || e.categoria || '—', categoria: e.categoria || '—', importo: amountOf(e) }));

  let projection = null;
  const lastDay = `${todayIso.slice(0, 8)}${String(daysInMonth(todayIso)).padStart(2, '0')}`;
  if (valid && from.endsWith('-01') && from.slice(0, 7) === todayIso.slice(0, 7) && to >= todayIso && todayIso < lastDay) {
    const elapsed = daysBetween(from, todayIso);
    if (elapsed >= 5 && totals.expenses > 0) projection = (totals.expenses / elapsed) * daysInMonth(todayIso);
  }

  const delta = (cur, old) => (old > 0 ? (cur - old) / old : null);
  const kpis = {
    savingsRate: totals.income > 0 ? totals.net / totals.income : null,
    avgDaily: days > 0 ? totals.expenses / days : 0,
    avgTicket: spend.length ? totals.expenses / spend.length : 0,
    deltaIncome: prev.hasData ? delta(totals.income, prevTotals.income) : null,
    deltaExpenses: prev.hasData ? delta(totals.expenses, prevTotals.expenses) : null,
  };

  const series = buildSeries(list, valid ? from : todayIso, valid ? to : todayIso);
  const insights = buildInsights({ totals, prev, categories, prevCategories, top, projection, days });

  return {
    valid, days, totals, prev, kpis, series, categories, incomeSources, beneficiaries, top, insights, projection,
    summary: summaryBy(list, group),
    expenses: list.slice().sort((a, b) => b.data_spesa.localeCompare(a.data_spesa)),
  };
}

// Dati aggregati da inviare all'AI: nessuna riga grezza, solo numeri di sintesi.
function aiPayload(params, data) {
  const r = (n) => Math.round((Number(n) || 0) * 100) / 100;
  return {
    periodo: { dal: params.from, al: params.to, giorni: data.days },
    filtri: { categoria: params.category || 'tutte', tipo: params.type || 'entrate e uscite' },
    totali: { entrate: r(data.totals.income), uscite: r(data.totals.expenses), saldo: r(data.totals.net), movimenti: data.totals.count },
    tasso_risparmio_percentuale: data.kpis.savingsRate === null ? null : r(data.kpis.savingsRate * 100),
    spesa_media_giornaliera: r(data.kpis.avgDaily),
    periodo_precedente: data.prev.hasData ? { entrate: r(data.prev.totals.income), uscite: r(data.prev.totals.expenses), saldo: r(data.prev.totals.net) } : null,
    categorie_uscite: data.categories.slice(0, 8).map((c) => ({ categoria: c.label, importo: r(c.amount), quota_percentuale: r(c.share * 100), movimenti: c.count })),
    fonti_entrate: data.incomeSources.slice(0, 5).map((c) => ({ categoria: c.label, importo: r(c.amount) })),
    andamento: data.series.buckets.map((b) => ({ periodo: b.label, entrate: r(b.income), uscite: r(b.expenses) })).slice(-18),
    spese_piu_alte: data.top.map((t) => ({ descrizione: t.descrizione, categoria: t.categoria, importo: r(t.importo) })),
    proiezione_fine_mese: data.projection ? r(data.projection) : null,
  };
}

module.exports = { analyze, aiPayload, fmt, MONTHS };
