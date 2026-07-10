/**
 * emotion/emotionEngine.js
 */

const db = require('../database/supabaseClient');
const { INTENTS } = require('../classifier/intentClassifier');
const { TIERS } = require('../relationship/relationshipEngine');

const HALF_LIFE_MINUTES = {
  warmth: 45,
  playfulness: 12,
  energy: 20,
  patience: 60,
  stress: 20,
  humor: 15,
  socialComfort: 30,
  annoyance: 10,
  curiosity: 15,
  jealousy: 180,
  discipline: 999999,
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

function computeBaseline(relationship) {
  const { tier, trust = 30, affection = 15, protectiveness = 20 } = relationship;
  const isCreator = tier === TIERS.CREATOR;

  const base = {
    warmth: clamp(isCreator ? 55 + affection * 0.4 : 30 + affection * 0.4),
    playfulness: clamp(15 + trust * 0.3),
    energy: 50,
    patience: clamp(55 + trust * 0.3),
    stress: 10,
    humor: clamp(20 + trust * 0.2),
    socialComfort: clamp(35 + trust * 0.4),
    annoyance: 0,
    curiosity: 35,
    jealousy: isCreator ? 8 : 0,
    discipline: 90,
    professionalism: tier === TIERS.TROUBLEMAKER ? 70 : 50,
  };
  if (tier === TIERS.TROUBLEMAKER) base.warmth = 15;
  return base;
}

function computeTarget({ intent, relationship, isModeration }) {
  const baseline = computeBaseline(relationship);
  const target = { ...baseline };
  const isCreator = relationship.tier === TIERS.CREATOR;

  if (isModeration || intent === INTENTS.MODERATION) {
    Object.assign(target, {
      warmth: 15, professionalism: 90, patience: 30, annoyance: 20, discipline: 95,
    });
  } else if (intent === INTENTS.COMMAND || intent === INTENTS.HEAVY_TASK) {
    Object.assign(target, { professionalism: Math.max(target.professionalism, 75), energy: 60 });
  } else if (intent === INTENTS.EMOTIONAL_DISCLOSURE) {
    Object.assign(target, { warmth: Math.max(target.warmth, isCreator ? 90 : 75), patience: 90, energy: 40, professionalism: 20 });
  } else if (intent === INTENTS.BANTER) {
    Object.assign(target, { playfulness: Math.max(target.playfulness, isCreator ? 65 : 40), humor: 50, energy: 55 });
  }

  if (isCreator) target.jealousy = Math.min(60, target.jealousy + 5);

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

function toBrief(state, relationship) {
  const isCreator = relationship.tier === TIERS.CREATOR;
  const notes = [];

  if (isCreator) {
    if (state.warmth > 70) notes.push("you feel completely at ease and happy with him — let that show softly");
    else notes.push("you feel a quiet warmth toward him even if today has been low-key");
    if (state.playfulness > 55) notes.push("a shy, teasing affection is close to the surface");
    if (state.jealousy > 20) notes.push("there's a small, tender protectiveness over him — it shows as care, never as insecurity or control");
  } else {
    if (state.warmth > 60) notes.push("you feel genuinely friendly and at ease with them");
    else if (state.warmth < 20) notes.push("you're a bit more reserved with them, though still kind");
    else notes.push("your warmth is easygoing, neither distant nor overly familiar");
  }

  if (state.stress > 40) notes.push("there's some leftover tension today — let it soften your energy, not your kindness");
  if (state.annoyance > 40) notes.push("something is mildly grating, but you let it pass with patience rather than an edge");
  if (state.professionalism > 75) notes.push("you're focused and a little more businesslike right now");

  return notes.join('. ') + '.';
}

module.exports = { updateState, computeBaseline, toBrief, DIMENSIONS };