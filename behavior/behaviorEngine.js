/**
 * behavior/behaviorEngine.js
 *
 * PURPOSE
 *   The critical firewall between emotion and text. Emotion NEVER generates
 *   text directly — it only sets numeric dials here, which behaviorEngine
 *   turns into concrete, explicit generation directives (length, tone
 *   words, emoji budget, question-asking, react-vs-answer). This is what
 *   keeps "being angry" from silently degrading reasoning quality, and what
 *   keeps affection from silently degrading professionalism: they're
 *   different output channels entirely.
 *
 * RESPONSIBILITIES
 *   - Map emotional state + intent + relationship -> a BehaviorDirective.
 *   - Never touch factual/reasoning content — only shape and tone.
 *
 * INPUTS
 *   { emotionalState, intent, relationship, userMessageLength }
 *
 * OUTPUTS
 *   BehaviorDirective: {
 *     targetLength: 'short'|'medium'|'long',
 *     tone: string[],            // e.g. ['warm', 'slightly teasing']
 *     emojiBudget: number,       // max emojis, enforced later in postProcessor
 *     mode: 'conversational'|'professional'|'moderation',
 *     preferReact: boolean,      // react/tease vs. directly answer
 *     askFollowUp: boolean,
 *   }
 *
 * TRADEOFFS
 *   Keeping this deterministic (no LLM call) means shape decisions are
 *   instant and consistent turn to turn. The LLM still has full creative
 *   freedom in *how* it fulfills the directive — this only sets guardrails.
 */

const { INTENTS } = require('../classifier/intentClassifier');

function decideLength(intent, userMessageLength) {
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND) return 'long';
  if (userMessageLength < 40) return 'short';
  if (userMessageLength < 150) return 'medium';
  return 'long';
}

function decideTone(emotionalState, intent) {
  const tone = [];
  if (emotionalState.warmth > 65) tone.push('warm');
  if (emotionalState.playfulness > 55) tone.push('playfully teasing');
  if (emotionalState.professionalism > 80) tone.push('focused and precise');
  if (emotionalState.annoyance > 40) tone.push('clipped, coldly composed');
  if (emotionalState.jealousy > 30) tone.push('subtly possessive, never insecure');
  if (intent === INTENTS.EMOTIONAL_DISCLOSURE) tone.push('gentle, fully present');
  if (tone.length === 0) tone.push('calm, naturally confident');
  return tone;
}

function decideEmojiBudget(emotionalState) {
  if (emotionalState.professionalism > 85) return 0;
  if (emotionalState.playfulness > 60) return 2;
  if (emotionalState.warmth > 50) return 1;
  return 0;
}

function decideMode(intent, isModeration) {
  if (isModeration) return 'moderation';
  if (intent === INTENTS.HEAVY_TASK || intent === INTENTS.COMMAND) return 'professional';
  return 'conversational';
}

function decide({ emotionalState, intent, relationship, userMessageLength, isModeration }) {
  return {
    targetLength: decideLength(intent, userMessageLength),
    tone: decideTone(emotionalState, intent),
    emojiBudget: decideEmojiBudget(emotionalState),
    mode: decideMode(intent, isModeration),
    preferReact: intent === INTENTS.BANTER || intent === INTENTS.SOCIAL,
    askFollowUp: intent === INTENTS.EMOTIONAL_DISCLOSURE || emotionalState.curiosity > 55,
  };
}

module.exports = { decide };
