/**
 * memory/memoryEngine.js
 *
 * PURPOSE
 *   Handles:
 *   - Working memory
 *   - Long-term memory retrieval
 *   - Local memory signal filtering
 *   - Database deduplication
 *   🚀 UPGRADE: Completely migrated to GROQ (openai/gpt-oss-20b).
 *   🚀 UPGRADE: Keyword Overlap Matching (Only fetches old memory if 2+ words match).
 *   🚀 UPGRADE: Ultra-clean on-demand summarization.
 *   🚫 STRICT RULE: Qwen models are completely excluded.
 */

const crypto = require('crypto');
const db = require('../database/supabaseClient');
const { OpenAI } = require('openai');

// ============================================================
// 1. GRACEFUL GROQ INITIALIZATION
// ============================================================

const groqKey = process.env.opla || process.env.OPLA || process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2;

let extractionClient = null;
const EXTRACTION_MODEL = 'openai/gpt-oss-20b'; 

if (groqKey && typeof groqKey === 'string' && groqKey.trim()) {
  try {
    extractionClient = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
    console.log(`🧠 [MEMORY] Groq extraction engine initialized using ${EXTRACTION_MODEL}.`);
  } catch (error) {
    console.warn('⚠️ [MEMORY] Groq initialization failed. Extraction disabled:', error.message);
  }
} else {
  console.warn('⚠️ [MEMORY] No Groq API key found. Extraction disabled.');
}

// ============================================================
// 2. MEMORY CONFIGURATION
// ============================================================

const SESSION_GAP_MINUTES = 45;
const WORKING_MEMORY_SIZE = 10;
const LONG_TERM_MEMORY_LIMIT = 30;
const DEFAULT_LTM_MAX_CHARS = 1800;

// ============================================================
// 3. KEYWORD MATCHING ENGINE (NEW)
// ============================================================

const STOP_WORDS = new Set([
  'is','the','a','an','and','or','but','if','kya','hai','tha','thi','me','ko',
  'se','ki','pe','yeh','woh','to','for','in','on','of','my','i','you','am','are',
  'was','were','be','been','have','has','do','does','did','will','mera','meri',
  'mujhe','main','hum','hamara','apna','apni','bhai','yaar','acha','theek','kar',
  'raha','rahi','tum','aap','tera'
]);

function getSignificantWords(text) {
  if (!text) return new Set();
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  return new Set(words.filter(w => w.length > 2 && !STOP_WORDS.has(w)));
}

function hasKeywordOverlap(currentMsg, pastMsg, threshold = 2) {
  const currentWords = getSignificantWords(currentMsg);
  const pastWords = getSignificantWords(pastMsg);
  let matchCount = 0;

  for (const word of currentWords) {
    if (pastWords.has(word)) matchCount++;
    if (matchCount >= threshold) return true;
  }
  return false;
}

const MEMORY_SIGNAL_REGEX =
  /\b(i am|i'm|my|i like|i love|i hate|i prefer|i want|i need|i study|i'm studying|my goal|i plan|i live|i work|remember|don't forget|mera|meri|mujhe|main|yaad rakhna|pasand|chahta|target|hum|hamara|apna|apni)\b/i;

const processedMessages = new Set();
const processingMessages = new Set();
const PROCESSED_LIMIT = 100;

function computeContentHash(userId, content) {
  const normalized = String(content || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(`${userId}::${normalized}`).digest('hex');
}

async function recordTurn({ channelId, userId, role, content, sessionId }) {
  return db.appendConversationTurn({
    channel_id: channelId,
    user_id: userId,
    role,
    content,
    session_id: sessionId
  });
}

// ============================================================
// 7. WORKING MEMORY (WITH KEYWORD RELEVANCE & PRUNING)
// ============================================================

// 🚀 Changed signature to accept currentMessage for keyword matching
async function getWorkingMemory(channelId, currentMessage = '') {
  try {
    const turns = await db.getRecentTurns(channelId, WORKING_MEMORY_SIZE * 2);

    if (!Array.isArray(turns) || turns.length === 0) return [];

    const session = [turns[turns.length - 1]];

    for (let i = turns.length - 2; i >= 0; i--) {
      const newer = turns[i + 1];
      const older = turns[i];

      const gapMs = new Date(newer.created_at).getTime() - new Date(older.created_at).getTime();
      if (Number.isFinite(gapMs) && gapMs / 60000 > SESSION_GAP_MINUTES) break;
      session.unshift(older);
    }

    const smartSession = [];
    const TOTAL = session.length;

    for (let i = 0; i < TOTAL; i++) {
      const turn = session[i];
      const isImmediateHistory = i >= TOTAL - 2; // Always keep the exact last 2 messages for flow

      // 🚀 Only include older messages if there is a 2+ word keyword overlap
      const isRelevant = currentMessage ? hasKeywordOverlap(currentMessage, turn.content, 2) : true;

      if (isImmediateHistory || isRelevant) {
        // Apply aggressive pruning to bot's own long messages
        if (turn.role === 'melody' && turn.content && turn.content.length > 150) {
          const firstSentence = turn.content.split(/(?<=[.!?])\s/)[0] || turn.content.substring(0, 100);
          smartSession.push({ ...turn, content: `${firstSentence}... [Details truncated]` });
        } else {
          smartSession.push(turn);
        }
      }
    }

    return smartSession.slice(-WORKING_MEMORY_SIZE);
  } catch (error) {
    console.error('⚠️ [MEMORY] getWorkingMemory failed:', error.message);
    return [];
  }
}

// ============================================================
// 8. LONG-TERM MEMORY RETRIEVAL
// ============================================================

async function getLongTermCandidates(userId) {
  try {
    const memories = await db.getLongTermMemories(userId, LONG_TERM_MEMORY_LIMIT);
    return Array.isArray(memories) ? memories.slice(0, LONG_TERM_MEMORY_LIMIT) : [];
  } catch (error) {
    console.error('⚠️ [MEMORY] getLongTermCandidates failed:', error.message);
    return [];
  }
}

// ============================================================
// 9. EXTRACTION (POWERED BY GROQ)
// ============================================================

async function extractCandidateMemories(turns, userId) {
  const candidates = [];

  if (!extractionClient || !Array.isArray(turns) || turns.length === 0) return candidates;

  for (const turn of turns) {
    if (turn?.role !== 'user' || turn?.user_id !== userId || typeof turn?.content !== 'string') continue;

    const content = turn.content.trim();
    if (!content || !MEMORY_SIGNAL_REGEX.test(content)) continue;

    const sourceHash = computeContentHash(userId, content);

    if (processedMessages.has(sourceHash) || processingMessages.has(sourceHash)) continue;
    processingMessages.add(sourceHash);

    const extractionPrompt = `
TASK: Extract durable facts, preferences, or goals from the user message.
LANG: Input may be English, Hindi, or Hinglish. Translate core concept to English for the tag.
OUTPUT: ONLY output format "[TAG:Value]|Score" OR "NONE". No markdown, no explanations.
SCORE: 0.1 (weak) to 1.0 (strong).

MESSAGE:
"${content}"
`.trim();

    try {
      const response = await extractionClient.chat.completions.create({
        model: EXTRACTION_MODEL,
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 50
      });

      const extraction = response.choices[0]?.message?.content?.trim() || 'NONE';

      if (extraction !== 'NONE' && extraction.includes(']|')) {
        const separatorIndex = extraction.indexOf(']|');
        const memoryTag = extraction.slice(0, separatorIndex + 1).trim();
        const scoreStr = extraction.slice(separatorIndex + 2).trim();
        const parsedScore = Number.parseFloat(scoreStr);
        const emotionalScore = Number.isFinite(parsedScore) ? Math.min(1, Math.max(0.1, parsedScore)) : 0.5;

        if (memoryTag.startsWith('[TAG:') && memoryTag.endsWith(']')) {
          candidates.push({
            content: memoryTag,
            content_hash: computeContentHash(userId, memoryTag),
            topic_tags: [],
            emotional_score: emotionalScore,
            source_hash: sourceHash
          });
        }
      }

      processedMessages.add(sourceHash);
      if (processedMessages.size > PROCESSED_LIMIT) {
        const oldestKey = processedMessages.keys().next().value;
        if (oldestKey) processedMessages.delete(oldestKey);
      }

    } catch (error) {
      console.error('⚠️ [MEMORY] Extraction via Groq failed:', error.message);
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
  if (!memory || typeof memory.content !== 'string' || !memory.content.trim()) return;

  const withHash = memory.content_hash
    ? memory
    : { ...memory, content_hash: computeContentHash(userId, memory.content) };

  try {
    await db.addLongTermMemory(userId, withHash);
  } catch (error) {
    if (error?.code === '23505' || /duplicate key/i.test(error?.message || '')) {
      return;
    }
    console.error('⚠️ [MEMORY] Failed to write memory:', error.message);
  }
}

function toBrief(memories, maxChars = DEFAULT_LTM_MAX_CHARS) {
  if (!Array.isArray(memories) || memories.length === 0) return '';

  let output = '';
  for (const memory of memories) {
    const item = typeof memory?.content === 'string' ? memory.content.trim() : '';
    if (!item) continue;
    if (output.length + item.length + 1 > maxChars) break;
    output += `${item} `;
  }

  return output.trim() ? `[LTM:${output.trim()}]` : '';
}

// ============================================================
// 11.5 CHAT SUMMARIZATION (ON-DEMAND & ULTRA-CLEAN)
// ============================================================

async function generateChatSummary(turns) {
  if (!extractionClient || !Array.isArray(turns) || turns.length === 0) return '';

  let transcript = turns
    .map(t => {
      const safeContent = t.content.length > 200 ? t.content.substring(0, 200) + '...' : t.content;
      return `${t.role || 'user'}: ${safeContent}`;
    })
    .join('\n');
    
  if (transcript.length > 2000) {
      transcript = transcript.substring(transcript.length - 2000);
  }

  // 🚀 Force the AI to be extremely short and avoid fluff.
  const prompt = `Summarize this Discord conversation. 
RULES:
1. ONLY return 2 short bullet points.
2. NO conversational filler (e.g. "Here is the summary").
3. Focus purely on key actions or decisions.

Conversation:\n${transcript}`;

  try {
    const response = await extractionClient.chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100
    });
    
    return response.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('⚠️ [MEMORY] Chat summary via Groq failed:', err.message);
    return '';
  }
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
  generateChatSummary
};
