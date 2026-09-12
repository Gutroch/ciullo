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
const { attachUser } = require('./middleware/auth');
const { maintenanceGate } = require('./middleware/maintenance');

const app = express();

async function migrateDataFromCsv() {
  try {
    console.log('📂 Controllo migrazione dati da CSV...');

    const existingExpenses = await Expenses.getAllExpenses();

    if (existingExpenses.length === 0) {
      console.log('📂 Nessun dato in Redis, importo da CSV...');

      const fs = require('fs');
      const dataDir = path.join(__dirname, 'data');

      if (fs.existsSync(path.join(dataDir, 'expenses.csv'))) {
        const expensesData = readCsv('expenses.csv', ['data_spesa', 'importo', 'tipo', 'categoria', 'sottocategoria', 'inserito_da', 'per_conto_di', 'note']);
        if (expensesData.rows.length > 0) {
          const imported = await Expenses.importFromCsv(expensesData.rows);
          console.log(` Importate ${imported} spese da CSV`);
        }
      }

      if (fs.existsSync(path.join(dataDir, 'users.csv'))) {
        const usersData = readCsv('users.csv', ['username', 'password', 'ruolo']);
        if (usersData.rows.length > 0) {
          const imported = await Users.importFromCsv(usersData.rows);
          console.log(` Importati ${imported} utenti da CSV`);
        }
      }

      await Users.ensureDefaultAdmin();
      await Recurring.processDueRecurring();
    } else {
      console.log(` Dati già presenti in Redis (${existingExpenses.length} spese)`);
    }
  } catch (error) {
    console.error(' Errore migrazione dati:', error.message);
  }
}

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
    secret: process.env.SESSION_SECRET || 'home-budget-tracker-secret-cambia-in-produzione',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

migrateDataFromCsv().then(() => {
  setInterval(() => Recurring.processDueRecurring(), 1000 * 60 * 60 * 6);

  app.listen(PORT, () => {
    console.log(` CiulloTracker in ascolto sulla porta ${PORT}`);
  });
});

module.exports = app;