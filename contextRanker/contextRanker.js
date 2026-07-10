/**
 * contextRanker/contextRanker.js
 *
 * PURPOSE
 *   Decides *which* candidate memories (from memoryEngine) actually make it
 *   into the assembled prompt. This is what replaces "dump the last 20
 *   messages" with "rank, then take the top few" — the single highest-
 *   leverage change over the original architecture.
 *
 * RESPONSIBILITIES
 *   - Score each long-term memory candidate against the current message.
 *   - Select top-K (default 5), never all candidates.
 *   - Filter out other-users' memories from 1:1 exchanges (pollution guard).
 *
 * SCORING FORMULA
 *   score = topic_similarity*0.4 + recency_decay*0.2
 *         + emotional_significance*0.25 + explicit_reference_bonus*0.15
 *
 * INPUTS
 *   { currentMessage, candidates: LongTermMemory[], currentUserId }
 *
 * OUTPUTS
 *   LongTermMemory[] (top-K, already sorted, ready to render as bullets)
 *
 * FUTURE SCALABILITY
 *   topic_similarity is currently a cheap token-overlap heuristic. Swap for
 *   embedding cosine similarity (pgvector) once memory volume per user
 *   makes token overlap too coarse — the scoring formula and consumers
 *   don't need to change, only this one function.
 *
 * TRADEOFFS
 *   Token-overlap similarity is fast and free but misses paraphrase/synonym
 *   matches an embedding model would catch. Acceptable at current scale;
 *   revisit if users report Melody "forgetting" clearly-related context.
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
  for (const tok of a) if (b.has(tok)) overlap++;
  return overlap / Math.sqrt(a.size * b.size); // cosine-ish over token sets
}

function recencyDecay(lastReferenced) {
  const days = (Date.now() - new Date(lastReferenced).getTime()) / 86400000;
  return Math.exp(-days / 14); // ~14-day half-scale decay
}

function explicitReferenceBonus(message) {
  return /remember|last time|you know|earlier|before|that thing/i.test(message) ? 1 : 0;
}

function rankMemories({ currentMessage, candidates = [] }) {
  const scored = candidates.map((mem) => {
    const score =
      topicSimilarity(currentMessage, mem.content) * 0.4 +
      recencyDecay(mem.last_referenced) * 0.2 +
      (mem.emotional_score || 0) * 0.25 +
      explicitReferenceBonus(currentMessage) * 0.15;
    return { ...mem, _score: score };
  });

  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, TOP_K)
    .filter((m) => m._score > 0.05);
}

/**
 * Filters working-memory turns down to only the current speaker + direct
 * replies/mentions of them, unless the channel context is explicitly
 * multi-party (group banter) — prevents cross-talk pollution in 1:1s.
 */
function filterWorkingMemory({ turns, currentUserId, isGroupContext = false }) {
  if (isGroupContext) return turns;
  return turns.filter((t) => t.role === 'melody' || t.user_id === currentUserId);
}

module.exports = { rankMemories, filterWorkingMemory, TOP_K };
