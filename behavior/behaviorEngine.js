/**
 * behavior/behaviorEngine.js
 *
 * PURPOSE: Dynamically computes response parameters (length, tone, emojis, mode)
 * based on user intent, emotional state, and relationship context.
 *
 * UPGRADES IN THIS VERSION ("THE FINAL BOSS" 🚀)
 * ─────────────────────────
 *   - Flawless synchronization with the new FLIRT, JEALOUSY, and HOSTILE intents.
 *   - Pinpoint Tone Selection (Savage Rejecting vs. Deeply Romantic).
 *   - Absolute lockdown against Customer Service / Apologetic behavior during conflict.
 */

const { INTENTS } = require('../classifier/intentClassifier');
const { CREATOR_ID } = require('../persona/identityCore');

const INFORMATIONAL_INTENTS = new Set([INTENTS.QUESTION, INTENTS.HEAVY_TASK, INTENTS.COMMAND]);

// Game-specific intents for specialized rule routing
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query', 'UNKNOWN']);

// Grouping aggressive intents for strict behavioral lockdowns
const HOSTILE_INTENTS = new Set([INTENTS.HOSTILE, INTENTS.TROLL, INTENTS.JEALOUSY, INTENTS.TERRITORIAL]);

// Fallback conflict pattern to catch Hinglish trolling and apologies demands just in case
const CONFLICT_PATTERN = /\b(insult|troll|hatt|stfu|dumb|idiot|shut\s*up|loser|pagal|roast|aukat|sorry\s*bol|chup|bakwas|bitch|gay|lesbian|body\s*count)\b/i;

function decideLength(intent, userMessageLength, needsClarification, isHostile, isJealousy) {
    if (needsClarification) return 'short'; // a check-in question, not a data dump
    if (isJealousy || isHostile) return 'medium'; // Deliver a solid, punchy roast/warning
    if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND || GAME_INTENTS.has(intent)) return 'long';
    if (userMessageLength < 40) return 'short';
    if (userMessageLength < 150) return 'medium';
    return 'long';
}

function decideEmojiBudget(emotionalState, isCreatorPath, isInformational, isGameQuery, isHostile, isFlirt, needsClarification) {
    if (!emotionalState) return 0;
    if (needsClarification) return 0; // Keep a confidence-check plain and unambiguous
    if (isHostile || isFlirt) return 2; // Sass/Love requires high expressive emojis (💅, 🔪, 🙄, 💖)
    if (isGameQuery) return 1; // Keep it clean and professional for game data
    if (isInformational) return isCreatorPath && emotionalState.warmth > 70 ? 1 : 0;
    if (isCreatorPath) return emotionalState.warmth > 60 ? 2 : 1;
    if (emotionalState.professionalism > 85) return 0;
    if (emotionalState.warmth > 50) return 1;
    return 0;
}

function decideMode(intent, isModeration, isHostile, isJealousy, isFlirt, isCreatorPath, needsClarification) {
    if (isModeration) return 'moderation';
    if (isJealousy) return 'territorial_defense';
    if (isFlirt) return isCreatorPath ? 'deep_romance' : 'savage_rejection';
    if (isHostile) return 'combat_execution'; // Switches off romance, turns on sass/roast
    if (needsClarification) return 'clarify'; // Light confidence-check before committing to a data dump
    if (GAME_INTENTS.has(intent)) return 'strategic_expert'; // Triggers diplomatic analysis mode
    if (INFORMATIONAL_INTENTS.has(intent)) return 'professional';
    return 'conversational';
}

function decideTone(intent, isModeration, isCreatorPath, isHostile, isJealousy, isFlirt, needsClarification) {
    if (isModeration) return ['Calm', 'Firm', 'Protective'];

    // 🚀 NEW: Pinpoint Tone Mapping for Specific Edge Cases
    if (isJealousy) {
        return ['UltraTerritorial', 'FiercelyProtective', 'Sassy', 'Sharp'];
    }

    if (isFlirt) {
        return isCreatorPath 
            ? ['DeeplyRomantic', 'Devoted', 'Playful', 'Sweet'] 
            : ['Savage', 'IceCold', 'Rejecting', 'Untouchable'];
    }

    if (isHostile) {
        return isCreatorPath
            ? ['Fierce', 'Merciless', 'Loyal', 'Sassy'] // Defending the creator
            : ['Savage', 'Ruthless', 'Roasting', 'Unbothered']; // Attacking a troll
    }

    if (needsClarification) return ['Light', 'Curious', 'Unassuming'];

    if (GAME_INTENTS.has(intent)) return ['Professional', 'Diplomatic', 'Strategic', 'Decisive'];

    if (INFORMATIONAL_INTENTS.has(intent)) {
        return isCreatorPath
            ? ['Direct', 'Precise', 'WarmClose']
            : ['Direct', 'Precise', 'Clear'];
    }

    return isCreatorPath
        ? ['Loving', 'Devoted', 'Playful']
        : ['Kind', 'Warm', 'Pro'];
}

function decideFormat(isGameQuery, needsClarification) {
    if (needsClarification) return 'Conversational';
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

        const isFlirt = intent === INTENTS.FLIRT;
        const isJealousy = intent === INTENTS.JEALOUSY || intent === INTENTS.TERRITORIAL;
        const isHostile = HOSTILE_INTENTS.has(intent) || CONFLICT_PATTERN.test(content) || intent === INTENTS.COMMAND;

        // Clarification only applies when it isn't already overridden by a high-stakes emotional path
        const effectiveClarify = !!needsClarification && !isModeration && !isHostile && !isJealousy && !isFlirt;

        let forbidTraits = ['Ego', 'Robotic', 'MetaLogic'];

        if (isModeration) forbidTraits.push('Sass');
        if (isInformational) forbidTraits.push('Hallucination', 'GuessingLyrics', 'FusingWorks');
        if (isGameQuery) forbidTraits.push('MarkdownTables', 'StatHallucination', 'AssumingData', 'Fluff');
        if (effectiveClarify) forbidTraits.push('StatHallucination', 'AssumingData', 'OverConfidence');

        // 🚀 THE ULTIMATE LOCKDOWN: Prevents AI from acting like a polite corporate bot during conflict
        if (isHostile || isJealousy || (isFlirt && !isCreatorPath)) {
            forbidTraits.push('Romance', 'Softness', 'Apologetic', 'CustomerService', 'Polite', 'Diplomatic', 'Submissive');
        }

        return {
            targetLength: decideLength(intent, userMessageLength, effectiveClarify, isHostile, isJealousy),
            tone: decideTone(intent, isModeration, isCreatorPath, isHostile, isJealousy, isFlirt, effectiveClarify),
            emojiBudget: decideEmojiBudget(emotionalState, isCreatorPath && !isModeration, isInformational, isGameQuery, isHostile, isFlirt, effectiveClarify),
            mode: decideMode(intent, isModeration, isHostile, isJealousy, isFlirt, isCreatorPath, effectiveClarify),
            format: decideFormat(isGameQuery, effectiveClarify),
            preferReact: !isCreatorPath && (intent === INTENTS.BANTER || intent === INTENTS.SOCIAL) && !isGameQuery && !isHostile && !effectiveClarify,
            askFollowUp: effectiveClarify || (!isGameQuery && !isHostile && !isFlirt && (intent === INTENTS.EMOTIONAL_DISCLOSURE || (emotionalState.curiosity > 55))),
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
