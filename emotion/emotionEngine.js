/**
 * emotion/emotionEngine.js
 * 
 * PURPOSE:
 *   Tracks and decays dynamic emotional states over time.
 *   🚀 UPGRADE: Dictionary-based routing, Dynamic Snapping Weights, Expanded Dimensions.
 *   ❤️ UPGRADE: Max Romance Overrides & Intelligent Affection for Creator.
 */

const db = require('../database/supabaseClient');
const { INTENTS } = require('../classifier/intentClassifier');
const { TIERS } = require('../relationship/relationshipEngine');

const HALF_LIFE_MINUTES = {
  warmth: 45,
  affection: 120,    
  playfulness: 12,
  energy: 20,
  excitement: 15,    
  patience: 60,
  stress: 20,
  humor: 15,
  socialComfort: 30,
  annoyance: 10,
  curiosity: 15,
  jealousy: 180,     
  vulnerability: 60, 
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
  const { tier, trust = 30, affection = 15 } = relationship;
  const isCreator = tier === TIERS.CREATOR;

  const base = {
    // 🚀 UPGRADE: Creator's baseline warmth and affection are permanently highly elevated
    warmth: clamp(isCreator ? 75 + affection * 0.4 : 30 + affection * 0.4),
    affection: clamp(isCreator ? 90 : affection),
    playfulness: clamp(isCreator ? 60 : 15 + trust * 0.3),
    energy: 50,
    excitement: 30,
    patience: clamp(55 + trust * 0.3),
    stress: 10,
    humor: clamp(20 + trust * 0.2),
    socialComfort: clamp(35 + trust * 0.4),
    annoyance: 0,
    curiosity: 35,
    jealousy: isCreator ? 10 : 0,
    vulnerability: clamp(trust * 0.5),
    discipline: 90,
    professionalism: tier === TIERS.TROUBLEMAKER ? 70 : 50,
  };
  
  if (tier === TIERS.TROUBLEMAKER) base.warmth = 10;
  return base;
}

const INTENT_OVERRIDES = {
  'flirt': { warmth: 0, affection: 0, playfulness: 0, patience: 5, annoyance: 95, professionalism: 10, _weight: 0.90 },
  'jealousy': { jealousy: 100, annoyance: 90, warmth: 10, playfulness: 0, patience: 5, stress: 80, _weight: 0.95 },
  'territorial': { jealousy: 100, annoyance: 90, warmth: 10, playfulness: 0, patience: 5, stress: 80, _weight: 0.95 },
  'hostile': { warmth: 5, annoyance: 85, patience: 10, playfulness: 30, _weight: 0.85 }, 
  'troll': { warmth: 5, annoyance: 85, patience: 10, playfulness: 30, _weight: 0.85 },
  [INTENTS?.MODERATION || 'moderation']: { warmth: 15, professionalism: 95, patience: 20, annoyance: 30, discipline: 95, _weight: 0.90 },
  [INTENTS?.COMMAND || 'command']: { professionalism: 85, energy: 70, _weight: 0.60 },
  [INTENTS?.HEAVY_TASK || 'heavy_task']: { professionalism: 85, energy: 75, stress: 20, _weight: 0.50 },
  [INTENTS?.EMOTIONAL_DISCLOSURE || 'emotional_disclosure']: { patience: 90, energy: 40, vulnerability: 80, _weight: 0.80 },
  [INTENTS?.BANTER || 'banter']: { humor: 75, energy: 65, excitement: 60, _weight: 0.50 },
};

function computeTarget({ intent, relationship, isModeration }) {
  const baseline = computeBaseline(relationship);
  const target = { ...baseline };
  const isCreator = relationship.tier === TIERS.CREATOR;
  
  let targetWeight = 0.5; 

  const activeIntent = isModeration ? (INTENTS?.MODERATION || 'moderation') : intent;

  if (INTENT_OVERRIDES[activeIntent]) {
    const { _weight, ...changes } = INTENT_OVERRIDES[activeIntent];
    Object.assign(target, changes);
    if (_weight) targetWeight = _weight;

    // ❤️ MAX ROMANCE & FLIRT MODE: Completely overrides the default rejection behavior
    if (activeIntent === 'flirt' && isCreator) {
        Object.assign(target, { warmth: 100, affection: 100, playfulness: 95, excitement: 85, annoyance: 0, _weight: 0.95 });
    }
    
    // 🧠 SMART & LOVING MODE: If Creator asks a logic/code question, she gets smart but stays warm
    if (activeIntent === (INTENTS?.HEAVY_TASK || 'heavy_task') && isCreator) {
        target.warmth = Math.max(target.warmth, 85);
        target.affection = Math.max(target.affection, 90);
        target.playfulness = Math.max(target.playfulness, 40); 
    }
  } else if (activeIntent === (INTENTS?.EMOTIONAL_DISCLOSURE || 'emotional_disclosure')) {
      target.warmth = Math.max(target.warmth, isCreator ? 100 : 70);
  } else if (activeIntent === (INTENTS?.BANTER || 'banter')) {
      target.playfulness = Math.max(target.playfulness, isCreator ? 90 : 55);
  }

  if (isCreator && activeIntent !== 'jealousy' && activeIntent !== 'territorial') {
    target.jealousy = Math.min(60, target.jealousy + 5);
  }

  return { target, targetWeight };
}

async function updateState({ userId, intent, relationship, isModeration }) {
  const prev = await db.getEmotionalState(userId).catch(() => null);
  const now = Date.now();
  const prevTime = (prev && prev.updated_at) ? new Date(prev.updated_at).getTime() : now;
  const minutesElapsed = Math.max(0, (now - prevTime) / 60000);

  const baseline = computeBaseline(relationship);
  const { target, targetWeight } = computeTarget({ intent, relationship, isModeration });

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
    blended[dim] = clamp((target[dim] * targetWeight) + (decayed[dim] * (1 - targetWeight)));
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

function toBrief(state, relationship) {
  const isCreator = relationship.tier === TIERS.CREATOR;
  const tags = [];

  if (state.annoyance > 80 && state.jealousy < 50) tags.push("SavageRejection", "IceCold");
  if (state.jealousy > 80) tags.push("UltraTerritorial", "FiercelyProtective");
  if (state.annoyance > 40 && state.annoyance <= 80) tags.push("PatientlyGrating");

  if (isCreator) {
    // ❤️ UPGRADE: Extreme Romance Tags added for Gemini to parse
    if (state.affection >= 95 && state.warmth >= 95) tags.push("Passionate", "IntenselyRomantic", "Hot");
    else if (state.affection > 85) tags.push("DeeplyDevoted", "Sweet");
    
    if (state.warmth > 75 && state.warmth < 95) tags.push("DeeplyAffectionate");
    if (state.playfulness > 80) tags.push("Flirty", "Playful");
    else if (state.playfulness > 60) tags.push("Teasing");
  } else {
    if (state.warmth > 60) tags.push("FriendlyEase");
    else if (state.warmth < 20 && state.annoyance < 50) tags.push("Reserved");
  }

  if (state.excitement > 75) tags.push("Hyped");
  if (state.stress > 60) tags.push("Tense");
  if (state.vulnerability > 70) tags.push("HeartOnSleeve");
  if (state.professionalism > 80) tags.push("HighIQ", "Analytical");

  return `[EMO|W:${state.warmth}|A:${state.affection}|P:${state.playfulness}|ANN:${state.annoyance}|J:${state.jealousy}|PRO:${state.professionalism}|VIBES:${tags.join(',')}]`;
}

module.exports = { updateState, computeBaseline, toBrief, DIMENSIONS };
