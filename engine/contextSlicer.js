/**
 * engine/contextSlicer.js  (NEW)
 *
 * Per-intent projections of hero / troop / boss / gear records.
 * Goal: the model gets ONLY what it must reason with. Stat tables for all 10
 * levels belong in the embed cards (deterministic), not in the prompt.
 * Pure functions, no I/O, no mutation of the source records.
 */

const DEFAULT_LEVEL = 10;

function _clampLevel(level, len) {
  const n = Number.isFinite(+level) ? Math.trunc(+level) : DEFAULT_LEVEL;
  return Math.min(Math.max(n, 1), len || 10);
}
const _at = (arr, level) => (Array.isArray(arr) && arr.length ? arr[_clampLevel(level, arr.length) - 1] : undefined);

function _clean(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
}

/** Hero → what the model needs. Stats at ONE level (default 10); card shows the rest. */
function sliceHero(h, { level = DEFAULT_LEVEL } = {}) {
  if (!h) return h;
  const sl = h.statLevels || {};
  return _clean({
    id: h.id, // kept: collection-bonus math in enrichment.js needs it
    name: h.name,
    faction: h.faction,
    rarity: h.rarity,
    role: h.analysis && h.analysis.primaryRole,
    secondaryRoles: h.analysis && h.analysis.secondaryRoles,
    supportFocus: h.supportFocus,
    statLevel: level,
    hp: _at(sl.hp, level),
    defense: _at(sl.defense, level),
    attack: _at(sl.attack, level),
    talent: h.talent && _clean({ name: h.talent.name, description: h.talent.description, effects: h.talent.effects, targets: h.talent.targets }),
    ability: h.ability && _clean({ name: h.ability.name, description: h.ability.description, effects: h.ability.effects }),
    strengths: h.analysis && h.analysis.strengths,
    weaknesses: h.analysis && h.analysis.weaknesses,
    recommendedTroops: h.recommendedTroops,
  });
}

/** Troop → ONE level only. combatLine is the ONLY source of positional role. */
function sliceTroop(t, { level = DEFAULT_LEVEL } = {}) {
  if (!t) return t;
  const L = t.levels || {};
  const ab = t.ability;
  let ability = null;
  if (ab) {
    const stats = {};
    for (const [k, arr] of Object.entries(ab.levelStats || {})) stats[k] = Array.isArray(arr) ? _at(arr, level) : arr;
    ability = _clean({ name: ab.name, description: ab.description, atLevel: stats });
  }
  return _clean({
    id: t.id,
    name: t.name,
    rarity: t.rarity,
    categories: t.categories,
    combatLine: t.combatLine,
    role: t.analysis && t.analysis.primaryRole,
    level,
    units: _at(L.units, level),
    hp: _at(L.hp, level),
    damage: _at(L.damage, level),
    defense: _at(L.defense, level),
    ability,
    strengths: t.analysis && t.analysis.strengths,
    weaknesses: t.analysis && t.analysis.weaknesses,
    recommendedHeroes: t.recommendedHeroes,
  });
}

/**
 * Synergy PARTNER → compact object. Keeps what the SYNERGY prompt segment needs:
 *  - hero: talent name+description (ROLE/EFFECT LOCK forbids guessing effects), one stat
 *  - troop: combatLine (the ONLY legal source of positional role), one stat
 *  - reason: the one-line "why" from synergies.js troopHeroSynergy (when known)
 */
function slimPartner(rec, type, { level = DEFAULT_LEVEL, reason } = {}) {
  if (!rec) return rec;
  if (type === 'hero') {
    const sl = rec.statLevels || {};
    return _clean({
      name: rec.name, rarity: rec.rarity,
      role: rec.analysis && rec.analysis.primaryRole,
      talent: rec.talent && _clean({ name: rec.talent.name, description: rec.talent.description }),
      hp: _at(sl.hp, level), attack: _at(sl.attack, level),
      reason,
    });
  }
  const L = rec.levels || {};
  return _clean({
    name: rec.name, rarity: rec.rarity, combatLine: rec.combatLine,
    role: rec.analysis && rec.analysis.primaryRole,
    hp: _at(L.hp, level), damage: _at(L.damage, level),
    reason,
  });
}

/** troopHeroSynergy (synergies.js) → Map 'troopId|heroId' → reason. Build once at startup. */
function buildReasonIndex(synergies) {
  const m = new Map();
  for (const t of (synergies && synergies.troopHeroSynergy) || []) {
    for (const hs of t.heroSynergies || []) m.set(`${t.troopId}|${hs.heroId}`, hs.reason);
  }
  return m;
}

/** Gear (gearData.js shape) → identity + trigger/effect + max-level scaling value only. */
function slimGear(g) {
  if (!g || typeof g !== 'object') return g;
  const p = g.passive && typeof g.passive === 'object' ? g.passive : {};
  const maxScaling = {};
  for (const [k, v] of Object.entries(p.scaling || {})) {
    if (k !== 'level' && Array.isArray(v) && v.length) maxScaling[k] = v[v.length - 1];
  }
  return _clean({
    name: g.name, slot: g.slot, rarity: g.rarity, roleFamily: g.roleFamily,
    ownershipStatus: g.ownershipStatus, // "locked" must be stated plainly (GEAR rule)
    trigger: p.trigger, effect: p.effect, maxScaling,
  });
}

const TIMINGS_BLOCK_RE = /\n\n\[[^\]]*TIMINGS\]:[\s\S]*?(?=\n\n\[UNIVERSAL BOSS ROSTER|$)/;

/** Boss → AI payload. Timings dropped (embed already renders them). resistance.note dropped (dup of deploymentRule + TACTIC). */
function sliceBoss(b) {
  if (!b) return b;
  const r = b.resistance;
  return _clean({
    name: b.name, tier: b.tier, zone: b.zone,
    resistance: r && _clean({ possibleTypes: r.possibleTypes, protectionPct: r.protectionPct, source: r.source, deploymentRule: r.deploymentRule }),
    abilities: Array.isArray(b.abilities)
      ? b.abilities.map(a => _clean({ type: a.type, name: a.name, cooldown: a.cooldown, description: a.description }))
      : undefined,
    strategy: typeof b.strategy === 'string' ? b.strategy.replace(TIMINGS_BLOCK_RE, '') : undefined,
  });
}

/** Synergy context (output of queryEngine.getSynergyContext) → slim candidate. */
function sliceSynergy(ctx, { level = DEFAULT_LEVEL, includeTarget = false, reasons = null } = {}) {
  const isHero = ctx.entityType === 'hero';
  return _clean({
    targetType: ctx.entityType,
    targetName: ctx.entity.name,
    // target record already travels in context.mentionedHeroes/Troops (or recognizedHero) -> not repeated here
    target: includeTarget ? (isHero ? sliceHero(ctx.entity, { level }) : sliceTroop(ctx.entity, { level })) : undefined,
    // pair reason lookup: key is always troopId|heroId regardless of which side is the target
    recommendedHeroes: (ctx.recommendedHeroes || []).map(h =>
      slimPartner(h, 'hero', { level, reason: reasons && reasons.get(`${ctx.entity.id}|${h.id}`) })),
    recommendedTroops: (ctx.recommendedTroops || []).map(t =>
      slimPartner(t, 'troop', { level, reason: reasons && reasons.get(`${t.id}|${ctx.entity.id}`) })),
    synergyCategories: ctx.synergyCategories,
    optimalGear: (ctx.optimalGear || []).slice(0, 3).map(slimGear),
    unresolvedRecommendations: ctx.unresolvedRecommendations,
  });
}

module.exports = { buildReasonIndex, sliceHero, sliceTroop, slimPartner, slimGear, sliceBoss, sliceSynergy, DEFAULT_LEVEL };
