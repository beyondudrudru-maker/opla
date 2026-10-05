/**
 * database/supabaseClient.js
 *
 * PURPOSE
 *   Two shared Supabase clients + typed accessor functions, split across
 *   two separate Supabase projects:
 *
 *     ramClient  -> Project 1 ("RAM"): chat_ram, the lightweight ephemeral
 *                   activity log. Retention: 5 hours (wiped in index.js).
 *
 *     coreClient -> Project 2 ("Core"): persistent stats, emotions,
 *                   memory, and behavior tables owned by Melody's pipeline.
 *                   conversation_turns retention: 24 hours (wiped in index.js).
 *
 *   🧠 HYBRID MEMORY (chat_ram = LTM store)
 *   chat_ram rows now carry `intent` + `expires_at`, both computed in Node at
 *   WRITE time (see memory/retention.js): 24h for CHAT, 72h for STRATEGY/BOSS.
 *     - insertChatRamEntry : stamps intent/expires_at on every write
 *     - getUserChatRam     : channel-scoped, TTL-aware read for `!summary @user`
 *     - deleteExpiredChatRam: batched purge used by cleanDb.js
 *   Permanent tables (user_profiles, game_state, bot instructions, ...) are never
 *   referenced by any purge function in this file.
 *
 *   🛡️ FIX: Added `deleteOldConversationTurns` — index.js was importing and
 *   calling this function, but it never existed in this file's exports.
 *   Every call silently threw "not a function" and was swallowed by
 *   index.js's catch block, meaning conversation_turns was NEVER being
 *   cleaned up and was growing unbounded since launch.
 */

const { createClient } = require('@supabase/supabase-js');
const { buildRetentionFields } = require('../memory/retention');

// ---- Project 1: RAM (short-term ephemeral chat_ram store) ----
const ramUrl = process.env.SUPABASE_URL_1;
const ramKey = process.env.SUPABASE_KEY_1;

let ramClient = null;
if (ramUrl && ramKey) {
  ramClient = createClient(ramUrl, ramKey);
  console.log('🧠 RAM Database Connection Established successfully.');
} else {
  console.warn('⚠️  RAM Supabase credentials missing (SUPABASE_URL_1 / SUPABASE_KEY_1) — running with in-memory fallback store.');
}

// ---- Project 2: Core (persistent profiles/emotion/memory/moderation) ----
const coreUrl = process.env.SUPABASE_URL_2;
const coreKey = process.env.SUPABASE_KEY_2;

let coreClient = null;
if (coreUrl && coreKey) {
  coreClient = createClient(coreUrl, coreKey);
  console.log('🧠 Core Database Connection Established successfully.');
} else {
  console.warn('⚠️  Core Supabase credentials missing (SUPABASE_URL_2 / SUPABASE_KEY_2) — running with in-memory fallback store.');
}

// ---- In-memory fallbacks so the bot still runs without Supabase configured ----
const ramMemoryStore = {
  chatRam: [],
};

const coreMemoryStore = {
  userProfiles: new Map(),
  emotionalState: new Map(),
  conversationTurns: [],
  longTermMemories: new Map(), // userId -> array
  moderationFlags: new Map(),  // userId -> array
};

// ==========================================
// CORE ACCESSORS (route through coreClient)
// ==========================================

async function getUserProfile(userId) {
  if (coreClient) {
    const { data, error } = await coreClient.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }
  return coreMemoryStore.userProfiles.get(userId) || null;
}

async function upsertUserProfile(userId, patch) {
  if (coreClient) {
    const { data, error } = await coreClient
      .from('user_profiles')
      .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  const existing = coreMemoryStore.userProfiles.get(userId) || { user_id: userId };
  const merged = { ...existing, ...patch };
  coreMemoryStore.userProfiles.set(userId, merged);
  return merged;
}

async function getEmotionalState(userId) {
  if (coreClient) {
    const { data, error } = await coreClient.from('emotional_state').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }
  return coreMemoryStore.emotionalState.get(userId) || null;
}

async function upsertEmotionalState(userId, state) {
  if (coreClient) {
    const { data, error } = await coreClient
      .from('emotional_state')
      .upsert({ user_id: userId, ...state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  const record = { ...state, user_id: userId, updated_at: new Date().toISOString() };
  coreMemoryStore.emotionalState.set(userId, record);
  return record;
}

async function appendConversationTurn(turn) {
  if (coreClient) {
    const { error } = await coreClient.from('conversation_turns').insert(turn);
    if (error) throw error;
    return;
  }
  coreMemoryStore.conversationTurns.push({ ...turn, created_at: new Date().toISOString() });
}

async function getRecentTurns(channelId, limit = 12) {
  if (coreClient) {
    const { data, error } = await coreClient
      .from('conversation_turns')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).reverse();
  }
  return coreMemoryStore.conversationTurns
    .filter((t) => t.channel_id === channelId)
    .slice(-limit);
}

// 🛡️ FIX: This was missing entirely. index.js has been calling
// `deleteOldConversationTurns` since launch and getting `undefined`,
// meaning conversation_turns has never actually been cleaned up.
async function deleteOldConversationTurns(cutoffIso) {
  if (coreClient) {
    const { error } = await coreClient.from('conversation_turns').delete().lt('created_at', cutoffIso);
    if (error) throw error;
    return;
  }
  coreMemoryStore.conversationTurns = coreMemoryStore.conversationTurns.filter((t) => t.created_at >= cutoffIso);
}

// 🚀 OPTIMIZED: Dynamic limits and recency ordering
async function getLongTermMemories(userId, limit = 30) {
  // Absolute safety bound to protect Render RAM
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);

  if (coreClient) {
    const { data, error } = await coreClient
      .from('long_term_memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw error;
    return data || [];
  }
  
  const list = coreMemoryStore.longTermMemories.get(userId) || [];
  return list.slice(-safeLimit).reverse();
}

async function addLongTermMemory(userId, memory) {
  if (coreClient) {
    if (!memory.content_hash) {
      throw new Error('addLongTermMemory: memory.content_hash is required for dedup — compute it in memoryEngine before calling this.');
    }
    const { error } = await coreClient
      .from('long_term_memories')
      .upsert({ user_id: userId, ...memory }, { onConflict: 'user_id,content_hash', ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  
  const list = coreMemoryStore.longTermMemories.get(userId) || [];
  if (memory.content_hash && list.some((m) => m.content_hash === memory.content_hash)) {
    return; 
  }
  list.push({ ...memory, created_at: new Date().toISOString(), last_referenced: new Date().toISOString() });
  coreMemoryStore.longTermMemories.set(userId, list);
}

async function addModerationFlag(userId, flag) {
  if (coreClient) {
    const { error } = await coreClient.from('moderation_flags').insert({ user_id: userId, ...flag });
    if (error) throw error;
    return;
  }
  const list = coreMemoryStore.moderationFlags.get(userId) || [];
  list.push({ ...flag, created_at: new Date().toISOString() });
  coreMemoryStore.moderationFlags.set(userId, list);
}

// ==========================================
// RAM ACCESSORS (route through ramClient)
// ==========================================

/**
 * Insert one chat_ram row. intent + expires_at are computed HERE, in-process,
 * before the row is pushed to Supabase (no LLM, no extra round trip).
 *
 * @param {{player_id:string, player_name:string, channel_id:string, message_content:string}} entry
 * @param {{isBot?: boolean}} [opts]  bot-authored rows are always CHAT (24h)
 */
async function insertChatRamEntry(entry, { isBot = false } = {}) {
  const row = {
    ...entry,
    ...buildRetentionFields(entry.message_content, { isBot }),
  };

  if (ramClient) {
    const { error } = await ramClient.from('chat_ram').insert([row]);
    if (error) throw error;
    return;
  }
  ramMemoryStore.chatRam.push({ ...row, created_at: new Date().toISOString() });
}

/**
 * LTM read for `!summary @user`.
 * PRIVACY: always scoped to ONE channel_id (the channel the command was run in).
 * TTL: rows past expires_at are ignored even if the hourly purge has not run yet.
 *
 * @returns {Promise<Array<{player_name:string, message_content:string, intent:string, created_at:string}>>}
 *          chronological order (oldest -> newest)
 */
async function getUserChatRam(channelId, userId, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const nowIso = new Date().toISOString();

  if (ramClient) {
    const { data, error } = await ramClient
      .from('chat_ram')
      .select('player_name, message_content, intent, created_at')
      .eq('channel_id', channelId)
      .eq('player_id', userId)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw error;
    return (data || []).reverse();
  }

  return ramMemoryStore.chatRam
    .filter((m) => m.channel_id === channelId && m.player_id === userId && (!m.expires_at || m.expires_at > nowIso))
    .slice(-safeLimit);
}

async function getRecentChatRam(channelId, limit = 5) {
  if (ramClient) {
    const { data, error } = await ramClient
      .from('chat_ram')
      .select('message_content')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
  return ramMemoryStore.chatRam
    .filter((m) => m.channel_id === channelId)
    .slice(-limit)
    .reverse();
}

async function deleteOldChatRam(cutoffIso) {
  if (ramClient) {
    const { error } = await ramClient.from('chat_ram').delete().lt('created_at', cutoffIso);
    if (error) throw error;
    return;
  }
  ramMemoryStore.chatRam = ramMemoryStore.chatRam.filter((m) => m.created_at >= cutoffIso);
}

/**
 * Retention purge: deletes chat_ram rows whose expires_at has passed.
 * Uses the batched SQL function (migration 001) and falls back to a single
 * DELETE if the function has not been installed yet.
 *
 * @returns {Promise<number>} rows deleted (best effort)
 */
let warnedMissingPurgeFn = false;

async function deleteExpiredChatRam({ batchSize = 1000, maxBatches = 50 } = {}) {
  const nowIso = new Date().toISOString();

  if (!ramClient) {
    const before = ramMemoryStore.chatRam.length;
    ramMemoryStore.chatRam = ramMemoryStore.chatRam.filter((m) => !m.expires_at || m.expires_at >= nowIso);
    return before - ramMemoryStore.chatRam.length;
  }

  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const { data, error } = await ramClient.rpc('purge_expired_chat_ram', { batch_size: batchSize });

    if (error) {
      const fnMissing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '');
      if (!fnMissing) throw error;

      if (!warnedMissingPurgeFn) {
        console.warn('⚠️ [CLEANUP] purge_expired_chat_ram() not installed — run migration 001. Using single-statement DELETE fallback.');
        warnedMissingPurgeFn = true;
      }
      const { error: delErr, count } = await ramClient
        .from('chat_ram')
        .delete({ count: 'exact' })
        .lt('expires_at', nowIso);
      if (delErr) throw delErr;
      return count || 0;
    }

    const deleted = Number(data) || 0;
    total += deleted;
    if (deleted < batchSize) break; // drained
  }
  return total;
}

module.exports = {
  ramClient,
  coreClient,
  getUserProfile,
  upsertUserProfile,
  getEmotionalState,
  upsertEmotionalState,
  appendConversationTurn,
  getRecentTurns,
  deleteOldConversationTurns,
  getLongTermMemories,
  addLongTermMemory,
  addModerationFlag,
  insertChatRamEntry,
  getUserChatRam,
  getRecentChatRam,
  deleteOldChatRam,
  deleteExpiredChatRam,
};
