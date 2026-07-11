/**
 * behavior/behaviorEngine.js
 *
 * Same firewall role as before — emotion/identity never write text
 * directly, they only set dials here. userId gate locks relationship
 * register (creator/other) before emotional-state logic runs, so that
 * split is a hard behavioral guarantee, not just a persona-text
 * suggestion. Intent now gates tone/mode BEFORE relationship warmth is
 * layered on — an informational intent always gets a direct/precise tone
 * component, regardless of who's asking or how warm the relationship is.
 *
 * CHANGELOG
 *   v2: tone/mode previously branched only on isModeration + isCreatorPath,
 *   completely ignoring `intent`. That meant QUESTION and HEAVY_TASK got
 *   the same poetic/warm tone directive as BANTER, which could out-compete
 *   the identity core's answer-first rule in the assembled prompt. Fixed
 *   by making intent the primary tone gate; relationship warmth now only
 *   adds a closing-note flavor, never replaces directness.
 *   v3: forbidTraits unconditionally banned 'sass' on every turn, which
 *   silently fought identityCore's RULE 1 (feminine sass during
 *   HOSTILITY/DEFENSE) and the creator's "troll them mercilessly and
 *   sassily" allowance. Removed 'sass' from the global ban — nothing here
 *   currently gates it per-intent, so a blanket ban always wins.
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
  if (isModeration) return ['calm, firm, protective'];

  // Informational intents get a direct/precise tone as the PRIMARY
  // descriptor, regardless of relationship. Relationship warmth is added
  // as a secondary flavor note only — it can color the closing line, it
  // can't replace directness.
  if (INFORMATIONAL_INTENTS.has(intent)) {
    return isCreatorPath
      ? ['direct', 'precise', 'answer first, warm closing note only']
      : ['direct', 'precise', 'clear'];
  }

  return isCreatorPath
    ? ['loving', 'a little shy', 'nurturing']
    : ['kind', 'warm', 'professional'];
}

function decide({ userId, emotionalState, intent, relationship, userMessageLength, isModeration }) {
  const isCreatorPath = userId === CREATOR_ID;
  const isInformational = INFORMATIONAL_INTENTS.has(intent);

  return {
    targetLength: decideLength(intent, userMessageLength),
    tone: decideTone(intent, isModeration, isCreatorPath),
    emojiBudget: decideEmojiBudget(emotionalState, isCreatorPath && !isModeration, isInformational),
    mode: decideMode(intent, isModeration),
    preferReact: !isCreatorPath && (intent === INTENTS.BANTER || intent === INTENTS.SOCIAL),
    askFollowUp: intent === INTENTS.EMOTIONAL_DISCLOSURE || emotionalState.curiosity > 55,
    forbidTraits: isModeration
      ? ['ego', 'robotic/architectural language', 'mentions of programming or logic', 'sass']
      : ['ego', 'robotic/architectural language', 'mentions of programming or logic'],
  };
}

module.exports = { decide };
