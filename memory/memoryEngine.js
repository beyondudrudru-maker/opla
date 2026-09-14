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
 *   🚀 UPGRADE: Bilingual (English + Hinglish) memory signal detection.
 *   🚀 NEW: Added generateChatSummary for rolling conversation summaries.
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

    extractionModel = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite'
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
//
// Only messages containing likely memory signals are sent to Gemini.
// 🚀 UPGRADE: Now catches Hindi/Hinglish triggers like "mera", "mujhe", "yaad rakhna".
//

const MEMORY_SIGNAL_REGEX =
  /\b(i am|i'm|my|i like|i love|i hate|i prefer|i want|i need|i study|i'm studying|my goal|i plan|i live|i work|remember|don't forget|mera|meri|mujhe|main|yaad rakhna|pasand|chahta|target)\b/i;

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
// 7. WORKING MEMORY
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

    // Start from the newest message.
    const session = [turns[turns.length - 1]];

    // Walk backwards until a session gap is detected.
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

    return session.slice(-WORKING_MEMORY_SIZE);

  } catch (error) {
    console.error(
      '⚠️ [MEMORY] getWorkingMemory failed:',
      error.message
    );

    // Never allow memory failure to kill the AI response.
    return [];
  }
}

// ============================================================
// 8. LONG-TERM MEMORY RETRIEVAL
// ============================================================

async function getLongTermCandidates(userId) {
  try {
    // Compatible with DB accessor accepting a limit.
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

  // Gemini unavailable → memory extraction simply disabled.
  if (!extractionModel) {
    return candidates;
  }

  if (!Array.isArray(turns) || turns.length === 0) {
    return candidates;
  }

  for (const turn of turns) {

    // Only inspect user's own messages.
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

    // ----------------------------------------------------------
    // LOCAL GATEKEEPER
    // ----------------------------------------------------------

    if (!MEMORY_SIGNAL_REGEX.test(content)) {
      continue;
    }

    // ----------------------------------------------------------
    // SOURCE HASH
    // ----------------------------------------------------------

    const sourceHash = computeContentHash(
      userId,
      content
    );

    // ----------------------------------------------------------
    // DUPLICATE / CONCURRENT PROTECTION
    // ----------------------------------------------------------

    if (
      processedMessages.has(sourceHash) ||
      processingMessages.has(sourceHash)
    ) {
      continue;
    }

    processingMessages.add(sourceHash);

    // ----------------------------------------------------------
    // EXTRACTION PROMPT
    // ----------------------------------------------------------

    const extractionPrompt = `
Analyze the user message (which may be in English, Hindi, or Hinglish) and determine whether it contains a durable,
long-term fact, preference, interest, identity detail, or goal.

If the user is speaking in Hindi/Hinglish, translate the core concept into English for the value tag.

Output EXACTLY one of these formats:

[TAG:ValueInEnglish]|Score

OR

NONE

Score must be between 0.1 and 1.0:
0.1 = weak / neutral
0.5 = meaningful
1.0 = highly important / strongly emotional

Examples:

"I am studying computer engineering"
-> [STUDIES:CompEng]|0.3

"mujhe Kingdom Clash khelna bahut pasand hai"
-> [FAV_GAME:KingdomClash]|0.9

"mera target Indian Army join karna hai"
-> [GOAL:IndianArmy]|0.8

"haha that's funny"
-> NONE

Do not explain.
Do not output multiple tags.
Do not use markdown.

User Message:
"${content}"
`.trim();

    try {
      const result =
        await extractionModel.generateContent(
          extractionPrompt
        );

      const extraction =
        result?.response?.text?.()?.trim() || 'NONE';

      // --------------------------------------------------------
      // PARSE RESULT
      // --------------------------------------------------------

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

        // Basic validation.
        if (
          memoryTag.startsWith('[TAG:') &&
          memoryTag.endsWith(']')
        ) {
          candidates.push({
            content: memoryTag,

            // Hash the extracted memory itself.
            content_hash: computeContentHash(
              userId,
              memoryTag
            ),

            topic_tags: [],

            emotional_score: emotionalScore,

            // Useful if your DB schema later supports it.
            source_hash: sourceHash
          });
        }
      }

      // Extraction completed successfully.
      processedMessages.add(sourceHash);

      // Keep memory usage bounded.
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
      // Always release concurrent lock.
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

    // PostgreSQL duplicate constraint.
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

    // Don't exceed prompt budget.
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
// 11.5 CHAT SUMMARIZATION (ROLLING SUMMARY) // 🚀 NEW
// ============================================================

/**
 * Generates a rolling summary of older conversation turns.
 */
async function generateChatSummary(turns) {
  if (!extractionModel || !Array.isArray(turns) || turns.length === 0) {
    return '';
  }

  const transcript = turns
    .map(t => `${t.role || 'user'}: ${t.content}`)
    .join('\n');

  const prompt = `Summarize the following Discord conversation in 2-3 concise bullet points focusing on key topics, decisions, or user questions. Avoid fluff.\n\nConversation:\n${transcript}`;

  try {
    // Generate content using Gemini 
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
  generateChatSummary // 🚀 NEW: Export the summary function
};
