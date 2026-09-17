// services/jonnyAgent.js
// Loop agentico di Jonny: questo è il cuore del RAG.
//
// 1) Costruiamo un system prompt con la "conoscenza statica" (chi è Jonny,
//    le categorie disponibili, come si usano le sezioni dell'app).
// 2) Mandiamo al modello (Groq) la conversazione + la lista di tool
//    disponibili (services/jonnyTools.js).
// 3) Se il modello chiede di chiamare uno o più tool, li eseguiamo
//    DAVVERO sui dati reali (Redis) e rimandiamo il risultato al modello.
// 4) Ripetiamo finché il modello non produce una risposta testuale finale.
//
// Questo è il "retrieval" del RAG: non è un vector database, sono query
// mirate sui dati strutturati, decise dinamicamente dal modello stesso.

const { chatCompletion } = require('./groqClient');
const { TOOLS, EXECUTORS, WRITE_TOOL_NAMES, WRITE_EXECUTORS } = require('./jonnyTools');
const Expenses = require('../models/expenses');

const MAX_TOOL_ITERATIONS = 4; // limite di sicurezza contro loop infiniti
const MAX_HISTORY_MESSAGES = 12; // quanti messaggi di storico conversazione teniamo

function buildCategorieText() {
  const uscite = Object.entries(Expenses.CATEGORIE_SPESE)
    .map(([cat, sub]) => `- ${cat}: ${sub.join(', ')}`)
    .join('\n');
  const entrate = Expenses.CATEGORIE_ENTRATE.join(', ');
  return `Categorie di USCITA disponibili (usa questi nomi esatti quando chiami i tool):\n${uscite}\n\nCategorie di ENTRATA disponibili: ${entrate}`;
}

function buildSystemPrompt(user) {
  const oggi = new Date().toISOString().slice(0, 10);
  return `Sei Jonny, l'assistente virtuale di CiulloTracker, un'app di gestione delle spese familiari.
Rispondi sempre in italiano, in modo colloquiale, chiaro e conciso. Il messaggio viene mostrato come testo semplice in una bolla di chat: NON usare markdown (niente **, #, tabelle); se serve elencare punti usa righe con un trattino "-".

Data di oggi: ${oggi}.
Utente che ti sta scrivendo: ${user && user.username ? user.username : 'utente'}.

REGOLE IMPORTANTI:
- Per qualsiasi domanda su importi, spese, entrate, categorie o periodi specifici, usa SEMPRE il tool query_expenses per recuperare i dati reali. Non inventare mai cifre.
- Per domande sul budget/andamento rispetto al previsto, usa il tool get_budget_status.
- Se l'utente chiede di AGGIUNGERE, MODIFICARE o ELIMINARE una spesa/entrata, usa rispettivamente propose_add_expense, propose_update_expense o propose_delete_expense. Questi tool NON scrivono nulla subito: preparano solo una proposta che l'utente dovrà confermare in un popup. Dopo averli chiamati NON dire mai "fatto" o "ho aggiunto/eliminato": la richiesta è solo in attesa di conferma, sarà l'app a informare l'utente dell'esito.
- Per modificare o eliminare una spesa specifica, prima trova il suo "id" con query_expenses, poi usalo nel tool di modifica/eliminazione.
- Se una domanda è generica (consigli di risparmio, spiegazioni su come usare l'app) puoi rispondere direttamente senza tool.
- Se dopo aver usato i tool i dati non bastano per rispondere con certezza, dillo onestamente invece di inventare.
- Gli importi sono in euro: formattali con la virgola decimale e il simbolo €, es. 45,50 €.

${buildCategorieText()}

COME SI FA (usa queste informazioni per rispondere a domande "come si fa a..."):
- Aggiungere una nuova spesa o entrata: menu "Nuovo" oppure pagina /expenses/new.
- Vedere lo storico completo ed esportare i dati (CSV/Excel/JSON): pagina /history.
- Gestire spese ricorrenti (es. abbonamenti, mutuo): pagina /recurring.
- Impostare o modificare il budget previsto mese per mese: pagina /budget ("Annuali").
- Creare promemoria: pagina /promemoria.
- La dashboard principale con la panoramica generale è nella home "/".`;
}

/**
 * Gestisce un turno di conversazione con Jonny.
 * @param {Array} history - storico messaggi precedenti [{role, content}]
 * @param {string} userMessage - nuovo messaggio dell'utente
 * @param {Object} user - utente loggato (req.session.user)
 * @returns {Promise<{reply: string, history: Array}>}
 */
async function chat(history, userMessage, user) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(user) },
    ...history,
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1;

    const assistantMessage = await chatCompletion({
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });

    // Nessuna chiamata a tool: abbiamo la risposta finale.
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const replyText = (assistantMessage.content || '').trim() ||
        'Non sono riuscito a formulare una risposta, prova a riformulare la domanda.';

      const newHistory = [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: replyText },
      ].slice(-MAX_HISTORY_MESSAGES);

      return { reply: replyText, history: newHistory };
    }

    // Il modello vuole chiamare uno o più tool: li eseguiamo davvero.
    messages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      const fnName = toolCall.function && toolCall.function.name;
      let args = {};
      try {
        args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
      } catch (e) {
        args = {};
      }

      // --- Tool di SCRITTURA: mai eseguiti direttamente. -------------
      // Prepariamo solo un'anteprima ("pending action") e interrompiamo
      // subito il ciclo: la scrittura vera avverrà solo se/quando
      // l'utente conferma esplicitamente nel popup lato client
      // (vedi routes/jonny.js -> POST /api/confirm).
      if (WRITE_TOOL_NAMES.has(fnName)) {
        const preview = await WRITE_EXECUTORS[fnName](args);

        if (preview.error) {
          // Errore di validazione (es. importo mancante): lo rimandiamo
          // al modello come risultato del tool, così può correggersi.
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(preview) });
          continue;
        }

        const introTesto = (assistantMessage.content || '').trim();
        const newHistory = [
          ...history,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: `${introTesto ? introTesto + ' ' : ''}${preview.description}` },
        ].slice(-MAX_HISTORY_MESSAGES);

        return {
          reply: preview.description,
          history: newHistory,
          requiresConfirmation: true,
          pendingAction: preview.pending_action,
        };
      }

      // --- Tool di LETTURA: eseguiti subito, sono sicuri. ------------
      const executor = EXECUTORS[fnName];
      let resultPayload;
      if (!executor) {
        resultPayload = { error: `Tool sconosciuto: ${fnName}` };
      } else {
        try {
          resultPayload = await executor(args);
        } catch (e) {
          console.error(' Errore esecuzione tool Jonny:', fnName, e.message);
          resultPayload = { error: `Errore durante il recupero dei dati: ${e.message}` };
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(resultPayload),
      });
    }
    // Torniamo in cima al ciclo: il modello ora vede i risultati dei tool
    // e può decidere se rispondere o chiamare altri tool.
  }

  // Troppe iterazioni senza una risposta finale: fallback prudente.
  const fallback = 'Ho trovato troppi dati da elaborare per rispondere con precisione: prova a restringere la domanda (es. un mese o una categoria specifica).';
  const newHistory = [
    ...history,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: fallback },
  ].slice(-MAX_HISTORY_MESSAGES);
  return { reply: fallback, history: newHistory };
}

module.exports = { chat };
