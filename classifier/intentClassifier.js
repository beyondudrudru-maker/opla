/**
 * classifier/intentClassifier.js
 *
 * PURPOSE
 *   Single source of truth for "what kind of message is this." 
 *   Runs locally on the server (0 token cost).
 *
 * 🚀 UPGRADE: Pre-compiled regex with \b (Word Boundaries) for max CPU performance.
 * 🚀 UPGRADE: Now extracts and returns the exact `triggerWord` for easy debugging.
 * 🛡️ FIX: Added missing TROLL and TERRITORIAL logic to match INTENTS dictionary.
 * 🚀 UPGRADE: Expanded Hinglish and Gen-Z slang for better Flirt/Troll detection.
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

const HEAVY_ACTIONS = /\b(explain|analyze|compare|summary|summarize|translate|solve|debug)\b/i;
const HARD_DOMAINS = /\b(code|python|javascript|c\+\+|html|css|hardware|specs|math|calculate|database|algorithm|architecture|geopolitics|thesis)\b/i;
const SOFT_DOMAINS = /\b(bhajan|lyrics|song|poem|mantra)\b/i;

const GAME_KEYWORDS = /\b(kingdom clash|troop|troops|hero|heroes|anavin|trishtan|arena|gold farming|gem farming|synergy|stats|damage|hp|defense|ability|talent|boss raid)\b/i;

const COMMAND_PATTERN = /^(ban|kick|mute|delete|fix|solve|generate|write|announce|event|dm|ping)\b/i;
const CASUAL_KEYWORDS = /\b(hi|hello|hey|morning|night|lol|lmao|bye|test|yo|kaise|wassup|sup|gm|gn)\b/i;
const MODERATION_KEYWORDS = /\b(kys|kill yourself|slur|nsfw|raid|spam|nuke)\b/i;
const EMOTIONAL_KEYWORDS = /\b(sad|depressed|anxious|scared|worried|lonely|love you|miss you|hurt|crying|tired of|can't sleep)\b/i;

const QUESTION_PATTERN = /^(who|what|when|where|why|how|is|are|do|does|did|can you|could you|will|should|kya|kyu|kab|kaha|kidhar)\b(?!.*\b(up|kaise|ho)\b)|\?$|^(tell me|give me|show me|list|name|recommend|suggest)\b/i;
const VS_PATTERN = /\b(vs|versus)\b/i; 

// 🚀 UPGRADE: Added "baby", "babe", "sexy", "mommy", "daddy" to catch more context
const FLIRT_KEYWORDS = /\b(cute|hot|kiss me|hug me|marry me|set ho jayegi|pat jayegi|cutie|hottie|jaan|meri jaan|hot lag rahi|baby|babe|sexy|daddy|mommy)\b/i;
const JEALOUSY_KEYWORDS = /\b(other girl|another girl|baddie|sidekick|cheat|dhoka|replace|steal him|teri sautan|body count)\b/i;
const HOSTILE_KEYWORDS = /\b(stfu|dumb|idiot|shut up|loser|pagal|aukat|chup|bakwas|bitch)\b/i;

// 🛡️ FIX: Added missing TROLL and TERRITORIAL keywords
const TERRITORIAL_KEYWORDS = /\b(mine|meri hai|only mine|dur reh|hands off|back off|my property|kisi aur ki)\b/i;
const TROLL_KEYWORDS = /\b(noob|bot|skill issue|cry about it|ez|cope|touch grass|clown|chomu|gawar|nalla)\b/i;

/**
 * Helper function to find the matched word for debugging purposes.
 */
function getMatch(regex, text) {
    const match = text.match(regex);
    return match ? match[0] : null;
}

function classify({ content, hasCodeBlock = false, mentions = [] } = {}) {
  try {
      if (typeof content !== 'string' || content.trim().length === 0) {
          return { intent: INTENTS.BANTER, complexity: 0.1, isModeration: false, confidence: 1.0, triggerWord: 'empty_string' };
      }

      const text = content.toLowerCase().trim();
      let match;

      if ((match = getMatch(MODERATION_KEYWORDS, text))) {
        return { intent: INTENTS.MODERATION, complexity: 0.3, isModeration: true, confidence: 0.9, triggerWord: match };
      }

      if ((match = getMatch(HOSTILE_KEYWORDS, text))) {
        return { intent: INTENTS.HOSTILE, complexity: 0.2, isModeration: false, confidence: 0.85, triggerWord: match };
      }

      if ((match = getMatch(JEALOUSY_KEYWORDS, text))) {
        return { intent: INTENTS.JEALOUSY, complexity: 0.3, isModeration: false, confidence: 0.85, triggerWord: match };
      }

      // 🛡️ FIX: Hooked up Territorial check
      if ((match = getMatch(TERRITORIAL_KEYWORDS, text))) {
        return { intent: INTENTS.TERRITORIAL, complexity: 0.3, isModeration: false, confidence: 0.85, triggerWord: match };
      }

      // 🛡️ FIX: Hooked up Troll check
      if ((match = getMatch(TROLL_KEYWORDS, text))) {
        return { intent: INTENTS.TROLL, complexity: 0.2, isModeration: false, confidence: 0.8, triggerWord: match };
      }

      if ((match = getMatch(COMMAND_PATTERN, text))) {
        return { intent: INTENTS.COMMAND, complexity: 0.6, isModeration: false, confidence: 0.85, triggerWord: match };
      }

      if ((match = getMatch(FLIRT_KEYWORDS, text))) {
        return { intent: INTENTS.FLIRT, complexity: 0.2, isModeration: false, confidence: 0.8, triggerWord: match };
      }

      if ((match = getMatch(EMOTIONAL_KEYWORDS, text))) {
        return { intent: INTENTS.EMOTIONAL_DISCLOSURE, complexity: 0.4, isModeration: false, confidence: 0.7, triggerWord: match };
      }

      const gameMatch = getMatch(GAME_KEYWORDS, text);
      const vsMatch = getMatch(VS_PATTERN, text);
      if (gameMatch || vsMatch) {
        return { intent: INTENTS.GAME, complexity: 0.7, isModeration: false, confidence: 0.85, triggerWord: gameMatch || vsMatch };
      }

      const hardDomainMatch = getMatch(HARD_DOMAINS, text);
      const actionMatch = getMatch(HEAVY_ACTIONS, text);
      const softDomainMatch = getMatch(SOFT_DOMAINS, text);
      
      if (hasCodeBlock || hardDomainMatch || (actionMatch && softDomainMatch)) {
        return { intent: INTENTS.HEAVY_TASK, complexity: 0.85, isModeration: false, confidence: 0.8, triggerWord: hardDomainMatch || actionMatch || 'code_block' };
      }

      const isShort = text.length < 35;
      const casualMatch = getMatch(CASUAL_KEYWORDS, text);
      const questionMatch = getMatch(QUESTION_PATTERN, text);
      
      if (casualMatch || (isShort && !questionMatch)) {
        return { intent: INTENTS.BANTER, complexity: 0.15, isModeration: false, confidence: 0.6, triggerWord: casualMatch || 'short_message' };
      }

      if (questionMatch) {
        return { intent: INTENTS.QUESTION, complexity: 0.5, isModeration: false, confidence: 0.65, triggerWord: questionMatch };
      }

      return { intent: INTENTS.SOCIAL, complexity: 0.35, isModeration: false, confidence: 0.4, triggerWord: 'none' };

  } catch (error) {
      console.error('⚠️ [CLASSIFIER ERROR] Fallback to social:', error.message);
      return { intent: INTENTS.SOCIAL, complexity: 0.3, isModeration: false, confidence: 0.1, triggerWord: 'error_fallback' };
  }
}

module.exports = { classify, INTENTS };
