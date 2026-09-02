// models/expenses.js - Versione Redis
const { getRedisClient } = require('../config/redis');

// Chiavi Redis
const REDIS_KEYS = {
  EXPENSES: 'ciullotracker:expenses',
  EXPENSES_COUNTER: 'ciullotracker:expenses:counter'
};

class Expenses {
  static CATEGORIE = [
    'Alimentari', 'Trasporti', 'Casa', 'Salute', 'Bollette',
    'Sport', 'Svago', 'Viaggi', 'Shopping', 'Scuola',
    'Auto', 'Regali', 'Ristoranti', 'Altro'
  ];

  // Ottiene tutte le spese
  static async getAllExpenses() {
    try {
      const redis = getRedisClient();
      const data = await redis.get(REDIS_KEYS.EXPENSES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Errore lettura spese da Redis:', error.message);
      return [];
    }
  }

  // Aggiunge una nuova spesa
  static async addExpense(data) {
    try {
      const redis = getRedisClient();
      
      // Ottieni le spese esistenti
      const expenses = await this.getAllExpenses();
      
      // Crea la nuova spesa
      const newExpense = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        data_spesa: data.data_spesa || new Date().toISOString().slice(0, 10),
        importo: parseFloat(data.importo),
        tipo: data.tipo || 'uscita',
        categoria: data.categoria || 'Altro',
        inserito_da: data.inserito_da || 'system',
        per_conto_di: data.per_conto_di || 'system',
        note: data.note || ''
      };
      
      // Aggiungi in testa (più recenti prima)
      expenses.unshift(newExpense);
      
      // Salva su Redis
      await redis.set(REDIS_KEYS.EXPENSES, JSON.stringify(expenses));
      
      return newExpense;
    } catch (error) {
      console.error('❌ Errore aggiunta spesa:', error.message);
      throw error;
    }
  }

  // Elimina una spesa
  static async deleteExpense(id) {
    try {
      const redis = getRedisClient();
      const expenses = await this.getAllExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      
      if (filtered.length === expenses.length) {
        return false; // Non trovato
      }
      
      await redis.set(REDIS_KEYS.EXPENSES, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('❌ Errore eliminazione spesa:', error.message);
      return false;
    }
  }

  // Importa dati da CSV (utility per la migrazione)
  static async importFromCsv(csvData) {
    try {
      const redis = getRedisClient();
      const expenses = csvData.map(row => ({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        data_spesa: row.data_spesa,
        importo: parseFloat(row.importo),
        tipo: row.tipo || 'uscita',
        categoria: row.categoria || 'Altro',
        inserito_da: row.inserito_da || 'system',
        per_conto_di: row.per_conto_di || 'system',
        note: row.note || ''
      }));
      
      await redis.set(REDIS_KEYS.EXPENSES, JSON.stringify(expenses));
      return expenses.length;
    } catch (error) {
      console.error('❌ Errore import CSV:', error.message);
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
      console.error('❌ Errore clear:', error.message);
      return false;
    }
  }
}

module.exports = Expenses;