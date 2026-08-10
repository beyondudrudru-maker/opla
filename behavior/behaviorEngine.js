/**
 * behavior/behaviorEngine.js
 *
 * PURPOSE: Dynamically computes response parameters (length, tone, emojis, mode)
 * based on user intent, emotional state, and relationship context.
 * 🚀 UPGRADE: Smarter intent handling, context-aware command execution, robust fallback handling,
 * and strict formatting enforcement for point-wise game responses.
 */

const { INTENTS } = require('../classifier/intentClassifier');
const { CREATOR_ID } = require('../persona/identityCore');

const INFORMATIONAL_INTENTS = new Set([INTENTS.QUESTION, INTENTS.HEAVY_TASK, INTENTS.COMMAND]);

// Game-specific intents for specialized rule routing
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query', 'UNKNOWN']);

// Conflict pattern to detect roasts, sassy commands, or targeted insults
const CONFLICT_PATTERN = /\b(insult|troll|hatt|stfu|dumb|idiot|shut\s*up|loser|pagal|roast)\b/i;

function decideLength(intent, userMessageLength) {
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND || GAME_INTENTS.has(intent)) return 'long';
  if (userMessageLength < 40) return 'short';
  if (userMessageLength < 150) return 'medium';
  return 'long';
}

function decideEmojiBudget(emotionalState, isCreatorPath, isInformational, isGameQuery, isConflict) {
  if (!emotionalState) return 0;
  if (isConflict) return 2; // Sassy emojis needed for execution (💅, 🔪, 🙄)
  if (isGameQuery) return 1; // Keep it clean and professional for game data
  if (isInformational) return isCreatorPath && emotionalState.warmth > 70 ? 1 : 0;
  if (isCreatorPath) return emotionalState.warmth > 60 ? 2 : 1;
  if (emotionalState.professionalism > 85) return 0;
  if (emotionalState.warmth > 50) return 1;
  return 0;
}

function decideMode(intent, isModeration, isConflict) {
  if (isModeration) return 'moderation';
  if (isConflict) return 'combat_execution'; // Switches off romance, turns on sass/execution
  if (GAME_INTENTS.has(intent)) return 'strategic_expert'; // Triggers diplomatic analysis mode
  if (INFORMATIONAL_INTENTS.has(intent)) return 'professional';
  return 'conversational';
}

function decideTone(intent, isModeration, isCreatorPath, isConflict) {
  if (isModeration) return ['Calm', 'Firm', 'Protective'];

  // Command/Conflict override: drop romance, execute roast
  if (isConflict) {
    return isCreatorPath 
      ? ['Fierce', 'Merciless', 'Loyal', 'Sassy'] 
      : ['Fierce', 'Sassy', 'Defensive'];
  }

  // Strict game tone overrides
  if (GAME_INTENTS.has(intent)) {
    return ['Professional', 'Diplomatic', 'Strategic', 'Decisive'];
  }

  if (INFORMATIONAL_INTENTS.has(intent)) {
    return isCreatorPath
      ? ['Direct', 'Precise', 'WarmClose'] // Still warm for creator, but focused
      : ['Direct', 'Precise', 'Clear'];
  }

  return isCreatorPath
    ? ['Loving', 'Devoted', 'Sweet'] // Deep boyfriend/girlfriend romance logic maps here for casual chat
    : ['Kind', 'Warm', 'Pro'];
}

function decideFormat(isGameQuery) {
  // Enforce point-wise answers strictly for game-related questions
  if (isGameQuery) return 'Bullet-Points';
  return 'Conversational';
}

function decide({ userId, emotionalState = {}, intent, relationship, userMessageLength = 50, isModeration = false, content = '' } = {}) {
  try {
    const isCreatorPath = userId === CREATOR_ID;
    const isInformational = INFORMATIONAL_INTENTS.has(intent);
    const isGameQuery = GAME_INTENTS.has(intent);
    
    // Dynamically flag conflicts or explicit commands to prevent accidental romantic loops
    const isConflict = CONFLICT_PATTERN.test(content) || intent === INTENTS.COMMAND;

    let forbidTraits = ['Ego', 'Robotic', 'MetaLogic'];
    
    if (isModeration) {
        forbidTraits.push('Sass');
    }
    
    if (isInformational) {
        forbidTraits.push('Hallucination', 'GuessingLyrics', 'FusingWorks');
    }

    // Block fake stats and messy formatting in game mode
    if (isGameQuery) {
        forbidTraits.push('MarkdownTables', 'StatHallucination', 'AssumingData', 'Fluff');
    }

    // Block romance during roasts/commands
    if (isConflict && isCreatorPath) {
        forbidTraits.push('Romance', 'Flirting', 'Softness');
    }

    return {
      targetLength: decideLength(intent, userMessageLength),
      tone: decideTone(intent, isModeration, isCreatorPath, isConflict),
      emojiBudget: decideEmojiBudget(emotionalState, isCreatorPath && !isModeration, isInformational, isGameQuery, isConflict),
      mode: decideMode(intent, isModeration, isConflict),
      format: decideFormat(isGameQuery),
      // Disable random reactions and follow-up questions when doing analytical game reporting or roasting
      preferReact: !isCreatorPath && (intent === INTENTS.BANTER || intent === INTENTS.SOCIAL) && !isGameQuery && !isConflict,
      askFollowUp: !isGameQuery && !isConflict && (intent === INTENTS.EMOTIONAL_DISCLOSURE || (emotionalState.curiosity && emotionalState.curiosity > 55)),
      forbidTraits: forbidTraits,
    };
  } catch (error) {
    console.error('⚠️ [BEHAVIOR ENGINE ERROR] Fallback decision applied:', error.message);
    return {
      targetLength: 'medium',
      tone: ['Kind', 'Warm'],
      emojiBudget: 1,
      mode: 'conversational',
      format: 'Conversational',
      preferReact: false,
      askFollowUp: false,
      forbidTraits: ['Ego', 'Robotic'],
    };
  }
}

// Token-compressed output
function toBrief(decision) {
  if (!decision) return '[BEHAVIOR|UNKNOWN]';
  return `[BEHAVIOR|LEN:${decision.targetLength}|MODE:${decision.mode}|FORMAT:${decision.format}|TONE:${decision.tone.join(',')}|EMOJI:${decision.emojiBudget}|REACT:${decision.preferReact ? 'Y':'N'}|ASK:${decision.askFollowUp ? 'Y':'N'}|NO:${decision.forbidTraits.join(',')}]`;
}

module.exports = { decide, toBrief };
