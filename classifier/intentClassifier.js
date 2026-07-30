/**
 * classifier/intentClassifier.js
 *
 * PURPOSE
 *   Single source of truth for "what kind of message is this." Replaces
 *   the three overlapping keyword lists that used to live separately in
 *   the router and the emotional-state function. Both modelRouter and
 *   emotionEngine consume this classifier's output instead of re-deriving
 *   their own heuristics.
 *
 * RESPONSIBILITIES
 *   - Classify into an intent taxonomy (see INTENTS below).
 *   - Estimate task complexity (0-1) for router confidence.
 *   - Flag moderation-relevant content for the safety layer.
 *
 * INPUTS
 *   { content: string, hasCodeBlock: boolean, mentions: string[] }
 *
 * OUTPUTS
 *   { intent: string, complexity: number, isModeration: boolean,
 *     confidence: number }
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

// UPDATED: Added cultural, lyrical, and musical keywords to ensure strict accuracy routing
const HEAVY_KEYWORDS = [
  'code', 'python', 'javascript', 'c++', 'html', 'css', 'hardware', 'specs',
  'math', 'calculate', 'explain', 'database', 'algorithm', 'error', 'debug',
  'architecture', 'detailed', 'bhajan', 'lyrics', 'song', 'poem', 'mantra', 'translate'
];

// UPDATED: Added server/clan management keywords
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

// Interrogative openers (question word or polite-ask framing) OR
// imperative info-requests
const QUESTION_PATTERN =
  /^(who|what|when|where|why|how|is|are|do|does|did|can you|could you|will|should)\b|\?$|^(tell me|give me|show me|list|name|recommend|suggest)\b/;

function classify({ content, hasCodeBlock = false, mentions = [] } = {}) {
  const text = (content || '').toLowerCase().trim();

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
