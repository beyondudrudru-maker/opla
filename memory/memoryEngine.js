/**
 * memory/memoryEngine.js
 *
 * PURPOSE
 *   Handles working memory (recent context) and long-term memory extraction.
 *   Optimized to strictly limit unnecessary Gemini API calls using Local Filters,
 *   Source Hashing, and Safe Concurrency Tracking.
 */

const crypto = require('crypto');
const db = require('../database/supabaseClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ============================================================
// 1. GRACEFUL INITIALIZATION 
// ============================================================
const apiKey = process.env.GEMINI_API_KEY || process.env.aiapi;
let extractionModel = null;

if (apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    extractionModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
  } catch (e) {
    console.warn('⚠️ [MEMORY] Gemini initialization failed. Extraction disabled.');
  }
} else {
  console.warn('⚠️ [MEMORY] No Gemini API key found. Extraction disabled.');
}

const SESSION_GAP_MINUTES = 45;
const WORKING_MEMORY_SIZE = 10; // Represents recent turns

// ============================================================
// 2. CHEAP LOCAL FILTERS & SPAM PREVENTION
// ============================================================
const MEMORY_SIGNAL_REGEX = /\b(i am|i'm|my|i like|i love|i hate|i prefer|i want|i need|i study|i'm studying|my goal|i plan|i live|i work|remember|don't forget)\b/i;

// In-memory caches to prevent redundant API calls and race conditions
const processedMessages = new Set();
const processingMessages = new Set();
const PROCESSED_LIMIT = 100;

function computeContentHash(userId, content) {
  return crypto.createHash('sha256').update(`${userId}::${content.trim().toLowerCase()}`).digest('hex');
}

async function recordTurn({ channelId, userId, role, content, sessionId }) {
  await db.appendConversationTurn({ channel_id: channelId, user_id: userId, role, content, session_id: sessionId });
}

async function getWorkingMemory(channelId) {
  const turns = await db.getRecentTurns(channelId, WORKING_MEMORY_SIZE * 2);
  if (turns.length === 0) return [];

  const session = [turns[turns.length - 1]];
  for (let i = turns.length - 2; i >= 0; i--) {
    const gapMs = new Date(turns[i + 1].created_at) - new Date(turns[i].created_at);
    if (gapMs / 60000 > SESSION_GAP_MINUTES) break;
    session.unshift(turns[i]);
  }
  return session.slice(-WORKING_MEMORY_SIZE);
}

async function getLongTermCandidates(userId) {
  // Pass a strict limit down to the DB layer to prevent massive payload transfers
  const limit = 30;
  const memories = await db.getLongTermMemories(userId, limit);
  return memories || [];
}

async function extractCandidateMemories(turns, userId) {
  const candidates = [];
  
  if (!extractionModel) return candidates;
  
  for (const turn of turns) {
    if (turn.role !== 'user' || turn.user_id !== userId) continue;

    // 🚀 The Gatekeeper: Skip Gemini if the message lacks memory signals
    if (!MEMORY_SIGNAL_REGEX.test(turn.content)) continue;

    const sourceHash = computeContentHash(userId, turn.content);
    
    // 🛡️ Concurrency & Spam Check: Skip if already processed or currently processing
    if (processedMessages.has(sourceHash) || processingMessages.has(sourceHash)) {
      continue;
    }

    // Lock the message while we wait for Gemini
    processingMessages.add(sourceHash);

    const extractionPrompt = `Analyze the user message. Extract durable, long-term facts, preferences, or goals.
Output ONLY a highly compressed bracketed tag. No filler.
Example 1: "I am studying computer engineering" -> [STUDIES:CompEng]
Example 2: "I love Kingdom Clash" -> [FAV_GAME:KingdomClash]
If no durable fact exists, output exactly: NONE
User Message: "${turn.content}"`;

    try {
      const result = await extractionModel.generateContent(extractionPrompt);
      const extraction = result.response.text().trim();

      if (extraction !== "NONE" && extraction.startsWith("[")) {
        candidates.push({
          content: extraction,
          content_hash: computeContentHash(userId, extraction),
          topic_tags: [], 
          emotional_score: null, 
        });
      }

      // ✅ Only mark as fully processed if Gemini succeeded
      processedMessages.add(sourceHash);
      if (processedMessages.size > PROCESSED_LIMIT) {
        const oldestKey = processedMessages.keys().next().value;
        processedMessages.delete(oldestKey);
      }

    } catch (error) {
      console.error(`⚠️ Memory Extraction failed:`, error.message);
    } finally {
      // Unlock the message so it can be retried later if it failed
      processingMessages.delete(sourceHash);
    }
  }
  
  return candidates;
}

async function writeMemory(userId, memory) {
  const withHash = memory.content_hash
    ? memory
    : { ...memory, content_hash: computeContentHash(userId, memory.content) };

  try {
    await db.addLongTermMemory(userId, withHash);
  } catch (error) {
    // Robust Database Uniqueness Handling (Postgres Code 23505)
    if (error?.code === '23505' || /duplicate key/i.test(error?.message || '')) {
      console.log(`⏩ [MEMORY] Skipped duplicate memory insertion.`);
    } else {
      console.error(`⚠️ [MEMORY] Failed to write memory:`, error.message);
    }
  }
}

// ⚡ TOKEN-COMPRESSED OUTPUT WITH HARD CHARACTER LIMIT
function toBrief(memories, maxChars = 1800) {
  if (!memories || memories.length === 0) return '';
  
  let output = '';
  for (const memory of memories) {
    const item = memory?.content || '';
    // Stop adding memories if we are about to blow up the prompt size budget
    if (output.length + item.length > maxChars) break;
    output += item + ' '; // Added space for cleaner log formatting
  }
  
  return output ? `[LTM:${output.trim()}]` : '';
}

module.exports = {
  recordTurn,
  getWorkingMemory,
  getLongTermCandidates,
  extractCandidateMemories,
  writeMemory,
  computeContentHash,
  WORKING_MEMORY_SIZE,
  toBrief,
};
