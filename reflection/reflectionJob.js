/**
 * reflection/reflectionJob.js
 *
 * PURPOSE
 *   Scheduled maintenance job (run nightly, or every N turns per user).
 *   Keeps long-term memory curated and bounded instead of growing forever,
 *   and keeps emotional state from sitting stale for inactive users.
 *   🚀 UPGRADE: Integrated requestQueue to prevent background jobs from 
 *   rate-limiting or crashing the live chat bot.
 *   🚀 NEW: Added start() function to initialize the background cron-like loop.
 *   🛡️ FIX: Activity detection now reads from `conversation_turns` (coreClient,
 *   24h retention) instead of `chat_ram` (ramClient, 5h retention). chat_ram
 *   gets wiped down to a 5-hour rolling window by a separate hourly cron in
 *   index.js, so querying it for "who was active in the last 24h" was
 *   silently missing every user whose last message was more than 5 hours
 *   before the sweep ran — they got zero memory extraction for that day.
 */

const db = require('../database/supabaseClient');
const memoryEngine = require('../memory/memoryEngine');
const requestQueue = require('../utils/requestQueue');

const MAX_MEMORIES_PER_USER = 50;
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours

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

// 🚀 NEW: The initialization function called by index.js
function start() {
  // We set an interval to run this automatically in the background
  setInterval(async () => {
    console.log('🔄 [REFLECTION] Starting scheduled background job...');
    try {
      // 🛡️ FIX: Was checking db.ramClient and querying chat_ram, which only
      // holds a 5-hour rolling window (see index.js's hourly wipe cron).
      // conversation_turns (coreClient) now holds a matching 24h window
      // (see index.js's 24h cleanup cron), so this correctly sees the full
      // sweep period instead of silently missing anyone inactive in the
      // last 5 hours.
      if (!db.coreClient) {
        console.warn('⚠️ [REFLECTION] No coreClient found. Skipping sweep.');
        return;
      }

      const twentyFourHoursAgo = new Date(Date.now() - SWEEP_INTERVAL_MS).toISOString();
      const { data, error } = await db.coreClient
        .from('conversation_turns')
        .select('user_id, channel_id')
        .eq('role', 'user') // only real user turns — 'melody' turns aren't extraction candidates anyway
        .gte('created_at', twentyFourHoursAgo);

      if (error) throw error;

      const activeUserChannelMap = {};
      
      if (data && data.length > 0) {
        data.forEach(row => {
          if (!row.user_id) return;
          
          if (!activeUserChannelMap[row.user_id]) {
            activeUserChannelMap[row.user_id] = new Set();
          }
          activeUserChannelMap[row.user_id].add(row.channel_id);
        });
      }

      // Convert Sets back to Arrays for runNightly
      const mapForSweep = {};
      for (const [uid, cSet] of Object.entries(activeUserChannelMap)) {
        mapForSweep[uid] = Array.from(cSet);
      }

      if (Object.keys(mapForSweep).length > 0) {
        await runNightly(mapForSweep);
      } else {
        console.log('⏩ [REFLECTION] No active users in the last 24h. Nothing to sweep.');
      }

    } catch (err) {
      console.error('❌ [REFLECTION] Background job failed:', err.message);
    }
  }, SWEEP_INTERVAL_MS);
}

module.exports = { runForUser, runNightly, start };
