/**
 * emotion/emotionEngine.js
 *
 * PURPOSE
 *   Owns Layer-B state: the 12-dimension "mood right now" — warmth,
 *   playfulness, energy, patience, stress, humor, social comfort, annoyance,
 *   curiosity, jealousy, discipline, professionalism. Time-decays toward a
 *   per-user baseline (derived from Layer-A relationship state), then blends
 *   with a target state computed from intent + relationship, using the same
 *   momentum-blend idea as the original code (60% new / 40% decayed-old).
 *
 * RESPONSIBILITIES
 *   - Compute per-dimension baselines from relationship (Layer A).
 *   - Decay previous state toward baseline based on elapsed real time.
 *   - Compute a target state from current intent + relationship tier.
 *   - Blend decayed-previous and target -> new state, persist it.
 *   - Produce a natural-language "emotional brief" for prompt assembly
 *     (see toBrief) instead of ever handing raw numbers to the model.
 *
 * INPUTS
 *   { userId, intent, relationship: { tier, trust, respect, affection,
 *     protectiveness }, isModeration }
 *
 * OUTPUTS
 *   { warmth, playfulness, energy, patience, stress, humor, socialComfort,
 *     annoyance, curiosity, jealousy, discipline, professionalism }
 *
 * DECAY MODEL
 *   Each dimension has its own half-life. Discipline barely moves at all —
 *   this is the literal mechanism behind "discipline always dominates
 *   emotion": it is structurally hard to move, not just instructed to stay
 *   high.
 *
 * TRADEOFFS
 *   Decay + blend is O(1) and fully deterministic/debuggable, at the cost
 *   of not capturing every psychological nuance an LLM-driven emotion
 *   model might. Given this runs on every message, determinism and low
 *   latency are the right tradeoff here.
 */

const db = require('../database/supabaseClient');
const { INTENTS } = require('../classifier/intentClassifier');
const { TIERS } = require('../relationship/relationshipEngine');

const HALF_LIFE_MINUTES = {
  warmth: 45,
  playfulness: 12,
  energy: 20,
  patience: 60, // recovers slowly once dipped
  stress: 20,
  humor: 15,
  socialComfort: 30,
  annoyance: 10,
  curiosity: 15,
  jealousy: 180, // deliberately slow — keeps it subtle, not spiky
  discipline: 999999, // effectively constant
  professionalism: 25,
};

const DIMENSIONS = Object.keys(HALF_LIFE_MINUTES);

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function decayTowardBaseline(current, baseline, minutesElapsed, halfLife) {
  const decayFactor = Math.pow(0.5, minutesElapsed / halfLife);
  return baseline + (current - baseline) * decayFactor;
}

/** Baseline derived from Layer-A relationship state — this is what makes
 *  a Creator's resting warmth genuinely different from a stranger's,
 *  without hardcoding per-tier response text anywhere. */
function computeBaseline(relationship) {
  const { tier, trust = 30, affection = 15, protectiveness = 20 } = relationship;
  const base = {
    warmth: clamp(20 + affection * 0.5),
    playfulness: clamp(15 + trust * 0.3),
    energy: 50,
    patience: clamp(50 + trust * 0.3),
    stress: 10,
    humor: clamp(20 + trust * 0.2),
    socialComfort: clamp(30 + trust * 0.4),
    annoyance: 0,
    curiosity: 35,
    jealousy: tier === TIERS.CREATOR ? 5 : 0,
    discipline: 95,
    professionalism: tier === TIERS.TROUBLEMAKER ? 90 : 55,
  };
  if (tier === TIERS.TROUBLEMAKER) {
    base.warmth = 5;
    base.protectiveness_note = 'low warmth ceiling';
  }
  return base;
}

/** Target state for *this* message, before blending with decayed history. */
function computeTarget({ intent, relationship, isModeration }) {
  const baseline = computeBaseline(relationship);
  const target = { ...baseline };

  if (isModeration || intent === INTENTS.MODERATION) {
    Object.assign(target, {
      warmth: 5, professionalism: 100, patience: 20, annoyance: 40,
      protectiveness: 80, discipline: 98,
    });
  } else if (intent === INTENTS.COMMAND || intent === INTENTS.HEAVY_TASK) {
    Object.assign(target, { professionalism: Math.max(target.professionalism, 85), playfulness: 10, energy: 60 });
  } else if (intent === INTENTS.EMOTIONAL_DISCLOSURE) {
    Object.assign(target, { warmth: Math.max(target.warmth, 75), patience: 90, energy: 40, professionalism: 30 });
  } else if (intent === INTENTS.BANTER) {
    Object.assign(target, { playfulness: Math.max(target.playfulness, 55), humor: 50, energy: 55 });
  }

  if (relationship.tier === TIERS.CREATOR) {
    target.jealousy = Math.min(100, target.jealousy + 5);
  }

  return target;
}

async function updateState({ userId, intent, relationship, isModeration }) {
  const prev = await db.getEmotionalState(userId);
  const now = Date.now();
  const prevTime = prev ? new Date(prev.updated_at).getTime() : now;
  const minutesElapsed = Math.max(0, (now - prevTime) / 60000);

  const baseline = computeBaseline(relationship);
  const target = computeTarget({ intent, relationship, isModeration });

  const decayed = {};
  for (const dim of DIMENSIONS) {
    const prevVal = prev ? Number(prev[camelToSnake(dim)] ?? prev[dim] ?? baseline[dim]) : baseline[dim];
    decayed[dim] = decayTowardBaseline(prevVal, baseline[dim], minutesElapsed, HALF_LIFE_MINUTES[dim]);
  }

  const blended = {};
  for (const dim of DIMENSIONS) {
    if (dim === 'discipline') {
      blended[dim] = clamp(Math.round((decayed[dim] * 0.9) + (target[dim] * 0.1)), 85, 100);
      continue;
    }
    blended[dim] = clamp(Math.round((target[dim] * 0.6) + (decayed[dim] * 0.4)));
  }

  await db.upsertEmotionalState(userId, snakeCaseAll(blended));
  return blended;
}

function camelToSnake(s) {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase();
}
function snakeCaseAll(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[camelToSnake(k)] = v;
  return out;
}

/**
 * Converts numeric state into a compact natural-language brief — this is
 * what actually gets sent to Gemini, never the raw numbers. See
 * promptBuilder for how this slots into the assembled prompt.
 */
function toBrief(state, relationship) {
  const notes = [];
  if (state.warmth > 70) notes.push('you feel warm and at ease with them');
  else if (state.warmth < 20) notes.push('you feel guarded, giving little warmth');
  else notes.push('your warmth is moderate, neither cold nor especially open');

  if (state.playfulness > 55) notes.push('a playful, teasing energy is close to the surface');
  if (state.stress > 40) notes.push("you're carrying some leftover tension — let it clip your patience, not your warmth");
  if (state.annoyance > 40) notes.push("there's real annoyance here, held with composure, not outbursts");
  if (state.jealousy > 30 && relationship.tier === TIERS.CREATOR) notes.push('a quiet, subtle possessiveness is present — never voiced as insecurity, just a slight edge');
  if (state.professionalism > 80) notes.push("you're in a focused, task-first mode right now");
  if (state.discipline < 90) notes.push('you are, even now, holding yourself with composure');

  return notes.join('. ') + '.';
}

module.exports = { updateState, computeBaseline, toBrief, DIMENSIONS };
