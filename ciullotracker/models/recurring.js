// models/recurring.js - Versione Redis
const { getRedisClient } = require('../config/redis');
const Expenses = require('./expenses');

const REDIS_KEYS = {
  RECURRING: 'ciullotracker:recurring'
};

class Recurring {
  static CATEGORIE = Expenses.CATEGORIE;

  // Ottiene tutte le ricorrenze
  static async getAll() {
    try {
      const redis = getRedisClient();
      const data = await redis.get(REDIS_KEYS.RECURRING);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Errore lettura ricorrenze:', error.message);
      return [];
    }
  }

  // Aggiunge una nuova ricorrenza
  static async add(data) {
    try {
      const redis = getRedisClient();
      const recurring = await this.getAll();
      
      const newItem = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        descrizione: data.descrizione,
        importo: parseFloat(data.importo),
        tipo: data.tipo || 'uscita',
        categoria: data.categoria || 'Altro',
        ricorrenza: data.ricorrenza || 'mesi',
        mesi: data.mesi || [],
        giorno: parseInt(data.giorno) || 1,
        inserito_da: data.inserito_da || 'system',
        per_conto_di: data.per_conto_di || 'system',
        attivo: true,
        ultima_esecuzione: null
      };
      
      recurring.push(newItem);
      await redis.set(REDIS_KEYS.RECURRING, JSON.stringify(recurring));
      
      return newItem;
    } catch (error) {
      console.error('❌ Errore aggiunta ricorrenza:', error.message);
      throw error;
    }
  }

  // Toggle attivo/disattivo
  static async toggleAttivo(id) {
    try {
      const redis = getRedisClient();
      const recurring = await this.getAll();
      const item = recurring.find(r => r.id === id);
      
      if (item) {
        item.attivo = !item.attivo;
        await redis.set(REDIS_KEYS.RECURRING, JSON.stringify(recurring));
      }
      
      return item;
    } catch (error) {
      console.error('❌ Errore toggle ricorrenza:', error.message);
      return null;
    }
  }

  // Elimina ricorrenza
  static async remove(id) {
    try {
      const redis = getRedisClient();
      const recurring = await this.getAll();
      const filtered = recurring.filter(r => r.id !== id);
      
      if (filtered.length === recurring.length) return false;
      
      await redis.set(REDIS_KEYS.RECURRING, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('❌ Errore eliminazione ricorrenza:', error.message);
      return false;
    }
  }

  // Ottiene le prossime scadenze
  static async getUpcoming(giorni = 7) {
    try {
      const recurring = await this.getAll();
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + giorni);
      
      return recurring.filter(r => {
        if (!r.attivo) return false;
        // Logica semplificata: controlla se il giorno è nei prossimi X giorni
        const giorno = r.giorno;
        const todayDay = today.getDate();
        const futureDay = future.getDate();
        
        if (giorno >= todayDay && giorno <= futureDay) {
          return true;
        }
        return false;
      });
    } catch (error) {
      console.error('❌ Errore getUpcoming:', error.message);
      return [];
    }
  }

  // Processa le ricorrenze scadute
  static async processDueRecurring() {
    console.log('🔄 Controllo spese ricorrenti scadute...');
    
    try {
      const recurring = await this.getAll();
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      
      let executed = 0;
      
      for (const item of recurring) {
        if (!item.attivo) continue;
        if (item.ultima_esecuzione === todayStr) continue;
        
        // Controlla se deve essere eseguita oggi
        const shouldRun = await this.shouldRunToday(item);
        
        if (shouldRun) {
          console.log(`📝 Eseguo ricorrente: ${item.descrizione}`);
          await this.execute(item);
          executed++;
        }
      }
      
      if (executed > 0) {
        console.log(`✅ Eseguite ${executed} ricorrenze`);
      }
      
      return executed;
    } catch (error) {
      console.error('❌ Errore processDueRecurring:', error.message);
      return 0;
    }
  }

  // Verifica se deve essere eseguita oggi
  static async shouldRunToday(item) {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    
    // Controlla il giorno
    if (day !== item.giorno) return false;
    
    // Controlla la ricorrenza
    switch (item.ricorrenza) {
      case 'mesi':
        return item.mesi.includes(month);
      case 'settimanale':
        return true;
      case 'bimestrale':
        return month % 2 === 0;
      case 'trimestrale':
        return month % 3 === 0;
      case 'semestrale':
        return month % 6 === 0;
      case 'annuale':
        return month === 1;
      default:
        return false;
    }
  }

  // Esegue la ricorrenza
  static async execute(item) {
    try {
      const redis = getRedisClient();
      
      // Crea la spesa
      await Expenses.addExpense({
        data_spesa: new Date().toISOString().slice(0, 10),
        importo: item.importo,
        tipo: item.tipo,
        categoria: item.categoria,
        inserito_da: item.inserito_da,
        per_conto_di: item.per_conto_di,
        note: `[Ricorrente] ${item.descrizione}`
      });
      
      // Aggiorna ultima esecuzione
      const recurring = await this.getAll();
      const found = recurring.find(r => r.id === item.id);
      if (found) {
        found.ultima_esecuzione = new Date().toISOString().slice(0, 10);
        await redis.set(REDIS_KEYS.RECURRING, JSON.stringify(recurring));
      }
      
      return true;
    } catch (error) {
      console.error('❌ Errore esecuzione ricorrenza:', error.message);
      return false;
    }
  }
}

module.exports = Recurring;