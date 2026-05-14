const agentService = require('../services/agentService');
const memoryService = require('../services/memoryService');
const mistakeService = require('../services/mistakeService');   // ✨ NEW

async function chat(req, res) {
  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, message'
      });
    }

    if (typeof message !== 'string' || message.length > 10000) {
      return res.status(400).json({
        error: 'Invalid message format or too long'
      });
    }

    const result = await agentService.chat(user_id, message);
    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getMemory(req, res) {
  try {
    const { user_id, key, limit } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const memories = key 
      ? await memoryService.get(user_id, key)
      : await memoryService.getRecent(user_id, parseInt(limit) || 20);

    res.json({ memories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function saveMemory(req, res) {
  try {
    const { user_id, key, value } = req.body;

    if (!user_id || !key || !value) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const memory = await memoryService.save(user_id, key, value);
    res.json({ success: true, memory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function deleteMemory(req, res) {
  try {
    const { user_id, key } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const result = await memoryService.clearMemory(user_id, key);
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getHistory(req, res) {
  try {
    const { user_id, limit } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    const history = await memoryService.getConversationHistory(
      user_id,
      parseInt(limit) || 50
    );

    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ✨ NEW: Feedback endpoint for learning from mistakes
async function submitFeedback(req, res) {
  try {
    const { user_id, query, wrong_answer, correction } = req.body;

    if (!user_id || !query || !correction) {
      return res.status(400).json({ error: 'user_id, query, correction required' });
    }

    mistakeService.recordMistake(user_id, query, wrong_answer || '', correction);
    res.json({ message: 'Feedback recorded. I’ll learn from this mistake.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  chat,
  getMemory,
  saveMemory,
  deleteMemory,
  getHistory,
  submitFeedback   // ✨ added
};
