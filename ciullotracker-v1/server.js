// server.js
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');

// Importa i modelli Redis
const Users = require('./models/users');
const Expenses = require('./models/expenses');
const Recurring = require('./models/recurring');
const { getRedisClient } = require('./config/redis');

// Importa utility CSV per migrazione
const { readCsv } = require('./utils/csv');

// Importa route
const authRoutes = require('./routes/auth');
const promemoriaRoutes = require('./routes/promemoria');
const expensesRoutes = require('./routes/expenses');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');
const recurringRoutes = require('./routes/recurring');
const budgetRoutes = require('./routes/budget'); // <-- NUOVO IMPORT
const { attachUser, requirePasswordChange } = require('./middleware/auth');
const { requestId, errorHandler } = require('./middleware/errors');
const logger = require('./utils/logger');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET è obbligatorio quando NODE_ENV=production.');
}
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('base64url');
if (!process.env.SESSION_SECRET) {
  logger.warn('SESSION_SECRET non configurato: secret casuale temporaneo, le sessioni non sopravvivono al riavvio.');
}

// --- Migrazione dati da CSV a Redis (solo se Redis è vuoto) ---
async function migrateDataFromCsv() {
  try {
    logger.info('Controllo migrazione dati da CSV');
    
    const existingExpenses = await Expenses.getAllExpenses();
    
    if (existingExpenses.length === 0) {
      logger.info('Nessun dato in Redis, importo da CSV');
      
      // Leggi i CSV (se esistono)
      const fs = require('fs');
      const dataDir = path.join(__dirname, 'data');
      
      if (fs.existsSync(path.join(dataDir, 'expenses.csv'))) {
        const expensesData = readCsv('expenses.csv', ['data_spesa', 'importo', 'tipo', 'categoria', 'sottocategoria', 'inserito_da', 'per_conto_di', 'note']);
        if (expensesData.rows.length > 0) {
          const imported = await Expenses.importFromCsv(expensesData.rows);
          logger.info({ imported }, 'Spese importate da CSV');
        }
      }
      
      if (fs.existsSync(path.join(dataDir, 'users.csv'))) {
        const usersData = readCsv('users.csv', ['username', 'password', 'ruolo']);
        if (usersData.rows.length > 0) {
          const imported = await Users.importFromCsv(usersData.rows);
          logger.info({ imported }, 'Utenti importati da CSV');
        }
      }
      
      // Avvia le ricorrenze
      await Recurring.processDueRecurring();
    } else {
      logger.info({ expenses: existingExpenses.length }, 'Dati già presenti in Redis');
    }
    await Users.ensureDefaultAdmin();
  } catch (error) {
    logger.error({ err: error }, 'Errore migrazione dati');
  }
}

// --- Configurazione motore di template EJS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Middleware base ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(requestId);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      // Restringere ulteriormente le origini CDN dopo aver censito tutti gli asset usati dall'app.
    }
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: isProduction ? undefined : false
}));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

// --- File statici ---
// EdgeOne serve i file statici dalla cartella /static
// Ma per compatibilità, manteniamo anche public
app.use(express.static(path.join(__dirname, 'public')));

// --- Gestione sessione (salvata su Redis, non in memoria) ---
// Necessario in produzione: MemoryStore perde le sessioni ad ogni
// riavvio/scaling del processo e causa il redirect continuo al login.
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use(
  session({
    store: new RedisStore({ client: getRedisClient(), prefix: 'ciullotracker:sess:' }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use(attachUser);
app.use(requirePasswordChange);

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: (req) => req.session.csrfSecret || (req.session.csrfSecret = crypto.randomBytes(32).toString('hex')),
  cookieName: 'x-csrf-token',
  cookieOptions: { httpOnly: false, sameSite: 'lax', secure: isProduction },
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});
app.use((req, res, next) => {
  res.locals.csrfToken = generateToken(req, res);
  next();
});
app.use(doubleCsrfProtection);

// --- Registrazione rotte ---
app.use('/', authRoutes);
app.use('/', expensesRoutes);
app.use('/', adminRoutes);
app.use('/', exportRoutes);
app.use('/', recurringRoutes);
app.use('/budget', budgetRoutes); 
app.use('/promemoria', promemoriaRoutes);


// --- Gestione 404 ---
app.use((req, res) => {
  res.status(404).render('error', { 
    user: req.session?.user, 
    message: 'Pagina non trovata.' 
  });
});

// --- Gestione errori ---
app.use(errorHandler);

// --- Avvia il server ---
const PORT = process.env.PORT || 3000;

migrateDataFromCsv().then(() => {
  // Avvia il processore di ricorrenze (ogni 6 ore)
  setInterval(() => Recurring.processDueRecurring(), 1000 * 60 * 60 * 6);

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'CiulloTracker in ascolto');
  });
});

module.exports = app;