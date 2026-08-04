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
  if (!turns || turns.length === 0) return [];

  const session = [turns[turns.length - 1]];
  for (let i = turns.length - 2; i >= 0; i--) {
    const gapMs = new Date(turns[i + 1].created_at) - new Date(turns[i].created_at);
    if (gapMs / 60000 > SESSION_GAP_MINUTES) break;
    session.unshift(turns[i]);
  }
  return session.slice(-WORKING_MEMORY_SIZE);
}

async function getLongTermCandidates(userId) {
  const limit = 30;
  const memories = await db.getLongTermMemories(userId, limit);
  return memories || [];
}

async function extractCandidateMemories(turns, userId) {
  const candidates = [];
  
  if (!extractionModel) return candidates;
  
  for (const turn of turns) {
    if (turn.role !== 'user' || turn.user_id !== userId) continue;

    if (!MEMORY_SIGNAL_REGEX.test(turn.content)) continue;

    const sourceHash = computeContentHash(userId, turn.content);
    
    if (processedMessages.has(sourceHash) || processingMessages.has(sourceHash)) {
      continue;
    }

    processingMessages.add(sourceHash);

    const extractionPrompt = `Analyze the user message. Extract durable, long-term facts, preferences, or goals.
Also assign an emotional weight from 0.1 (neutral) to 1.0 (highly passionate/emotional).
Output EXACTLY in this format: [TAG:Value]|Score
Example 1: "I am studying computer engineering" -> [STUDIES:CompEng]|0.3
Example 2: "I absolutely love Kingdom Clash!" -> [FAV_GAME:KingdomClash]|0.9
If no durable fact exists, output exactly: NONE
User Message: "${turn.content}"`;

    try {
      const result = await extractionModel.generateContent(extractionPrompt);
      const extraction = result.response.text().trim();

      if (extraction !== "NONE" && extraction.includes("]|")) {
        const [memoryTag, scoreStr] = extraction.split("]|");
        const finalTag = memoryTag + "]"; 
        const emotionalScore = parseFloat(scoreStr) || 0.5;

        candidates.push({
          content: finalTag,
          content_hash: computeContentHash(userId, finalTag),
          topic_tags: [], 
          emotional_score: emotionalScore,
        });
      }

      processedMessages.add(sourceHash);
      if (processedMessages.size > PROCESSED_LIMIT) {
        const oldestKey = processedMessages.keys().next().value;
        processedMessages.delete(oldestKey);
      }

    } catch (error) {
      console.error(`⚠️ Memory Extraction failed:`, error.message);
    } finally {
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
    if (error?.code === '23505' || /duplicate key/i.test(error?.message || '')) {
      console.log(`⏩ [MEMORY] Skipped duplicate memory insertion.`);
    } else {
      console.error(`⚠️ [MEMORY] Failed to write memory:`, error.message);
    }
  }
}

function toBrief(memories, maxChars = 1800) {
  if (!memories || memories.length === 0) return '';
  
  let output = '';
  for (const memory of memories) {
    const item = memory?.content || '';
    if (output.length + item.length > maxChars) break;
    output += item + ' ';
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
