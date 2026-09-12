// routes/auth.js
const express = require('express');
const router = express.Router();
const Users = require('../models/users');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

router.post('/login', async (req, res) => {
  const { username, password, ricordami } = req.body;
  
  try {
    const user = await Users.findByUsername((username || '').trim());
    
    if (!user || !Users.verifyPassword(user, password || '')) {
      return res.status(401).render('login', { error: 'Username o password non validi.' });
    }
    
    req.session.user = { 
      id: user.id, 
      username: user.username, 
      ruolo: user.ruolo 
    };
    
    if (ricordami === 'on') {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    } else {
      req.session.cookie.maxAge = null;
    }
    
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).render('login', { error: 'Errore del server.' });
  }
});

module.exports = router;