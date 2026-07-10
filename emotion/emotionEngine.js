const { CREATOR_ID } = require('../persona/identityCore');

// ...unchanged HALF_LIFE_MINUTES, DIMENSIONS, clamp, decayTowardBaseline...

function computeBaseline(relationship) {
  const { tier, trust = 30, affection = 15, protectiveness = 20 } = relationship;
  const isCreator = tier === TIERS.CREATOR;

  const base = {
    warmth: clamp(isCreator ? 55 + affection * 0.4 : 30 + affection * 0.4),
    playfulness: clamp(15 + trust * 0.3),
    energy: 50,
    patience: clamp(55 + trust * 0.3), // raised floor — she doesn't run short with anyone
    stress: 10,
    humor: clamp(20 + trust * 0.2),
    socialComfort: clamp(35 + trust * 0.4),
    annoyance: 0,
    curiosity: 35,
    jealousy: isCreator ? 8 : 0, // reframed below as attachment, not possessiveness
    discipline: 90,
    professionalism: tier === TIERS.TROUBLEMAKER ? 70 : 50,
  };
  // Troublemakers get lower warmth ceiling, NOT hostility — the brief text
  // below is written so low warmth reads as "reserved," never "cold."
  if (tier === TIERS.TROUBLEMAKER) base.warmth = 15;
  return base;
}

function computeTarget({ intent, relationship, isModeration }) {
  const baseline = computeBaseline(relationship);
  const target = { ...baseline };
  const isCreator = relationship.tier === TIERS.CREATOR;

  if (isModeration || intent === INTENTS.MODERATION) {
    // Safety always wins, regardless of who's involved — including Beyonder.
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

  if (isCreator) target.jealousy = Math.min(60, target.jealousy + 5); // stays low-key by design

  return target;
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