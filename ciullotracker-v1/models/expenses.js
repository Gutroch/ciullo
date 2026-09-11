// models/expenses.js - Versione Redis
const { getRedisClient } = require('../config/redis');

// Chiavi Redis
const REDIS_KEYS = {
  EXPENSES: 'ciullotracker:expenses',
  EXPENSES_COUNTER: 'ciullotracker:expenses:counter'
};

class Expenses {
  // Categorie di spesa (uscite) con relative sottocategorie
  static CATEGORIE_SPESE = {
    "CASA, UTENZE E TASSE": [
        "Mutuo/Affitto",
        "Spese Condominio",
        "Luce",
        "Gas",
        "Acqua",
        "Internet/Telefono",
        "Rifiuti/TARI",
        "IMU/Tasse Casa",
        "Bonifica/Consorzio",
        "Manutenzione/Riparazioni Casa",
        "Arredamento/Elettrodomestici",
        "Pulizie/Casa",
        "Altro Casa"
    ],

    "CIBO E SPESA": [
        "Supermercato/Spesa",
        "Macellaio",
        "Fruttivendolo",
        "Panetteria/Colazione",
        "Uova",
        "Spese Veloci/Bar",
        "Pranzo/Cena fuori",
        "Delivery",
        "Spesa per Papà/Familiari",
        "Altro Cibo"
    ],

    "DEBITI, PRESTITI E FINANZA": [
        "Prestito 1",
        "Prestito 2",
        "Carte di credito",
        "Commissioni bancarie",
        "Rimborsi/Debiti",
        "Altro Finanza"
    ],

    "RISPARMIO E INVESTIMENTI": [
        "PAC/Fondi",
        "Pensione integrativa",
        "Risparmio",
        "Altro Investimenti"
    ],

    "SALUTE E BENESSERE": [
        "Visite Mediche",
        "Farmacia",
        "Dentista",
        "Analisi/Esami",
        "Massaggiatore/Benessere",
        "Palestra/Sport",
        "Altro Salute"
    ],

    "ABBIGLIAMENTO E CURA PERSONALE": [
        "Primark",
        "Vestiti Luca/Diego",
        "Vestiti Mamma/Papà",
        "Calzature",
        "Parrucchiera",
        "Estetista",
        "Cosmetica/Cura personale",
        "Altro Abbigliamento"
    ],

    "AUTO E TRASPORTI": [
        "Benzina/Carburante",
        "Problemi/Riparazioni",
        "Bollo",
        "Assicurazione",
        "Revisione",
        "Tagliando",
        "Autostrada/Pedaggi",
        "Parcheggi",
        "Mezzi pubblici",
        "Altro Auto"
    ],

    "REGALI E OCCASIONI": [
        "Fiorista",
        "Regali Interni",
        "Regali Estranei",
        "Compleanni/Natale/Ricorrenze",
        "Matrimoni/Eventi",
        "Altro Regali"
    ],

    "FAMIGLIA E FIGLI": [
        "Luca",
        "Diego",
        "Papà",
        "Spese Figli",
        "Scuola/Attività",
        "Contributi familiari",
        "Altro Famiglia"
    ],

    "ANIMALI": [
        "Rocky",
        "Veterinario",
        "Cibo animali",
        "Toelettatura",
        "Altro Animali"
    ],

    "TECNOLOGIA E ABBONAMENTI": [
        "Telefono",
        "Internet",
        "Abbonamenti Streaming",
        "Software/Cloud",
        "Elettronica",
        "Altro Tecnologia"
    ],

    "SHOPPING GENERICO": [
        "Amazon",
        "Varie shopping",
        "Altro Shopping"
    ],

    "SVAGO, TEMPO LIBERO E VACANZE": [
        "Hobby",
        "Cinema/Teatro",
        "Libri",
        "Viaggi/Vacanze",
        "Hotel/Prenotazioni",
        "Altro Svago"
    ],

    "ISTRUZIONE E FORMAZIONE": [
        "Corsi",
        "Libri scolastici",
        "Tasse scolastiche",
        "Altro Istruzione"
    ],

    "CONGUAGLI E RETTIFICHE": [
        "Conguaglio",
        "Rimborsi",
        "Storni",
        "Altro Conguagli"
    ],

    "VARIE O IMPREVISTI": [
        "Altro",
        "Imprevisti",
        "Da classificare"
    ]
  };

  // Categorie per le entrate (senza sottocategorie)
  static CATEGORIE_ENTRATE = [
    'Stipendio Papà',
    'Stipendio Mamma',
    'Luca / Diego',
    'Portafogli Mamma',
    'Portafogli Papà',
    'Assegno Familiare',
    'Conguaglio',
    'Conto Corrente',
    'Altro'
  ];

  // Restituisce tutte le sottocategorie per una data categoria (solo per uscite)
  static getSottocategorie(categoria) {
    return this.CATEGORIE_SPESE[categoria] || [];
  }

  // Normalizza i dati legacy che salvavano la sottocategoria in `categoria`.
  static normalizeExpense(expense) {
    if (!expense || expense.tipo === 'ingresso' || expense.sottocategoria) {
      return expense;
    }

    const categorieCandidate = Object.entries(this.CATEGORIE_SPESE)
      .filter(([, sottocategorie]) => sottocategorie.includes(expense.categoria));

    if (categorieCandidate.length === 1) {
      const [categoria, sottocategorie] = categorieCandidate[0];
      return {
        ...expense,
        categoria,
        sottocategoria: sottocategorie.includes(expense.categoria)
          ? expense.categoria
          : ''
      };
    }

    return expense;
  }

  // Ottiene tutte le spese
  static async getAllExpenses() {
    try {
      const redis = getRedisClient();
      const data = await redis.get(REDIS_KEYS.EXPENSES);
      return data ? JSON.parse(data).map(expense => this.normalizeExpense(expense)) : [];
    } catch (error) {
      console.error(' Errore lettura spese da Redis:', error.message);
      return [];
    }
  }

  // Aggiunge una nuova spesa (accetta anche sottocategoria)
  static async addExpense(data) {
    try {
      const redis = getRedisClient();
      const expenses = await this.getAllExpenses();

      const newExpense = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        data_spesa: data.data_spesa || new Date().toISOString().slice(0, 10),
        importo: parseFloat(data.importo),
        tipo: data.tipo || 'uscita',
        categoria: data.categoria || 'Altro',
        sottocategoria: data.sottocategoria || '',
        inserito_da: data.inserito_da || 'system',
        per_conto_di: data.per_conto_di || 'system',
        note: data.note || ''
      };

      expenses.unshift(newExpense);
      await redis.set(REDIS_KEYS.EXPENSES, JSON.stringify(expenses));
      return newExpense;
    } catch (error) {
      console.error(' Errore aggiunta spesa:', error.message);
      throw error;
    }
  }

  // Aggiorna una spesa esistente
  static async updateExpense(id, data) {
    try {
      const redis = getRedisClient();
      const expenses = await this.getAllExpenses();
      const index = expenses.findIndex(e => e.id === id);
      if (index === -1) return null;

      const old = expenses[index];
      const updated = {
        ...old,
        data_spesa: data.data_spesa || old.data_spesa,
        importo: parseFloat(data.importo) || old.importo,
        tipo: data.tipo || old.tipo,
        categoria: data.categoria || old.categoria,
        sottocategoria: data.sottocategoria !== undefined ? data.sottocategoria : old.sottocategoria,
        inserito_da: data.inserito_da || old.inserito_da,
        per_conto_di: data.per_conto_di || old.per_conto_di,
        note: data.note !== undefined ? data.note : old.note
      };

      expenses[index] = updated;
      await redis.set(REDIS_KEYS.EXPENSES, JSON.stringify(expenses));
      return updated;
    } catch (error) {
      console.error(' Errore aggiornamento spesa:', error.message);
      throw error;
    }
  }

  // Elimina una spesa
  static async deleteExpense(id) {
    try {
      const redis = getRedisClient();
      const expenses = await this.getAllExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      if (filtered.length === expenses.length) return false;
      await redis.set(REDIS_KEYS.EXPENSES, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error(' Errore eliminazione spesa:', error.message);
      return false;
    }
  }

  // Importa dati da CSV (utility)
  static async importFromCsv(csvData) {
    try {
      const redis = getRedisClient();
      const expenses = csvData.map(row => this.normalizeExpense({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          data_spesa: row.data_spesa,
          importo: parseFloat(row.importo),
          tipo: row.tipo || 'uscita',
          categoria: row.categoria || 'Altro',
          sottocategoria: row.sottocategoria || '',
          inserito_da: row.inserito_da || 'system',
          per_conto_di: row.per_conto_di || 'system',
          note: row.note || ''
        }));
      await redis.set(REDIS_KEYS.EXPENSES, JSON.stringify(expenses));
      return expenses.length;
    } catch (error) {
      console.error(' Errore import CSV:', error.message);
      return 0;
    }
  }

  // Reset dei dati (per testing)
  static async clearAll() {
    try {
      const redis = getRedisClient();
      await redis.del(REDIS_KEYS.EXPENSES);
      return true;
    } catch (error) {
      console.error(' Errore clear:', error.message);
      return false;
    }
  }
}

module.exports = Expenses;