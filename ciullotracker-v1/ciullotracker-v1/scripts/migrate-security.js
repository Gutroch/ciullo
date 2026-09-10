const { getRedisClient } = require('../config/redis');
const Users = require('../models/users');

async function migrate() {
  const redis = getRedisClient();
  const users = await Users.getAllUsers();
  const admin = users.find(user => user.ruolo === 'admin');
  if (!admin) throw new Error('Nessun admin disponibile: eseguire prima il bootstrap applicativo.');

  const expensesKey = 'ciullotracker:expenses';
  const expensesRaw = await redis.get(expensesKey);
  if (expensesRaw) {
    const expenses = JSON.parse(expensesRaw);
    let changed = false;
    for (const expense of expenses) {
      if (!expense.userId) {
        expense.userId = admin.id;
        changed = true;
      }
    }
    if (changed) await redis.set(expensesKey, JSON.stringify(expenses));
  }

  const recurringKey = 'ciullotracker:recurring';
  const recurringRaw = await redis.get(recurringKey);
  if (recurringRaw) {
    const recurring = JSON.parse(recurringRaw);
    let changed = false;
    for (const item of recurring) {
      if (!item.userId) {
        item.userId = admin.id;
        changed = true;
      }
    }
    if (changed) await redis.set(recurringKey, JSON.stringify(recurring));
  }

  const ids = await redis.smembers('promemoria:ids');
  for (const id of ids) {
    const key = `promemoria:${id}`;
    const raw = await redis.get(key);
    if (!raw) continue;
    const item = JSON.parse(raw);
    if (!item.userId) {
      item.userId = admin.id;
      await redis.set(key, JSON.stringify(item));
    }
  }

  console.log('Migrazione security completata: record legacy assegnati all\'admin.');
  await redis.quit();
}

migrate().catch(async error => {
  console.error('Migrazione fallita:', error.message);
  try { await getRedisClient().quit(); } catch {}
  process.exitCode = 1;
});
