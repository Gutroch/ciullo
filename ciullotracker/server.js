// server.js
const express = require('express');
const session = require('express-session');
const path = require('path');

// Importa i modelli Redis
const Users = require('./models/users');
const Expenses = require('./models/expenses');
const Recurring = require('./models/recurring');

// Importa utility CSV per migrazione
const { readCsv } = require('./utils/csv');

// Importa route
const authRoutes = require('./routes/auth');
const expensesRoutes = require('./routes/expenses');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');
const recurringRoutes = require('./routes/recurring');
const { attachUser } = require('./middleware/auth');

const app = express();

// --- Migrazione dati da CSV a Redis (solo se Redis è vuoto) ---
async function migrateDataFromCsv() {
  try {
    console.log('📂 Controllo migrazione dati da CSV...');
    
    const existingExpenses = await Expenses.getAllExpenses();
    
    if (existingExpenses.length === 0) {
      console.log('📂 Nessun dato in Redis, importo da CSV...');
      
      // Leggi i CSV (se esistono)
      const fs = require('fs');
      const dataDir = path.join(__dirname, 'data');
      
      if (fs.existsSync(path.join(dataDir, 'expenses.csv'))) {
        const expensesData = readCsv('expenses.csv', ['data_spesa', 'importo', 'tipo', 'categoria', 'inserito_da', 'per_conto_di', 'note']);
        if (expensesData.rows.length > 0) {
          const imported = await Expenses.importFromCsv(expensesData.rows);
          console.log(`✅ Importate ${imported} spese da CSV`);
        }
      }
      
      if (fs.existsSync(path.join(dataDir, 'users.csv'))) {
        const usersData = readCsv('users.csv', ['username', 'password', 'ruolo']);
        if (usersData.rows.length > 0) {
          const imported = await Users.importFromCsv(usersData.rows);
          console.log(`✅ Importati ${imported} utenti da CSV`);
        }
      }
      
      // Crea admin di default se non esiste
      await Users.ensureDefaultAdmin();
      
      // Avvia le ricorrenze
      await Recurring.processDueRecurring();
    } else {
      console.log(`✅ Dati già presenti in Redis (${existingExpenses.length} spese)`);
    }
  } catch (error) {
    console.error('❌ Errore migrazione dati:', error.message);
  }
}

// --- Configurazione motore di template EJS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Middleware base ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- File statici ---
// EdgeOne serve i file statici dalla cartella /static
// Ma per compatibilità, manteniamo anche public
app.use(express.static(path.join(__dirname, 'public')));

// --- Gestione sessione ---
app.use(
  session({
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

// --- Registrazione rotte ---
app.use('/', authRoutes);
app.use('/', expensesRoutes);
app.use('/', adminRoutes);
app.use('/', exportRoutes);
app.use('/', recurringRoutes);

// --- Gestione 404 ---
app.use((req, res) => {
  res.status(404).render('error', { 
    user: req.session?.user, 
    message: 'Pagina non trovata.' 
  });
});

// --- Gestione errori ---
app.use((err, req, res, next) => {
  console.error('❌ Errore:', err);
  res.status(500).render('error', {
    user: req.session?.user,
    message: 'Si è verificato un errore interno del server.',
  });
});

// --- Avvia il server ---
const PORT = process.env.PORT || 3000;

migrateDataFromCsv().then(() => {
  // Avvia il processore di ricorrenze (ogni 6 ore)
  setInterval(() => Recurring.processDueRecurring(), 1000 * 60 * 60 * 6);

  app.listen(PORT, () => {
    console.log(`✅ Home CiulloTracker in ascolto sulla porta ${PORT}`);
  });
});

module.exports = app;