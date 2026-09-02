const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

let redisClient = null;
let isConnected = false;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('❌ Impossibile connettersi a Redis dopo 10 tentativi');
          return null;
        }
        return Math.min(times * 100, 3000);
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Connesso a Redis!');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      console.error('❌ Errore Redis:', err.message);
      isConnected = false;
    });
  }
  return redisClient;
}

module.exports = { getRedisClient, isConnected };