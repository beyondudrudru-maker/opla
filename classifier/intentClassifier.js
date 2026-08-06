/**
 * classifier/intentClassifier.js
 *
 * PURPOSE
 *   Single source of truth for "what kind of message is this." 
 *   Runs locally on the server (0 token cost).
 *   Armored with fault-tolerance and fine-tuned for Gemini 3.5/3.6 (3rd Gen) & Llama 3 routing.
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

// 🚀 UPGRADE: Fine-tuned for your specific interests to route to 3.6/Groq properly
const HEAVY_KEYWORDS = [
  'code', 'python', 'javascript', 'c++', 'html', 'css', 'hardware', 'specs',
  'math', 'calculate', 'explain', 'database', 'algorithm', 'error', 'debug',
  'architecture', 'detailed', 'bhajan', 'lyrics', 'song', 'poem', 'mantra', 'translate',
  'geopolitics', 'history', 'thesis', 'analyze', 'compare', 'summary'
];

const COMMAND_PATTERN = /^(ban|kick|mute|delete|fix|solve|generate|write|announce|event)\b/i;

const CASUAL_KEYWORDS = [
  'hi', 'hello', 'hey', 'morning', 'night', 'lol', 'lmao', 'bye', 'test', 'yo', 'kaise'
];

const MODERATION_KEYWORDS = [
  'kys', 'kill yourself', 'slur', 'nsfw', 'raid', 'spam', 'nuke',
];

const EMOTIONAL_KEYWORDS = [
  'sad', 'depressed', 'anxious', 'scared', 'worried', 'lonely', 'love you',
  'miss you', 'hurt', 'crying', 'tired of', "can't sleep",
];

// 🚀 UPGRADE: Stricter question regex so casual chat drops to 3.5 Flash-Lite
const QUESTION_PATTERN =
  /^(who|what|when|where|why|how|is|are|do|does|did|can you|could you|will|should)\b(?!.*\b(up|kaise|ho)\b)|\?$|^(tell me|give me|show me|list|name|recommend|suggest)\b/i;

/**
 * Safely classifies the user's text.
 */
function classify({ content, hasCodeBlock = false, mentions = [] } = {}) {
  try {
      // 🛡️ FAULT TOLERANCE: Ensure content is always a valid string
      if (typeof content !== 'string' || content.trim().length === 0) {
          return { intent: INTENTS.BANTER, complexity: 0.1, isModeration: false, confidence: 1.0 };
      }

      const text = content.toLowerCase().trim();

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

      const isShort = text.length < 35;
      const isCasual = CASUAL_KEYWORDS.some((kw) => text.includes(kw));
      
      // 🚀 UPGRADE: Prioritize Banter for short/casual messages even if they contain a question mark
      if (isCasual || (isShort && !QUESTION_PATTERN.test(text))) {
        return { intent: INTENTS.BANTER, complexity: 0.15, isModeration: false, confidence: 0.6 };
      }

      if (QUESTION_PATTERN.test(text)) {
        return { intent: INTENTS.QUESTION, complexity: 0.5, isModeration: false, confidence: 0.65 };
      }

      return { intent: INTENTS.SOCIAL, complexity: 0.35, isModeration: false, confidence: 0.4 };

  } catch (error) {
      console.error('⚠️ [CLASSIFIER ERROR] Fallback to social:', error.message);
      return { intent: INTENTS.SOCIAL, complexity: 0.3, isModeration: false, confidence: 0.1 };
  }
}

module.exports = { classify, INTENTS };
