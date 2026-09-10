const { getRedisClient } = require('../config/redis');
const redis = getRedisClient();
const crypto = require('crypto');

const KEY_PREFIX = 'promemoria:';
const INDEX_KEY = 'promemoria:ids';

class PromemoriaModel {
  
  // Genera un ID univoco
  static generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  // Salva o aggiorna un promemoria
  static async save(data) {
    const id = data.id || this.generateId();
    const existing = data.id ? await this.findById(data.id, data.actor) : null;
    if (data.id && !existing) return null;
    const promemoria = {
      id,
      descrizione: data.descrizione.trim(),
      periodo: data.periodo.trim(),
      importo: parseFloat(data.importo) || 0,
      scadenza: data.scadenza || null,
      note: data.note || '',
      userId: existing?.userId || data.userId,
      creatoIl: data.creatoIl || new Date().toISOString()
    };

    // Salva nel Redis
    const key = KEY_PREFIX + id;
    await redis.set(key, JSON.stringify(promemoria));
    
    // Aggiungi all'indice se è nuovo
    if (!data.id) {
      await redis.sadd(INDEX_KEY, id);
    }

    return promemoria;
  }

  // Recupera tutti i promemoria
  static async findAll(user) {
    const ids = await redis.smembers(INDEX_KEY);
    if (!ids || ids.length === 0) return [];

    const pipeline = redis.pipeline();
    ids.forEach(id => {
      pipeline.get(KEY_PREFIX + id);
    });

    const results = await pipeline.exec();
    const promemoria = results
      .map(([err, data]) => {
        if (err || !data) return null;
        try {
          const item = JSON.parse(data);
          return user?.ruolo === 'admin' || item.userId === user?.id ? item : null;
        } catch {
          return null;
        }
      })
      .filter(p => p !== null)
      .sort((a, b) => {
        // Ordina per periodo (es. "Gennaio-Marzo" -> in base al mese di inizio)
        const getMonthOrder = (periodo) => {
          const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                       'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
          const first = periodo.split('-')[0].trim();
          const idx = mesi.indexOf(first);
          return idx >= 0 ? idx : 99;
        };
        return getMonthOrder(a.periodo) - getMonthOrder(b.periodo);
      });

    return promemoria;
  }

  // Recupera un singolo promemoria
  static async findById(id, user) {
    const data = await redis.get(KEY_PREFIX + id);
    if (!data) return null;
    try {
      const item = JSON.parse(data);
      return user?.ruolo === 'admin' || item.userId === user?.id ? item : null;
    } catch {
      return null;
    }
  }

  // Elimina un promemoria
  static async delete(id, user) {
    const item = await this.findById(id, user);
    if (!item) return false;
    await redis.del(KEY_PREFIX + id);
    await redis.srem(INDEX_KEY, id);
    return true;
  }

  // Elimina tutti i promemoria (utile per reset)
  static async deleteAll(user) {
    const ids = await redis.smembers(INDEX_KEY);
    if (user?.ruolo !== 'admin') {
      const owned = await this.findAll(user);
      for (const item of owned) await this.delete(item.id, user);
      return true;
    }
    if (ids && ids.length > 0) {
      const keys = ids.map(id => KEY_PREFIX + id);
      await redis.del(keys);
      await redis.del(INDEX_KEY);
    }
    return true;
  }
}

module.exports = PromemoriaModel;