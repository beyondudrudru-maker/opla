/**
 * contextRanker/contextRanker.js
 * 
 * PURPOSE
 *   Ranks long-term memory candidates to inject only the most relevant ones.
 *   🚀 UPGRADE: Bilingual (English + Hinglish) explicit reference bonus.
 *   🛡️ UPGRADE: Timestamp fallbacks to prevent NaN math errors.
 *   🚀 UPGRADE: Bilingual Stop-Word filtering to prevent generic word overlap inflation.
 */

const TOP_K = 5;

// 🚀 UPGRADE: Filter out generic conversational words so they don't inflate the similarity score
const STOP_WORDS = new Set([
  'is','the','a','an','and','or','but','if','kya','hai','tha','thi','me','ko',
  'se','ki','pe','yeh','woh','to','for','in','on','of','my','i','you','am','are',
  'was','were','be','been','have','has','do','does','did','will','mera','meri',
  'mujhe','main','hum','hamara','apna','apni','bhai','yaar','acha','theek','kar',
  'raha','rahi','tum','aap','tera','it','this','that','there','here','what','how'
]);

function tokenize(text) {
  const words = (text || '').toLowerCase().match(/[a-z0-9']+/g) || [];
  return new Set(words.filter(w => w.length > 2 && !STOP_WORDS.has(w)));
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
  let timestamp = Date.now();
  
  // 🛡️ UPGRADE: Protect against malformed database strings returning NaN
  if (lastReferenced) {
      const parsed = new Date(lastReferenced).getTime();
      if (!Number.isNaN(parsed)) {
          timestamp = parsed;
      }
  }
  
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
