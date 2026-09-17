const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const jonnyAgent = require('../services/jonnyAgent');
const { applyConfirmedAction } = require('../services/jonnyTools');

// Pagina principale della sezione Jonny
router.get('/', requireAuth, (req, res) => {
  res.render('jonny', {
    user: req.session.user,
    active: 'jonny'
  });
});

router.post('/api/chat', requireAuth, async (req, res) => {
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ success: false, error: 'Messaggio vuoto' });
  }

  // Piccola cronologia di conversazione, tenuta in sessione così ogni
  // utente/famiglia ha la propria chat indipendente.
  const history = req.session.jonnyHistory || [];

  try {
    const result = await jonnyAgent.chat(history, message, req.session.user);
    req.session.jonnyHistory = result.history;

    if (result.requiresConfirmation) {
      // Salviamo la proposta in sessione: NON è ancora stata eseguita.
      req.session.jonnyPendingAction = result.pendingAction;
      return res.json({
        success: true,
        reply: result.reply,
        requiresConfirmation: true,
        confirmationText: result.reply,
      });
    }

    // Nessuna azione in sospeso: puliamo eventuali residui precedenti.
    req.session.jonnyPendingAction = null;
    res.json({ success: true, reply: result.reply });
  } catch (error) {
    console.error(' Errore chat Jonny:', error);

    if (error.code === 'NO_API_KEY') {
      return res.json({
        success: true,
        reply: 'Il mio motore non è ancora configurato (manca la chiave API). Chiedi a un amministratore di impostare GROQ_API_KEY.',
      });
    }

    res.status(500).json({
      success: false,
      reply: 'Qualcosa è andato storto mentre elaboravo la risposta. Riprova tra poco.',
    });
  }
});

// Conferma o annulla l'azione di scrittura proposta da Jonny.
// Questo è l'UNICO punto in cui i dati vengono davvero modificati.
router.post('/api/confirm', requireAuth, async (req, res) => {
  const pendingAction = req.session.jonnyPendingAction;
  const confirmed = req.body.confirm === true;

  if (!pendingAction) {
    return res.json({ success: true, reply: 'Non c\'è nessuna azione in sospeso da confermare.' });
  }

  // In ogni caso (conferma o annulla) la proposta va rimossa dalla sessione.
  req.session.jonnyPendingAction = null;

  if (!confirmed) {
    const reply = 'Ok, ho annullato: non ho modificato nulla.';
    req.session.jonnyHistory = [...(req.session.jonnyHistory || []), { role: 'assistant', content: reply }];
    return res.json({ success: true, reply });
  }

  try {
    await applyConfirmedAction(pendingAction);
    const reply = 'Fatto! Ho applicato la modifica come richiesto.';
    req.session.jonnyHistory = [...(req.session.jonnyHistory || []), { role: 'assistant', content: reply }];
    res.json({ success: true, reply });
  } catch (error) {
    console.error(' Errore applicazione azione confermata da Jonny:', error);
    res.status(500).json({
      success: false,
      reply: 'Non sono riuscito ad applicare la modifica. Riprova o effettuala manualmente dall\'app.',
    });
  }
});

// Reset della conversazione (utile per ripartire da zero)
router.post('/api/reset', requireAuth, (req, res) => {
  req.session.jonnyHistory = [];
  req.session.jonnyPendingAction = null;
  res.json({ success: true });
});

module.exports = router;
