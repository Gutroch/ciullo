// services/jonnyTools.js
// Qui vive il "retrieval" del RAG: non un vector database, ma query
// dirette e mirate sui modelli esistenti (Expenses, Budget), esposte
// al modello come funzioni che può decidere di chiamare (tool calling).
// È il modello a scegliere quale funzione chiamare e con quali
// parametri, in base alla domanda dell'utente.

const Expenses = require('../models/expenses');
const Budget = require('../models/budget');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Raggruppa le spese di un anno per mese (indice 0-11), come già fatto
// in routes/budget.js: netto = entrate - uscite.
function computeMonthlyNet(expenses, year) {
  const months = Array(12).fill(0);
  expenses.forEach(e => {
    const d = new Date(e.data_spesa);
    if (d.getFullYear() === year) {
      const amount = e.tipo === 'ingresso' ? e.importo : -e.importo;
      months[d.getMonth()] += amount;
    }
  });
  return months;
}

// --- Tool 1: interroga/filtra/aggrega le spese reali -----------------

async function queryExpenses(args = {}) {
  const { data_da, data_a, categoria, sottocategoria, tipo, parola_chiave, limit } = args;
  const all = await Expenses.getAllExpenses();

  const filtered = all.filter(e => {
    if (data_da && e.data_spesa < data_da) return false;
    if (data_a && e.data_spesa > data_a) return false;
    if (tipo && e.tipo !== tipo) return false;
    if (categoria && e.categoria !== categoria) return false;
    if (sottocategoria && e.sottocategoria !== sottocategoria) return false;
    if (parola_chiave) {
      const kw = String(parola_chiave).toLowerCase();
      const haystack = `${e.note || ''} ${e.categoria || ''} ${e.sottocategoria || ''}`.toLowerCase();
      if (!haystack.includes(kw)) return false;
    }
    return true;
  });

  const totaleUscite = filtered.filter(e => e.tipo !== 'ingresso').reduce((s, e) => s + (e.importo || 0), 0);
  const totaleEntrate = filtered.filter(e => e.tipo === 'ingresso').reduce((s, e) => s + (e.importo || 0), 0);

  const perCategoria = {};
  filtered.filter(e => e.tipo !== 'ingresso').forEach(e => {
    const key = e.categoria || 'Altro';
    perCategoria[key] = (perCategoria[key] || 0) + (e.importo || 0);
  });
  const breakdownPerCategoria = Object.entries(perCategoria)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, tot]) => ({ categoria: cat, totale: round2(tot) }));

  const ordinate = [...filtered].sort((a, b) => (a.data_spesa < b.data_spesa ? 1 : -1));
  const cap = Math.max(1, Math.min(limit || 30, 100));
  const transazioni = ordinate.slice(0, cap).map(e => ({
    id: e.id,
    data: e.data_spesa,
    importo: e.importo,
    tipo: e.tipo,
    categoria: e.categoria,
    sottocategoria: e.sottocategoria,
    note: e.note,
    inserito_da: e.inserito_da,
    per_conto_di: e.per_conto_di,
  }));

  return {
    filtri_applicati: { data_da, data_a, categoria, sottocategoria, tipo, parola_chiave },
    numero_risultati_totali: filtered.length,
    totale_uscite: round2(totaleUscite),
    totale_entrate: round2(totaleEntrate),
    saldo: round2(totaleEntrate - totaleUscite),
    breakdown_per_categoria: breakdownPerCategoria,
    transazioni_mostrate: transazioni.length,
    transazioni: transazioni,
    nota: filtered.length > transazioni.length
      ? `Sono state trovate ${filtered.length} transazioni ma ne sono mostrate solo ${transazioni.length}: per il totale/numero esatto usa i campi aggregati, non contare le transazioni elencate.`
      : undefined,
  };
}

// --- Tool 2: stato del budget (previsto vs reale) ---------------------

async function getBudgetStatus(args = {}) {
  const anno = parseInt(args.anno, 10) || new Date().getFullYear();
  const mese = args.mese ? parseInt(args.mese, 10) : null; // 1-12, opzionale

  const [budgetData, allExpenses] = await Promise.all([
    Budget.getBudget(anno),
    Expenses.getAllExpenses(),
  ]);
  const realNet = computeMonthlyNet(allExpenses, anno);
  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  const monthsData = [];
  for (let m = 0; m < 12; m++) {
    const previsto = budgetData[m] !== undefined ? budgetData[m] : 0;
    const reale = realNet[m] || 0;
    monthsData.push({
      mese: monthNames[m],
      numero_mese: m + 1,
      previsto: round2(previsto),
      reale_netto: round2(reale),
      differenza: round2(reale - previsto),
      sopra_o_sotto_budget: reale >= previsto ? 'sopra/in linea' : 'sotto',
    });
  }

  if (mese && mese >= 1 && mese <= 12) {
    return { anno, mese_richiesto: monthsData[mese - 1] };
  }

  const totalPrevisto = monthsData.reduce((s, m) => s + m.previsto, 0);
  const totalReale = monthsData.reduce((s, m) => s + m.reale_netto, 0);

  return {
    anno,
    mesi: monthsData,
    totale_previsto_anno: round2(totalPrevisto),
    totale_reale_anno: round2(totalReale),
    differenza_anno: round2(totalReale - totalPrevisto),
  };
}

// --- Definizioni dei tool in formato OpenAI/Groq function calling -----

const TOOLS_READ = [
  {
    type: 'function',
    function: {
      name: 'query_expenses',
      description:
        "Cerca, filtra e aggrega le spese/entrate reali della famiglia. Usalo per qualsiasi domanda su importi, categorie, periodi o transazioni specifiche (es. 'quanto ho speso a luglio in benzina', 'trovami le spese con Rocky nelle note', 'quanto abbiamo speso in totale ad agosto'). Ritorna sia i totali aggregati sia un elenco di esempio di transazioni.",
      parameters: {
        type: 'object',
        properties: {
          data_da: { type: 'string', description: 'Data inizio periodo, formato YYYY-MM-DD (opzionale)' },
          data_a: { type: 'string', description: 'Data fine periodo, formato YYYY-MM-DD (opzionale)' },
          categoria: { type: 'string', description: 'Nome esatto della categoria principale (opzionale, vedi elenco categorie nel system prompt)' },
          sottocategoria: { type: 'string', description: 'Nome esatto della sottocategoria (opzionale)' },
          tipo: { type: 'string', enum: ['uscita', 'ingresso'], description: "Filtra per 'uscita' o 'ingresso' (opzionale, default: entrambi)" },
          parola_chiave: { type: 'string', description: 'Testo libero da cercare nelle note/categoria/sottocategoria (ricerca semplice case-insensitive)' },
          limit: { type: 'number', description: 'Numero massimo di transazioni di esempio da restituire (default 30, max 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_budget_status',
      description:
        "Confronta il budget previsto con la spesa/entrata netta reale, per un anno (e opzionalmente un mese specifico). Usalo per domande tipo 'sto sforando il budget?', 'come va questo mese rispetto al previsto?'.",
      parameters: {
        type: 'object',
        properties: {
          anno: { type: 'number', description: 'Anno da analizzare (default: anno corrente)' },
          mese: { type: 'number', description: 'Mese da 1 a 12 (opzionale: se omesso ritorna la panoramica di tutto l\'anno)' },
        },
      },
    },
  },
];

// --- Tool "di scrittura": NON eseguono nulla direttamente --------------
// Per sicurezza (evitare che il modello scriva/cancelli dati per errore
// o "allucinazione"), questi tool si limitano a preparare un'anteprima
// dell'operazione ("pending action"). L'esecuzione reale su Redis avviene
// solo dopo conferma esplicita dell'utente in un popup lato client
// (vedi routes/jonny.js -> /api/confirm e services/jonnyAgent.js).

function formatEuro(n) {
  return `${round2(n).toFixed(2).replace('.', ',')} €`;
}

async function previewAddExpense(args = {}) {
  const importo = parseFloat(args.importo);
  if (isNaN(importo) || importo <= 0) {
    return { error: 'Importo mancante o non valido: specifica un numero positivo.' };
  }
  const params = {
    data_spesa: args.data_spesa || new Date().toISOString().slice(0, 10),
    importo,
    tipo: args.tipo === 'ingresso' ? 'ingresso' : 'uscita',
    categoria: args.categoria || 'Altro',
    sottocategoria: args.sottocategoria || '',
    note: args.note || '',
    inserito_da: args.inserito_da || 'Jonny',
    per_conto_di: args.per_conto_di || args.inserito_da || 'Jonny',
  };
  const description = `Aggiungere una nuova ${params.tipo === 'ingresso' ? 'entrata' : 'uscita'} di ${formatEuro(params.importo)} in data ${params.data_spesa}, categoria "${params.categoria}"${params.sottocategoria ? ' / ' + params.sottocategoria : ''}${params.note ? `, nota: "${params.note}"` : ''}.`;
  return {
    requires_confirmation: true,
    pending_action: { type: 'add_expense', params },
    description,
  };
}

async function previewUpdateExpense(args = {}) {
  if (!args.id) return { error: 'Serve l\'id della spesa da modificare: usa prima query_expenses per trovarlo.' };
  const all = await Expenses.getAllExpenses();
  const existing = all.find(e => e.id === args.id);
  if (!existing) return { error: `Nessuna spesa trovata con id ${args.id}.` };

  const params = { id: args.id, ...args };
  delete params.id;
  const campiModificati = Object.keys(args).filter(k => k !== 'id' && args[k] !== undefined && args[k] !== existing[k]);
  if (campiModificati.length === 0) {
    return { error: 'Nessuna modifica effettiva rispetto ai dati attuali.' };
  }
  const descModifiche = campiModificati.map(k => `${k}: "${existing[k]}" → "${args[k]}"`).join('; ');
  const description = `Modificare la spesa del ${existing.data_spesa} (${formatEuro(existing.importo)}, ${existing.categoria}): ${descModifiche}.`;
  return {
    requires_confirmation: true,
    pending_action: { type: 'update_expense', params: { id: args.id, data: params } },
    description,
  };
}

async function previewDeleteExpense(args = {}) {
  if (!args.id) return { error: 'Serve l\'id della spesa da eliminare: usa prima query_expenses per trovarlo.' };
  const all = await Expenses.getAllExpenses();
  const existing = all.find(e => e.id === args.id);
  if (!existing) return { error: `Nessuna spesa trovata con id ${args.id}.` };

  const description = `Eliminare definitivamente la spesa del ${existing.data_spesa}: ${formatEuro(existing.importo)}, categoria "${existing.categoria}"${existing.note ? `, nota: "${existing.note}"` : ''}.`;
  return {
    requires_confirmation: true,
    pending_action: { type: 'delete_expense', params: { id: args.id } },
    description,
  };
}

// Eseguita SOLO dopo la conferma esplicita dell'utente (vedi routes/jonny.js)
async function applyConfirmedAction(pendingAction) {
  if (!pendingAction || !pendingAction.type) throw new Error('Azione non valida');
  switch (pendingAction.type) {
    case 'add_expense':
      return Expenses.addExpense(pendingAction.params);
    case 'update_expense':
      return Expenses.updateExpense(pendingAction.params.id, pendingAction.params.data);
    case 'delete_expense':
      return Expenses.deleteExpense(pendingAction.params.id);
    default:
      throw new Error(`Tipo azione sconosciuto: ${pendingAction.type}`);
  }
}

const WRITE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'propose_add_expense',
      description: 'Prepara l\'aggiunta di una nuova spesa o entrata. NON scrive nulla subito: l\'utente dovrà confermare in un popup. Usalo quando l\'utente chiede esplicitamente di registrare/aggiungere una spesa o un\'entrata via chat.',
      parameters: {
        type: 'object',
        properties: {
          data_spesa: { type: 'string', description: 'Data YYYY-MM-DD (default: oggi)' },
          importo: { type: 'number', description: 'Importo positivo in euro' },
          tipo: { type: 'string', enum: ['uscita', 'ingresso'] },
          categoria: { type: 'string' },
          sottocategoria: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['importo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_update_expense',
      description: 'Prepara la modifica di una spesa esistente (trovata prima con query_expenses). NON scrive nulla subito: richiede conferma dell\'utente.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id della spesa da modificare, ottenuto da query_expenses' },
          data_spesa: { type: 'string' },
          importo: { type: 'number' },
          tipo: { type: 'string', enum: ['uscita', 'ingresso'] },
          categoria: { type: 'string' },
          sottocategoria: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_delete_expense',
      description: 'Prepara l\'eliminazione di una spesa esistente (trovata prima con query_expenses). NON elimina nulla subito: richiede conferma dell\'utente.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id della spesa da eliminare, ottenuto da query_expenses' },
        },
        required: ['id'],
      },
    },
  },
];

const WRITE_EXECUTORS = {
  propose_add_expense: previewAddExpense,
  propose_update_expense: previewUpdateExpense,
  propose_delete_expense: previewDeleteExpense,
};

const WRITE_TOOL_NAMES = new Set(Object.keys(WRITE_EXECUTORS));

const EXECUTORS_READ = {
  query_expenses: queryExpenses,
  get_budget_status: getBudgetStatus,
};

module.exports = {
  TOOLS: [...TOOLS_READ, ...WRITE_TOOLS],
  EXECUTORS: EXECUTORS_READ,
  WRITE_TOOL_NAMES,
  WRITE_EXECUTORS,
  applyConfirmedAction,
};
