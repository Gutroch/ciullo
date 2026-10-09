// services/receiptScanner.js — legge uno scontrino con un modello Groq che supporta le immagini.
// Non salva nulla: restituisce solo valori proposti, già validati, da mostrare nel form.
const { chatCompletion } = require('./groqClient');
const Expenses = require('../models/expenses');

const VISION_MODEL = () => process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

function buildPrompt(today) {
  const cats = Object.entries(Expenses.CATEGORIE_SPESE)
    .map(([c, subs]) => `- ${c}: ${subs.join(', ')}`).join('\n');
  return [
    'Sei un lettore di scontrini italiani. Ricevi la foto di UNO scontrino e devi estrarre i dati.',
    `Data di oggi: ${today}. Se l'anno sul scontrino ha due cifre, interpretalo nel 2000.`,
    'Rispondi SOLO con un oggetto JSON, senza testo e senza markdown, con queste chiavi:',
    '"negozio" (stringa o null), "data" (YYYY-MM-DD o null), "totale" (numero con il punto decimale: il TOTALE PAGATO, non subtotali, resto, contanti o sconti; null se non leggibile),',
    '"categoria" (una tra quelle elencate, nome esatto), "sottocategoria" (una di quelle della categoria scelta, nome esatto, oppure stringa vuota), "leggibile" (true/false).',
    'Se non sei sicuro di un valore, usa null: NON inventare cifre. Se la foto non è uno scontrino, "leggibile" = false.',
    `Categorie e sottocategorie ammesse:\n${cats}`,
  ].join('\n');
}

function extractJson(text) {
  const t = String(text || '').replace(/```json|```/gi, '');
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

function sanitize(raw, today) {
  const cats = Expenses.CATEGORIE_SPESE;
  const amount = Number(String(raw.totale).replace(',', '.'));
  const importo = Number.isFinite(amount) && amount > 0 && amount < 100000 ? Math.round(amount * 100) / 100 : null;
  const okDate = /^\d{4}-\d{2}-\d{2}$/.test(raw.data || '') && !Number.isNaN(Date.parse(raw.data)) && raw.data <= today && raw.data >= '2000-01-01';
  const categoria = Object.prototype.hasOwnProperty.call(cats, raw.categoria) ? raw.categoria : null;
  const sottocategoria = categoria && (cats[categoria] || []).includes(raw.sottocategoria) ? raw.sottocategoria : '';
  const negozio = typeof raw.negozio === 'string' ? raw.negozio.trim().slice(0, 100) : '';
  return { importo, data: okDate ? raw.data : null, categoria, sottocategoria, note: negozio, leggibile: raw.leggibile !== false && importo !== null };
}

async function scanReceipt(buffer, mime) {
  const today = new Date().toISOString().slice(0, 10);
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: buildPrompt(today) },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  }];
  const base = { model: VISION_MODEL(), messages, temperature: 0, max_tokens: 400 };
  let message;
  try {
    message = await chatCompletion({ ...base, response_format: { type: 'json_object' } });
  } catch (e) {
    if (e.code === 'GROQ_API_ERROR' && e.status === 400) message = await chatCompletion(base); // modello senza JSON mode
    else throw e;
  }
  const parsed = extractJson(message && message.content);
  if (!parsed) { const err = new Error('Risposta non interpretabile'); err.code = 'BAD_OUTPUT'; throw err; }
  return sanitize(parsed, today);
}

module.exports = { scanReceipt };
