const { randomUUID } = require('crypto');
const { getRedisClient } = require('../config/redis');

const MAX_CONVERSATIONS = 10;
const MAX_MESSAGES = 12;
const NEW_CONVERSATION_TITLE = 'Nuova conversazione';
const REDIS_PREFIX = 'ciullotracker:jonny:conversations:';

function redisKey(userId) {
  const encodedId = Buffer.from(String(userId)).toString('base64url');
  return REDIS_PREFIX + encodedId;
}

async function readConversations(userId) {
  const redis = getRedisClient();
  const serialized = await redis.get(redisKey(userId));
  if (!serialized) return [];

  try {
    const conversations = JSON.parse(serialized);
    return Array.isArray(conversations) ? conversations : [];
  } catch (error) {
    console.error(' Errore lettura cronologia Jonny:', error.message);
    return [];
  }
}

async function saveConversations(userId, conversations) {
  const retained = conversations
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
  const redis = getRedisClient();
  await redis.set(redisKey(userId), JSON.stringify(retained));
  return retained;
}

function createConversation() {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: NEW_CONVERSATION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

class JonnyConversations {
  static async list(userId) {
    return readConversations(userId);
  }

  static async find(userId, conversationId) {
    const conversations = await readConversations(userId);
    return conversations.find((conversation) => conversation.id === conversationId) || null;
  }

  static async create(userId) {
    const conversations = await readConversations(userId);
    const conversation = createConversation();
    const saved = await saveConversations(userId, [conversation, ...conversations]);
    return { conversation, conversations: saved };
  }

  static async update(userId, conversationId, messages, title) {
    const conversations = await readConversations(userId);
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return null;

    conversation.messages = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
    if (title && conversation.title === NEW_CONVERSATION_TITLE) {
      conversation.title = title.trim().slice(0, 48) || NEW_CONVERSATION_TITLE;
    }
    conversation.updatedAt = new Date().toISOString();

    const saved = await saveConversations(userId, conversations);
    return saved.find((item) => item.id === conversationId) || null;
  }
}

module.exports = { JonnyConversations, MAX_CONVERSATIONS };