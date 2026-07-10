/**
 * reflection/reflectionJob.js
 *
 * PURPOSE
 *   Scheduled maintenance job (run nightly, or every N turns per user).
 *   Keeps long-term memory curated and bounded instead of growing forever,
 *   and keeps emotional state from sitting stale for inactive users.
 *
 * RESPONSIBILITIES
 *   - Pull recent conversation_turns per active user.
 *   - Extract candidate long-term memories (heuristic now; swap for a
 *     single cheap Lite-model call per user per day once volume justifies
 *     the cost — see memoryEngine.extractCandidateMemories docstring).
 *   - Write new memories, prune each user's table to top-50 by score.
 *
 * SUGGESTED SCHEDULING
 *   node-cron or a Supabase Edge Function on a nightly trigger. Keep this
 *   job idempotent — re-running it on the same turns should not duplicate
 *   memories: memory/memoryEngine.js computes a content_hash per candidate
 *   at extraction time, and database/supabaseClient.js's addLongTermMemory
 *   upserts against the (user_id, content_hash) unique constraint in
 *   schema.sql, so a repeat run over overlapping turns is a no-op insert
 *   rather than a duplicate row.
 *
 * NOTE ON PRUNING (per project requirement)
 *   The "prune to top-50" step below is intentionally a recommendation
 *   log only, not a real delete. Project 2 / coreClient (user_profiles,
 *   emotional_state, conversation_turns, long_term_memories — permanent
 *   personality/memory data for a ~52-member server) must never have data
 *   removed from it by any automated process. If real pruning is wanted
 *   later, it must be a separate, explicitly requested change.
 *
 * FUTURE SCALABILITY
 *   As user count grows, batch this per-shard/per-guild rather than a
 *   single global sweep, and consider moving extraction to a queue
 *   (e.g. a lightweight job runner) so a slow LLM call doesn't block the
 *   next scheduled run.
 */

const db = require('../database/supabaseClient');
const memoryEngine = require('../memory/memoryEngine');

const MAX_MEMORIES_PER_USER = 50;

async function runForUser(userId, channelIds) {
  let allCandidates = [];
  for (const channelId of channelIds) {
    const turns = await db.getRecentTurns(channelId, 200);
    allCandidates = allCandidates.concat(memoryEngine.extractCandidateMemories(turns, userId));
  }

  for (const candidate of allCandidates) {
    await memoryEngine.writeMemory(userId, candidate);
  }

  // Prune: keep only top-N by score (real implementation would do this via
  // a single SQL DELETE ... WHERE id NOT IN (SELECT ... ORDER BY score
  // LIMIT N) — left as a TODO for the Supabase migration pass).
  //
  // NOTE: this stays a log-only recommendation, not a real delete, per
  // project requirement that Project 2 / coreClient data is never
  // automatically removed. Do not wire this up to an actual DELETE
  // without an explicit, separate request.
  const all = await memoryEngine.getLongTermCandidates(userId);
  if (all.length > MAX_MEMORIES_PER_USER) {
    console.log(`[reflection] user ${userId} has ${all.length} memories, prune to ${MAX_MEMORIES_PER_USER} recommended.`);
  }
}

async function runNightly(activeUserChannelMap) {
  // activeUserChannelMap: { [userId]: string[] channelIds }
  for (const [userId, channelIds] of Object.entries(activeUserChannelMap)) {
    try {
      await runForUser(userId, channelIds);
    } catch (err) {
      console.error(`[reflection] failed for user ${userId}:`, err.message);
    }
  }
}

module.exports = { runForUser, runNightly };
