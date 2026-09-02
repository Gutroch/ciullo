// routes/budget.js
const express = require('express');
const router = express.Router();
const Expenses = require('../models/expenses');
const Budget = require('../models/budget');
const { requireAuth } = require('../middleware/auth');

// Helper: raggruppa le spese per mese e calcola il netto (entrate - uscite)
function computeMonthlyNet(expenses, year) {
  const months = Array(12).fill(0);
  expenses.forEach(e => {
    const d = new Date(e.data_spesa);
    if (d.getFullYear() === year) {
      const month = d.getMonth(); // 0-based
      const amount = e.tipo === 'ingresso' ? e.importo : -e.importo;
      months[month] += amount;
    }
  });
  return months; // array di 12 numeri
}

// GET /budget?year=...
router.get('/', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const allExpenses = await Expenses.getAllExpenses();

    // Calcola netto reale per ogni mese
    const realNet = computeMonthlyNet(allExpenses, year);

    // Leggi budget previsto per quest'anno
    const budgetData = await Budget.getBudget(year);

    // Prepara i dati per la vista
    const monthsData = [];
    let totalPrevisto = 0, totalReale = 0;
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    for (let m = 0; m < 12; m++) {
      const previsto = budgetData[m] !== undefined ? budgetData[m] : 0;
      const reale = realNet[m] || 0;
      const differenza = reale - previsto; // differenza del mese
      totalPrevisto += previsto;
      totalReale += reale;
      monthsData.push({
        month: m + 1,
        label: monthNames[m] + '-' + String(year).slice(-2),
        previsto: previsto,
        reale: reale,
        differenza: differenza
      });
    }

    // Anni disponibili per il filtro (da tutti i dati)
    const anniDisponibili = [...new Set(allExpenses.map(e => new Date(e.data_spesa).getFullYear()))].sort((a, b) => b - a);
    if (!anniDisponibili.includes(year) && allExpenses.length > 0) {
      anniDisponibili.push(year); // aggiunge l'anno selezionato se non presente
      anniDisponibili.sort((a, b) => b - a);
    }

    res.render('budget', {
      user: req.session.user,
      year: year,
      anniDisponibili,
      months: monthsData,
      totalPrevisto: totalPrevisto,
      totalReale: totalReale,
      totalDifferenza: totalPrevisto - totalReale,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('❌ Errore caricamento budget:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel caricamento del budget.'
    });
  }
});

// POST /budget/update – aggiorna tutti i campi previsto
router.post('/update', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.body.year);
    const data = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (key.startsWith('previsto_')) {
        const month = parseInt(key.split('_')[1]);
        if (!isNaN(month) && month >= 1 && month <= 12) {
          data[month - 1] = parseFloat(value) || 0;
        }
      }
    }
    await Budget.setAllBudget(year, data);
    res.redirect(`/budget?year=${year}&success=1`);
  } catch (error) {
    console.error('❌ Errore aggiornamento budget:', error);
    res.redirect(`/budget?year=${req.body.year}&error=1`);
  }
});

module.exports = router;