// middleware/maintenance.js
// Se la modalità manutenzione è attiva, blocca tutti gli utenti tranne
// gli amministratori (che possono continuare a usare l'app e disattivarla
// dal Pannello Admin). Il login/logout restano sempre raggiungibili.
const Settings = require('../models/settings');

const ALWAYS_ALLOWED_PATHS = ['/login', '/logout'];

async function maintenanceGate(req, res, next) {
  try {
    const settings = await Settings.get();
    res.locals.maintenanceActive = !!settings.maintenance;

    if (!settings.maintenance) return next();

    const user = req.session && req.session.user;
    if (user && user.ruolo === 'admin') return next();
    if (ALWAYS_ALLOWED_PATHS.includes(req.path)) return next();

    return res.status(503).render('maintenance', {
      user: user || null,
      message: settings.maintenanceMessage || null,
    });
  } catch (error) {
    // Non blocchiamo mai l'app per un errore di lettura impostazioni:
    // meglio un fail-open che un lockout totale in caso di problemi Redis.
    console.error(' Errore controllo manutenzione:', error.message);
    return next();
  }
}

module.exports = { maintenanceGate };
