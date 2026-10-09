require('dotenv').config();
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const path = require('path');

const Users = require('./models/users');
const Expenses = require('./models/expenses');
const Recurring = require('./models/recurring');
const { getRedisClient } = require('./config/redis');

const { readCsv } = require('./utils/csv');

const authRoutes = require('./routes/auth');
const promemoriaRoutes = require('./routes/promemoria');
const expensesRoutes = require('./routes/expenses');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');
const recurringRoutes = require('./routes/recurring');
const budgetRoutes = require('./routes/budget');
const jonnyRoutes = require('./routes/jonny');
const reportsRoutes = require('./routes/reports');
const { attachUser } = require('./middleware/auth');
const { maintenanceGate } = require('./middleware/maintenance');

const app = express();

const crypto = require('crypto');
const helmet = require('helmet');

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          (req, res) => `'nonce-${res.locals.cspNonce}'`,
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
          'https://esm.sh',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'https://esm.sh'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1);

app.use(
  session({
    store: new RedisStore({ client: getRedisClient(), prefix: 'ciullotracker:sess:' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  })
);

app.use(attachUser);

app.use(maintenanceGate);

app.use('/', authRoutes);
app.use('/', expensesRoutes);
app.use('/', adminRoutes);
app.use('/', exportRoutes);
app.use('/', recurringRoutes);
app.use('/budget', budgetRoutes);
app.use('/promemoria', promemoriaRoutes);
app.use('/jonny', jonnyRoutes);
app.use('/reports', reportsRoutes);
app.use('/receipt', require('./routes/receipt'));

app.use((req, res) => {
  res.status(404).render('error', {
    user: req.session?.user,
    message: 'Pagina non trovata.'
  });
});

app.use((err, req, res, next) => {
  console.error(' Errore:', err);
  res.status(500).render('error', {
    user: req.session?.user,
    message: 'Si è verificato un errore interno del server.',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(` CiulloTracker in ascolto sulla porta ${PORT}`);
  });

module.exports = app;