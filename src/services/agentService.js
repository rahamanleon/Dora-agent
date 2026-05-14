const { getAIResponse } = require('../utils/aiHelper');
const memoryService = require('./memoryService');
const { getRelevantMistakes } = require('./mistakeService');

/**
 * Core chat logic – now with:
 * - Learning from past mistakes
 * - Automatic web search when AI outputs [SEARCH: ...]
 */
async function chat(userId, message) {
  // Load conversation history (last 50 messages)
  const history = await memoryService.getConversationHistory(userId, 50);
  history.push({ role: 'user', content: message });

  // ------ LEARNING INJECTION ------
  const mistakes = getRelevantMistakes(userId, message);
  let learningSystemMsg = '';
  if (mistakes.length > 0) {
    const mistakesText = mistakes
      .map(m => `• Q: "${m.query}" → Wrong: "${m.wrongAnswer}" → Correct: "${m.correction}"`)
      .join('\n');
    learningSystemMsg = `IMPORTANT: You made mistakes on similar questions before. Learn from these corrections:\n${mistakesText}\n\nNow answer the user's new question correctly.`;
  }

  // Build messages for the AI
  let messages = [];
  if (learningSystemMsg) {
    messages.push({ role: 'system', content: learningSystemMsg });
  }
  messages = messages.concat(history);

  // ------ AUTO-SEARCH LOOP (inside getAIResponse) ------
  // getAIResponse now handles the [SEARCH: ...] marker automatically
  const reply = await getAIResponse(messages);

  // Save assistant reply to history
  await memoryService.saveConversation(userId, [
    { role: 'user', content: message },
    { role: 'assistant', content: reply }
  ]);

  return { reply };
}

module.exports = { chat };
