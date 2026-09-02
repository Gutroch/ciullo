// models/budget.js
const { getRedisClient } = require('../config/redis');

const REDIS_KEY_BUDGET = (year) => `ciullotracker:budget:${year}`;

class Budget {
  // Ottiene il budget per un anno (oggetto { mese: valore })
  static async getBudget(year) {
    try {
      const redis = getRedisClient();
      const data = await redis.get(REDIS_KEY_BUDGET(year));
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('❌ Errore lettura budget:', error.message);
      return {};
    }
  }

  // Imposta il budget per un mese specifico
  static async setBudget(year, month, value) {
    try {
      const redis = getRedisClient();
      const budget = await this.getBudget(year);
      budget[month] = parseFloat(value) || 0;
      await redis.set(REDIS_KEY_BUDGET(year), JSON.stringify(budget));
      return true;
    } catch (error) {
      console.error('❌ Errore scrittura budget:', error.message);
      return false;
    }
  }

  // Imposta tutti i mesi in una volta (riceve oggetto { month: value })
  static async setAllBudget(year, data) {
    try {
      const redis = getRedisClient();
      const budget = {};
      for (const [month, value] of Object.entries(data)) {
        budget[month] = parseFloat(value) || 0;
      }
      await redis.set(REDIS_KEY_BUDGET(year), JSON.stringify(budget));
      return true;
    } catch (error) {
      console.error('❌ Errore scrittura budget multiplo:', error.message);
      return false;
    }
  }
}

module.exports = Budget;