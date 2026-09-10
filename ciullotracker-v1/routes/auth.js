// routes/auth.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const Users = require('../models/users');
const logger = require('../utils/logger');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, requestId: req.id }, 'login rate limit exceeded');
    res.status(429).render('login', { error: 'Troppi tentativi. Riprova tra 15 minuti.' });
  }
});
const passwordRules = [body('password').isLength({ min: 12 }).withMessage('La password deve contenere almeno 12 caratteri.')];

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/login', loginLimiter, [
  body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Username obbligatorio.'),
  body('password').isString().isLength({ min: 1 }).withMessage('Password obbligatoria.')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).render('login', { error: errors.array()[0].msg });
  try {
    const user = await Users.findByUsername(req.body.username);
    if (!user || !Users.verifyPassword(user, req.body.password)) {
      logger.warn({ username: req.body.username, ip: req.ip, requestId: req.id }, 'login failed');
      return res.status(401).render('login', { error: 'Username o password non validi.' });
    }
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.user = { id: user.id, username: user.username, ruolo: user.ruolo, mustChangePassword: Boolean(user.mustChangePassword) };
    req.session.cookie.maxAge = req.body.ricordami === 'on' ? 1000 * 60 * 60 * 24 * 30 : null;
    res.redirect(user.mustChangePassword ? '/change-password' : '/');
  } catch (error) { next(error); }
});

router.get('/change-password', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('change-password', { error: null });
});

router.post('/change-password', passwordRules, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).render('change-password', { error: errors.array()[0].msg });
  try {
    const result = await Users.changePassword(req.session.user.id, req.body.password);
    if (!result.ok) return res.status(400).render('change-password', { error: result.error });
    req.session.user.mustChangePassword = false;
    logger.info({ userId: req.session.user.id, requestId: req.id }, 'password changed');
    res.redirect('/');
  } catch (error) { next(error); }
});

router.post('/logout', (req, res, next) => req.session.destroy(error => error ? next(error) : res.redirect('/login')));

module.exports = router;