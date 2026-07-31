/**
 * classifier/intentClassifier.js
 *
 * PURPOSE
 *   Single source of truth for "what kind of message is this." 
 *   Runs locally on the server (0 token cost).
 *   Armored with fault-tolerance to prevent crashes from empty inputs.
 */

const INTENTS = Object.freeze({
  COMMAND: 'command',
  HEAVY_TASK: 'heavy-task',
  MODERATION: 'moderation-trigger',
  EMOTIONAL_DISCLOSURE: 'emotional-disclosure',
  BANTER: 'banter',
  SOCIAL: 'social',
  QUESTION: 'question',
  UNKNOWN: 'unknown',
});

const HEAVY_KEYWORDS = [
  'code', 'python', 'javascript', 'c++', 'html', 'css', 'hardware', 'specs',
  'math', 'calculate', 'explain', 'database', 'algorithm', 'error', 'debug',
  'architecture', 'detailed', 'bhajan', 'lyrics', 'song', 'poem', 'mantra', 'translate'
];

const COMMAND_PATTERN = /^(ban|kick|mute|delete|fix|solve|generate|write|announce|event)\b/i;

const CASUAL_KEYWORDS = [
  'hi', 'hello', 'hey', 'morning', 'night', 'lol', 'lmao', 'bye', 'test',
];

const MODERATION_KEYWORDS = [
  'kys', 'kill yourself', 'slur', 'nsfw', 'raid', 'spam', 'nuke',
];

const EMOTIONAL_KEYWORDS = [
  'sad', 'depressed', 'anxious', 'scared', 'worried', 'lonely', 'love you',
  'miss you', 'hurt', 'crying', 'tired of', "can't sleep",
];

const QUESTION_PATTERN =
  /^(who|what|when|where|why|how|is|are|do|does|did|can you|could you|will|should)\b|\?$|^(tell me|give me|show me|list|name|recommend|suggest)\b/;

/**
 * Safely classifies the user's text.
 */
function classify({ content, hasCodeBlock = false, mentions = [] } = {}) {
  // 🛡️ FAULT TOLERANCE: Ensure content is always a valid string
  if (typeof content !== 'string') {
      return { intent: INTENTS.UNKNOWN, complexity: 0.1, isModeration: false, confidence: 1.0 };
  }

  const text = content.toLowerCase().trim();

  // 🛡️ FAULT TOLERANCE: Handle completely empty strings
  if (text.length === 0) {
      return { intent: INTENTS.BANTER, complexity: 0.1, isModeration: false, confidence: 1.0 };
  }

  if (MODERATION_KEYWORDS.some((kw) => text.includes(kw))) {
    return { intent: INTENTS.MODERATION, complexity: 0.3, isModeration: true, confidence: 0.9 };
  }

  if (COMMAND_PATTERN.test(text)) {
    return { intent: INTENTS.COMMAND, complexity: 0.6, isModeration: false, confidence: 0.85 };
  }

  if (EMOTIONAL_KEYWORDS.some((kw) => text.includes(kw))) {
    return { intent: INTENTS.EMOTIONAL_DISCLOSURE, complexity: 0.4, isModeration: false, confidence: 0.7 };
  }

  const needsHeavyLifting = hasCodeBlock || HEAVY_KEYWORDS.some((kw) => text.includes(kw));
  if (needsHeavyLifting) {
    return { intent: INTENTS.HEAVY_TASK, complexity: 0.85, isModeration: false, confidence: 0.8 };
  }

  if (QUESTION_PATTERN.test(text)) {
    return { intent: INTENTS.QUESTION, complexity: 0.5, isModeration: false, confidence: 0.65 };
  }

  const isShort = text.length < 35;
  const isCasual = CASUAL_KEYWORDS.some((kw) => text.includes(kw));
  if (isShort || isCasual) {
    return { intent: INTENTS.BANTER, complexity: 0.15, isModeration: false, confidence: 0.6 };
  }

  return { intent: INTENTS.SOCIAL, complexity: 0.35, isModeration: false, confidence: 0.4 };
}

module.exports = { classify, INTENTS };
