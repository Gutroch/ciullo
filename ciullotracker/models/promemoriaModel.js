// models/promemoriaModel.js
const redis = require('../config/redis');
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
    const promemoria = {
      id,
      descrizione: data.descrizione.trim(),
      periodo: data.periodo.trim(),
      importo: parseFloat(data.importo) || 0,
      scadenza: data.scadenza || null,
      note: data.note || '',
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
  static async findAll() {
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
          return JSON.parse(data);
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
  static async findById(id) {
    const data = await redis.get(KEY_PREFIX + id);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // Elimina un promemoria
  static async delete(id) {
    await redis.del(KEY_PREFIX + id);
    await redis.srem(INDEX_KEY, id);
    return true;
  }

  // Elimina tutti i promemoria (utile per reset)
  static async deleteAll() {
    const ids = await redis.smembers(INDEX_KEY);
    if (ids && ids.length > 0) {
      const keys = ids.map(id => KEY_PREFIX + id);
      await redis.del(keys);
      await redis.del(INDEX_KEY);
    }
    return true;
  }
}

module.exports = PromemoriaModel;