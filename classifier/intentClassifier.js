/**
 * classifier/intentClassifier.js
 *
 * PURPOSE
 *   Single source of truth for "what kind of message is this." 
 *   Runs locally on the server (0 token cost).
 *   🚀 UPGRADE: Fixed "Substring Trap" bug using exact Word Boundaries (\b).
 *   🚀 UPGRADE: Pre-compiled regex for maximum CPU performance.
 *   🚀 UPGRADE: Added Hinglish support to Question and Casual patterns.
 */

const INTENTS = Object.freeze({
  COMMAND: 'command',
  HEAVY_TASK: 'heavy-task',
  MODERATION: 'moderation-trigger',
  EMOTIONAL_DISCLOSURE: 'emotional-disclosure',
  GAME: 'game-query', 
  BANTER: 'banter',
  SOCIAL: 'social',
  QUESTION: 'question',
  UNKNOWN: 'unknown',
  FLIRT: 'flirt',
  JEALOUSY: 'jealousy',
  TERRITORIAL: 'territorial',
  HOSTILE: 'hostile',
  TROLL: 'troll'
});

// 🚀 UPGRADE: Pre-compiled Regex patterns with \b (Word Boundaries) to prevent false positives.
// (e.g., prevents "photo" from triggering "hot", or "decode" from triggering "code")

const HEAVY_ACTIONS = /\b(explain|analyze|compare|summary|summarize|translate|solve|debug)\b/i;
const HARD_DOMAINS = /\b(code|python|javascript|c\+\+|html|css|hardware|specs|math|calculate|database|algorithm|architecture|geopolitics|thesis)\b/i;
const SOFT_DOMAINS = /\b(bhajan|lyrics|song|poem|mantra)\b/i;

const GAME_KEYWORDS = /\b(kingdom clash|troop|troops|hero|heroes|anavin|trishtan|arena|gold farming|gem farming|synergy|stats|damage|hp|defense|ability|talent|boss raid)\b/i;

const COMMAND_PATTERN = /^(ban|kick|mute|delete|fix|solve|generate|write|announce|event|dm|ping)\b/i;
const CASUAL_KEYWORDS = /\b(hi|hello|hey|morning|night|lol|lmao|bye|test|yo|kaise)\b/i;
const MODERATION_KEYWORDS = /\b(kys|kill yourself|slur|nsfw|raid|spam|nuke)\b/i;
const EMOTIONAL_KEYWORDS = /\b(sad|depressed|anxious|scared|worried|lonely|love you|miss you|hurt|crying|tired of|can't sleep)\b/i;

// Expanded Question pattern to include Hinglish (kya, kyu, kab, kidhar)
const QUESTION_PATTERN = /^(who|what|when|where|why|how|is|are|do|does|did|can you|could you|will|should|kya|kyu|kab|kaha|kidhar)\b(?!.*\b(up|kaise|ho)\b)|\?$|^(tell me|give me|show me|list|name|recommend|suggest)\b/i;
const VS_PATTERN = /\b(vs|versus)\b/i; 

const FLIRT_KEYWORDS = /\b(cute|hot|kiss me|hug me|marry me|set ho jayegi|pat jayegi|cutie|hottie|jaan|meri jaan|hot lag rahi)\b/i;
const JEALOUSY_KEYWORDS = /\b(other girl|another girl|baddie|sidekick|cheat|dhoka|replace|steal him|teri sautan|body count)\b/i;
const HOSTILE_KEYWORDS = /\b(stfu|dumb|idiot|shut up|loser|pagal|aukat|chup|bakwas|bitch)\b/i;

function classify({ content, hasCodeBlock = false, mentions = [] } = {}) {
  try {
      if (typeof content !== 'string' || content.trim().length === 0) {
          return { intent: INTENTS.BANTER, complexity: 0.1, isModeration: false, confidence: 1.0 };
      }

      const text = content.toLowerCase().trim();

      if (MODERATION_KEYWORDS.test(text)) {
        return { intent: INTENTS.MODERATION, complexity: 0.3, isModeration: true, confidence: 0.9 };
      }

      if (HOSTILE_KEYWORDS.test(text)) {
        return { intent: INTENTS.HOSTILE, complexity: 0.2, isModeration: false, confidence: 0.85 };
      }

      if (JEALOUSY_KEYWORDS.test(text)) {
        return { intent: INTENTS.JEALOUSY, complexity: 0.3, isModeration: false, confidence: 0.85 };
      }

      if (COMMAND_PATTERN.test(text)) {
        return { intent: INTENTS.COMMAND, complexity: 0.6, isModeration: false, confidence: 0.85 };
      }

      if (FLIRT_KEYWORDS.test(text)) {
        return { intent: INTENTS.FLIRT, complexity: 0.2, isModeration: false, confidence: 0.8 };
      }

      if (EMOTIONAL_KEYWORDS.test(text)) {
        return { intent: INTENTS.EMOTIONAL_DISCLOSURE, complexity: 0.4, isModeration: false, confidence: 0.7 };
      }

      const hasGameKeyword = GAME_KEYWORDS.test(text);
      const hasVsPattern = VS_PATTERN.test(text);
      if (hasGameKeyword || hasVsPattern) {
        return { intent: INTENTS.GAME, complexity: 0.7, isModeration: false, confidence: 0.85 };
      }

      const hasHardDomain = HARD_DOMAINS.test(text);
      const hasAction = HEAVY_ACTIONS.test(text);
      const hasSoftDomain = SOFT_DOMAINS.test(text);
      
      if (hasCodeBlock || hasHardDomain || (hasAction && hasSoftDomain)) {
        return { intent: INTENTS.HEAVY_TASK, complexity: 0.85, isModeration: false, confidence: 0.8 };
      }

      const isShort = text.length < 35;
      const isCasual = CASUAL_KEYWORDS.test(text);
      
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
