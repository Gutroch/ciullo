// routes/promemoria.js
const express = require('express');
const router = express.Router();
const PromemoriaModel = require('../models/promemoriaModel');

// Middleware di autenticazione (se usi sessioni)
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

// Pagina principale - lista promemoria
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const promemoria = await PromemoriaModel.findAll();
    res.render('promemoria', {
      user: req.session.user,
      promemoria: promemoria,
      active: 'promemoria'
    });
  } catch (error) {
    console.error('Errore nel caricare i promemoria:', error);
    res.render('promemoria', {
      user: req.session.user,
      promemoria: [],
      error: 'Errore nel caricamento dei promemoria',
      active: 'promemoria'
    });
  }
});

// API: Salva (crea o aggiorna)
router.post('/api/save', isAuthenticated, async (req, res) => {
  try {
    const { id, descrizione, periodo, importo, scadenza, note } = req.body;
    
    if (!descrizione || !periodo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Descrizione e periodo sono obbligatori' 
      });
    }

    const promemoria = await PromemoriaModel.save({
      id: id || undefined,
      descrizione,
      periodo,
      importo: parseFloat(importo) || 0,
      scadenza: scadenza || null,
      note: note || ''
    });

    res.json({ success: true, promemoria });
  } catch (error) {
    console.error('Errore nel salvare il promemoria:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Errore interno' 
    });
  }
});

// API: Recupera un promemoria per modifica
router.get('/api/get/:id', isAuthenticated, async (req, res) => {
  try {
    const promemoria = await PromemoriaModel.findById(req.params.id);
    if (!promemoria) {
      return res.status(404).json({ success: false, error: 'Promemoria non trovato' });
    }
    res.json({ success: true, promemoria });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Elimina un promemoria
router.delete('/api/delete/:id', isAuthenticated, async (req, res) => {
  try {
    await PromemoriaModel.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Elimina tutti i promemoria
router.delete('/api/delete-all', isAuthenticated, async (req, res) => {
  try {
    await PromemoriaModel.deleteAll();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;