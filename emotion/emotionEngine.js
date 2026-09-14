/**
 * emotion/emotionEngine.js
 * 
 * PURPOSE:
 *   Tracks and decays dynamic emotional states over time.
 *   🚀 UPGRADE: Savage/Territorial emotional spikes and aggressive token tags.
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
  jealousy: 180, // Jealousy takes a long time to cool down
  discipline: 999999,
  professionalism: 25,
};

const DIMENSIONS = Object.keys(HALF_LIFE_MINUTES);

function clamp(n, min = 0, max = 100) {
  return Math.round(Math.max(min, Math.min(max, n)));
}

function decayTowardBaseline(current, baseline, minutesElapsed, halfLife) {
  const decayFactor = Math.pow(0.5, minutesElapsed / halfLife);
  return baseline + (current - baseline) * decayFactor;
}

function computeBaseline(relationship) {
  const { tier, trust = 30, affection = 15, protectiveness = 20 } = relationship;
  const isCreator = tier === TIERS.CREATOR;

  const base = {
    warmth: clamp(isCreator ? 65 + affection * 0.4 : 30 + affection * 0.4),
    playfulness: clamp(15 + trust * 0.3),
    energy: 50,
    patience: clamp(55 + trust * 0.3),
    stress: 10,
    humor: clamp(20 + trust * 0.2),
    socialComfort: clamp(35 + trust * 0.4),
    annoyance: 0,
    curiosity: 35,
    jealousy: isCreator ? 10 : 0,
    discipline: 90,
    professionalism: tier === TIERS.TROUBLEMAKER ? 70 : 50,
  };
  
  if (tier === TIERS.TROUBLEMAKER) base.warmth = 10;
  return base;
}

function computeTarget({ intent, relationship, isModeration }) {
  const baseline = computeBaseline(relationship);
  const target = { ...baseline };
  const isCreator = relationship.tier === TIERS.CREATOR;

  // 🚀 CRITICAL OVERRIDES: Savage & Territorial Spikes
  if (intent === 'flirt' && !isCreator) {
    Object.assign(target, { warmth: 0, playfulness: 0, patience: 5, annoyance: 95, professionalism: 10 });
  } else if (intent === 'jealousy' || intent === 'territorial') {
    Object.assign(target, { jealousy: 100, annoyance: 90, warmth: 10, playfulness: 0, patience: 5 });
  } else if (intent === 'hostile' || intent === 'troll') {
    Object.assign(target, { warmth: 5, annoyance: 85, patience: 10, playfulness: 30 }); // 30 playfulness for sarcastic roasting
  } else if (isModeration || intent === INTENTS.MODERATION) {
    Object.assign(target, { warmth: 15, professionalism: 95, patience: 20, annoyance: 30, discipline: 95 });
  } else if (intent === INTENTS.COMMAND || intent === INTENTS.HEAVY_TASK) {
    Object.assign(target, { professionalism: Math.max(target.professionalism, 80), energy: 65 });
  } else if (intent === INTENTS.EMOTIONAL_DISCLOSURE) {
    Object.assign(target, { warmth: Math.max(target.warmth, isCreator ? 95 : 70), patience: 90, energy: 40 });
  } else if (intent === INTENTS.BANTER) {
    Object.assign(target, { playfulness: Math.max(target.playfulness, isCreator ? 75 : 50), humor: 60, energy: 60 });
  }

  // Natural steady jealousy buildup for Creator
  if (isCreator && intent !== 'jealousy') {
    target.jealousy = Math.min(60, target.jealousy + 5);
  }

  return target;
}

async function updateState({ userId, intent, relationship, isModeration }) {
  const prev = await db.getEmotionalState(userId).catch(() => null);
  const now = Date.now();
  const prevTime = (prev && prev.updated_at) ? new Date(prev.updated_at).getTime() : now;
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
      blended[dim] = clamp((decayed[dim] * 0.9) + (target[dim] * 0.1), 85, 100);
      continue;
    }
    // Faster adaptation to sudden targets (60% weight to target)
    blended[dim] = clamp((target[dim] * 0.6) + (decayed[dim] * 0.4));
  }

  try {
    await db.upsertEmotionalState(userId, snakeCaseAll(blended));
  } catch (err) {
    console.warn('⚠️ Could not save emotional state to DB:', err.message);
  }
  
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

// ⚡ TOKEN-COMPRESSED OUTPUT
function toBrief(state, relationship) {
  const isCreator = relationship.tier === TIERS.CREATOR;
  const tags = [];

  // 🚀 AGGRESSIVE TAGS (Triggers identityCore overrides)
  if (state.annoyance > 80 && state.jealousy < 50) tags.push("SavageRejection", "IceCold");
  if (state.jealousy > 80) tags.push("UltraTerritorial", "FiercelyProtective");

  if (isCreator) {
    if (state.warmth > 75) tags.push("DeeplyAffectionate");
    else tags.push("QuietWarmth");
    
    if (state.playfulness > 60) tags.push("Teasing");
  } else {
    if (state.warmth > 60) tags.push("FriendlyEase");
    else if (state.warmth < 20 && state.annoyance < 50) tags.push("Reserved");
  }

  if (state.stress > 50) tags.push("Tense");
  if (state.annoyance > 40 && state.annoyance <= 80) tags.push("PatientlyGrating");
  if (state.professionalism > 80) tags.push("StrictAdminFocus");

  return `[EMO|W:${state.warmth}|P:${state.playfulness}|A:${state.annoyance}|J:${state.jealousy}|PRO:${state.professionalism}|VIBES:${tags.join(',')}]`;
}

module.exports = { updateState, computeBaseline, toBrief, DIMENSIONS };
