const Memory = require('../models/Memory');
const Conversation = require('../models/Conversation');

class MemoryService {
  constructor() {
    this.memoryCache = new Map();
    this.conversationCache = new Map();
  }

  async safeOp(operation, fallback = null) {
    try {
      return await operation();
    } catch (err) {
      const errorPatterns = [
        'not allowed', 'Unauthorized', 'not authorized',
        'does not have permission', 'user is not allowed'
      ];
      const isPermissionError = err.code === 8000 ||
        errorPatterns.some(p => err.message && err.message.toLowerCase().includes(p.toLowerCase()));
      if (isPermissionError) {
        console.warn('[MemoryService] MongoDB permission denied, using in-memory fallback:', err.message);
        return fallback;
      }
      throw err;
    }
  }

  async save(userId, key, value) {
    return this.safeOp(async () => {
      const memory = new Memory({ user_id: userId, key, value });
      await memory.save();
      return memory;
    }, { user_id: userId, key, value, timestamp: new Date() });
  }

  async get(userId, key = null) {
    return this.safeOp(async () => {
      const query = { user_id: userId };
      if (key) query.key = key;
      return Memory.find(query).sort({ timestamp: -1 }).limit(50);
    }, (this.memoryCache.get(userId) || []).filter(m => !key || m.key === key));
  }

  async getRecent(userId, limit = 10) {
    return this.safeOp(async () => {
      return Memory.find({ user_id: userId })
        .sort({ timestamp: -1 })
        .limit(limit);
    }, (this.memoryCache.get(userId) || []).slice(0, limit));
  }

  async getContext(userId, query) {
    const search = query.toLowerCase();
    return this.safeOp(async () => {
      return Memory.find({
        user_id: userId,
        $or: [
          { key: { $regex: query, $options: 'i' } },
          { value: { $regex: query, $options: 'i' } }
        ]
      }).limit(10);
    }, (this.memoryCache.get(userId) || []).filter(m =>
      m.key.toLowerCase().includes(search) || m.value.toLowerCase().includes(search)
    ));
  }

  // ✨ UPDATED: now accepts either a single message OR an array of messages
  async saveConversation(userId, messagesOrRole, maybeContent) {
    if (Array.isArray(messagesOrRole)) {
      // Array of {role, content} objects
      for (const msg of messagesOrRole) {
        await this._saveSingleConversation(userId, msg.role, msg.content);
      }
      return;
    }
    // Single call: saveConversation(userId, role, content)
    return this._saveSingleConversation(userId, messagesOrRole, maybeContent);
  }

  // Internal single save
  async _saveSingleConversation(userId, role, content) {
    return this.safeOp(async () => {
      const conv = new Conversation({ user_id: userId, role, content });
      await conv.save();
      return conv;
    }, (() => {
      const entry = { user_id: userId, role, content, timestamp: new Date() };
      if (!this.conversationCache.has(userId)) {
        this.conversationCache.set(userId, []);
      }
      this.conversationCache.get(userId).push(entry);
      return entry;
    })());
  }

  async getConversationHistory(userId, limit = 20) {
    return this.safeOp(async () => {
      return Conversation.find({ user_id: userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .then(docs => docs.reverse());
    }, (this.conversationCache.get(userId) || []).slice(-limit));
  }

  async clearMemory(userId, key = null) {
    return this.safeOp(async () => {
      const query = { user_id: userId };
      if (key) query.key = key;
      return Memory.deleteMany(query);
    }, (() => {
      const existing = this.memoryCache.get(userId) || [];
      this.memoryCache.set(userId, key
        ? existing.filter(m => m.key !== key)
        : []
      );
      return { deletedCount: key ? existing.filter(m => m.key === key).length : existing.length };
    })());
  }
}

module.exports = new MemoryService();
