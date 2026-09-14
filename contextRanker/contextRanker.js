/**
 * contextRanker/contextRanker.js
 * 
 * PURPOSE
 *   Ranks long-term memory candidates to inject only the most relevant ones.
 *   🚀 UPGRADE: Bilingual (English + Hinglish) explicit reference bonus.
 *   🛡️ UPGRADE: Timestamp fallbacks to prevent NaN math errors.
 */

const TOP_K = 5;

function tokenize(text) {
  return new Set((text || '').toLowerCase().match(/[a-z0-9']+/g) || []);
}

function topicSimilarity(message, memoryContent) {
  const a = tokenize(message);
  const b = tokenize(memoryContent);
  if (a.size === 0 || b.size === 0) return 0;
  
  let overlap = 0;
  for (const tok of a) {
    if (b.has(tok)) overlap++;
  }
  
  return overlap / Math.sqrt(a.size * b.size);
}

function recencyDecay(lastReferenced) {
  // Safe fallback to current time if undefined to prevent NaN math errors
  const timestamp = lastReferenced ? new Date(lastReferenced).getTime() : Date.now();
  const days = (Date.now() - timestamp) / 86400000;
  return Math.exp(-days / 14);
}

function explicitReferenceBonus(message) {
  // 🚀 UPGRADE: Added Hinglish/Hindi memory triggers
  const triggers = /remember|last time|you know|earlier|before|that thing|yaad|bataya tha|bola tha|kaha tha|bhool/i;
  return triggers.test(message || '') ? 1 : 0;
}

function rankMemories({ currentMessage, candidates = [] }) {
  const scored = candidates.map((mem) => {
    // 🛡️ Fallback to created_at if last_referenced doesn't exist yet
    const timeRef = mem.last_referenced || mem.created_at;
    
    const score =
      topicSimilarity(currentMessage, mem.content) * 0.4 +
      recencyDecay(timeRef) * 0.2 +
      (mem.emotional_score || 0) * 0.25 +
      explicitReferenceBonus(currentMessage) * 0.15;
      
    return { ...mem, _score: score };
  });

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, TOP_K)
    .filter((m) => m._score > 0.05); // Must meet a minimum relevance threshold
}

function filterWorkingMemory({ turns, currentUserId, isGroupContext = false }) {
  if (isGroupContext) return turns;
  return turns.filter((t) => t.role === 'melody' || t.user_id === currentUserId);
}

module.exports = { rankMemories, filterWorkingMemory, TOP_K };
