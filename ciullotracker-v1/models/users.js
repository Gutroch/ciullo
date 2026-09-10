// models/users.js - Versione Redis (CORRETTA)
const { getRedisClient } = require('../config/redis');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
      console.error(' Errore lettura utenti:', error.message);
      return [];
    }
  }

  // Trova utente per username
  static async findByUsername(username) {
    try {
      const users = await this.getAllUsers();
      return users.find(u => u.username === username) || null;
    } catch (error) {
      console.error(' Errore ricerca utente:', error.message);
      return null;
    }
  }

  // Trova utente per ID
  static async findById(id) {
    try {
      const users = await this.getAllUsers();
      return users.find(u => u.id === id) || null;
    } catch (error) {
      console.error(' Errore ricerca utente:', error.message);
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
      return await this._withLock(async () => {
        const users = await this.getAllUsers();
        if (users.find(u => u.username === username)) return { ok: false, error: 'Username già in uso' };
        const newUser = {
          id: crypto.randomUUID(), username, passwordHash: bcrypt.hashSync(password, 10),
          ruolo: ruolo || 'user', mustChangePassword: false
        };
        users.push(newUser);
        await this._saveUsers(users);
        return { ok: true, user: { id: newUser.id, username: newUser.username, ruolo: newUser.ruolo } };
      });
    } catch (error) {
      console.error(' Errore creazione utente:', error.message);
      return { ok: false, error: 'Errore del server' };
    }
  }

  // Reset password
  static async resetPassword(id, newPassword) {
    try {
      return await this._withLock(async () => {
        const users = await this.getAllUsers();
        const user = users.find(u => u.id === id);
        if (!user) return { ok: false, error: 'Utente non trovato' };
        user.passwordHash = bcrypt.hashSync(newPassword, 10);
        user.mustChangePassword = false;
        await this._saveUsers(users);
        return { ok: true };
      });
    } catch (error) {
      console.error(' Errore reset password:', error.message);
      return { ok: false, error: 'Errore del server' };
    }
  }

  // Elimina utente
  static async deleteUser(id) {
    try {
      return await this._withLock(async () => {
        const users = await this.getAllUsers();
        const filtered = users.filter(u => u.id !== id);
        if (filtered.length === users.length) return { ok: false, error: 'Utente non trovato' };
        await this._saveUsers(filtered);
        return { ok: true };
      });
    } catch (error) {
      console.error(' Errore eliminazione utente:', error.message);
      return { ok: false, error: 'Errore del server' };
    }
  }

  // Assicura che esista un admin di default
  static async ensureDefaultAdmin() {
    return this._withLock(async () => {
      const users = await this.getAllUsers();
      if (users.length > 0) return null;
      const password = crypto.randomBytes(16).toString('base64url');
      const admin = { id: crypto.randomUUID(), username: 'admin', passwordHash: bcrypt.hashSync(password, 10), ruolo: 'admin', mustChangePassword: true };
      await this._saveUsers([admin]);
      console.warn('⚠️ ADMIN INIZIALE: username=admin password=%s. Cambiarla al primo accesso e conservarla in modo sicuro.', password);
      return password;
    });
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
          id: row.id || crypto.randomUUID(),
          username: row.username,
          passwordHash,
          ruolo: row.ruolo || 'user',
          mustChangePassword: false,
        });
        imported++;
      }

      if (imported > 0) {
        await this._saveUsers(users);
      }

      return imported;
    } catch (error) {
      console.error(' Errore import utenti:', error.message);
      return 0;
    }
  }

  // Metodo privato per salvare su Redis
  static async _saveUsers(users) {
    const redis = getRedisClient();
    await redis.set(REDIS_KEYS.USERS, JSON.stringify(users));
  }

  static async changePassword(id, newPassword) {
    return this.resetPassword(id, newPassword);
  }

  // Il lock Redis serializza le modifiche all'array legacy e impedisce lost update tra processi.
  static async _withLock(operation) {
    const redis = getRedisClient();
    const lockKey = 'ciullotracker:users:lock';
    const token = crypto.randomUUID();
    let acquired = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await redis.set(lockKey, token, { NX: true, PX: 5000 })) {
        acquired = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!acquired) throw new Error('Impossibile acquisire il lock Redis utenti.');
    try {
      return await operation();
    } finally {
      const unlock = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
      await redis.eval(unlock, { keys: [lockKey], arguments: [token] });
    }
  }
}

module.exports = Users;