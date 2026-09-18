/**
 * memory/memoryEngine.js
 *
 * PURPOSE
 *   Handles:
 *   - Working memory
 *   - Long-term memory retrieval
 *   - Local memory signal filtering
 *   - Gemini-based memory extraction
 *   - Source hashing / duplicate extraction prevention
 *   - Concurrent extraction protection
 *   - Database deduplication
 *   - Prompt-size protection
 *   🚀 UPGRADE: Smart Pruning — Truncates massive past bot responses to save tokens.
 *   🚀 UPGRADE: Speed-Optimized Summarization to prevent 2500ms pipeline timeouts.
 *   🚀 UPGRADE: Bilingual (English + Hinglish) memory signal detection.
 */

const crypto = require('crypto');
const db = require('../database/supabaseClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ============================================================
// 1. GRACEFUL GEMINI INITIALIZATION
// ============================================================

const apiKey = process.env.GEMINI_API_KEY || process.env.aiapi;

let extractionModel = null;

if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // 🚀 FIX: Using 1.5-flash for ultra-fast, reliable background processing
    extractionModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash'
    });

    console.log('🧠 [MEMORY] Gemini extraction engine initialized.');
  } catch (error) {
    console.warn(
      '⚠️ [MEMORY] Gemini initialization failed. Extraction disabled:',
      error.message
    );
  }
} else {
  console.warn(
    '⚠️ [MEMORY] No Gemini API key found. Extraction disabled.'
  );
}

// ============================================================
// 2. MEMORY CONFIGURATION
// ============================================================

const SESSION_GAP_MINUTES = 45;

// Number of recent conversation turns supplied to the context system.
const WORKING_MEMORY_SIZE = 10;

// Maximum number of long-term memories retrieved from DB.
const LONG_TERM_MEMORY_LIMIT = 30;

// Maximum LTM characters inserted into prompt.
const DEFAULT_LTM_MAX_CHARS = 1800;

// ============================================================
// 3. CHEAP LOCAL MEMORY FILTER
// ============================================================

const MEMORY_SIGNAL_REGEX =
  /\b(i am|i'm|my|i like|i love|i hate|i prefer|i want|i need|i study|i'm studying|my goal|i plan|i live|i work|remember|don't forget|mera|meri|mujhe|main|yaad rakhna|pasand|chahta|target|hum|hamara|apna|apni)\b/i;

// ============================================================
// 4. EXTRACTION SPAM / CONCURRENCY PROTECTION
// ============================================================

const processedMessages = new Set();
const processingMessages = new Set();

const PROCESSED_LIMIT = 100;

// ============================================================
// 5. HASHING
// ============================================================

function computeContentHash(userId, content) {
  const normalized = String(content || '')
    .trim()
    .toLowerCase();

  return crypto
    .createHash('sha256')
    .update(`${userId}::${normalized}`)
    .digest('hex');
}

// ============================================================
// 6. RECORD CONVERSATION TURN
// ============================================================

async function recordTurn({
  channelId,
  userId,
  role,
  content,
  sessionId
}) {
  return db.appendConversationTurn({
    channel_id: channelId,
    user_id: userId,
    role,
    content,
    session_id: sessionId
  });
}

// ============================================================
// 7. WORKING MEMORY (WITH SMART PRUNING)
// ============================================================

async function getWorkingMemory(channelId) {
  try {
    const turns = await db.getRecentTurns(
      channelId,
      WORKING_MEMORY_SIZE * 2
    );

    if (!Array.isArray(turns) || turns.length === 0) {
      return [];
    }

    const session = [turns[turns.length - 1]];

    for (let i = turns.length - 2; i >= 0; i--) {
      const newer = turns[i + 1];
      const older = turns[i];

      const newerTime = new Date(newer.created_at).getTime();
      const olderTime = new Date(older.created_at).getTime();

      const gapMs = newerTime - olderTime;

      if (
        Number.isFinite(gapMs) &&
        gapMs / 60000 > SESSION_GAP_MINUTES
      ) {
        break;
      }

      session.unshift(older);
    }

    // 🚀 UPGRADE: Smart Pruning
    // If the bot sent a massive game data embed previously, we don't need to 
    // send those 2000 chars back to the AI. We just need the core context.
    const smartSession = session.map(turn => {
      if (turn.role === 'melody' && turn.content && turn.content.length > 300) {
        const firstSentence = turn.content.split(/(?<=[.!?])\s/)[0] || turn.content.substring(0, 150);
        return { 
          ...turn, 
          content: `${firstSentence}... [Detailed game/strategy response provided to user]` 
        };
      }
      return turn;
    });

    return smartSession.slice(-WORKING_MEMORY_SIZE);

  } catch (error) {
    console.error(
      '⚠️ [MEMORY] getWorkingMemory failed:',
      error.message
    );
    return [];
  }
}

// ============================================================
// 8. LONG-TERM MEMORY RETRIEVAL
// ============================================================

async function getLongTermCandidates(userId) {
  try {
    const memories = await db.getLongTermMemories(
      userId,
      LONG_TERM_MEMORY_LIMIT
    );

    return Array.isArray(memories)
      ? memories.slice(0, LONG_TERM_MEMORY_LIMIT)
      : [];

  } catch (error) {
    console.error(
      '⚠️ [MEMORY] getLongTermCandidates failed:',
      error.message
    );

    return [];
  }
}

// ============================================================
// 9. EXTRACTION
// ============================================================

async function extractCandidateMemories(turns, userId) {
  const candidates = [];

  if (!extractionModel) {
    return candidates;
  }

  if (!Array.isArray(turns) || turns.length === 0) {
    return candidates;
  }

  for (const turn of turns) {

    if (
      turn?.role !== 'user' ||
      turn?.user_id !== userId ||
      typeof turn?.content !== 'string'
    ) {
      continue;
    }

    const content = turn.content.trim();

    if (!content) {
      continue;
    }

    if (!MEMORY_SIGNAL_REGEX.test(content)) {
      continue;
    }

    const sourceHash = computeContentHash(
      userId,
      content
    );

    if (
      processedMessages.has(sourceHash) ||
      processingMessages.has(sourceHash)
    ) {
      continue;
    }

    processingMessages.add(sourceHash);

    const extractionPrompt = `
TASK: Extract durable facts, preferences, or goals from the user message.
LANG: Input may be English, Hindi, or Hinglish. Translate core concept to English for the tag.
OUTPUT: ONLY output format "[TAG:Value]|Score" OR "NONE". No markdown, no explanations.
SCORE: 0.1 (weak) to 1.0 (strong).

EXAMPLES:
"I study computer engineering" -> [STUDIES:CompEng]|0.3
"mujhe Kingdom Clash pasand hai" -> [FAV_GAME:KingdomClash]|0.9
"mera target Indian army hai" -> [GOAL:IndianArmy]|0.8
"haha lol" -> NONE

MESSAGE:
"${content}"
`.trim();

    try {
      const result =
        await extractionModel.generateContent(
          extractionPrompt
        );

      const extraction =
        result?.response?.text?.()?.trim() || 'NONE';

      if (
        extraction !== 'NONE' &&
        extraction.includes(']|')
      ) {
        const separatorIndex =
          extraction.indexOf(']|');

        const memoryTag =
          extraction
            .slice(0, separatorIndex + 1)
            .trim();

        const scoreStr =
          extraction
            .slice(separatorIndex + 2)
            .trim();

        const parsedScore =
          Number.parseFloat(scoreStr);

        const emotionalScore =
          Number.isFinite(parsedScore)
            ? Math.min(
                1,
                Math.max(0.1, parsedScore)
              )
            : 0.5;

        if (
          memoryTag.startsWith('[TAG:') &&
          memoryTag.endsWith(']')
        ) {
          candidates.push({
            content: memoryTag,
            content_hash: computeContentHash(
              userId,
              memoryTag
            ),
            topic_tags: [],
            emotional_score: emotionalScore,
            source_hash: sourceHash
          });
        }
      }

      processedMessages.add(sourceHash);

      if (processedMessages.size > PROCESSED_LIMIT) {
        const oldestKey =
          processedMessages.keys().next().value;

        if (oldestKey) {
          processedMessages.delete(oldestKey);
        }
      }

    } catch (error) {
      console.error(
        '⚠️ [MEMORY] Extraction failed:',
        error.message
      );

    } finally {
      processingMessages.delete(sourceHash);
    }
  }

  return candidates;
}

// ============================================================
// 10. WRITE LONG-TERM MEMORY
// ============================================================

async function writeMemory(userId, memory) {
  if (
    !memory ||
    typeof memory.content !== 'string' ||
    !memory.content.trim()
  ) {
    return;
  }

  const withHash = memory.content_hash
    ? memory
    : {
        ...memory,
        content_hash: computeContentHash(
          userId,
          memory.content
        )
      };

  try {
    await db.addLongTermMemory(
      userId,
      withHash
    );

  } catch (error) {
    if (
      error?.code === '23505' ||
      /duplicate key/i.test(
        error?.message || ''
      )
    ) {
      console.log(
        '⏩ [MEMORY] Duplicate memory skipped.'
      );

      return;
    }

    console.error(
      '⚠️ [MEMORY] Failed to write memory:',
      error.message
    );
  }
}

// ============================================================
// 11. TOKEN / CHARACTER COMPRESSED MEMORY BLOCK
// ============================================================

function toBrief(
  memories,
  maxChars = DEFAULT_LTM_MAX_CHARS
) {
  if (
    !Array.isArray(memories) ||
    memories.length === 0
  ) {
    return '';
  }

  let output = '';

  for (const memory of memories) {
    const item =
      typeof memory?.content === 'string'
        ? memory.content.trim()
        : '';

    if (!item) {
      continue;
    }

    if (
      output.length + item.length + 1 >
      maxChars
    ) {
      break;
    }

    output += `${item} `;
  }

  output = output.trim();

  return output
    ? `[LTM:${output}]`
    : '';
}

// ============================================================
// 11.5 CHAT SUMMARIZATION (ROLLING SUMMARY)
// ============================================================

/**
 * Generates a rolling summary of older conversation turns.
 * 🚀 UPGRADE: Enforces a strict character limit on the transcript so the 
 * AI doesn't timeout processing massive blocks of text.
 */
async function generateChatSummary(turns) {
  if (!extractionModel || !Array.isArray(turns) || turns.length === 0) {
    return '';
  }

  // 🚀 Strip out excessively long text to keep the summarization API call ultra-fast
  let transcript = turns
    .map(t => {
      const safeContent = t.content.length > 200 ? t.content.substring(0, 200) + '...' : t.content;
      return `${t.role || 'user'}: ${safeContent}`;
    })
    .join('\n');
    
  if (transcript.length > 3000) {
      transcript = transcript.substring(transcript.length - 3000);
  }

  const prompt = `Summarize the following Discord conversation in 2-3 concise bullet points focusing on key topics, decisions, or user questions. Avoid fluff.\n\nConversation:\n${transcript}`;

  try {
    const result = await extractionModel.generateContent(prompt);
    return result?.response?.text?.()?.trim() || '';
  } catch (err) {
    console.error('⚠️ [MEMORY] Chat summary failed:', err.message);
    return '';
  }
}

// ============================================================
// 12. EXPORTS
// ============================================================

module.exports = {
  recordTurn,
  getWorkingMemory,
  getLongTermCandidates,
  extractCandidateMemories,
  writeMemory,
  computeContentHash,
  WORKING_MEMORY_SIZE,
  toBrief,
  generateChatSummary
};
