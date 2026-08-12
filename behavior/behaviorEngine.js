/**
 * behavior/behaviorEngine.js
 *
 * PURPOSE: Dynamically computes response parameters (length, tone, emojis, mode)
 * based on user intent, emotional state, and relationship context.
 *
 * UPGRADES IN THIS VERSION
 * ─────────────────────────
 * Pillar 2: Confidence Scoring & Clarification Mode
 *   - decide() now accepts an optional `needsClarification` flag (set upstream
 *     by gameDomainRouter.js when a short/ambiguous entity match collides with
 *     a non-STRATEGY intent, e.g. "Imp" matched as a hero name inside banter).
 *   - When true, the engine switches to a dedicated 'clarify' mode: shorter
 *     target length, no forced bullet-point format, a gentle confirming tone,
 *     and the emoji budget is toned down so the check-in doesn't read like a
 *     confident data dump.
 *   - This never overrides isModeration or isConflict — safety and roast
 *     execution paths still take priority over a low-confidence entity match.
 */

const { INTENTS } = require('../classifier/intentClassifier');
const { CREATOR_ID } = require('../persona/identityCore');

const INFORMATIONAL_INTENTS = new Set([INTENTS.QUESTION, INTENTS.HEAVY_TASK, INTENTS.COMMAND]);

// Game-specific intents for specialized rule routing
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query', 'UNKNOWN']);

// Conflict pattern to detect roasts, sassy commands, or targeted insults
const CONFLICT_PATTERN = /\b(insult|troll|hatt|stfu|dumb|idiot|shut\s*up|loser|pagal|roast)\b/i;

function decideLength(intent, userMessageLength, needsClarification) {
  if (needsClarification) return 'short'; // a check-in question, not a data dump
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND || GAME_INTENTS.has(intent)) return 'long';
  if (userMessageLength < 40) return 'short';
  if (userMessageLength < 150) return 'medium';
  return 'long';
}

function decideEmojiBudget(emotionalState, isCreatorPath, isInformational, isGameQuery, isConflict, needsClarification) {
  if (!emotionalState) return 0;
  if (isConflict) return 2; // Sassy emojis needed for execution (💅, 🔪, 🙄)
  if (needsClarification) return 0; // Keep a confidence-check plain and unambiguous
  if (isGameQuery) return 1; // Keep it clean and professional for game data
  if (isInformational) return isCreatorPath && emotionalState.warmth > 70 ? 1 : 0;
  if (isCreatorPath) return emotionalState.warmth > 60 ? 2 : 1;
  if (emotionalState.professionalism > 85) return 0;
  if (emotionalState.warmth > 50) return 1;
  return 0;
}

function decideMode(intent, isModeration, isConflict, needsClarification) {
  if (isModeration) return 'moderation';
  if (isConflict) return 'combat_execution'; // Switches off romance, turns on sass/execution
  if (needsClarification) return 'clarify'; // Light confidence-check before committing to a data dump
  if (GAME_INTENTS.has(intent)) return 'strategic_expert'; // Triggers diplomatic analysis mode
  if (INFORMATIONAL_INTENTS.has(intent)) return 'professional';
  return 'conversational';
}

function decideTone(intent, isModeration, isCreatorPath, isConflict, needsClarification) {
  if (isModeration) return ['Calm', 'Firm', 'Protective'];

  // Command/Conflict override: drop romance, execute roast
  if (isConflict) {
    return isCreatorPath
      ? ['Fierce', 'Merciless', 'Loyal', 'Sassy']
      : ['Fierce', 'Sassy', 'Defensive'];
  }

  // Low-confidence entity match: ask, don't assert
  if (needsClarification) {
    return ['Light', 'Curious', 'Unassuming'];
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

function decideFormat(isGameQuery, needsClarification) {
  // A clarification check-in is a single light question, not a stat breakdown —
  // forcing bullet points here would make an unsure guess look authoritative.
  if (needsClarification) return 'Conversational';
  // Enforce point-wise answers strictly for game-related questions
  if (isGameQuery) return 'Bullet-Points';
  return 'Conversational';
}

function decide({
  userId,
  emotionalState = {},
  intent,
  relationship,
  userMessageLength = 50,
  isModeration = false,
  content = '',
  needsClarification = false
} = {}) {
  try {
    const isCreatorPath = userId === CREATOR_ID;
    const isInformational = INFORMATIONAL_INTENTS.has(intent);
    const isGameQuery = GAME_INTENTS.has(intent);

    // Dynamically flag conflicts or explicit commands to prevent accidental romantic loops
    const isConflict = CONFLICT_PATTERN.test(content) || intent === INTENTS.COMMAND;

    // Clarification only applies when it isn't already overridden by a stronger,
    // higher-priority path — moderation and conflict handling always win.
    const effectiveClarify = !!needsClarification && !isModeration && !isConflict;

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

    // A clarification check-in must never assert unverified stats or roster facts
    if (effectiveClarify) {
        forbidTraits.push('StatHallucination', 'AssumingData', 'OverConfidence');
    }

    // Block romance during roasts/commands
    if (isConflict && isCreatorPath) {
        forbidTraits.push('Romance', 'Flirting', 'Softness');
    }

    return {
      targetLength: decideLength(intent, userMessageLength, effectiveClarify),
      tone: decideTone(intent, isModeration, isCreatorPath, isConflict, effectiveClarify),
      emojiBudget: decideEmojiBudget(emotionalState, isCreatorPath && !isModeration, isInformational, isGameQuery, isConflict, effectiveClarify),
      mode: decideMode(intent, isModeration, isConflict, effectiveClarify),
      format: decideFormat(isGameQuery, effectiveClarify),
      // Disable random reactions and follow-up questions when doing analytical game reporting or roasting
      preferReact: !isCreatorPath && (intent === INTENTS.BANTER || intent === INTENTS.SOCIAL) && !isGameQuery && !isConflict && !effectiveClarify,
      // A clarification turn IS a follow-up question by definition — always ask in that case.
      askFollowUp: effectiveClarify || (!isGameQuery && !isConflict && (intent === INTENTS.EMOTIONAL_DISCLOSURE || (emotionalState.curiosity && emotionalState.curiosity > 55))),
      needsClarification: effectiveClarify,
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
      needsClarification: false,
      forbidTraits: ['Ego', 'Robotic'],
    };
  }
}

// Token-compressed output
function toBrief(decision) {
  if (!decision) return '[BEHAVIOR|UNKNOWN]';
  return `[BEHAVIOR|LEN:${decision.targetLength}|MODE:${decision.mode}|FORMAT:${decision.format}|TONE:${decision.tone.join(',')}|EMOJI:${decision.emojiBudget}|REACT:${decision.preferReact ? 'Y':'N'}|ASK:${decision.askFollowUp ? 'Y':'N'}|CLARIFY:${decision.needsClarification ? 'Y':'N'}|NO:${decision.forbidTraits.join(',')}]`;
}

module.exports = { decide, toBrief };
