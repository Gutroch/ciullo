// routes/admin.js - Versione async
const express = require('express');
const router = express.Router();
const Users = require('../models/users');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /admin
router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const utenti = await Users.getAllUsers();
    res.render('admin', { user: req.session.user, utenti, error: null, success: null });
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
    
    if (!result.ok) {
      return res.status(400).render('admin', {
        user: req.session.user,
        utenti,
        error: result.error,
        success: null,
      });
    }
    
    res.render('admin', {
      user: req.session.user,
      utenti,
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
    
    res.render('admin', {
      user: req.session.user,
      utenti,
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
      return res.status(400).render('admin', {
        user: req.session.user,
        utenti,
        error: 'Non puoi eliminare il tuo stesso account.',
        success: null,
      });
    }
    
    const result = await Users.deleteUser(req.params.id);
    const utenti = await Users.getAllUsers();
    
    res.render('admin', {
      user: req.session.user,
      utenti,
      error: result.ok ? null : result.error,
      success: result.ok ? 'Utente eliminato.' : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { user: req.session.user, message: 'Errore del server' });
  }
});

module.exports = router;