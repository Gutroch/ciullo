const express = require('express');
const Expenses = require('../models/expenses');
const { requireAuth } = require('../middleware/auth');
const { analyze, aiPayload, fmt } = require('../services/reportAnalytics');
const charts = require('../services/reportCharts');
const { colorFor } = require('../utils/categoryColors');
const { chatCompletion } = require('../services/groqClient');

const router = express.Router();
const GROUPS = ['categoria', 'mese', 'beneficiario'];

// Sezioni selezionabili dal menu in alto (chiave -> etichetta)
const SECTIONS = [
  { key: 'kpi', label: 'Indicatori', on: true },
  { key: 'andamento', label: 'Andamento', on: true },
  { key: 'categorie', label: 'Ripartizione uscite', on: true },
  { key: 'consigli', label: 'Consigli', on: true },
  { key: 'ai', label: 'Analisi AI', on: false },
  { key: 'riepilogo', label: 'Riepilogo', on: true },
  { key: 'top', label: 'Spese più alte', on: true },
  { key: 'dettaglio', label: 'Dettaglio movimenti', on: true },
];

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

function todayIsoRome() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function parseParams(src) {
  const todayIso = todayIsoRome();
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const from = validDate(src.dal) ? src.dal : `${todayIso.slice(0, 8)}01`;
  const to = validDate(src.al) ? src.al : todayIso;
  return {
    todayIso,
    from,
    to,
    category: text(src.categoria, 120),
    type: ['ingresso', 'uscita'].includes(src.tipo) ? src.tipo : '',
    group: GROUPS.includes(src.raggruppa) ? src.raggruppa : 'categoria',
    title: text(src.titolo, 100) || 'Report movimenti',
    heading: text(src.intestazione, 100) || 'CiulloTracker',
  };
}

function selectedSections(query) {
  // Il campo nascosto "sez_set" distingue "nessuna spunta" da "prima visita".
  if (!query.sez_set) return SECTIONS.filter((s) => s.on).map((s) => s.key);
  const raw = [].concat(query.sezioni || []);
  return SECTIONS.map((s) => s.key).filter((k) => raw.includes(k));
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const allExpenses = await Expenses.getAllExpenses();
    const params = parseParams(req.query);
    const data = analyze(allExpenses, params, params.todayIso);
    const categories = [...new Set(allExpenses.map((e) => e.categoria).filter(Boolean))].sort();

    const legend = charts.legendItems(data.categories);
    // Stessi colori categoria di dashboard e storico (anche nella ciambella)
    if (params.group === 'categoria') legend.forEach((it) => { it.color = colorFor(it.label); });
    const visuals = {
      bars: charts.barsChart(data.series.buckets),
      balance: charts.balanceChart(data.series.buckets),
      donut: charts.donutChart(legend, fmt.eur(data.totals.expenses)),
      legend,
    };

    res.render('reports', {
      user: req.session.user,
      report: {
        ...params,
        validRange: data.valid,
        generatedAt: new Date(),
        data,
        visuals,
        sections: SECTIONS,
        selected: selectedSections(req.query),
      },
      categories,
      fmt,
    });
  } catch (error) {
    console.error('Errore generazione report:', error);
    res.status(500).render('error', {
      user: req.session.user,
      message: 'Si è verificato un errore nella generazione del report.',
    });
  }
});

const AI_SYSTEM_PROMPT = [
  'Sei un consulente finanziario personale che scrive in italiano, con tono professionale, chiaro e concreto.',
  'Analizzi il bilancio di una famiglia a partire dai SOLI dati aggregati forniti in JSON.',
  'Regole: usa esclusivamente numeri presenti nei dati o calcolati da essi; non inventare cifre, categorie o eventi;',
  'se un dato manca, dillo. Niente consigli legali o di investimento specifici su prodotti finanziari.',
  'Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza markdown, con queste chiavi:',
  '"sintesi" (stringa, massimo 3 frasi), "punti_di_forza" (array di massimo 3 stringhe),',
  '"criticita" (array di massimo 3 stringhe), "consigli" (array da 3 a 5 stringhe, azioni concrete con impatto stimato in euro quando i dati lo permettono),',
  '"obiettivo" (stringa, un obiettivo misurabile per il prossimo periodo).',
].join(' ');

function extractJson(text) {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (e) { return null; }
}

const strList = (v, max) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : []);

router.post('/ai', requireAuth, async (req, res) => {
  const now = Date.now();
  if (req.session.reportAiAt && now - req.session.reportAiAt < 8000) {
    return res.status(429).json({ success: false, error: 'Attendi qualche secondo prima di rigenerare l\'analisi.' });
  }
  req.session.reportAiAt = now;

  try {
    const params = parseParams(req.body || {});
    if (params.from > params.to) {
      return res.status(400).json({ success: false, error: 'Intervallo date non valido.' });
    }
    const allExpenses = await Expenses.getAllExpenses();
    const data = analyze(allExpenses, params, params.todayIso);
    if (!data.totals.count) {
      return res.status(400).json({ success: false, error: 'Nessun movimento nel periodo: niente da analizzare.' });
    }

    const message = await chatCompletion({
      temperature: 0.2,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(aiPayload(params, data)) },
      ],
    });

    const parsed = extractJson(message && message.content);
    const analysis = parsed
      ? {
        sintesi: String(parsed.sintesi || '').trim(),
        punti_di_forza: strList(parsed.punti_di_forza, 3),
        criticita: strList(parsed.criticita, 3),
        consigli: strList(parsed.consigli, 5),
        obiettivo: String(parsed.obiettivo || '').trim(),
      }
      : { sintesi: String((message && message.content) || '').trim().slice(0, 1200), punti_di_forza: [], criticita: [], consigli: [], obiettivo: '' };

    if (!analysis.sintesi && !analysis.consigli.length) {
      return res.status(502).json({ success: false, error: 'Risposta AI vuota. Riprova.' });
    }
    return res.json({ success: true, analysis, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Errore analisi AI report:', error.message);
    const status = error.code === 'NO_API_KEY' ? 503 : 502;
    const text = error.code === 'NO_API_KEY' ? 'Analisi AI non configurata (manca GROQ_API_KEY).' : 'Analisi AI momentaneamente non disponibile.';
    return res.status(status).json({ success: false, error: text });
  }
});

module.exports = router;
