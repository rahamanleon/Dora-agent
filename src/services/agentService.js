const { getAIResponse } = require('../utils/aiHelper');
const memoryService = require('./memoryService');
const { getRelevantMistakes, recordMistake } = require('./mistakeService');

/**
 * Detect if a user message is a correction of the previous AI answer.
 * Returns the extracted correction text, or null if it doesn't match.
 */
function detectCorrection(userMessage) {
  const msg = userMessage.trim();
  const patterns = [
    /^(?:wrong|incorrect|no|actually|correction|fix|error)\b[\s:,]*(.+)/i,
    /^that'?s\s+(?:wrong|incorrect|not\s+right)\b[\s,.:]*(.+)/i,
    /^you'?re\s+wrong\b[\s,.:]*(.+)/i,
    /^it'?s\s+(?:not|actually)\b[\s,.:]*(.+)/i,
    /^(?:the\s+)?correct\s+(?:answer|one|info|information)\s+is\b[\s:,.]+(.+)/i,
    /^(?:i\s+)?(?:mean|meant|said)\b[\s:,.]*(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

/**
 * Core chat logic – now with:
 * - Automatic mistake detection & learning
 * - Injection of past mistakes for context
 * - Automatic web search when AI outputs [SEARCH: ...]
 */
async function chat(userId, message) {
  // Load conversation history (last 50 messages)
  const history = await memoryService.getConversationHistory(userId, 50);

  // ----- AUTOMATIC MISTAKE DETECTION -----
  let correctionMsg = null;
  if (history.length >= 2) {
    const lastAssistant = history.filter(m => m.role === 'assistant').pop();
    const lastUserQuery = history.filter(m => m.role === 'user').pop()?.content || '';
    const correction = detectCorrection(message);

    if (lastAssistant && correction) {
      // Record the mistake
      recordMistake(userId, lastUserQuery, lastAssistant.content, correction);
      // Create a system message to acknowledge the correction
      correctionMsg = {
        role: 'system',
        content: `The user just corrected your previous answer. The correct information is: "${correction}". Please acknowledge this correction briefly and use it going forward.`
      };
    }
  }

  // Add the new user message to history (still in-memory for this request)
  history.push({ role: 'user', content: message });

  // ------ LEARNING INJECTION (past mistakes) ------
  const mistakes = getRelevantMistakes(userId, message);
  let learningSystemMsg = '';
  if (mistakes.length > 0) {
    const mistakesText = mistakes
      .map(m => `• Q: "${m.query}" → Wrong: "${m.wrongAnswer}" → Correct: "${m.correction}"`)
      .join('\n');
    learningSystemMsg = `IMPORTANT: You made mistakes on similar questions before. Learn from these corrections:\n${mistakesText}\n\nNow answer the user's new question correctly.`;
  }

  // Build messages for the AI (system messages first, then conversation)
  let messages = [];
  if (learningSystemMsg) {
    messages.push({ role: 'system', content: learningSystemMsg });
  }
  if (correctionMsg) {
    messages.push(correctionMsg);
  }
  messages = messages.concat(history);

  // ------ AUTO-SEARCH LOOP (inside getAIResponse) ------
  const reply = await getAIResponse(messages);

  // Save assistant reply and the user message to history
  await memoryService.saveConversation(userId, [
    { role: 'user', content: message },
    { role: 'assistant', content: reply }
  ]);

  return { reply };
}

module.exports = { chat };
