/**
 * database/supabaseClient.js
 *
 * PURPOSE
 *   Two shared Supabase clients + typed accessor functions, split across
 *   two separate Supabase projects:
 *
 *     ramClient  -> Project 1 ("RAM"): chat_ram, the lightweight ephemeral
 *                   activity log.
 *
 *     coreClient -> Project 2 ("Core"): persistent stats, emotions,
 *                   memory, and behavior tables owned by Melody's pipeline.
 */

const { createClient } = require('@supabase/supabase-js');

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

async function insertChatRamEntry(entry) {
  if (ramClient) {
    const { error } = await ramClient.from('chat_ram').insert([entry]);
    if (error) throw error;
    return;
  }
  ramMemoryStore.chatRam.push({ ...entry, created_at: new Date().toISOString() });
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

module.exports = {
  ramClient,
  coreClient,
  getUserProfile,
  upsertUserProfile,
  getEmotionalState,
  upsertEmotionalState,
  appendConversationTurn,
  getRecentTurns,
  getLongTermMemories,
  addLongTermMemory,
  addModerationFlag,
  insertChatRamEntry,
  getRecentChatRam,
  deleteOldChatRam,
};
