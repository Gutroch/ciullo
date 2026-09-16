// routes/jonny.js
// Sezione "Jonny": l'avatar reattivo con chat integrata.
// La grafica e il flusso della chat sono già funzionanti; il motore RAG
// vero e proprio non è ancora collegato, quindi l'endpoint risponde per
// ora con un messaggio predefinito che avvisa l'utente.
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Risposte "in arrivo": ne scegliamo una a caso per dare un minimo di
// varietà, ma sono tutte concettualmente lo stesso messaggio placeholder.
const COMING_SOON_REPLIES = [
  'Ciao, sono Jonny! Il mio cervello RAG è ancora in allenamento: presto potrò rispondere davvero alle tue domande su spese e budget. Torna a trovarmi a breve! 🚧',
  'Per ora sono solo una bella faccia 🙂 Il chatbot collegato ai tuoi dati arriva presto — nel frattempo puoi già provare l\'interfaccia della chat.',
  'Sto ancora imparando! Quando sarò collegato ai tuoi dati potrò aiutarti con le tue spese in tempo reale. A prestissimo!'
];

function pickReply() {
  return COMING_SOON_REPLIES[Math.floor(Math.random() * COMING_SOON_REPLIES.length)];
}

// Pagina principale della sezione Jonny
router.get('/', requireAuth, (req, res) => {
  res.render('jonny', {
    user: req.session.user,
    active: 'jonny'
  });
});

// Endpoint chat: per ora ignora il contenuto del messaggio e risponde
// sempre con l'avviso "in arrivo". Quando il RAG sarà pronto, qui andrà
// collegata la logica vera (retrieval sui dati dell'utente + generazione).
router.post('/api/chat', requireAuth, (req, res) => {
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ success: false, error: 'Messaggio vuoto' });
  }

  // Piccolo ritardo simulato per far vedere l'indicatore "sta scrivendo".
  setTimeout(() => {
    res.json({
      success: true,
      reply: pickReply(),
      comingSoon: true
    });
  }, 500 + Math.random() * 500);
});

module.exports = router;
