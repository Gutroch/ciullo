const express = require('express');
const Expenses = require('../models/expenses');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GROUPS = ['categoria', 'mese', 'beneficiario'];

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const allExpenses = await Expenses.getAllExpenses();
    const today = new Date();
    const todayIso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const from = validDate(req.query.dal) ? req.query.dal : `${todayIso.slice(0, 8)}01`;
    const to = validDate(req.query.al) ? req.query.al : todayIso;
    const category = typeof req.query.categoria === 'string' ? req.query.categoria : '';
    const type = ['ingresso', 'uscita'].includes(req.query.tipo) ? req.query.tipo : '';
    const group = GROUPS.includes(req.query.raggruppa) ? req.query.raggruppa : 'categoria';
    const title = typeof req.query.titolo === 'string' && req.query.titolo.trim()
      ? req.query.titolo.trim().slice(0, 100)
      : 'Report movimenti';
    const heading = typeof req.query.intestazione === 'string' && req.query.intestazione.trim()
      ? req.query.intestazione.trim().slice(0, 100)
      : 'CiulloTracker';
    const validRange = from <= to;
    const filtered = validRange ? allExpenses.filter((expense) => {
      return expense.data_spesa >= from && expense.data_spesa <= to &&
        (!category || expense.categoria === category) &&
        (!type || expense.tipo === type);
    }) : [];

    const totals = filtered.reduce((result, expense) => {
      const amount = Number(expense.importo) || 0;
      if (expense.tipo === 'ingresso') result.income += amount;
      else result.expenses += amount;
      return result;
    }, { income: 0, expenses: 0 });
    const grouped = new Map();

    filtered.forEach((expense) => {
      let key = expense.categoria || 'Senza categoria';
      if (group === 'mese') key = expense.data_spesa.slice(0, 7);
      if (group === 'beneficiario') key = expense.per_conto_di || 'Non indicato';
      const current = grouped.get(key) || { label: key, income: 0, expenses: 0, count: 0 };
      const amount = Number(expense.importo) || 0;
      if (expense.tipo === 'ingresso') current.income += amount;
      else current.expenses += amount;
      current.count += 1;
      grouped.set(key, current);
    });

    const summary = [...grouped.values()].map((item) => ({
      ...item,
      net: item.income - item.expenses,
    }));
    if (group === 'mese') {
      summary.sort((a, b) => a.label.localeCompare(b.label));
      summary.forEach((item) => {
        const [year, month] = item.label.split('-');
        item.label = `${MONTHS[Number(month) - 1]} ${year}`;
      });
    } else {
      summary.sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income));
    }

    const categories = [...new Set(allExpenses.map((expense) => expense.categoria).filter(Boolean))].sort();
    res.render('reports', {
      user: req.session.user,
      report: {
        from, to, category, type, group, title, heading, validRange,
        generatedAt: today,
        totals: { ...totals, net: totals.income - totals.expenses },
        summary,
        expenses: filtered.slice().sort((a, b) => b.data_spesa.localeCompare(a.data_spesa)),
      },
      categories,
    });
  } catch (error) {
    console.error('Errore generazione report:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nella generazione del report.'
    });
  }
});

module.exports = router;