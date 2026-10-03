const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const jonnyAgent = require('../services/jonnyAgent');
const { applyConfirmedAction } = require('../services/jonnyTools');
const { JonnyConversations } = require('../models/jonnyConversations');

function getUserId(req) {
  return req.session.user.id || req.session.user.username;
}

function summarizeConversations(conversations) {
  return conversations.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

function setActiveConversation(req, conversation) {
  req.session.jonnyConversationId = conversation.id;
  req.session.jonnyHistory = conversation.messages || [];
  req.session.jonnyPendingAction = null;
}

// Pagina principale della sezione Jonny
router.get('/', requireAuth, (req, res) => {
  res.render('jonny', {
    user: req.session.user,
    active: 'jonny'
  });
});

router.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    let conversations = await JonnyConversations.list(userId);
    let active = conversations.find((item) => item.id === req.session.jonnyConversationId);

    if (!active && conversations.length === 0) {
      const created = await JonnyConversations.create(userId);
      conversations = created.conversations;
      active = created.conversation;
      const previousHistory = req.session.jonnyHistory;
      if (Array.isArray(previousHistory) && previousHistory.length > 0) {
        const firstUserMessage = previousHistory.find((item) => item.role === 'user');
        active = await JonnyConversations.update(
          userId,
          active.id,
          previousHistory,
          firstUserMessage && firstUserMessage.content
        ) || active;
        conversations = await JonnyConversations.list(userId);
      }
    } else if (!active) {
      active = conversations[0];
    }

    req.session.jonnyPendingAction = null;
    req.session.jonnyConversationId = active.id;
    req.session.jonnyHistory = active.messages || [];

    res.json({
      success: true,
      conversations: summarizeConversations(conversations),
      activeConversationId: active.id,
      messages: active.messages || [],
    });
  } catch (error) {
    console.error(' Errore lettura cronologia Jonny:', error);
    res.status(500).json({ success: false, error: 'Impossibile caricare la cronologia.' });
  }
});

router.post('/api/conversations', requireAuth, async (req, res) => {
  try {
    const created = await JonnyConversations.create(getUserId(req));
    setActiveConversation(req, created.conversation);
    res.json({
      success: true,
      conversations: summarizeConversations(created.conversations),
      activeConversationId: created.conversation.id,
      messages: [],
    });
  } catch (error) {
    console.error(' Errore creazione conversazione Jonny:', error);
    res.status(500).json({ success: false, error: 'Impossibile creare una nuova conversazione.' });
  }
});

router.post('/api/conversations/:id/select', requireAuth, async (req, res) => {
  try {
    const conversation = await JonnyConversations.find(getUserId(req), req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversazione non trovata.' });
    }

    setActiveConversation(req, conversation);
    res.json({ success: true, activeConversationId: conversation.id, messages: conversation.messages || [] });
  } catch (error) {
    console.error(' Errore apertura conversazione Jonny:', error);
    res.status(500).json({ success: false, error: 'Impossibile aprire la conversazione.' });
  }
});

router.post('/api/chat', requireAuth, async (req, res) => {
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ success: false, error: 'Messaggio vuoto' });
  }

  try {
    const userId = getUserId(req);
    let conversation = await JonnyConversations.find(userId, req.session.jonnyConversationId);
    if (!conversation) {
      const created = await JonnyConversations.create(userId);
      conversation = created.conversation;
      setActiveConversation(req, conversation);
    }

    const result = await jonnyAgent.chat(conversation.messages || [], message, req.session.user);
    const title = conversation.title === 'Nuova conversazione' ? message : undefined;
    conversation = await JonnyConversations.update(userId, conversation.id, result.history, title);
    if (!conversation) throw new Error('Conversazione non più disponibile');
    req.session.jonnyHistory = conversation.messages;

    if (result.requiresConfirmation) {
      // Salviamo la proposta in sessione: NON è ancora stata eseguita.
      req.session.jonnyPendingAction = result.pendingAction;
      return res.json({
        success: true,
        reply: result.reply,
        requiresConfirmation: true,
        confirmationText: result.reply,
        conversations: summarizeConversations(await JonnyConversations.list(userId)),
      });
    }

    // Nessuna azione in sospeso: puliamo eventuali residui precedenti.
    req.session.jonnyPendingAction = null;
    res.json({
      success: true,
      reply: result.reply,
      conversations: summarizeConversations(await JonnyConversations.list(userId)),
    });
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
    try {
      await JonnyConversations.update(getUserId(req), req.session.jonnyConversationId, req.session.jonnyHistory);
    } catch (error) {
      console.error(' Errore salvataggio cronologia Jonny:', error);
    }
    const conversations = await JonnyConversations.list(getUserId(req)).catch(() => []);
    return res.json({
      success: true,
      reply,
      conversations: summarizeConversations(conversations),
    });
  }

  try {
    await applyConfirmedAction(pendingAction);
    const reply = 'Fatto! Ho applicato la modifica come richiesto.';
    req.session.jonnyHistory = [...(req.session.jonnyHistory || []), { role: 'assistant', content: reply }];
    try {
      await JonnyConversations.update(getUserId(req), req.session.jonnyConversationId, req.session.jonnyHistory);
    } catch (error) {
      console.error(' Errore salvataggio cronologia Jonny:', error);
    }
    const conversations = await JonnyConversations.list(getUserId(req)).catch(() => []);
    res.json({ success: true, reply, conversations: summarizeConversations(conversations) });
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
  JonnyConversations.create(getUserId(req))
    .then(({ conversation, conversations }) => {
      setActiveConversation(req, conversation);
      res.json({
        success: true,
        conversations: summarizeConversations(conversations),
        activeConversationId: conversation.id,
        messages: [],
      });
    })
    .catch((error) => {
      console.error(' Errore reset conversazione Jonny:', error);
      res.status(500).json({ success: false, error: 'Impossibile creare una nuova conversazione.' });
    });
});

module.exports = router;
