/**
 * reflection/reflectionJob.js
 *
 * PURPOSE
 *   Scheduled maintenance job (run nightly, or every N turns per user).
 *   Keeps long-term memory curated and bounded instead of growing forever,
 *   and keeps emotional state from sitting stale for inactive users.
 *   🚀 UPGRADE: Integrated requestQueue to prevent background jobs from 
 *   rate-limiting or crashing the live chat bot.
 */

const db = require('../database/supabaseClient');
const memoryEngine = require('../memory/memoryEngine');
const requestQueue = require('../utils/requestQueue');

const MAX_MEMORIES_PER_USER = 50;

async function runForUser(userId, channelIds) {
  let allCandidates = [];
  
  for (const channelId of channelIds) {
    try {
      const turns = await db.getRecentTurns(channelId, 200);
      
      // 🚀 UPGRADE: Queued extraction ensures background processing 
      // doesn't starve the live bot of API bandwidth.
      const extracted = await requestQueue.enqueue(() => 
        memoryEngine.extractCandidateMemories(turns, userId)
      );
      
      allCandidates = allCandidates.concat(extracted);
    } catch (channelErr) {
      console.warn(`⚠️ [REFLECTION] Failed to extract memories for user ${userId} in channel ${channelId}:`, channelErr.message);
    }
  }

  for (const candidate of allCandidates) {
    try {
      await memoryEngine.writeMemory(userId, candidate);
    } catch (writeErr) {
      console.warn(`⚠️ [REFLECTION] Failed to write memory for user ${userId}:`, writeErr.message);
    }
  }

  // Prune: keep only top-N by score.
  // NOTE: this stays a log-only recommendation, not a real delete, per
  // project requirement that Project 2 / coreClient data is never
  // automatically removed. Do not wire this up to an actual DELETE
  // without an explicit, separate request.
  try {
    const all = await memoryEngine.getLongTermCandidates(userId);
    if (all.length > MAX_MEMORIES_PER_USER) {
      console.log(`[REFLECTION] User ${userId} has ${all.length} memories. Pruning to ${MAX_MEMORIES_PER_USER} recommended.`);
    }
  } catch (err) {
    console.error(`⚠️ [REFLECTION] Failed to check memory limits for user ${userId}:`, err.message);
  }
}

async function runNightly(activeUserChannelMap) {
  console.log('🌙 [REFLECTION] Nightly memory sweep initiated...');
  
  // activeUserChannelMap: { [userId]: string[] channelIds }
  for (const [userId, channelIds] of Object.entries(activeUserChannelMap)) {
    try {
      await runForUser(userId, channelIds);
    } catch (err) {
      console.error(`❌ [REFLECTION] Critical failure for user ${userId}:`, err.message);
    }
  }
  
  console.log('✅ [REFLECTION] Nightly memory sweep completed.');
}

module.exports = { runForUser, runNightly };
