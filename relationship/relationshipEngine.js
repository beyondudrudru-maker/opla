/**
 * relationship/relationshipEngine.js
 */

const db = require('../database/supabaseClient');
const { CREATOR_ID } = require('../persona/identityCore');

const VIP_NAMES = ['sweet', 'frozen'];
const TROUBLEMAKER_FLAG_THRESHOLD = 3;

const TIERS = Object.freeze({
  CREATOR: 'creator',
  VIP: 'vip',
  REGULAR: 'regular',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  TROUBLEMAKER: 'troublemaker',
  UNKNOWN: 'unknown',
});

const SALIENT_EVENTS = {
  vulnerable_disclosure: { trust: +3, affection: +1 },
  boundary_violation: { trust: -6, respect: -4 },
  genuine_compliment_landed: { affection: +2, respect: +1 },
  conflict_repaired: { trust: +2, patience_note: 'partial_recovery' },
  defended_creator: { affection: +2, protectiveness: +1 },
  rule_broken: { respect: -5, trust: -3 },
  helped_others: { respect: +2 },
};

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

async function resolveTier({ userId, displayName = '', roles = [] }) {
  if (userId === CREATOR_ID) return TIERS.CREATOR;

  const flags = (await db.getUserProfile(userId))?.moderation_flag_count || 0;
  if (flags >= TROUBLEMAKER_FLAG_THRESHOLD) return TIERS.TROUBLEMAKER;

  if (roles.includes('admin') || roles.includes('owner')) return TIERS.ADMIN;
  if (roles.includes('moderator')) return TIERS.MODERATOR;
  if (VIP_NAMES.some((n) => displayName.toLowerCase().includes(n))) return TIERS.VIP;

  const profile = await db.getUserProfile(userId);
  return profile ? TIERS.REGULAR : TIERS.UNKNOWN;
}

async function resolve({ userId, displayName = '', roles = [] }) {
  const tier = await resolveTier({ userId, displayName, roles });
  let profile = await db.getUserProfile(userId);

  if (!profile) {
    profile = await db.upsertUserProfile(userId, {
      display_name: displayName,
      tier,
      trust: tier === TIERS.CREATOR ? 70 : 30,
      respect: 30,
      affection: tier === TIERS.CREATOR ? 60 : 15,
      familiarity: 0,
      protectiveness: 20,
      interaction_count: 0,
    });
  }

  const interaction_count = (profile.interaction_count || 0) + 1;
  const familiarity = clamp(Math.round(Math.log2(interaction_count + 1) * 8));

  await db.upsertUserProfile(userId, {
    interaction_count,
    familiarity,
    last_seen: new Date().toISOString(),
    tier,
  });

  return { ...profile, tier, interaction_count, familiarity };
}

async function applyEvent(userId, eventKey) {
  const deltas = SALIENT_EVENTS[eventKey];
  if (!deltas) return null;

  const profile = await db.getUserProfile(userId);
  if (!profile) return null;

  const updated = {
    trust: clamp((profile.trust || 30) + (deltas.trust || 0)),
    respect: clamp((profile.respect || 30) + (deltas.respect || 0)),
    affection: clamp((profile.affection || 15) + (deltas.affection || 0)),
    protectiveness: clamp((profile.protectiveness || 20) + (deltas.protectiveness || 0)),
  };

  return db.upsertUserProfile(userId, updated);
}

module.exports = { resolve, applyEvent, TIERS, SALIENT_EVENTS };
