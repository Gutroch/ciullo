// models/settings.js
// Impostazioni globali dell'applicazione (es. modalità manutenzione).
const { getRedisClient } = require('../config/redis');

const REDIS_KEY = 'ciullotracker:settings';

const DEFAULTS = {
  maintenance: false,
  maintenanceMessage: '',
  maintenanceUpdatedAt: null,
  maintenanceUpdatedBy: null,
};

class Settings {
  // Ottiene le impostazioni correnti (con default se non presenti)
  static async get() {
    try {
      const redis = getRedisClient();
      const data = await redis.get(REDIS_KEY);
      if (!data) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(data) };
    } catch (error) {
      console.error(' Errore lettura impostazioni:', error.message);
      return { ...DEFAULTS };
    }
  }

  // Aggiorna parzialmente le impostazioni
  static async update(partial) {
    try {
      const redis = getRedisClient();
      const current = await this.get();
      const next = { ...current, ...partial };
      await redis.set(REDIS_KEY, JSON.stringify(next));
      return next;
    } catch (error) {
      console.error(' Errore scrittura impostazioni:', error.message);
      throw error;
    }
  }

  // Attiva/disattiva la modalità manutenzione
  static async setMaintenance(active, message, updatedBy) {
    return this.update({
      maintenance: !!active,
      maintenanceMessage: (message || '').trim(),
      maintenanceUpdatedAt: new Date().toISOString(),
      maintenanceUpdatedBy: updatedBy || null,
    });
  }
}

module.exports = Settings;
