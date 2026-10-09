// routes/receipt.js — POST /receipt/scan  (corpo = immagine binaria, non JSON: evita i limiti di express.json)
// Montalo in app.js:  app.use('/receipt', require('./routes/receipt'));
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { scanReceipt } = require('../services/receiptScanner');

const router = express.Router();
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 3 * 1024 * 1024; // Groq accetta immagini base64 fino a 4 MB

router.post('/scan', requireAuth, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_BYTES }), async (req, res) => {
  const now = Date.now();
  if (req.session.receiptScanAt && now - req.session.receiptScanAt < 4000) {
    return res.status(429).json({ success: false, error: 'Attendi qualche secondo prima di scansionare un altro scontrino.' });
  }
  req.session.receiptScanAt = now;

  const mime = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!ALLOWED.has(mime) || !Buffer.isBuffer(req.body) || req.body.length < 1000) {
    return res.status(400).json({ success: false, error: 'Immagine non valida. Usa una foto JPEG, PNG o WebP.' });
  }

  try {
    const fields = await scanReceipt(req.body, mime);
    if (!fields.leggibile) {
      return res.status(422).json({ success: false, error: 'Non riesco a leggere il totale. Riprova con una foto più nitida e ben illuminata.' });
    }
    return res.json({ success: true, fields });
  } catch (error) {
    console.error(' Errore scansione scontrino:', error.message);
    if (error.code === 'NO_API_KEY') return res.status(503).json({ success: false, error: 'Scansione non configurata (manca GROQ_API_KEY).' });
    if (error.code === 'GROQ_API_ERROR') return res.status(502).json({ success: false, error: 'Il servizio AI non ha risposto (il modello potrebbe non supportare le immagini). Inserisci i dati a mano.' });
    return res.status(502).json({ success: false, error: 'Lettura non riuscita. Riprova o inserisci i dati a mano.' });
  }
});

// Errori di express.raw (es. file troppo grande)
router.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ success: false, error: 'Foto troppo pesante.' });
  next(err);
});

module.exports = router;
