// models/users.js - Versione Redis (CORRETTA)
const { getRedisClient } = require('../config/redis');
const bcrypt = require('bcryptjs');

const REDIS_KEYS = {
  USERS: 'ciullotracker:users'
};

class Users {
  // Ottiene tutti gli utenti (con tutti i campi, incluso passwordHash)
  static async getAllUsers() {
    try {
      const redis = getRedisClient();
      const data = await redis.get(REDIS_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Errore lettura utenti:', error.message);
      return [];
    }
  }

  // Trova utente per username
  static async findByUsername(username) {
    try {
      const users = await this.getAllUsers();
      return users.find(u => u.username === username) || null;
    } catch (error) {
      console.error('❌ Errore ricerca utente:', error.message);
      return null;
    }
  }

  // Trova utente per ID
  static async findById(id) {
    try {
      const users = await this.getAllUsers();
      return users.find(u => u.id === id) || null;
    } catch (error) {
      console.error('❌ Errore ricerca utente:', error.message);
      return null;
    }
  }

  // Verifica password
  static verifyPassword(user, password) {
    if (!user || !user.passwordHash) return false;
    return bcrypt.compareSync(password, user.passwordHash);
  }

  // Crea nuovo utente
  static async createUser(username, password, ruolo = 'user') {
    try {
      const users = await this.getAllUsers();
      
      if (users.find(u => u.username === username)) {
        return { ok: false, error: 'Username già in uso' };
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      const newUser = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        username,
        passwordHash,
        ruolo: ruolo || 'user'
      };

      users.push(newUser);
      await this._saveUsers(users);

      return { 
        ok: true, 
        user: { id: newUser.id, username: newUser.username, ruolo: newUser.ruolo } 
      };
    } catch (error) {
      console.error('❌ Errore creazione utente:', error.message);
      return { ok: false, error: 'Errore del server' };
    }
  }

  // Reset password
  static async resetPassword(id, newPassword) {
    try {
      const users = await this.getAllUsers();
      const user = users.find(u => u.id === id);
      if (!user) {
        return { ok: false, error: 'Utente non trovato' };
      }

      const salt = bcrypt.genSaltSync(10);
      user.passwordHash = bcrypt.hashSync(newPassword, salt);
      await this._saveUsers(users);
      return { ok: true };
    } catch (error) {
      console.error('❌ Errore reset password:', error.message);
      return { ok: false, error: 'Errore del server' };
    }
  }

  // Elimina utente
  static async deleteUser(id) {
    try {
      const users = await this.getAllUsers();
      const filtered = users.filter(u => u.id !== id);
      
      if (filtered.length === users.length) {
        return { ok: false, error: 'Utente non trovato' };
      }

      await this._saveUsers(filtered);
      return { ok: true };
    } catch (error) {
      console.error('❌ Errore eliminazione utente:', error.message);
      return { ok: false, error: 'Errore del server' };
    }
  }

  // Assicura che esista un admin di default
  static async ensureDefaultAdmin() {
    const users = await this.getAllUsers();
    const adminExists = users.some(u => u.ruolo === 'admin');
    
    if (!adminExists) {
      console.log('⚠️ Nessun admin trovato, creo admin predefinito...');
      await this.createUser('admin', 'admin123', 'admin');
      console.log('✅ Admin creato: username=admin, password=admin123');
    }
  }

  // Importa da CSV (migrazione)
  static async importFromCsv(csvData) {
    const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;
    try {
      const users = await this.getAllUsers();
      let imported = 0;

      for (const row of csvData) {
        if (!row.username || users.find((u) => u.username === row.username)) continue;

        const rawPassword = row.password || 'password123';
        const passwordHash = BCRYPT_HASH_RE.test(rawPassword)
          ? rawPassword
          : bcrypt.hashSync(rawPassword, bcrypt.genSaltSync(10));

        users.push({
          id: row.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)),
          username: row.username,
          passwordHash,
          ruolo: row.ruolo || 'user',
        });
        imported++;
      }

      if (imported > 0) {
        await this._saveUsers(users);
      }

      return imported;
    } catch (error) {
      console.error('❌ Errore import utenti:', error.message);
      return 0;
    }
  }

  // Metodo privato per salvare su Redis
  static async _saveUsers(users) {
    const redis = getRedisClient();
    await redis.set(REDIS_KEYS.USERS, JSON.stringify(users));
  }
}

module.exports = Users;