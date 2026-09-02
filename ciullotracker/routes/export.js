const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const Expenses = require('../models/expenses');
const { requireAuth } = require('../middleware/auth');
const { toCsv } = require('../utils/csv');

const EXPORT_COLUMNS = ['data_spesa', 'tipo', 'importo', 'categoria', 'inserito_da', 'per_conto_di', 'note'];
const EXPORT_LABELS = ['Data', 'Tipo', 'Importo', 'Categoria', 'Autore Inserimento', 'Beneficiario', 'Note'];

// Applica gli stessi filtri usati nello storico (mese/anno/categoria)
function filtraSpese(all, query) {
  const { mese, anno, categoria } = query;
  let filtered = all;
  if (mese) filtered = filtered.filter((e) => new Date(e.data_spesa).getMonth() + 1 === parseInt(mese, 10));
  if (anno) filtered = filtered.filter((e) => new Date(e.data_spesa).getFullYear() === parseInt(anno, 10));
  if (categoria) filtered = filtered.filter((e) => e.categoria === categoria);
  return filtered;
}

// GET /export/csv
router.get('/export/csv', requireAuth, async (req, res) => {
  try {
    const all = await Expenses.getAllExpenses();
    const filtered = filtraSpese(all, req.query);
    const csv = toCsv(EXPORT_COLUMNS, filtered);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="storico_spese.csv"');
    res.send(csv);
  } catch (error) {
    console.error('❌ Errore esportazione CSV:', error);
    res.status(500).json({ error: 'Errore durante l\'esportazione CSV' });
  }
});

// GET /export/xlsx
router.get('/export/xlsx', requireAuth, async (req, res) => {
  try {
    const all = await Expenses.getAllExpenses();
    const filtered = filtraSpese(all, req.query);

    const data = filtered.map((e) => EXPORT_COLUMNS.map((c) => e[c]));
    const sheetData = [EXPORT_LABELS, ...data];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Storico Spese');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="storico_spese.xlsx"');
    res.send(buffer);
  } catch (error) {
    console.error('❌ Errore esportazione Excel:', error);
    res.status(500).json({ error: 'Errore durante l\'esportazione Excel' });
  }
});

// GET /export/json
router.get('/export/json', requireAuth, async (req, res) => {
  try {
    const all = await Expenses.getAllExpenses();
    const filtered = filtraSpese(all, req.query);
    const clean = filtered.map((e) => {
      const obj = {};
      EXPORT_COLUMNS.forEach((c) => (obj[c] = e[c]));
      return obj;
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="storico_spese.json"');
    res.send(JSON.stringify(clean, null, 2));
  } catch (error) {
    console.error('❌ Errore esportazione JSON:', error);
    res.status(500).json({ error: 'Errore durante l\'esportazione JSON' });
  }
});

module.exports = router;