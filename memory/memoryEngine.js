/**
 * memory/memoryEngine.js
 *
 * PURPOSE
 *   Owns storage and coarse retrieval across memory tiers. Ranking/scoring
 *   of *which* memories make it into a prompt is a separate concern, owned
 *   by contextRanker.
 *
 * TIERS
 *   - Working memory: last 8-12 raw turns in the *current session*.
 *   - Long-term memory: curated, distilled facts/events per user, extracted
 *     using an AI-powered lightweight model (Gemini Flash-Lite).
 */

const crypto = require('crypto');
const db = require('../database/supabaseClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize a dedicated, fast model purely for background memory extraction
const apiKey = process.env.GEMINI_API_KEY;
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
 * Deterministic content hash used for dedup on write.
 */
function computeContentHash(userId, content) {
  return crypto.createHash('sha256').update(`${userId}::${content.trim().toLowerCase()}`).digest('hex');
}

/**
 * AI-Powered Extraction: Uses Flash-Lite to intelligently extract durable
 * facts, goals, and preferences from user turns.
 * 
 * NOTE: This is now an ASYNC function. Callers must use await.
 */
async function extractCandidateMemories(turns, userId) {
  const candidates = [];
  
  for (const turn of turns) {
    // We only want to extract facts about the user from their own messages
    if (turn.role !== 'user' || turn.user_id !== userId) continue;

    const extractionPrompt = `
      Analyze the following chat message from a user. 
      Does it contain a durable, long-term fact, preference, goal, or emotional state that would be useful to remember for future conversations?
      If YES, return a single concise sentence summarizing the fact (e.g., "User is studying computer engineering", "User loves playing Kingdom Clash").
      If NO (it is just a greeting, a question, or irrelevant chatter), return exactly the word "NONE".
      
      User Message: "${turn.content}"
    `;

    try {
      // Use the lightest, fastest model for this background task
      const result = await extractionModel.generateContent(extractionPrompt);
      const extraction = result.response.text().trim();

      // If the AI found a fact, format it and push it to the candidates array
      if (extraction !== "NONE" && extraction.length > 5) {
        candidates.push({
          content: extraction,
          content_hash: computeContentHash(userId, extraction),
          topic_tags: [], 
          emotional_score: 0.8, // Assign a high default score for AI-validated facts
        });
      }
    } catch (error) {
      // If the API hits a rate limit during extraction, log it but don't crash
      console.error(`⚠️ Memory Extraction failed for turn:`, error.message);
    }
  }
  
  return candidates;
}

async function writeMemory(userId, memory) {
  // content_hash should already be set by extractCandidateMemories, but
  // compute it here too as a safety net.
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
