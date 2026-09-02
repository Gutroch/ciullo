const express = require('express');
const router = express.Router();
const Recurring = require('../models/recurring');
const Expenses = require('../models/expenses');
const Users = require('../models/users');
const { requireAuth } = require('../middleware/auth');

router.get('/recurring', requireAuth, async (req, res) => {
  try {
    // Applica eventuali scadenze prima di mostrare l'elenco
    await Recurring.processDueRecurring();

    const utenti = await Users.getAllUsers();
    const voci = await Recurring.getAll();

    res.render('recurring', {
      user: req.session.user,
      voci,
      utenti,
      categorie: Expenses.CATEGORIE,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error('❌ Errore caricamento ricorrenze:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel caricamento delle ricorrenze.'
    });
  }
});

// ---------------------------------------------------------------
// POST /recurring - Crea una nuova spesa/entrata ricorrente
// ---------------------------------------------------------------
router.post('/recurring', requireAuth, async (req, res) => {
  try {
    const { descrizione, importo, tipo, categoria, ricorrenza, giorno } = req.body;
    const inserito_da = req.body.inserito_da || req.session.user.username;
    const per_conto_di = req.body.per_conto_di || req.session.user.username;
    // I mesi arrivano come checkbox multipli: mesi=3&mesi=10
    let mesi = req.body.mesi || [];
    if (!Array.isArray(mesi)) mesi = [mesi];

    const utenti = await Users.getAllUsers();
    const voci = await Recurring.getAll();

    const importoValido = importo && !isNaN(parseFloat(importo)) && parseFloat(importo) > 0;
    const meseValido = ricorrenza !== 'mesi' || mesi.length > 0;

    if (!descrizione || !importoValido || !meseValido) {
      return res.status(400).render('recurring', {
        user: req.session.user,
        voci,
        utenti,
        categorie: Expenses.CATEGORIE,
        error: !meseValido
          ? 'Seleziona almeno un mese per una ricorrenza "Mesi specifici".'
          : 'Inserisci una descrizione e un importo valido maggiore di zero.',
        success: null,
      });
    }

    await Recurring.add({
      descrizione,
      importo,
      tipo,
      categoria,
      ricorrenza,
      mesi,
      giorno,
      inserito_da,
      per_conto_di,
    });

    // Ricarica i dati aggiornati
    const vociAggiornate = await Recurring.getAll();

    res.render('recurring', {
      user: req.session.user,
      voci: vociAggiornate,
      utenti,
      categorie: Expenses.CATEGORIE,
      error: null,
      success: 'Spesa ricorrente salvata correttamente!',
    });
  } catch (error) {
    console.error('❌ Errore creazione ricorrenza:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nella creazione della ricorrenza.'
    });
  }
});

// ---------------------------------------------------------------
// POST /recurring/:id/toggle - Attiva/disattiva una voce ricorrente
// ---------------------------------------------------------------
router.post('/recurring/:id/toggle', requireAuth, async (req, res) => {
  try {
    await Recurring.toggleAttivo(req.params.id);
    res.redirect('/recurring');
  } catch (error) {
    console.error('❌ Errore toggle ricorrenza:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nell\'aggiornamento della ricorrenza.'
    });
  }
});

// ---------------------------------------------------------------
// POST /recurring/:id/delete - Elimina una voce ricorrente
// ---------------------------------------------------------------
router.post('/recurring/:id/delete', requireAuth, async (req, res) => {
  try {
    await Recurring.remove(req.params.id);
    res.redirect('/recurring');
  } catch (error) {
    console.error('❌ Errore eliminazione ricorrenza:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nell\'eliminazione della ricorrenza.'
    });
  }
});

module.exports = router;