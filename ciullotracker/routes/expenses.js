const express = require('express');
const router = express.Router();
const Expenses = require('../models/expenses');
const Users = require('../models/users');
const Recurring = require('../models/recurring');
const { requireAuth } = require('../middleware/auth');

// Helper: verifica se una data (ISO yyyy-mm-dd) appartiene al mese/anno indicati
function isInMonth(dateStr, month, year) {
  const d = new Date(dateStr);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
}

// ---------------------------------------------------------------
// GET / - Dashboard principale (mese corrente)
// ---------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Processa le spese ricorrenti scadute
    await Recurring.processDueRecurring();

    const all = await Expenses.getAllExpenses();
    const monthly = all.filter((e) => isInMonth(e.data_spesa, month, year));

    // Filtra uscite e ingressi del mese corrente
    const uscite = monthly.filter((e) => e.tipo !== 'ingresso');
    const ingressi = monthly.filter((e) => e.tipo === 'ingresso');

    // Calcoli totali
    const totale = uscite.reduce((sum, e) => sum + e.importo, 0);
    const totaleIngressi = ingressi.reduce((sum, e) => sum + e.importo, 0);
    const saldo = totaleIngressi - totale;

    // Categoria con la spesa più alta (solo uscite)
    const perCategoria = {};
    uscite.forEach((e) => {
      perCategoria[e.categoria] = (perCategoria[e.categoria] || 0) + e.importo;
    });
    let topCategoria = '—';
    let maxCat = -1;
    Object.entries(perCategoria).forEach(([cat, val]) => {
      if (val > maxCat) {
        maxCat = val;
        topCategoria = cat;
      }
    });

    // Utente con la spesa più alta
    const perUtente = {};
    uscite.forEach((e) => {
      perUtente[e.per_conto_di] = (perUtente[e.per_conto_di] || 0) + e.importo;
    });
    let topUtente = '—';
    let maxUser = -1;
    Object.entries(perUtente).forEach(([u, val]) => {
      if (val > maxUser) {
        maxUser = val;
        topUtente = u;
      }
    });

    // Ultime 10 spese del mese
    const ultimeSpese = monthly.slice(0, 10);

    // ===== DATI PER GRAFICI =====

// 1. Grafico categorie: separa ingressi e uscite
const macroUscite = {};
const macroIngressi = {};
monthly.forEach((e) => {
  const bucket = e.tipo === 'ingresso' ? macroIngressi : macroUscite;
  bucket[e.categoria] = (bucket[e.categoria] || 0) + e.importo;
});

const chartCategorie = {
  uscite: {
    labels: Object.keys(macroUscite),
    data: Object.values(macroUscite).map(v => parseFloat(v.toFixed(2)))
  },
  ingressi: {
    labels: Object.keys(macroIngressi),
    data: Object.values(macroIngressi).map(v => parseFloat(v.toFixed(2)))
  }
};

// 2. Grafico sottocategorie: per ogni macrocategoria, somma per sottocategoria
const subUscite = {};
const subIngressi = {};
monthly.forEach((e) => {
  if (!e.sottocategoria) return;
  const bucket = e.tipo === 'ingresso' ? subIngressi : subUscite;
  if (!bucket[e.categoria]) bucket[e.categoria] = {};
  bucket[e.categoria][e.sottocategoria] = 
    (bucket[e.categoria][e.sottocategoria] || 0) + e.importo;
});

function packSub(bucket) {
  const out = {};
  Object.keys(bucket).forEach(cat => {
    out[cat] = {
      labels: Object.keys(bucket[cat]),
      data: Object.values(bucket[cat]).map(v => parseFloat(v.toFixed(2)))
    };
  });
  return out;
}

const chartSottocategorie = {
  uscite: packSub(subUscite),
  ingressi: packSub(subIngressi)
};

// 3. Grafico giornaliero (invariato)
const giorniNelMese = new Date(year, month, 0).getDate();
const perGiornoUscite = Array(giorniNelMese).fill(0);
const perGiornoIngressi = Array(giorniNelMese).fill(0);
uscite.forEach((e) => {
  const giorno = new Date(e.data_spesa).getDate();
  if (giorno >= 1 && giorno <= giorniNelMese) perGiornoUscite[giorno - 1] += e.importo;
});
ingressi.forEach((e) => {
  const giorno = new Date(e.data_spesa).getDate();
  if (giorno >= 1 && giorno <= giorniNelMese) perGiornoIngressi[giorno - 1] += e.importo;
});
const chartGiornaliero = {
  labels: Array.from({ length: giorniNelMese }, (_, i) => String(i + 1)),
  dataUscite: perGiornoUscite.map((v) => parseFloat(v.toFixed(2))),
  dataIngressi: perGiornoIngressi.map((v) => parseFloat(v.toFixed(2))),
};

// 4. Trend mensile (invariato)
const trendData = [];
const trendIngressi = [];
const trendLabels = [];
for (let i = 5; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  const monthTrend = d.getMonth() + 1;
  const yearTrend = d.getFullYear();
  const monthExpenses = all.filter(e => isInMonth(e.data_spesa, monthTrend, yearTrend));
  const usciteTrend = monthExpenses.filter(e => e.tipo !== 'ingresso');
  const ingressiTrend = monthExpenses.filter(e => e.tipo === 'ingresso');
  trendData.push(usciteTrend.reduce((sum, e) => sum + e.importo, 0));
  trendIngressi.push(ingressiTrend.reduce((sum, e) => sum + e.importo, 0));
  trendLabels.push(d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }));
}
const chartTrend = {
  labels: trendLabels,
  dataUscite: trendData.map(v => parseFloat(v.toFixed(2))),
  dataIngressi: trendIngressi.map(v => parseFloat(v.toFixed(2))),
};

    // Distribuzione per utente (tutte le uscite dell'anno in corso)
    const perUtenteAll = {};
    all.filter(e => e.tipo !== 'ingresso').forEach(e => {
      const key = e.per_conto_di || 'Sconosciuto';
      perUtenteAll[key] = (perUtenteAll[key] || 0) + e.importo;
    });
    const chartUtenti = {
      labels: Object.keys(perUtenteAll),
      data: Object.values(perUtenteAll).map(v => parseFloat(v.toFixed(2))),
    };

    // Distribuzione per categoria (tutte le uscite dell'anno in corso)
    const perCategoriaAll = {};
    all.filter(e => e.tipo !== 'ingresso').forEach(e => {
      perCategoriaAll[e.categoria] = (perCategoriaAll[e.categoria] || 0) + e.importo;
    });
    const chartCategorieAll = {
      labels: Object.keys(perCategoriaAll),
      data: Object.values(perCategoriaAll).map(v => parseFloat(v.toFixed(2))),
    };

    // Statistiche aggiuntive
    const numeroMovimenti = monthly.length;
    const numeroUscite = uscite.length;
    const numeroIngressi = ingressi.length;
    const spesaMediaGiornaliera = giorniNelMese > 0 ? totale / giorniNelMese : 0;
    const entrataMediaGiornaliera = giorniNelMese > 0 ? totaleIngressi / giorniNelMese : 0;

    // Spesa per giorno della settimana
    const giorniSettimana = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const perGiornoSettimana = Array(7).fill(0);
    uscite.forEach((e) => {
      const giorno = new Date(e.data_spesa).getDay();
      perGiornoSettimana[giorno] += e.importo;
    });
    const chartSettimana = {
      labels: giorniSettimana,
      data: perGiornoSettimana.map(v => parseFloat(v.toFixed(2))),
    };

    // Prossime scadenze (7 giorni)
    const prossimeScadenze = await Recurring.getUpcoming(7);

    // Mese label formattata
    const meseLabel = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    res.render('dashboard', {
      user: req.session.user,
      // KPI principali
      totale: totale.toFixed(2),
      totaleIngressi: totaleIngressi.toFixed(2),
      saldo: saldo.toFixed(2),
      topCategoria,
      topUtente,
      // Liste
      ultimeSpese,
      prossimeScadenze,
      // Grafici
      chartCategorie,
      chartSottocategorie,
      chartGiornaliero,
      chartTrend,
      chartUtenti,
      chartCategorieAll,
      chartSettimana,
      // Statistiche aggiuntive
      numeroMovimenti,
      numeroUscite,
      numeroIngressi,
      spesaMediaGiornaliera: spesaMediaGiornaliera.toFixed(2),
      entrataMediaGiornaliera: entrataMediaGiornaliera.toFixed(2),
      meseLabel,
    });
  } catch (error) {
    console.error('❌ Errore dashboard:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel caricamento della dashboard.'
    });
  }
});

// ---------------------------------------------------------------
// GET /expenses/new - Form di inserimento nuova spesa
// ---------------------------------------------------------------
router.get('/expenses/new', requireAuth, async (req, res) => {
  try {
    const utenti = await Users.getAllUsers();
    res.render('new-expense', {
      user: req.session.user,
      utenti,
      categorieSpese: Expenses.CATEGORIE_SPESE,
      categorieEntrate: Expenses.CATEGORIE_ENTRATE,
      sottocategorieMap: Expenses.CATEGORIE_SPESE,
      oggi: new Date().toISOString().slice(0, 10),
      error: null,
      success: null,
      expense: null,
      editMode: false, // 👈 AGGIUNGI QUESTA RIGA
    });
  } catch (error) {
    console.error('❌ Errore form nuova spesa:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel caricamento del form.'
    });
  }
});

// ---------------------------------------------------------------
// POST /expenses - Salvataggio nuova spesa
// ---------------------------------------------------------------
router.post('/expenses', requireAuth, async (req, res) => {
  try {
    const { importo, data_spesa, categoria, note, tipo, sottocategoria } = req.body;
    const tipoFinale = tipo === 'ingresso' ? 'ingresso' : 'uscita';
    const inserito_da = req.body.inserito_da || req.session.user.username;
    const per_conto_di = req.body.per_conto_di || req.session.user.username;

    const utenti = await Users.getAllUsers();

    if (!importo || isNaN(parseFloat(importo)) || parseFloat(importo) <= 0) {
      return res.status(400).render('new-expense', {
        user: req.session.user,
        utenti,
        categorieSpese: Expenses.CATEGORIE_SPESE,
        categorieEntrate: Expenses.CATEGORIE_ENTRATE,
        sottocategorieMap: Expenses.CATEGORIE_SPESE,
        oggi: new Date().toISOString().slice(0, 10),
        error: "Inserisci un importo valido maggiore di zero.",
        success: null,
        expense: null,
      });
    }

    await Expenses.addExpense({
      data_spesa: data_spesa || new Date().toISOString().slice(0, 10),
      importo,
      tipo: tipoFinale,
      categoria,
      sottocategoria: (tipoFinale === 'uscita' && sottocategoria) ? sottocategoria : '',
      inserito_da,
      per_conto_di,
      note,
    });

    res.render('new-expense', {
      user: req.session.user,
      utenti,
      categorieSpese: Expenses.CATEGORIE_SPESE,
      categorieEntrate: Expenses.CATEGORIE_ENTRATE,
      sottocategorieMap: Expenses.CATEGORIE_SPESE,
      oggi: new Date().toISOString().slice(0, 10),
      error: null,
      success: 'Spesa registrata correttamente!',
      expense: null,
    });
  } catch (error) {
    console.error('❌ Errore salvataggio spesa:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel salvataggio della spesa.'
    });
  }
});

// ---------------------------------------------------------------
// GET /expenses/:id/edit - Form di modifica
// ---------------------------------------------------------------
router.get('/expenses/:id/edit', requireAuth, async (req, res) => {
  try {
    const all = await Expenses.getAllExpenses();
    const expense = all.find(e => e.id === req.params.id);
    if (!expense) {
      return res.status(404).render('error', {
        user: req.session.user,
        message: 'Spesa non trovata.'
      });
    }
    const utenti = await Users.getAllUsers();
    res.render('new-expense', {
      user: req.session.user,
      utenti,
      categorieSpese: Expenses.CATEGORIE_SPESE,
      categorieEntrate: Expenses.CATEGORIE_ENTRATE,
      sottocategorieMap: Expenses.CATEGORIE_SPESE,
      oggi: new Date().toISOString().slice(0, 10),
      error: null,
      success: null,
      expense: expense, // precompila il form
      editMode: true,
    });
  } catch (error) {
    console.error('❌ Errore form modifica:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel caricamento del form di modifica.'
    });
  }
});

// ---------------------------------------------------------------
// POST /expenses/:id/update - Aggiorna una spesa
// ---------------------------------------------------------------
router.post('/expenses/:id/update', requireAuth, async (req, res) => {
  try {
    const { importo, data_spesa, categoria, note, tipo, sottocategoria } = req.body;
    const tipoFinale = tipo === 'ingresso' ? 'ingresso' : 'uscita';
    const inserito_da = req.body.inserito_da || req.session.user.username;
    const per_conto_di = req.body.per_conto_di || req.session.user.username;

    if (!importo || isNaN(parseFloat(importo)) || parseFloat(importo) <= 0) {
      // Se errore, mostriamo di nuovo il form di modifica con i dati vecchi
      const all = await Expenses.getAllExpenses();
      const expense = all.find(e => e.id === req.params.id);
      const utenti = await Users.getAllUsers();
      return res.status(400).render('new-expense', {
        user: req.session.user,
        utenti,
        categorieSpese: Expenses.CATEGORIE_SPESE,
        categorieEntrate: Expenses.CATEGORIE_ENTRATE,
        sottocategorieMap: Expenses.CATEGORIE_SPESE,
        oggi: new Date().toISOString().slice(0, 10),
        error: "Inserisci un importo valido maggiore di zero.",
        success: null,
        expense: expense,
        editMode: true,
      });
    }

    await Expenses.updateExpense(req.params.id, {
      data_spesa: data_spesa || new Date().toISOString().slice(0, 10),
      importo,
      tipo: tipoFinale,
      categoria,
      sottocategoria: (tipoFinale === 'uscita' && sottocategoria) ? sottocategoria : '',
      inserito_da,
      per_conto_di,
      note,
    });

    // Reindirizza alla pagina da cui si proveniva (history o dashboard)
    const referer = req.headers.referer || '/history';
    res.redirect(referer);
  } catch (error) {
    console.error('❌ Errore aggiornamento spesa:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nell\'aggiornamento della spesa.'
    });
  }
});

// ---------------------------------------------------------------
// GET /history - Storico con filtri (incluso sottocategoria)
// ---------------------------------------------------------------
router.get('/history', requireAuth, async (req, res) => {
  try {
    const all = await Expenses.getAllExpenses();
    const { mese, anno, categoria, sottocategoria } = req.query;

    let filtered = all;
    if (mese) filtered = filtered.filter((e) => new Date(e.data_spesa).getMonth() + 1 === parseInt(mese, 10));
    if (anno) filtered = filtered.filter((e) => new Date(e.data_spesa).getFullYear() === parseInt(anno, 10));
    if (categoria) filtered = filtered.filter((e) => e.categoria === categoria);
    if (sottocategoria) filtered = filtered.filter((e) => e.sottocategoria === sottocategoria);

    const anniDisponibili = [...new Set(all.map((e) => new Date(e.data_spesa).getFullYear()))].sort((a, b) => b - a);
    const categorieDisponibili = [...new Set(all.map((e) => e.categoria))].sort();
    const sottocategorieDisponibili = [...new Set(all.map((e) => e.sottocategoria).filter(s => s))].sort();

    res.render('history', {
      user: req.session.user,
      expenses: filtered,
      categorie: Object.keys(Expenses.CATEGORIE_SPESE), // 👈 MODIFICA QUESTA RIGA
      anniDisponibili,
      categorieDisponibili,
      sottocategorieDisponibili,
      filtri: { mese: mese || '', anno: anno || '', categoria: categoria || '', sottocategoria: sottocategoria || '' },
    });
  } catch (error) {
    console.error('❌ Errore storico:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel caricamento dello storico.'
    });
  }
});

// ---------------------------------------------------------------
// POST /expenses/:id/delete - Elimina una spesa
// ---------------------------------------------------------------
router.post('/expenses/:id/delete', requireAuth, async (req, res) => {
  try {
    await Expenses.deleteExpense(req.params.id);
    res.redirect('back');
  } catch (error) {
    console.error('❌ Errore eliminazione spesa:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nell\'eliminazione della spesa.'
    });
  }
});

// POST /expenses/:id/update-amount - Aggiornamento rapido importo (AJAX)
router.post('/expenses/:id/update-amount', requireAuth, async (req, res) => {
  try {
    const { importo } = req.body;
    const id = req.params.id;
    
    if (!importo || isNaN(parseFloat(importo)) || parseFloat(importo) <= 0) {
      return res.status(400).json({ success: false, error: 'Importo non valido' });
    }
    
    const all = await Expenses.getAllExpenses();
    const expense = all.find(e => e.id === id);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Spesa non trovata' });
    }
    
    await Expenses.updateExpense(id, {
      ...expense,
      importo: parseFloat(importo)
    });
    
    res.json({ 
      success: true, 
      isIngresso: expense.tipo === 'ingresso',
      newAmount: parseFloat(importo)
    });
  } catch (error) {
    console.error('❌ Errore aggiornamento rapido:', error);
    res.status(500).json({ success: false, error: 'Errore del server' });
  }
});

module.exports = router;