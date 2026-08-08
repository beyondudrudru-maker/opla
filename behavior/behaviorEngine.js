/**
 * behavior/behaviorEngine.js
 * 
 * PURPOSE: Dynamically computes response parameters (length, tone, emojis, mode)
 * based on user intent, emotional state, and relationship context.
 */

const { INTENTS } = require('../classifier/intentClassifier');
const { CREATOR_ID } = require('../persona/identityCore');

const INFORMATIONAL_INTENTS = new Set([INTENTS.QUESTION, INTENTS.HEAVY_TASK, INTENTS.COMMAND]);

// 🚀 GAME-SPECIFIC INTENTS (Passed down from gameDomainRouter)
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM']);

function decideLength(intent, userMessageLength) {
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND || GAME_INTENTS.has(intent)) return 'long';
  if (userMessageLength < 40) return 'short';
  if (userMessageLength < 150) return 'medium';
  return 'long';
}

function decideEmojiBudget(emotionalState, isCreatorPath, isInformational, isGameQuery) {
  if (!emotionalState) return 0;
  if (isGameQuery) return 1; // Keep it clean and professional for game data
  if (isInformational) return isCreatorPath && emotionalState.warmth > 70 ? 1 : 0;
  if (isCreatorPath) return emotionalState.warmth > 60 ? 2 : 1;
  if (emotionalState.professionalism > 85) return 0;
  if (emotionalState.warmth > 50) return 1;
  return 0;
}

function decideMode(intent, isModeration) {
  if (isModeration) return 'moderation';
  if (GAME_INTENTS.has(intent)) return 'strategic_expert'; // 🚀 Triggers diplomatic analysis mode
  if (INFORMATIONAL_INTENTS.has(intent)) return 'professional';
  return 'conversational';
}

function decideTone(intent, isModeration, isCreatorPath) {
  if (isModeration) return ['Calm', 'Firm', 'Protective'];

  // 🚀 STRICT GAME TONE OVERRIDES
  if (GAME_INTENTS.has(intent)) {
    return ['Professional', 'Diplomatic', 'Strategic', 'Decisive'];
  }

  if (INFORMATIONAL_INTENTS.has(intent)) {
    return isCreatorPath
      ? ['Direct', 'Precise', 'WarmClose']
      : ['Direct', 'Precise', 'Clear'];
  }

  return isCreatorPath
    ? ['Loving', 'Shy', 'Nurturing']
    : ['Kind', 'Warm', 'Pro'];
}

function decide({ userId, emotionalState = {}, intent, relationship, userMessageLength = 50, isModeration = false }) {
  const isCreatorPath = userId === CREATOR_ID;
  const isInformational = INFORMATIONAL_INTENTS.has(intent);
  const isGameQuery = GAME_INTENTS.has(intent);

  let forbidTraits = ['Ego', 'Robotic', 'MetaLogic'];
  
  if (isModeration) {
      forbidTraits.push('Sass');
  }
  
  if (isInformational) {
      forbidTraits.push('Hallucination', 'GuessingLyrics', 'FusingWorks');
  }

  // 🚀 BLOCK FAKE STATS AND MESSY FORMATTING IN GAME MODE
  if (isGameQuery) {
      forbidTraits.push('MarkdownTables', 'StatHallucination', 'AssumingData', 'Fluff');
  }

  return {
    targetLength: decideLength(intent, userMessageLength),
    tone: decideTone(intent, isModeration, isCreatorPath),
    emojiBudget: decideEmojiBudget(emotionalState, isCreatorPath && !isModeration, isInformational, isGameQuery),
    mode: decideMode(intent, isModeration),
    // Disable random reactions and follow-up questions when doing analytical game reporting
    preferReact: !isCreatorPath && (intent === INTENTS.BANTER || intent === INTENTS.SOCIAL) && !isGameQuery,
    askFollowUp: !isGameQuery && (intent === INTENTS.EMOTIONAL_DISCLOSURE || (emotionalState.curiosity && emotionalState.curiosity > 55)),
    forbidTraits: forbidTraits,
  };
}

// ⚡ TOKEN-COMPRESSED OUTPUT
function toBrief(decision) {
  if (!decision) return '[BEHAVIOR|UNKNOWN]';
  return `[BEHAVIOR|LEN:${decision.targetLength}|MODE:${decision.mode}|TONE:${decision.tone.join(',')}|EMOJI:${decision.emojiBudget}|REACT:${decision.preferReact ? 'Y':'N'}|ASK:${decision.askFollowUp ? 'Y':'N'}|NO:${decision.forbidTraits.join(',')}]`;
}

module.exports = { decide, toBrief };
