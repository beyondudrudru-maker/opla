/**
 * database/supabaseClient.js
 *
 * PURPOSE
 *   Single shared Supabase client + typed accessor functions. Every other
 *   engine (relationship, emotion, memory) reads/writes through here —
 *   nobody constructs their own client or writes raw queries elsewhere.
 *
 * FUTURE SCALABILITY
 *   If you outgrow Supabase's Postgres or need read replicas for a
 *   multi-shard bot, only this file and schema.sql need to change; every
 *   engine module depends on the function signatures below, not on
 *   Supabase specifically.
 */

const { createClient } = require('@supabase/supabase-js');

// Updated to target the newly configured "_2" environment variables in Render
const supabaseUrl = process.env.SUPABASE_URL_2;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY_2;

let client = null;
if (supabaseUrl && supabaseKey) {
  client = createClient(supabaseUrl, supabaseKey);
  console.log('🧠 AI Database Connection Established successfully.');
} else {
  console.warn('⚠️  Supabase credentials missing — running with in-memory fallback store.');
}

// ---- In-memory fallback so the bot still runs without Supabase configured ----
const memoryStore = {
  userProfiles: new Map(),
  emotionalState: new Map(),
  conversationTurns: [],
  longTermMemories: new Map(), // userId -> array
  moderationFlags: new Map(),  // userId -> array
};

async function getUserProfile(userId) {
  if (client) {
    const { data, error } = await client.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }
  return memoryStore.userProfiles.get(userId) || null;
}

async function upsertUserProfile(userId, patch) {
  if (client) {
    const { data, error } = await client
      .from('user_profiles')
      .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  const existing = memoryStore.userProfiles.get(userId) || { user_id: userId };
  const merged = { ...existing, ...patch };
  memoryStore.userProfiles.set(userId, merged);
  return merged;
}

async function getEmotionalState(userId) {
  if (client) {
    const { data, error } = await client.from('emotional_state').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }
  return memoryStore.emotionalState.get(userId) || null;
}

async function upsertEmotionalState(userId, state) {
  if (client) {
    const { data, error } = await client
      .from('emotional_state')
      .upsert({ user_id: userId, ...state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  const record = { ...state, user_id: userId, updated_at: new Date().toISOString() };
  memoryStore.emotionalState.set(userId, record);
  return record;
}

async function appendConversationTurn(turn) {
  if (client) {
    const { error } = await client.from('conversation_turns').insert(turn);
    if (error) throw error;
    return;
  }
  memoryStore.conversationTurns.push({ ...turn, created_at: new Date().toISOString() });
}

async function getRecentTurns(channelId, limit = 12) {
  if (client) {
    const { data, error } = await client
      .from('conversation_turns')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).reverse();
  }
  return memoryStore.conversationTurns
    .filter((t) => t.channel_id === channelId)
    .slice(-limit);
}

async function getLongTermMemories(userId) {
  if (client) {
    const { data, error } = await client
      .from('long_term_memories')
      .select('*')
      .eq('user_id', userId)
      .order('emotional_score', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }
  return memoryStore.longTermMemories.get(userId) || [];
}

async function addLongTermMemory(userId, memory) {
  if (client) {
    const { error } = await client.from('long_term_memories').insert({ user_id: userId, ...memory });
    if (error) throw error;
    return;
  }
  const list = memoryStore.longTermMemories.get(userId) || [];
  list.push({ ...memory, created_at: new Date().toISOString(), last_referenced: new Date().toISOString() });
  memoryStore.longTermMemories.set(userId, list);
}

async function addModerationFlag(userId, flag) {
  if (client) {
    const { error } = await client.from('moderation_flags').insert({ user_id: userId, ...flag });
    if (error) throw error;
    return;
  }
  const list = memoryStore.moderationFlags.get(userId) || [];
  list.push({ ...flag, created_at: new Date().toISOString() });
  memoryStore.moderationFlags.set(userId, list);
}

module.exports = {
  client,
  getUserProfile,
  upsertUserProfile,
  getEmotionalState,
  upsertEmotionalState,
  appendConversationTurn,
  getRecentTurns,
  getLongTermMemories,
  addLongTermMemory,
  addModerationFlag,
};
