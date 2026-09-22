/**
 * relationship/relationshipEngine.js
 * 
 * PURPOSE:
 *   Tracks long-term relationship metrics (trust, respect, affection) per user.
 *   🚀 UPGRADE: Maximized Creator baseline stats to match the devoted persona.
 *   🚀 UPGRADE: Added severe penalty events for flirting and hostility.
 *   🚀 UPGRADE: Added processIntent() to automatically trigger database penalties.
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

// 🚀 UPGRADE: Added specific penalties for boundary violations and flirting
const SALIENT_EVENTS = {
  vulnerable_disclosure: { trust: +3, affection: +1 },
  boundary_violation: { trust: -6, respect: -4 },
  genuine_compliment_landed: { affection: +2, respect: +1 },
  conflict_repaired: { trust: +2, patience_note: 'partial_recovery' },
  defended_creator: { affection: +2, protectiveness: +1 },
  rule_broken: { respect: -5, trust: -3 },
  helped_others: { respect: +2 },
  unwanted_flirt: { respect: -15, trust: -10, affection: -10 },
  hostile_attack: { respect: -20, trust: -10 },
  jealousy_trigger: { trust: -5, affection: -2 }
};

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

async function resolveTier({ userId, displayName = '', roles = [] }) {
  if (userId === CREATOR_ID) return TIERS.CREATOR;

  const flags = (await db.getUserProfile(userId))?.moderation_flag_count || 0;
  if (flags >= TROUBLEMAKER_FLAG_THRESHOLD) return TIERS.TROUBLEMAKER;

  const safeRoles = roles || [];
  if (safeRoles.includes('admin') || safeRoles.includes('owner')) return TIERS.ADMIN;
  if (safeRoles.includes('moderator')) return TIERS.MODERATOR;
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
      // 🚀 UPGRADE: Creator starts completely maxed out in affection and trust
      trust: tier === TIERS.CREATOR ? 100 : 30,
      respect: tier === TIERS.CREATOR ? 100 : 30,
      affection: tier === TIERS.CREATOR ? 100 : 15,
      familiarity: tier === TIERS.CREATOR ? 100 : 0,
      protectiveness: tier === TIERS.CREATOR ? 100 : 20,
      interaction_count: 0,
    });
  }

  const interaction_count = (profile.interaction_count || 0) + 1;
  // Creator bypasses the familiarity log curve
  const familiarity = tier === TIERS.CREATOR ? 100 : clamp(Math.round(Math.log2(interaction_count + 1) * 8));

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

  // Protect the Creator from stat decay
  if (profile.tier === TIERS.CREATOR) return profile;

  const updated = {
    trust: clamp((profile.trust || 30) + (deltas.trust || 0)),
    respect: clamp((profile.respect || 30) + (deltas.respect || 0)),
    affection: clamp((profile.affection || 15) + (deltas.affection || 0)),
    protectiveness: clamp((profile.protectiveness || 20) + (deltas.protectiveness || 0)),
  };

  return db.upsertUserProfile(userId, updated);
}

/**
 * 🚀 UPGRADE: Automatically routes specific classified intents to permanent database penalties.
 */
async function processIntent(userId, intent) {
  if (!intent) return null;
  const normalizedIntent = intent.toLowerCase();

  try {
      if (normalizedIntent === 'flirt' && userId !== CREATOR_ID) {
          return await applyEvent(userId, 'unwanted_flirt');
      }
      if (normalizedIntent === 'hostile' || normalizedIntent === 'troll') {
          return await applyEvent(userId, 'hostile_attack');
      }
      if (normalizedIntent === 'jealousy' || normalizedIntent === 'territorial') {
          return await applyEvent(userId, 'jealousy_trigger');
      }
  } catch (error) {
      console.error(`⚠️ [RELATIONSHIP ENGINE] Failed to process intent penalty:`, error.message);
  }
  
  return null;
}

module.exports = { resolve, applyEvent, processIntent, TIERS, SALIENT_EVENTS };
