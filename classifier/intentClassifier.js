/**
 * classifier/intentClassifier.js
 *
 * PURPOSE
 *   Single source of truth for "what kind of message is this." 
 *   Runs locally on the server (0 token cost).
 *   🚀 UPGRADE: Context-aware heavy routing and dedicated GAME domain detection.
 */

const INTENTS = Object.freeze({
  COMMAND: 'command',
  HEAVY_TASK: 'heavy-task',
  MODERATION: 'moderation-trigger',
  EMOTIONAL_DISCLOSURE: 'emotional-disclosure',
  GAME: 'game-query', // 🚀 NEW: Top-level game intent routing
  BANTER: 'banter',
  SOCIAL: 'social',
  QUESTION: 'question',
  UNKNOWN: 'unknown',
});

// 🚀 UPGRADE: Split into Actions and Domains to prevent false-positives
const HEAVY_ACTIONS = ['explain', 'analyze', 'compare', 'summary', 'summarize', 'translate', 'solve', 'debug'];
const HARD_DOMAINS = ['code', 'python', 'javascript', 'c++', 'html', 'css', 'hardware', 'specs', 'math', 'calculate', 'database', 'algorithm', 'architecture', 'geopolitics', 'thesis'];
const SOFT_DOMAINS = ['bhajan', 'lyrics', 'song', 'poem', 'mantra'];

// 🚀 NEW: Game Domain Keywords to catch Kingdom Clash queries instantly
const GAME_KEYWORDS = ['kingdom clash', 'troop', 'troops', 'hero', 'heroes', 'anavin', 'trishtan', 'arena', 'gold farming', 'gem farming', 'synergy', 'stats', 'damage', 'hp', 'defense', 'ability', 'talent', 'boss raid'];

const COMMAND_PATTERN = /^(ban|kick|mute|delete|fix|solve|generate|write|announce|event)\b/i;
const CASUAL_KEYWORDS = ['hi', 'hello', 'hey', 'morning', 'night', 'lol', 'lmao', 'bye', 'test', 'yo', 'kaise'];
const MODERATION_KEYWORDS = ['kys', 'kill yourself', 'slur', 'nsfw', 'raid', 'spam', 'nuke'];
const EMOTIONAL_KEYWORDS = ['sad', 'depressed', 'anxious', 'scared', 'worried', 'lonely', 'love you', 'miss you', 'hurt', 'crying', 'tired of', "can't sleep"];
const QUESTION_PATTERN = /^(who|what|when|where|why|how|is|are|do|does|did|can you|could you|will|should)\b(?!.*\b(up|kaise|ho)\b)|\?$|^(tell me|give me|show me|list|name|recommend|suggest)\b/i;
const VS_PATTERN = /\b(vs|versus)\b/i; // 🚀 NEW: Catches comparison queries like "X vs Y"

function classify({ content, hasCodeBlock = false, mentions = [] } = {}) {
  try {
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

      // 🚀 UPGRADE: Catch game-specific queries and vs comparisons immediately
      const hasGameKeyword = GAME_KEYWORDS.some((kw) => text.includes(kw));
      const hasVsPattern = VS_PATTERN.test(text);
      if (hasGameKeyword || hasVsPattern) {
        return { intent: INTENTS.GAME, complexity: 0.7, isModeration: false, confidence: 0.85 };
      }

      // 🚀 UPGRADE: Smarter Heavy Task Detection
      const hasHardDomain = HARD_DOMAINS.some(kw => text.includes(kw));
      const hasAction = HEAVY_ACTIONS.some(kw => text.includes(kw));
      const hasSoftDomain = SOFT_DOMAINS.some(kw => text.includes(kw));
      
      // It's heavy if it has a codeblock, a hard tech/science domain, OR (an action verb + a soft domain like a poem)
      if (hasCodeBlock || hasHardDomain || (hasAction && hasSoftDomain)) {
        return { intent: INTENTS.HEAVY_TASK, complexity: 0.85, isModeration: false, confidence: 0.8 };
      }

      const isShort = text.length < 35;
      const isCasual = CASUAL_KEYWORDS.some((kw) => text.includes(kw));
      
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
