/**
 * memory/memoryEngine.js
 */

const crypto = require('crypto');
const db = require('../database/supabaseClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY || process.env.aiapi;
const genAI = new GoogleGenerativeAI(apiKey);
const extractionModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

const SESSION_GAP_MINUTES = 45;
const WORKING_MEMORY_SIZE = 10;

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
  return db.getLongTermMemories(userId);
}

function computeContentHash(userId, content) {
  return crypto.createHash('sha256').update(`${userId}::${content.trim().toLowerCase()}`).digest('hex');
}

async function extractCandidateMemories(turns, userId) {
  const candidates = [];
  
  for (const turn of turns) {
    if (turn.role !== 'user' || turn.user_id !== userId) continue;

    // ⚡ TOKEN-COMPRESSED EXTRACTION PROMPT
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
          emotional_score: 0.8,
        });
      }
    } catch (error) {
      console.error(`⚠️ Memory Extraction failed:`, error.message);
    }
  }
  
  return candidates;
}

async function writeMemory(userId, memory) {
  const withHash = memory.content_hash
    ? memory
    : { ...memory, content_hash: computeContentHash(userId, memory.content) };

  await db.addLongTermMemory(userId, withHash);
}

// ⚡ TOKEN-COMPRESSED OUTPUT
function toBrief(memories) {
  if (!memories || memories.length === 0) return '';
  // Assuming memories is an array of objects with a 'content' field holding the tags
  return `[LTM:${memories.map(m => m.content).join('')}]`; 
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
