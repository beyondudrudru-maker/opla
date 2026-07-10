/**
 * memory/memoryEngine.js
 *
 * PURPOSE
 *   Owns storage and coarse retrieval across memory tiers. Ranking/scoring
 *   of *which* memories make it into a prompt is a separate concern, owned
 *   by contextRanker — this module's job is fetching candidates and writing
 *   new memories, not deciding final relevance.
 *
 * TIERS
 *   - Working memory: last 8-12 raw turns in the *current session* (a
 *     session = a burst of activity within a 30-60 min gap). Purpose:
 *     pronoun/reference coherence, not knowledge.
 *   - Long-term memory: curated, distilled facts/events per user, written
 *     by extractCandidateMemories (normally run by reflection/reflectionJob,
 *     exposed here too for on-demand extraction).
 *
 * RESPONSIBILITIES
 *   - getWorkingMemory(channelId): last N turns, session-aware.
 *   - getLongTermCandidates(userId): all curated memories for ranking.
 *   - recordTurn(turn): persist a raw turn.
 *   - extractCandidateMemories(turns): lightweight heuristic extraction of
 *     durable facts from a batch of turns (real production version should
 *     replace the heuristic with a single cheap Lite-model call, see
 *     reflection/reflectionJob.js for where that swap happens). Also
 *     computes content_hash per candidate (see writeMemory).
 *   - writeMemory(userId, memory): persist one candidate. Relies on
 *     memory.content_hash being set (extractCandidateMemories does this)
 *     so database/supabaseClient.js's addLongTermMemory can dedupe against
 *     the (user_id, content_hash) unique constraint in schema.sql. This is
 *     what makes reflectionJob.runNightly idempotent across repeated runs
 *     over overlapping turns — a previously-written memory is silently
 *     skipped instead of duplicated.
 *
 * NOTE ON DELETION
 *   Nothing in this module deletes long-term memories. Pruning is
 *   deliberately not implemented anywhere in this codebase (see
 *   reflection/reflectionJob.js header) — long_term_memories is
 *   append/no-duplicate-only by project requirement.
 *
 * FUTURE SCALABILITY
 *   Long-term memory table will grow unbounded per active user (by
 *   design, per project requirement — no auto-prune). If you need
 *   semantic (embedding) search over memories at scale, add a `pgvector`
 *   column to long_term_memories and swap the topic_similarity scorer in
 *   contextRanker for a cosine-similarity query — nothing else changes.
 */

const crypto = require('crypto');
const db = require('../database/supabaseClient');

const SESSION_GAP_MINUTES = 45;
const WORKING_MEMORY_SIZE = 10;

async function recordTurn({ channelId, userId, role, content, sessionId }) {
  await db.appendConversationTurn({ channel_id: channelId, user_id: userId, role, content, session_id: sessionId });
}

async function getWorkingMemory(channelId) {
  const turns = await db.getRecentTurns(channelId, WORKING_MEMORY_SIZE * 2);
  if (turns.length === 0) return [];

  // Trim to the current session only: walk backward from the latest turn,
  // stop at the first gap larger than SESSION_GAP_MINUTES.
  const session = [turns[turns.length - 1]];
  for (let i = turns.length - 2; i >= 0; i--) {
    const gapMs = new Date(turns[i + 1].created_at) - new Date(turns[i].created_at);
    if (gapMs / 60000 > SESSION_GAP_MINUTES) break;
    session.unshift(turns[i]);
  }
  return session.slice(-WORKING_MEMORY_SIZE);
}

async function getLongTermCandidates(userId) {
  return db.getLongTermMemories(userId);
}

/**
 * Deterministic content hash used for dedup on write. Same shape as
 * reflection/reflectionJob.js would expect: sha256 of
 * "<userId>::<lowercased, trimmed content>". Kept here (not in
 * supabaseClient.js) because hashing is a memory-shaping concern, not a
 * DB-access concern — supabaseClient just persists whatever hash it's
 * given.
 */
function computeContentHash(userId, content) {
  return crypto.createHash('sha256').update(`${userId}::${content.trim().toLowerCase()}`).digest('hex');
}

/**
 * Heuristic extraction: flags turns that look durable/significant (long
 * enough, contains a personal disclosure marker, or a preference marker).
 * This is intentionally simple — swap for a Lite-model call in production
 * (see reflection/reflectionJob.js) once volume justifies the extra cost.
 */
const SIGNIFICANCE_MARKERS = [
  { pattern: /i (feel|felt|am|was) (sad|anxious|happy|proud|scared|excited|worried)/i, score: 0.7 },
  { pattern: /i (love|hate|prefer|really like|can't stand)/i, score: 0.5 },
  { pattern: /my (project|job|exam|birthday|family|dog|cat)/i, score: 0.4 },
  { pattern: /remember (this|when|that)/i, score: 0.6 },
];

function extractCandidateMemories(turns, userId) {
  const candidates = [];
  for (const turn of turns) {
    if (turn.role !== 'user' || turn.user_id !== userId) continue;
    for (const { pattern, score } of SIGNIFICANCE_MARKERS) {
      if (pattern.test(turn.content)) {
        const content = turn.content.slice(0, 300);
        candidates.push({
          content,
          content_hash: computeContentHash(userId, content),
          topic_tags: [],
          emotional_score: score,
        });
        break;
      }
    }
  }
  return candidates;
}

async function writeMemory(userId, memory) {
  // content_hash should already be set by extractCandidateMemories, but
  // compute it here too as a safety net for any future caller that
  // constructs a memory object by hand instead of via extraction.
  const withHash = memory.content_hash
    ? memory
    : { ...memory, content_hash: computeContentHash(userId, memory.content) };

  await db.addLongTermMemory(userId, withHash);
}

module.exports = {
  recordTurn,
  getWorkingMemory,
  getLongTermCandidates,
  extractCandidateMemories,
  writeMemory,
  computeContentHash,
  WORKING_MEMORY_SIZE,
};
