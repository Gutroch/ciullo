// routes/admin.js - Versione async
const express = require('express');
const router = express.Router();
const os = require('os');
const Users = require('../models/users');
const Expenses = require('../models/expenses');
const Recurring = require('../models/recurring');
const PromemoriaModel = require('../models/promemoriaModel');
const Settings = require('../models/settings');
const { getRedisClient } = require('../config/redis');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Prefissi di chiave ammessi per il backup/ripristino: evita che un
// eventuale file di ripristino manomesso possa scrivere chiavi Redis
// arbitrarie (es. dati di sessione di altri utenti).
const BACKUP_KEY_PREFIXES = ['ciullotracker:', 'promemoria:'];
const BACKUP_KEY_EXCLUDE_PREFIX = 'ciullotracker:sess:';

function isBackupKeyAllowed(key) {
  if (typeof key !== 'string' || !key.length) return false;
  if (key.startsWith(BACKUP_KEY_EXCLUDE_PREFIX)) return false;
  return BACKUP_KEY_PREFIXES.some((p) => key.startsWith(p));
}

// Raccoglie tutte le chiavi Redis dell'app (esclude le sessioni)
async function collectAppKeys(redis) {
  const found = new Set();
  for (const prefix of BACKUP_KEY_PREFIXES) {
    const keys = await redis.keys(prefix + '*');
    keys.forEach((k) => { if (isBackupKeyAllowed(k)) found.add(k); });
  }
  return Array.from(found).sort();
}

async function buildSystemInfo() {
  const redis = getRedisClient();
  let redisOk = true;
  try {
    await redis.ping();
  } catch (error) {
    redisOk = false;
  }

  const [utenti, spese, ricorrenze, promemoria, settings, appKeys] = await Promise.all([
    Users.getAllUsers(),
    Expenses.getAllExpenses(),
    Recurring.getAll(),
    PromemoriaModel.findAll(),
    Settings.get(),
    collectAppKeys(redis),
  ]);

  return {
    settings,
    stats: {
      utenti: utenti.length,
      spese: spese.length,
      ricorrenze: ricorrenze.length,
      promemoria: promemoria.length,
      chiaviRedis: appKeys.length,
    },
    redisOk,
    nodeVersion: process.version,
    uptimeSec: Math.floor(process.uptime()),
    hostname: os.hostname(),
  };
}

// GET /admin
router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const utenti = await Users.getAllUsers();
    const system = await buildSystemInfo();
    res.render('admin', { user: req.session.user, utenti, system, error: null, success: null });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { user: req.session.user, message: 'Errore del server' });
  }
});

// POST /admin/users
router.post('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, ruolo } = req.body;
  
  try {
    const result = await Users.createUser(username, password, ruolo);
    const utenti = await Users.getAllUsers();
    const system = await buildSystemInfo();
    
    if (!result.ok) {
      return res.status(400).render('admin', {
        user: req.session.user,
        utenti,
        system,
        error: result.error,
        success: null,
      });
    }
    
    res.render('admin', {
      user: req.session.user,
      utenti,
      system,
      error: null,
      success: `Utente "${result.user.username}" creato con successo.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { user: req.session.user, message: 'Errore del server' });
  }
});

// POST /admin/users/:id/reset
router.post('/admin/users/:id/reset', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const result = await Users.resetPassword(req.params.id, newPassword || 'password123');
    const utenti = await Users.getAllUsers();
    const system = await buildSystemInfo();
    
    res.render('admin', {
      user: req.session.user,
      utenti,
      system,
      error: result.ok ? null : result.error,
      success: result.ok ? 'Password reimpostata con successo.' : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { user: req.session.user, message: 'Errore del server' });
  }
});

// POST /admin/users/:id/delete
router.post('/admin/users/:id/delete', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.session.user.id) {
      const utenti = await Users.getAllUsers();
      const system = await buildSystemInfo();
      return res.status(400).render('admin', {
        user: req.session.user,
        utenti,
        system,
        error: 'Non puoi eliminare il tuo stesso account.',
        success: null,
      });
    }
    
    const result = await Users.deleteUser(req.params.id);
    const utenti = await Users.getAllUsers();
    const system = await buildSystemInfo();
    
    res.render('admin', {
      user: req.session.user,
      utenti,
      system,
      error: result.ok ? null : result.error,
      success: result.ok ? 'Utente eliminato.' : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { user: req.session.user, message: 'Errore del server' });
  }
});

// ============================================================
// MANUTENZIONE
// ============================================================

// POST /admin/maintenance - attiva/disattiva la modalità manutenzione
router.post('/admin/maintenance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const attiva = req.body.maintenance === 'on' || req.body.maintenance === 'true';
    const messaggio = req.body.maintenanceMessage || '';
    await Settings.setMaintenance(attiva, messaggio, req.session.user.username);

    const utenti = await Users.getAllUsers();
    const system = await buildSystemInfo();
    res.render('admin', {
      user: req.session.user,
      utenti,
      system,
      error: null,
      success: attiva ? 'Modalità manutenzione attivata.' : 'Modalità manutenzione disattivata.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { user: req.session.user, message: 'Errore del server' });
  }
});

// ============================================================
// BACKUP & RIPRISTINO
// ============================================================

// GET /admin/backup/download - scarica un backup JSON di tutti i dati dell'app
router.get('/admin/backup/download', requireAuth, requireAdmin, async (req, res) => {
  try {
    const redis = getRedisClient();
    const keys = await collectAppKeys(redis);

    const entries = [];
    for (const key of keys) {
      const type = await redis.type(key);
      if (type === 'string') {
        const raw = await redis.get(key);
        let value = raw;
        try { value = JSON.parse(raw); } catch (e) { /* valore non-JSON: lo teniamo come stringa */ }
        entries.push({ key, type: 'string', value });
      } else if (type === 'set') {
        const members = await redis.smembers(key);
        entries.push({ key, type: 'set', value: members });
      } else {
        // Tipo non gestito dal backup (non dovrebbe verificarsi con i dati di CiulloTracker)
        entries.push({ key, type, value: null, skipped: true });
      }
    }

    const payload = {
      meta: {
        app: 'CiulloTracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: req.session.user.username,
        totalKeys: entries.length,
      },
      entries,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ciullotracker-backup-${dateStr}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error(' Errore generazione backup:', error);
    res.status(500).json({ ok: false, error: 'Errore durante la generazione del backup' });
  }
});

// POST /admin/backup/restore - ripristina i dati da un backup JSON (chiamata via fetch/AJAX)
router.post('/admin/backup/restore', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const entries = Array.isArray(body.entries) ? body.entries : null;

    if (!entries || entries.length === 0) {
      return res.status(400).json({ ok: false, error: 'File di backup non valido o vuoto.' });
    }

    const redis = getRedisClient();
    let restored = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!entry || !isBackupKeyAllowed(entry.key)) { skipped++; continue; }

      if (entry.type === 'string') {
        const toStore = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
        await redis.set(entry.key, toStore);
        restored++;
      } else if (entry.type === 'set') {
        const members = Array.isArray(entry.value) ? entry.value : [];
        await redis.del(entry.key);
        if (members.length > 0) await redis.sadd(entry.key, members);
        restored++;
      } else {
        skipped++;
      }
    }

    res.json({ ok: true, restored, skipped });
  } catch (error) {
    console.error(' Errore ripristino backup:', error);
    res.status(500).json({ ok: false, error: 'Errore durante il ripristino del backup.' });
  }
});

module.exports = router;