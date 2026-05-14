// In-memory store (replace with MongoDB later)
const mistakesStore = new Map(); // userId → [ { query, wrongAnswer, correction, timestamp } ]

function recordMistake(userId, query, wrongAnswer, correction) {
  if (!mistakesStore.has(userId)) mistakesStore.set(userId, []);
  const list = mistakesStore.get(userId);
  list.push({ query, wrongAnswer, correction, timestamp: new Date().toISOString() });
  if (list.length > 100) mistakesStore.set(userId, list.slice(-100)); // keep last 100
}

function getRelevantMistakes(userId, currentQuery) {
  const list = mistakesStore.get(userId) || [];
  if (!list.length) return [];
  const qLower = currentQuery.toLowerCase();
  // simple keyword overlap (you can upgrade to embedding search later)
  return list.filter(m => {
    const pastWords = m.query.toLowerCase().split(/\s+/);
    return pastWords.some(w => w.length > 3 && qLower.includes(w));
  });
}

module.exports = { recordMistake, getRelevantMistakes };
