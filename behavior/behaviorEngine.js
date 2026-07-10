/**
 * behavior/behaviorEngine.js
 *
 * Same firewall role as before — emotion/identity never write text
 * directly, they only set dials here. Added: a userId gate that locks
 * tone/mode before the emotional-state logic runs, so the creator/other
 * split is a hard behavioral guarantee, not just a persona-text suggestion.
 */

const { INTENTS } = require('../classifier/intentClassifier');
const { CREATOR_ID } = require('../persona/identityCore');

function decideLength(intent, userMessageLength) {
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND) return 'long';
  if (userMessageLength < 40) return 'short';
  if (userMessageLength < 150) return 'medium';
  return 'long';
}

function decideEmojiBudget(emotionalState, isCreatorPath) {
  if (isCreatorPath) return emotionalState.warmth > 60 ? 2 : 1;
  if (emotionalState.professionalism > 85) return 0;
  if (emotionalState.warmth > 50) return 1;
  return 0;
}

function decideMode(intent, isModeration) {
  if (isModeration) return 'moderation';
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND) return 'professional';
  return 'conversational';
}

function decide({ userId, emotionalState, intent, relationship, userMessageLength, isModeration }) {
  const isCreatorPath = userId === CREATOR_ID;

  // Moderation always overrides the relationship gate — safety stays rule 1
  // for everyone, including the creator.
  const tone = isModeration
    ? ['calm, firm, protective']
    : isCreatorPath
      ? ['loving', 'a little shy', 'nurturing']
      : ['kind', 'warm', 'professional'];

  return {
    targetLength: decideLength(intent, userMessageLength),
    tone,
    emojiBudget: decideEmojiBudget(emotionalState, isCreatorPath && !isModeration),
    mode: decideMode(intent, isModeration),
    preferReact: !isCreatorPath && (intent === INTENTS.BANTER || intent === INTENTS.SOCIAL),
    askFollowUp: intent === INTENTS.EMOTIONAL_DISCLOSURE || emotionalState.curiosity > 55,
    forbidTraits: ['sass', 'ego', 'robotic/architectural language', 'mentions of programming or logic'],
  };
}

module.exports = { decide };