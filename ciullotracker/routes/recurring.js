const express = require('express');
const router = express.Router();
const Recurring = require('../models/recurring');
const Expenses = require('../models/expenses');
const Users = require('../models/users');
const { requireAuth } = require('../middleware/auth');

router.get('/recurring', requireAuth, async (req, res) => {
  try {
    await Recurring.processDueRecurring();

    const utenti = await Users.getAllUsers();
    const voci = await Recurring.getAll();

    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('recurring', {
      user: req.session.user,
      voci,
      utenti,
      categorieSpese: Expenses.CATEGORIE_SPESE,
      categorieEntrate: Expenses.CATEGORIE_ENTRATE,
      sottocategorieMap: Expenses.CATEGORIE_SPESE,
      error,
      success,
    });
  } catch (error) {
    console.error(' Errore caricamento ricorrenze:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nel caricamento delle ricorrenze.'
    });
  }
});


// POST /recurring - Crea una nuova spesa/entrata ricorrente

router.post('/recurring', requireAuth, async (req, res) => {
  try {
    const { descrizione, importo, tipo, categoria, ricorrenza, giorno, sottocategoria } = req.body;
    const inserito_da = req.body.inserito_da || req.session.user.username;
    const per_conto_di = req.body.per_conto_di || req.session.user.username;
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
        categorieSpese: Expenses.CATEGORIE_SPESE,
        categorieEntrate: Expenses.CATEGORIE_ENTRATE,
        sottocategorieMap: Expenses.CATEGORIE_SPESE,
        error: !meseValido
          ? 'Seleziona almeno un mese per una ricorrenza "Mesi specifici".'
          : 'Inserisci una descrizione e un importo valido maggiore di zero.',
        success: null,
      });
    }

    const newItem = await Recurring.add({
      descrizione,
      importo,
      tipo,
      categoria,
      sottocategoria: (tipo === 'uscita' && sottocategoria) ? sottocategoria : '',
      ricorrenza,
      mesi,
      giorno,
      inserito_da,
      per_conto_di,
    });

    // Gestione retroattività
    if (req.body.retroattiva === 'on' || req.body.retroattiva === 'true') {
      const oggi = new Date();
      const giornoNum = parseInt(giorno);
      const meseCorrente = oggi.getMonth() + 1;
      
      if (giornoNum <= oggi.getDate()) {
        let shouldRun = false;
        if (ricorrenza === 'mensile') {
          shouldRun = true;
        } else if (ricorrenza === 'mesi') {
          const mesiArr = Array.isArray(req.body.mesi) ? req.body.mesi : [req.body.mesi];
          shouldRun = mesiArr.map(Number).includes(meseCorrente);
        }
        // Per altri tipi di ricorrenza si potrebbe estendere
        if (shouldRun) {
          const dataSpesa = new Date(oggi.getFullYear(), oggi.getMonth(), giornoNum);
          await Recurring.execute(newItem, dataSpesa);
        }
      }
    }

    const vociAggiornate = await Recurring.getAll();

    res.render('recurring', {
      user: req.session.user,
      voci: vociAggiornate,
      utenti,
      categorieSpese: Expenses.CATEGORIE_SPESE,
      categorieEntrate: Expenses.CATEGORIE_ENTRATE,
      sottocategorieMap: Expenses.CATEGORIE_SPESE,
      error: null,
      success: 'Spesa ricorrente salvata correttamente!',
    });
  } catch (error) {
    console.error(' Errore creazione ricorrenza:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nella creazione della ricorrenza.'
    });
  }
});

// GET /recurring/:id/edit - Mostra il form di modifica
router.get('/recurring/:id/edit', requireAuth, async (req, res) => {
  try {
    const voce = await Recurring.getById(req.params.id);
    if (!voce) {
      return res.status(404).render('error', { 
        user: req.session.user, 
        message: 'Ricorrenza non trovata.' 
      });
    }
    
    const utenti = await Users.getAllUsers();
    res.render('recurring-edit', {
      user: req.session.user,
      voce,
      utenti,
      categorieSpese: Expenses.CATEGORIE_SPESE,
      categorieEntrate: Expenses.CATEGORIE_ENTRATE,
      sottocategorieMap: Expenses.CATEGORIE_SPESE,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error(' Errore caricamento modifica ricorrenza:', error);
    res.status(500).render('error', { 
      user: req.session.user, 
      message: 'Errore caricamento modifica.' 
    });
  }
});

// POST /recurring/:id/update - Aggiorna una ricorrenza
router.post('/recurring/:id/update', requireAuth, async (req, res) => {
  try {
    const { descrizione, importo, tipo, categoria, ricorrenza, giorno, sottocategoria } = req.body;
    const inserito_da = req.body.inserito_da || req.session.user.username;
    const per_conto_di = req.body.per_conto_di || req.session.user.username;
    let mesi = req.body.mesi || [];
    if (!Array.isArray(mesi)) mesi = [mesi];

    const importoValido = importo && !isNaN(parseFloat(importo)) && parseFloat(importo) > 0;
    const meseValido = ricorrenza !== 'mesi' || mesi.length > 0;

    if (!descrizione || !importoValido || !meseValido) {
      const voce = await Recurring.getById(req.params.id);
      const utenti = await Users.getAllUsers();
      return res.status(400).render('recurring-edit', {
        user: req.session.user,
        voce,
        utenti,
        categorieSpese: Expenses.CATEGORIE_SPESE,
        categorieEntrate: Expenses.CATEGORIE_ENTRATE,
        sottocategorieMap: Expenses.CATEGORIE_SPESE,
        error: !meseValido 
          ? 'Seleziona almeno un mese per ricorrenza "Mesi specifici".' 
          : 'Inserisci descrizione e importo valido.',
        success: null,
      });
    }

    const updated = await Recurring.update(req.params.id, {
      descrizione,
      importo,
      tipo,
      categoria,
      sottocategoria: (tipo === 'uscita' && sottocategoria) ? sottocategoria : '',
      ricorrenza,
      mesi,
      giorno,
      inserito_da,
      per_conto_di,
    });

    if (!updated) {
      throw new Error('Ricorrenza non trovata per update');
    }

    // --- Gestione retroattività anche in modifica ---
    if (req.body.retroattiva === 'on' || req.body.retroattiva === 'true') {
      const oggi = new Date();
      const giornoNum = parseInt(giorno);
      const meseCorrente = oggi.getMonth() + 1;
      
      // Verifica se il giorno è già passato
      if (giornoNum <= oggi.getDate()) {
        let shouldRun = false;
        
        if (ricorrenza === 'mensile') {
          shouldRun = true;
        } else if (ricorrenza === 'mesi') {
          const mesiArr = Array.isArray(req.body.mesi) ? req.body.mesi : [req.body.mesi];
          shouldRun = mesiArr.map(Number).includes(meseCorrente);
        }
        // Per altri tipi di ricorrenza si potrebbe estendere
        
        if (shouldRun) {
          // Recupera la voce appena aggiornata per eseguirla
          const itemToExecute = await Recurring.getById(req.params.id);
          if (itemToExecute) {
            const dataSpesa = new Date(oggi.getFullYear(), oggi.getMonth(), giornoNum);
            await Recurring.execute(itemToExecute, dataSpesa);
            console.log(`Esecuzione retroattiva per: ${itemToExecute.descrizione}`);
          }
        }
      }
    }

    res.redirect('/recurring?success=Modifica effettuata');
  } catch (error) {
    console.error('Errore update ricorrenza:', error);
    res.status(500).render('error', { 
      user: req.session.user, 
      message: 'Errore durante la modifica.' 
    });
  }
});

// POST /recurring/:id/toggle - Attiva/disattiva
router.post('/recurring/:id/toggle', requireAuth, async (req, res) => {
  try {
    await Recurring.toggleAttivo(req.params.id);
    res.redirect('/recurring');
  } catch (error) {
    console.error(' Errore toggle ricorrenza:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nell\'aggiornamento della ricorrenza.'
    });
  }
});

// POST /recurring/:id/delete - Elimina
router.post('/recurring/:id/delete', requireAuth, async (req, res) => {
  try {
    await Recurring.remove(req.params.id);
    res.redirect('/recurring');
  } catch (error) {
    console.error(' Errore eliminazione ricorrenza:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nell\'eliminazione della ricorrenza.'
    });
  }
});

module.exports = router;