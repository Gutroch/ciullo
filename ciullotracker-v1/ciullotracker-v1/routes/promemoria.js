// routes/promemoria.js
const express = require('express');
const router = express.Router();
const PromemoriaModel = require('../models/promemoriaModel');
const { requireAuth } = require('../middleware/auth');

// Pagina principale - lista promemoria
router.get('/', requireAuth, async (req, res) => {
  try {
    const promemoria = await PromemoriaModel.findAll(req.session.user);
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
router.post('/api/save', requireAuth, async (req, res) => {
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
      note: note || '',
      userId: req.session.user.id,
      actor: req.session.user
    });

    if (!promemoria) return res.status(404).json({ success: false, error: 'Promemoria non trovato o accesso negato' });

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
router.get('/api/get/:id', requireAuth, async (req, res) => {
  try {
    const promemoria = await PromemoriaModel.findById(req.params.id, req.session.user);
    if (!promemoria) {
      return res.status(404).json({ success: false, error: 'Promemoria non trovato' });
    }
    res.json({ success: true, promemoria });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Elimina un promemoria
router.delete('/api/delete/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await PromemoriaModel.delete(req.params.id, req.session.user);
    if (!deleted) return res.status(404).json({ success: false, error: 'Promemoria non trovato' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Elimina tutti i promemoria
router.delete('/api/delete-all', requireAuth, async (req, res) => {
  try {
    await PromemoriaModel.deleteAll(req.session.user);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;