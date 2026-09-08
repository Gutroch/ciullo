// ============================================================
// utils/csv.js
// Utility "fatte in casa" per leggere e scrivere file CSV.
// Nessuna dipendenza esterna: gestiamo noi il quoting dei campi
// che contengono virgole, virgolette o a capo (es. il campo "note").
// ============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Garantisce che la cartella /data esista
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Esegue l'escape di un singolo campo per il formato CSV
function escapeField(value) {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n;]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Serializza un array di oggetti in testo CSV, usando l'ordine di "headers"
function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

// Effettua il parsing "a mano" di una riga CSV rispettando il quoting
function parseLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // salta la doppia virgoletta di escape
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Effettua il parsing dell'intero contenuto CSV in array di oggetti
function parseCsv(content) {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(obj);
  }
  return { headers, rows };
}

// Legge un file CSV dalla cartella /data. Se non esiste, lo crea con gli
// header forniti (requisito: gestione automatica dei file mancanti).
function readCsv(filename, defaultHeaders) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultHeaders.join(',') + '\n', 'utf8');
    return { headers: defaultHeaders, rows: [] };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = parseCsv(content);
    // Se il file esiste ma è vuoto/corrotto, usiamo gli header di default
    const headers = parsed.headers.length > 0 ? parsed.headers : defaultHeaders;
    return { headers, rows: parsed.rows };
  } catch (err) {
    console.error(`Errore lettura CSV ${filename}:`, err.message);
    // In caso di errore grave, ripristiniamo un file vuoto e coerente
    fs.writeFileSync(filePath, defaultHeaders.join(',') + '\n', 'utf8');
    return { headers: defaultHeaders, rows: [] };
  }
}

// Scrive (sovrascrive) un file CSV nella cartella /data
function writeCsv(filename, headers, rows) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, toCsv(headers, rows), 'utf8');
    return true;
  } catch (err) {
    console.error(`Errore scrittura CSV ${filename}:`, err.message);
    return false;
  }
}

module.exports = { readCsv, writeCsv, toCsv, parseCsv, DATA_DIR, ensureDataDir };
