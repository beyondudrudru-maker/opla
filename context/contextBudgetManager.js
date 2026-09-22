/**
 * context/contextBudgetManager.js
 *
 * PURPOSE
 *   Single source of truth for "how much context does this message deserve".
 *   Every other file (index.js, decisionPipeline.js, promptAssembler.js)
 *   should ASK this module for numbers instead of hardcoding their own
 *   limits. This is what stops the "114,513 char prompt for a 'hello'"
 *   problem from ever coming back, and makes tuning a one-file job.
 *
 *   Nothing in here touches the DB or the AI. It's pure decision logic:
 *   given signals about a message, return a Budget Profile.
 *
 * USAGE
 *   const budgetManager = require('../context/contextBudgetManager');
 *
 *   const profile = budgetManager.getBudgetProfile({
 *     content,
 *     intent: classification.intent,
 *     isGameTurn,
 *     isModeration: classification.isModeration,
 *   });
 *
 *   // profile.fetchHistoryLimit      -> how many chat_ram rows to SELECT
 *   // profile.aiContextMessageCount  -> how many of those go into the prompt
 *   // profile.perMessageCharCap      -> hard cap per message before joining
 *   // profile.recentChatLogCap       -> safety-net cap on the joined string
 *   // profile.useLongTermMemory      -> whether to hit long_term_memories at all
 *   // profile.useChatSummary         -> whether to run generateChatSummary
 *   // profile.maxWorkingMemoryTurns  -> cap on conversation_turns window
 *   // profile.rankedMemoryCount      -> how many ranked LTM items to keep
 *   // profile.maxPromptChars         -> final hard ceiling for the assembler
 */

// ============================================================
// 1. TIER DEFINITIONS
// ============================================================
// Each tier is a complete budget. Tune numbers here, nowhere else.

const TIERS = {
  // One-word greetings, "kya haal", emoji-only messages, short banter.
  // These should be near-instant and near-zero DB weight.
  CASUAL: {
    fetchHistoryLimit: 8,
    aiContextMessageCount: 3,
    perMessageCharCap: 180,
    recentChatLogCap: 400,
    useLongTermMemory: false,
    useChatSummary: false,
    maxWorkingMemoryTurns: 4,
    rankedMemoryCount: 0,
    maxPromptChars: 3000,
  },

  // Normal conversation: real sentences, questions, small talk with substance.
  STANDARD: {
    fetchHistoryLimit: 15,
    aiContextMessageCount: 5,
    perMessageCharCap: 250,
    recentChatLogCap: 600,
    useLongTermMemory: true,
    useChatSummary: false,
    maxWorkingMemoryTurns: 8,
    rankedMemoryCount: 4,
    maxPromptChars: 5000,
  },

  // Long/complex asks: explain, code, essay, multi-turn planning, anything
  // where the classifier flagged "heavy-task", or the message itself is long.
  HEAVY: {
    fetchHistoryLimit: 25,
    aiContextMessageCount: 8,
    perMessageCharCap: 300,
    recentChatLogCap: 800,
    useLongTermMemory: true,
    useChatSummary: true,
    maxWorkingMemoryTurns: 10,
    rankedMemoryCount: 6,
    maxPromptChars: 8000,
  },

  // Kingdom Clash strategy/game queries. These already carry a big
  // <GameData> block, so chat history budget stays intentionally small —
  // game data is the payload here, not conversation history.
  GAME: {
    fetchHistoryLimit: 6,
    aiContextMessageCount: 2,
    perMessageCharCap: 150,
    recentChatLogCap: 300,
    useLongTermMemory: false,
    useChatSummary: false,
    maxWorkingMemoryTurns: 0,
    rankedMemoryCount: 0,
    maxPromptChars: 8000, // GameData itself is capped separately (GAME_CONTEXT_SOFT_CAP_CHARS)
  },

  // Moderation / conflict messages: keep it fast and cheap, no memory needed
  // to roast someone effectively.
  MODERATION: {
    fetchHistoryLimit: 6,
    aiContextMessageCount: 2,
    perMessageCharCap: 150,
    recentChatLogCap: 300,
    useLongTermMemory: false,
    useChatSummary: false,
    maxWorkingMemoryTurns: 2,
    rankedMemoryCount: 0,
    maxPromptChars: 3000,
  },
};

// ============================================================
// 2. TIER CLASSIFICATION SIGNALS
// ============================================================

const HEAVY_SIGNAL_REGEX = /\b(explain|detail|history|analyze|code|script|story|essay|poem|stotram|mantra|lyrics|compare|breakdown|walkthrough)\b/i;
const CASUAL_WORD_COUNT_CEILING = 4;
const HEAVY_WORD_COUNT_FLOOR = 40;
const HEAVY_CHAR_FLOOR = 220;

const CASUAL_INTENTS = new Set(['banter', 'social', 'unknown']);
const HEAVY_INTENTS = new Set(['heavy-task', 'heavy_task', 'question']);
const MODERATION_INTENTS = new Set(['moderation', 'conflict']);

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Decides which tier a message belongs to.
 * Order matters: game > moderation > explicit-heavy-signal > casual > intent-based > default.
 */
function decideTier({ content = '', intent = '', isGameTurn = false, isModeration = false } = {}) {
  const normalizedIntent = String(intent || '').toLowerCase();
  const wordCount = countWords(content);

  if (isGameTurn) return 'GAME';
  if (isModeration || MODERATION_INTENTS.has(normalizedIntent)) return 'MODERATION';

  // Explicit heavy signal always wins, regardless of what the classifier thinks —
  // a long/complex message should never get squeezed into the casual budget.
  const looksHeavy =
    HEAVY_SIGNAL_REGEX.test(content) ||
    wordCount >= HEAVY_WORD_COUNT_FLOOR ||
    content.length >= HEAVY_CHAR_FLOOR ||
    HEAVY_INTENTS.has(normalizedIntent);

  if (looksHeavy) return 'HEAVY';

  // Short messages are casual no matter what the classifier guessed —
  // this is the safety net against misclassification blowing up the prompt.
  if (wordCount <= CASUAL_WORD_COUNT_CEILING || CASUAL_INTENTS.has(normalizedIntent)) {
    return 'CASUAL';
  }

  return 'STANDARD';
}

// ============================================================
// 3. PUBLIC API
// ============================================================

/**
 * Returns a full, ready-to-use budget profile for a message.
 * Always returns a fresh object (safe to mutate by caller if needed).
 */
function getBudgetProfile(signals = {}) {
  const tier = decideTier(signals);
  const base = TIERS[tier] || TIERS.STANDARD;

  return {
    tier,
    ...base,
  };
}

/**
 * Truncates and joins raw chat_ram rows into a prompt-ready string,
 * respecting the profile's per-message and total caps. Centralizing this
 * means index.js no longer needs its own truncation logic.
 *
 * @param {Array<{player_name?: string, message_content?: string}>} rows - newest first
 * @param {object} profile - result of getBudgetProfile()
 */
function buildChatLog(rows, profile) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const selected = rows.slice(0, profile.aiContextMessageCount).reverse();

  const joined = selected
    .map((r) => {
      const raw = r.message_content || '';
      const content = raw.length > profile.perMessageCharCap
        ? raw.slice(0, profile.perMessageCharCap) + '…'
        : raw;
      return `[${r.player_name || 'User'}]: ${content}`;
    })
    .join('\n');

  return joined.length > profile.recentChatLogCap
    ? joined.slice(-profile.recentChatLogCap)
    : joined;
}

/**
 * One-line trace log, consistent with the existing [PIPELINE TRACE] style,
 * so budget decisions are visible in Render logs without extra work.
 */
function traceBudget(profile, meta = {}) {
  const metaStr = Object.entries(meta)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(
    `[BUDGET TRACE] tier=${profile.tier} fetchLimit=${profile.fetchHistoryLimit} ` +
    `ctxMsgs=${profile.aiContextMessageCount} ltm=${profile.useLongTermMemory} ` +
    `summary=${profile.useChatSummary} maxPrompt=${profile.maxPromptChars} ${metaStr}`
  );
}

module.exports = {
  TIERS,
  decideTier,
  getBudgetProfile,
  buildChatLog,
  traceBudget,
};
