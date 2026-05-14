const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Chat
router.post('/', chatController.chat);

// Memory
router.get('/memory', chatController.getMemory);
router.post('/memory', chatController.saveMemory);
router.delete('/memory', chatController.deleteMemory);

// History
router.get('/history', chatController.getHistory);

// ✨ NEW: Feedback for learning from mistakes
router.post('/feedback', chatController.submitFeedback);

module.exports = router;
