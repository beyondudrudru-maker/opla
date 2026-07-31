/**
 * behavior/behaviorEngine.js
 */

const { INTENTS } = require('../classifier/intentClassifier');
const { CREATOR_ID } = require('../persona/identityCore');

const INFORMATIONAL_INTENTS = new Set([INTENTS.QUESTION, INTENTS.HEAVY_TASK, INTENTS.COMMAND]);

function decideLength(intent, userMessageLength) {
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND) return 'long';
  if (userMessageLength < 40) return 'short';
  if (userMessageLength < 150) return 'medium';
  return 'long';
}

function decideEmojiBudget(emotionalState, isCreatorPath, isInformational) {
  if (isInformational) return isCreatorPath && emotionalState.warmth > 70 ? 1 : 0;
  if (isCreatorPath) return emotionalState.warmth > 60 ? 2 : 1;
  if (emotionalState.professionalism > 85) return 0;
  if (emotionalState.warmth > 50) return 1;
  return 0;
}

function decideMode(intent, isModeration) {
  if (isModeration) return 'moderation';
  if (INFORMATIONAL_INTENTS.has(intent)) return 'professional';
  return 'conversational';
}

function decideTone(intent, isModeration, isCreatorPath) {
  if (isModeration) return ['Calm', 'Firm', 'Protective'];

  if (INFORMATIONAL_INTENTS.has(intent)) {
    return isCreatorPath
      ? ['Direct', 'Precise', 'WarmClose']
      : ['Direct', 'Precise', 'Clear'];
  }

  return isCreatorPath
    ? ['Loving', 'Shy', 'Nurturing']
    : ['Kind', 'Warm', 'Pro'];
}

function decide({ userId, emotionalState, intent, relationship, userMessageLength, isModeration }) {
  const isCreatorPath = userId === CREATOR_ID;
  const isInformational = INFORMATIONAL_INTENTS.has(intent);

  let forbidTraits = ['Ego', 'Robotic', 'MetaLogic'];
  
  if (isModeration) {
      forbidTraits.push('Sass');
  }
  
  if (isInformational) {
      forbidTraits.push('Hallucination', 'GuessingLyrics', 'FusingWorks');
  }

  return {
    targetLength: decideLength(intent, userMessageLength),
    tone: decideTone(intent, isModeration, isCreatorPath),
    emojiBudget: decideEmojiBudget(emotionalState, isCreatorPath && !isModeration, isInformational),
    mode: decideMode(intent, isModeration),
    preferReact: !isCreatorPath && (intent === INTENTS.BANTER || intent === INTENTS.SOCIAL),
    askFollowUp: intent === INTENTS.EMOTIONAL_DISCLOSURE || emotionalState.curiosity > 55,
    forbidTraits: forbidTraits,
  };
}

// ⚡ TOKEN-COMPRESSED OUTPUT
function toBrief(decision) {
  return `[BEHAVIOR|LEN:${decision.targetLength}|MODE:${decision.mode}|TONE:${decision.tone.join(',')}|EMOJI:${decision.emojiBudget}|REACT:${decision.preferReact ? 'Y':'N'}|ASK:${decision.askFollowUp ? 'Y':'N'}|NO:${decision.forbidTraits.join(',')}]`;
}

module.exports = { decide, toBrief };
