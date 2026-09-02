// ============================================================
// middleware/auth.js
// Middleware per proteggere le rotte: nessuna pagina o dato è
// visibile senza autenticazione (requisito "Accesso Rigido").
// ============================================================

// Richiede che l'utente sia loggato, altrimenti redirect forzato al Login
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login');
}

// Richiede che l'utente loggato abbia ruolo Admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.ruolo === 'admin') {
    return next();
  }
  return res.status(403).render('error', {
    user: req.session.user,
    message: 'Accesso negato: sezione riservata agli amministratori.',
  });
}

// Rende disponibile l'utente corrente a tutte le view (navbar, ecc.)
function attachUser(req, res, next) {
  res.locals.currentUser = (req.session && req.session.user) || null;
  next();
}

module.exports = { requireAuth, requireAdmin, attachUser };
