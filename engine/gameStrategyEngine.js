/**
 * MELODY Game Strategy Engine
 * -------------------------------------------------------------
 * Sits ON TOP of gameQueryEngine.js (which sits on top of gameKnowledge.js).
 *
 *   gameKnowledge.js  -> raw data
 *   gameQueryEngine.js -> exact lookups / formulas
 *   gameStrategyEngine.js (this file) -> deterministic strategic ANALYSIS
 *   LLM / Melody -> explains the analysis in natural language
 *
 * HARD RULES THIS FILE FOLLOWS:
 *  - Never invents a stat, buff, or synergy. Every number returned traces
 *    back to a value stored in gameKnowledge.js.
 *  - If something can't be resolved (unknown troop/hero, no talent, no
 *    synergy data, level out of range), it is reported as null / applies:false
 *    / missingInformation — never silently guessed.
 *  - No single universal "best troop" formula. Different questions use
 *    different, clearly-labeled ranking criteria (see section 9 helpers).
 *  - All score/ranking output includes its component breakdown, not just
 *    a final number, so the LLM (and the user) can see exactly why.
 *  - Talent effect ranges ("2% - 25%") are interpolated linearly across
 *    hero levels 1-10 (level 1 = low end, level 10 = high end). This
 *    mirrors the only stacking convention gameKnowledge.js actually
 *    specifies (formulas.totalBonusPct sums percentages additively), so
 *    multi-hero buff stacking in this file also sums additively. Both
 *    assumptions are stated explicitly in the relevant return payloads.
 * -------------------------------------------------------------
 */

const queryEngine = require('./gameQueryEngine.js');
const { gameLibrary } = queryEngine;
const { heroSynergyIndex } = gameLibrary;

// ---------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------

function normalize(str) {
  if (str === null || str === undefined) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * gameQueryEngine.js does not export a single-hero-by-name lookup that
 * returns the FULL hero record (talent/ability/tags) — only findHeroes()
 * (array filter). This mirrors the same normalize/match strategy
 * gameQueryEngine.js uses internally, applied to the same gameLibrary.heroes
 * array, so results stay 1:1 consistent with the rest of the pipeline.
 */
function _localFindHero(name) {
  if (!name) return null;
  // Try to use the new exact entity matcher from query engine if available
  if (queryEngine.findEntityByName) {
    const entity = queryEngine.findEntityByName(name);
    if (entity && entity.type === 'hero') return entity.data;
  }

  const n = normalize(name);
  let hit = gameLibrary.heroes.find(h => normalize(h.name) === n || normalize(h.id) === n);
  if (!hit) {
    hit = gameLibrary.heroes.find(h => normalize(h.name).includes(n) || n.includes(normalize(h.name)) || normalize(h.id).includes(n));
  }
  return hit || null;
}

function _isValidLevel(level) {
  const lv = parseInt(level, 10);
  return !isNaN(lv) && lv >= 1 && lv <= 10;
}

function _round(n, decimals = 2) {
  if (typeof n !== 'number' || isNaN(n)) return null;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/** Parses a single value like "25%", "1,600", "17s", "3.5 m" -> { value, unit } */
function parseValueWithUnit(raw) {
  if (typeof raw === 'number') return { value: raw, unit: null };
  if (typeof raw !== 'string') return { value: null, unit: null };
  const cleaned = raw.trim().replace(/,/g, '');
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(%|s|m)?$/i);
  if (!m) return { value: null, unit: null };
  return { value: parseFloat(m[1]), unit: m[2] || null };
}

/**
 * Parses gameKnowledge.js range strings, e.g. "2% - 25%", "2% — 25%",
 * "1,600 - 2,500", "35s - 26s" (descending is valid — e.g. cooldowns
 * that shrink with level), or fixed values like "27 (Fixed)".
 * Returns null if the string isn't a recognizable range/fixed format
 * (never fabricates a value in that case).
 */
function parseRangeString(raw) {
  if (typeof raw === 'number') return { fixed: true, min: raw, max: raw, unit: null, raw };
  if (typeof raw !== 'string') return null;

  const fixedMatch = raw.match(/^(.*?)\s*\(Fixed\)\s*$/i);
  if (fixedMatch) {
    const parsed = parseValueWithUnit(fixedMatch[1]);
    if (parsed.value === null) return null;
    return { fixed: true, min: parsed.value, max: parsed.value, unit: parsed.unit, raw };
  }

  const parts = raw.split(/\s[-–—]\s/); // hyphen / en dash / em dash, space-padded
  if (parts.length !== 2) return null;

  const a = parseValueWithUnit(parts[0]);
  const b = parseValueWithUnit(parts[1]);
  if (a.value === null || b.value === null) return null;

  return { fixed: false, min: a.value, max: b.value, unit: a.unit || b.unit || null, raw };
}

/** Linearly interpolates a parsed range across hero/ability level 1-10. Level 1 = min, level 10 = max. */
function interpolateRange(range, level) {
  if (!range) return null;
  if (range.fixed) return range.min;
  const lvl = Math.max(1, Math.min(10, parseInt(level, 10) || 1));
  const t = (lvl - 1) / 9;
  const val = range.min + (range.max - range.min) * t;
  const bothInt = Number.isInteger(range.min) && Number.isInteger(range.max);
  return bothInt ? Math.round(val) : _round(val, 2);
}

/** Maps a hero talent "targets" label to the matching troop.categories label. Identity if no mapping needed. */
const TARGET_TO_CATEGORY = { Mage: 'Mages', Human: 'Human', Undead: 'Undead', Tank: 'Tank' };

/** All real troop category labels actually present in gameKnowledge.js (derived, never hardcoded guesses). */
const KNOWN_TROOP_CATEGORIES = [...new Set(gameLibrary.troops.flatMap(t => t.categories || []))];

/**
 * Resolves a loosely-worded category (e.g. "mage", singular, mis-cased) to the
 * exact category label stored in gameKnowledge.js (e.g. "Mages").
 */
function _resolveCategory(input) {
  if (!input) return null;
  const n = normalize(input);
  let hit = KNOWN_TROOP_CATEGORIES.find(c => normalize(c) === n);
  if (!hit) hit = KNOWN_TROOP_CATEGORIES.find(c => normalize(c).includes(n) || n.includes(normalize(c)));
  return hit || null;
}

/** Classifies a talent effect key so we know whether it maps onto a troop's HP/Damage stat, or is "other". */
function classifyTalentEffectKey(key) {
  const k = key.toLowerCase();
  if (k.includes('hp')) return 'hp';
  if (k.includes('damage dealt')) {
    if (/^increased|^increase/.test(k)) return 'attackBuff';
    if (/^decreased|^decrease/.test(k)) return 'enemyDamageDebuff'; // reduces the ATTACKER's damage
    return 'damageRelated';
  }
  if (k.includes('return damage')) return 'thorns';
  if (k.includes('evasion') || k.includes('chance of missing')) return 'evasion';
  if (k.includes('defense')) return 'defenseBuff';
  return 'other';
}

/**
 * Detects per-level growth spikes for a troop.
 */
function _detectSpikes(troopName) {
  const troop = queryEngine.getTroop(troopName);
  if (!troop) return [];
  const hp = troop.levels.hp;
  const dmg = troop.levels.damage;

  const steps = [];
  for (let i = 1; i < 10; i++) {
    const hpPercent = hp[i - 1] ? _round(((hp[i] - hp[i - 1]) / hp[i - 1]) * 100, 2) : null;
    const damagePercent = dmg[i - 1] ? _round(((dmg[i] - dmg[i - 1]) / dmg[i - 1]) * 100, 2) : null;
    steps.push({
      fromLevel: i, toLevel: i + 1,
      hpPercent, damagePercent,
      hpAbsolute: hp[i] - hp[i - 1],
      damageAbsolute: dmg[i] - dmg[i - 1]
    });
  }

  function isAcceleration(curr, prev) {
    if (curr === null || prev === null) return false;
    return curr >= prev * 1.5 && (curr - prev) >= 15;
  }

  const spikes = [];
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i], prev = steps[i - 1];
    const isHpSpike = isAcceleration(s.hpPercent, prev.hpPercent);
    const isDmgSpike = isAcceleration(s.damagePercent, prev.damagePercent);
    if (isHpSpike || isDmgSpike) {
      spikes.push({
        fromLevel: s.fromLevel, toLevel: s.toLevel,
        type: isHpSpike && isDmgSpike ? 'hp+damage' : (isHpSpike ? 'hp' : 'damage'),
        hpPercent: s.hpPercent, damagePercent: s.damagePercent,
        hpAbsolute: s.hpAbsolute, damageAbsolute: s.damageAbsolute,
        previousStepHpPercent: prev.hpPercent, previousStepDamagePercent: prev.damagePercent
      });
    }
  }
  return spikes;
}

// ---------------------------------------------------------------
// 1. TROOP LEVEL ANALYSIS
// ---------------------------------------------------------------

function analyzeTroopAtLevel(name, level) {
  const troop = queryEngine.getTroop(name);
  if (!troop) return { error: `Troop "${name}" not found in gameKnowledge.js` };

  const statsAtLevel = queryEngine.getTroopLevel(name, level);
  if (!statsAtLevel) return { error: `Level ${level} is invalid for ${troop.name}. Valid levels are 1-10.` };

  const abilityInfo = queryEngine.getTroopAbility(name, level);
  const lvl10 = queryEngine.getTroopLevel(name, 10);

  const stats = {
    units: statsAtLevel.units,
    hp: statsAtLevel.hp,
    damage: statsAtLevel.damage,
    defense: statsAtLevel.defense,
    evasion: statsAtLevel.evasion !== undefined ? statsAtLevel.evasion : null,
    speed: troop.baseStats ? troop.baseStats.speed : null,
    attackSpeed: troop.baseStats ? troop.baseStats.attackSpeed : null,
    attackRange: troop.baseStats ? troop.baseStats.attackRange : null,
    aoeRadius: troop.baseStats ? troop.baseStats.aoeRadius : null
  };

  const ability = (abilityInfo && abilityInfo.name) ? {
    name: abilityInfo.name,
    description: abilityInfo.description,
    statsAtLevel: abilityInfo.statsAtLevel
  } : { name: null, description: null, statsAtLevel: null };

  function progressPct(curr, max) {
    if (typeof curr !== 'number' || typeof max !== 'number' || max === 0) return null;
    return _round((curr / max) * 100, 2);
  }
  const hpProgress = progressPct(stats.hp, lvl10 ? lvl10.hp : null);
  const damageProgress = progressPct(stats.damage, lvl10 ? lvl10.damage : null);
  const defenseProgress = progressPct(stats.defense, lvl10 ? lvl10.defense : null);
  const present = [hpProgress, damageProgress, defenseProgress].filter(v => v !== null);

  const performanceScore = {
    methodology: "Percent of THIS TROOP'S OWN level-10 stat ceiling reached at this level — an intrinsic per-troop metric, not a cross-troop power ranking.",
    components: { hpProgressPercent: hpProgress, damageProgressPercent: damageProgress, defenseProgressPercent: defenseProgress },
    composite: present.length ? _round(present.reduce((a, b) => a + b, 0) / present.length, 2) : null
  };

  const scaling = troop.analysis ? troop.analysis.scaling : null;
  const recommendations = [];
  if (scaling) {
    if (scaling.hp === 'strong') recommendations.push(`${troop.name}'s HP scales strongly with level — leveling is efficient for durability.`);
    if (scaling.hp === 'weak') recommendations.push(`${troop.name}'s HP scaling is weak — don't expect big survivability gains from leveling alone.`);
    if (scaling.damage === 'strong') recommendations.push(`${troop.name}'s damage scales strongly with level — worth prioritizing for offense.`);
    if (scaling.damage === 'moderate') recommendations.push(`${troop.name}'s damage scaling is moderate — steady but not explosive gains per level.`);
    if (scaling.damage === 'weak') recommendations.push(`${troop.name}'s damage scaling is weak — pair with a damage-buff hero rather than relying on troop levels alone.`);
  }
  if (troop.analysis && troop.analysis.primaryRole) {
    const secondary = (troop.analysis.secondaryRoles || []).length ? ` (secondary: ${troop.analysis.secondaryRoles.join(', ')})` : '';
    recommendations.push(`Primary role is ${troop.analysis.primaryRole}${secondary} — build hero/gear support accordingly.`);
  }
  const heroSynergy = queryEngine.findHeroSynergies(name);
  if (heroSynergy && heroSynergy.heroSynergies.length) {
    recommendations.push(`Synergizes with ${heroSynergy.heroSynergies.length} known hero(es) in gameKnowledge.js — see findBestHeroesForTroop("${troop.name}") for the ranked list.`);
  }

  return {
    troop: { id: troop.id, name: troop.name, rarity: troop.rarity, categories: troop.categories, tags: troop.tags },
    level: statsAtLevel.level,
    stats,
    ability,
    role: { primaryRole: troop.analysis ? troop.analysis.primaryRole : null, secondaryRoles: troop.analysis ? troop.analysis.secondaryRoles : [] },
    strengths: troop.analysis ? troop.analysis.strengths : [],
    weaknesses: troop.analysis ? troop.analysis.weaknesses : [],
    performanceScore,
    recommendations
  };
}

// ---------------------------------------------------------------
// 2. LEVEL COMPARISON
// ---------------------------------------------------------------

function compareTroopLevels(name, levelA, levelB) {
  const growth = queryEngine.getTroopGrowth(name, levelA, levelB);
  const cmp = queryEngine.compareTroop(name, levelA, levelB);
  if (!growth || !cmp) {
    return { error: `Could not compare "${name}" between level ${levelA} and ${levelB} — check the troop name and that both levels are 1-10.` };
  }

  const abilityA = queryEngine.getTroopAbility(name, levelA);
  const abilityB = queryEngine.getTroopAbility(name, levelB);
  const abilityGrowth = {};
  if (abilityA && abilityB && abilityA.statsAtLevel && abilityB.statsAtLevel) {
    Object.keys(abilityA.statsAtLevel).forEach(key => {
      const vA = abilityA.statsAtLevel[key];
      const vB = abilityB.statsAtLevel[key];
      const pA = typeof vA === 'number' ? vA : parseValueWithUnit(String(vA)).value;
      const pB = typeof vB === 'number' ? vB : parseValueWithUnit(String(vB)).value;
      if (pA !== null && pB !== null && !isNaN(pA) && !isNaN(pB)) {
        abilityGrowth[key] = {
          from: vA, to: vB,
          absolute: _round(pB - pA, 2),
          percent: pA === 0 ? null : _round(((pB - pA) / pA) * 100, 2)
        };
      } else {
        abilityGrowth[key] = { from: vA, to: vB, changed: vA !== vB };
      }
    });
  }

  const spikes = _detectSpikes(name);
  const lo = Math.min(parseInt(levelA, 10), parseInt(levelB, 10));
  const hi = Math.max(parseInt(levelA, 10), parseInt(levelB, 10));
  const importantBreakpoints = spikes.filter(s => s.toLevel > lo && s.toLevel <= hi);

  const hpPct = growth.hp.percent;
  const dmgPct = growth.damage.percent;
  const parts = [];
  if (hpPct !== null) parts.push(`HP ${hpPct >= 0 ? '+' : ''}${hpPct}%`);
  if (dmgPct !== null) parts.push(`Damage ${dmgPct >= 0 ? '+' : ''}${dmgPct}%`);
  const maxPct = Math.max(Math.abs(hpPct || 0), Math.abs(dmgPct || 0));
  let magnitude = 'minor';
  if (maxPct >= 75) magnitude = 'massive';
  else if (maxPct >= 35) magnitude = 'major';
  else if (maxPct >= 15) magnitude = 'moderate';

  const lowLvl = Math.min(cmp.levelA.level, cmp.levelB.level);
  const highLvl = Math.max(cmp.levelA.level, cmp.levelB.level);
  const verdict = `Lv${highLvl} vs Lv${lowLvl}: ${magnitude} change (${parts.join(', ') || 'no numeric stats to compare'})` +
    `${importantBreakpoints.length ? `, crossing ${importantBreakpoints.length} notable growth spike(s) at level(s) ${importantBreakpoints.map(b => b.toLevel).join(', ')}` : ''}.`;

  return {
    levelA: cmp.levelA,
    levelB: cmp.levelB,
    absoluteGrowth: { hp: growth.hp.absolute, damage: growth.damage.absolute, defense: growth.defense.absolute, units: growth.units.absolute },
    percentageGrowth: { hp: growth.hp.percent, damage: growth.damage.percent, defense: growth.defense.percent, units: growth.units.percent },
    abilityGrowth,
    importantBreakpoints,
    verdict
  };
}

// ---------------------------------------------------------------
// 3. LEVEL VALUE / BREAKPOINT ANALYSIS
// ---------------------------------------------------------------

function analyzeTroopProgression(name) {
  const troop = queryEngine.getTroop(name);
  if (!troop) return { error: `Troop "${name}" not found in gameKnowledge.js` };

  const hp = troop.levels.hp, dmg = troop.levels.damage, def = troop.levels.defense, units = troop.levels.units;

  function totalGrowth(arr) {
    return {
      from: arr[0], to: arr[9],
      absolute: arr[9] - arr[0],
      percent: arr[0] ? _round(((arr[9] - arr[0]) / arr[0]) * 100, 2) : null
    };
  }
  const level1To10 = { hp: totalGrowth(hp), damage: totalGrowth(dmg), defense: totalGrowth(def), units: { from: units[0], to: units[9], absolute: units[9] - units[0] } };

  const majorSpikes = _detectSpikes(name);

  const unitBreakpoints = [];
  for (let i = 1; i < 10; i++) {
    if (units[i] !== units[i - 1]) unitBreakpoints.push({ atLevel: i + 1, from: units[i - 1], to: units[i] });
  }

  const abilityBreakpoints = [];
  if (troop.ability && troop.ability.levelStats) {
    Object.entries(troop.ability.levelStats).forEach(([statName, arr]) => {
      const numeric = arr.every(v => typeof v === 'number');
      for (let i = 1; i < 10; i++) {
        if (numeric) {
          if (arr[i] !== arr[i - 1]) {
            const pct = arr[i - 1] ? _round(((arr[i] - arr[i - 1]) / arr[i - 1]) * 100, 2) : null;
            abilityBreakpoints.push({ stat: statName, atLevel: i + 1, from: arr[i - 1], to: arr[i], percentChange: pct });
          }
        } else if (String(arr[i]) !== String(arr[i - 1])) {
          abilityBreakpoints.push({ stat: statName, atLevel: i + 1, from: arr[i - 1], to: arr[i] });
        }
      }
    });
  }

  function shareOfTotal(arr, uptoIdx) {
    const total = arr[9] - arr[0];
    if (!total) return null;
    return _round(((arr[uptoIdx] - arr[0]) / total) * 100, 2);
  }
  const earlyGameValue = { throughLevel: 4, hpSharePercent: shareOfTotal(hp, 3), damageSharePercent: shareOfTotal(dmg, 3) };
  const midGameValue = { throughLevel: 7, hpSharePercent: shareOfTotal(hp, 6), damageSharePercent: shareOfTotal(dmg, 6) };
  const lateGameValue = {
    fromLevel: 8,
    hpSharePercent: midGameValue.hpSharePercent !== null ? _round(100 - midGameValue.hpSharePercent, 2) : null,
    damageSharePercent: midGameValue.damageSharePercent !== null ? _round(100 - midGameValue.damageSharePercent, 2) : null
  };

  const bestValueLevels = majorSpikes.map(s => ({
    level: s.toLevel,
    reason: `Reaching level ${s.toLevel} crosses a growth spike (${s.type === 'hp+damage' ? `HP +${s.hpPercent}% / Damage +${s.damagePercent}%` : (s.type === 'hp' ? `HP +${s.hpPercent}%` : `Damage +${s.damagePercent}%`)} vs. the prior level, well above this troop's typical per-level growth) — this is where leveling pays off most, based on stat growth alone.`
  }));

  const scalingProfile = `${troop.name}: HP scaling is "${(troop.analysis && troop.analysis.scaling && troop.analysis.scaling.hp) || 'unknown'}", damage scaling is "${(troop.analysis && troop.analysis.scaling && troop.analysis.scaling.damage) || 'unknown'}" (per gameKnowledge.js analysis). ` +
    `${majorSpikes.length ? `Growth is punctuated by ${majorSpikes.length} notable spike(s) at level(s) ${majorSpikes.map(s => s.toLevel).join(', ')}, rather than smooth linear growth.` : 'Growth is relatively smooth across levels 1-10, without pronounced spikes.'}`;

  return {
    troop: { id: troop.id, name: troop.name },
    level1To10,
    majorSpikes,
    abilityBreakpoints,
    unitBreakpoints,
    earlyGameValue,
    midGameValue,
    lateGameValue,
    bestValueLevels,
    scalingProfile,
    missingData: ["Per-level gold/resource upgrade cost is not present in gameKnowledge.js — 'value' above reflects stat-growth pattern only, not resource/cost efficiency."]
  };
}

// ---------------------------------------------------------------
// 3.5 ENTITY COMPARISON ENGINE (Fixes "X vs Y" queries)
// ---------------------------------------------------------------

function compareEntities(nameA, nameB) {
  if (!queryEngine.findEntityByName) return { error: `queryEngine.findEntityByName is not available. Please ensure gameQueryEngine.js is updated.` };
  
const entityA = queryEngine.findEntityByName(nameA);
  const entityB = queryEngine.findEntityByName(nameB);

  if (!entityA) return { error: `Entity "${nameA}" not found in gameKnowledge.js database.` };
  if (!entityB) return { error: `Entity "${nameB}" not found in gameKnowledge.js database.` };

  return {
    entityA: {
      type: entityA.type,
      name: entityA.data.name,
      faction: entityA.data.faction || (entityA.data.categories ? entityA.data.categories.join(', ') : 'Unknown'),
      rarity: entityA.data.rarity,
      stats: entityA.type === 'hero' ? entityA.data.stats : { hp: entityA.data.levels.hp[0], damage: entityA.data.levels.damage[0], defense: entityA.data.levels.defense[0] },
      talent: entityA.data.talent || null,
      ability: entityA.data.ability || null
    },
    entityB: {
      type: entityB.type,
      name: entityB.data.name,
      faction: entityB.data.faction || (entityB.data.categories ? entityB.data.categories.join(', ') : 'Unknown'),
      rarity: entityB.data.rarity,
      stats: entityB.type === 'hero' ? entityB.data.stats : { hp: entityB.data.levels.hp[0], damage: entityB.data.levels.damage[0], defense: entityB.data.levels.defense[0] },
      talent: entityB.data.talent || null,
      ability: entityB.data.ability || null
    }
  };
}

// ---------------------------------------------------------------
// 4. HERO BUFF ANALYSIS
// ---------------------------------------------------------------

const BUFF_TAGS = ['Attack-Buff', 'HP-Buff', 'Defense-Buff', 'Boss-Damage', 'Healing', 'Shielding', 'Evasion-Buff'];
const PRIORITY_TAG_MAP = { hp: 'HP-Buff', attack: 'Attack-Buff', damage: 'Attack-Buff', defense: 'Defense-Buff', healing: 'Healing', support: 'Healing', shield: 'Shielding', shielding: 'Shielding', evasion: 'Evasion-Buff' };

function findBestHeroesForTroop(troopName, options = {}) {
  const { limit = 5, priority = null } = options;
  const synergy = queryEngine.findHeroSynergies(troopName);
  if (!synergy) return { error: `Troop "${troopName}" not found in gameKnowledge.js` };
  if (!synergy.heroSynergies.length) {
    return { troopId: synergy.troopId, troopName: synergy.troopName, priority: priority || null, candidates: [], message: `No curated hero synergy entries exist for ${synergy.troopName} in gameKnowledge.js (troopHeroSynergy).` };
  }

  const priorityTag = priority ? PRIORITY_TAG_MAP[String(priority).toLowerCase()] : null;

  const candidates = synergy.heroSynergies.map(s => {
    const hero = _localFindHero(s.heroId);
    if (!hero) return { heroId: s.heroId, heroName: s.heroName, reason: s.reason, error: 'Hero id present in troopHeroSynergy but not found in heroes[] — data inconsistency in gameKnowledge.js.' };
    const matchedBuffTags = (hero.tags || []).filter(t => BUFF_TAGS.includes(t));
    return {
      heroId: hero.id,
      heroName: hero.name,
      faction: hero.faction,
      rarity: hero.rarity,
      reason: s.reason,
      talentName: hero.talent ? hero.talent.name : null,
      talentDescription: hero.talent ? hero.talent.description : null,
      matchedBuffTags,
      matchesPriority: priorityTag ? matchedBuffTags.includes(priorityTag) : null
    };
  });

  candidates.sort((a, b) => {
    if (priorityTag) {
      const pa = a.matchesPriority ? 1 : 0, pb = b.matchesPriority ? 1 : 0;
      if (pa !== pb) return pb - pa;
    }
    return (b.matchedBuffTags ? b.matchedBuffTags.length : 0) - (a.matchedBuffTags ? a.matchedBuffTags.length : 0);
  });

  return {
    troopId: synergy.troopId,
    troopName: synergy.troopName,
    priority: priority || null,
    candidates: candidates.slice(0, limit)
  };
}
// ---------------------------------------------------------------
// 5. ACTUAL HERO BUFF APPLICATION
// ---------------------------------------------------------------

function calculateHeroTalentEffect({ heroName, heroLevel, troopName, troopLevel } = {}) {
  const hero = _localFindHero(heroName);
  const troop = queryEngine.getTroop(troopName);

  if (!hero) return { applies: false, buffPercent: 0, reason: `Hero "${heroName}" not found in gameKnowledge.js.` };
  if (!troop) return { applies: false, buffPercent: 0, reason: `Troop "${troopName}" not found in gameKnowledge.js.` };
  if (!_isValidLevel(heroLevel)) return { applies: false, buffPercent: 0, reason: `Hero level ${heroLevel} is invalid — must be 1-10.` };

  const troopStatsAtLevel = queryEngine.getTroopLevel(troopName, troopLevel);
  if (!troopStatsAtLevel) return { applies: false, buffPercent: 0, reason: `Troop level ${troopLevel} is invalid for ${troop.name} — must be 1-10.` };

  const base = {
    applies: false,
    heroName: hero.name, heroId: hero.id, heroLevel: parseInt(heroLevel, 10),
    troopName: troop.name, troopLevel: troopStatsAtLevel.level,
    talentName: hero.talent ? hero.talent.name : null,
    hp: null, damage: null, otherEffects: [], reason: null, source: hero.talent ? `${hero.name} - ${hero.talent.name}` : null
  };

  if (!hero.talent) {
    base.reason = `${hero.name} has no talent defined in gameKnowledge.js (talent: null) — nothing to apply.`;
    return base;
  }

  const targets = hero.talent.targets || [];
  const appliesUniversally = targets.includes('All Allies');
  const matchedTarget = targets.find(t => t !== 'All Allies' && (troop.categories || []).some(c => normalize(c) === normalize(TARGET_TO_CATEGORY[t] || t)));

  if (!appliesUniversally && !matchedTarget) {
    base.reason = targets.length === 0
      ? `${hero.name}'s talent ("${hero.talent.name}") has no allied-troop target in gameKnowledge.js — it does not buff regular troops (e.g. self/summon-only effect).`
      : `${hero.name}'s talent targets [${targets.join(', ')}], but ${troop.name} belongs to categories [${(troop.categories || []).join(', ')}] — no overlap, so the talent does not apply.`;
    return base;
  }

  base.applies = true;
  base.matchedTarget = appliesUniversally ? 'All Allies' : matchedTarget;

  const effects = hero.talent.effects || {};
  const classified = Object.entries(effects).map(([key, raw]) => ({ key, raw, type: classifyTalentEffectKey(key), range: parseRangeString(raw) }));

  const hpEffect = classified.find(c => c.type === 'hp' && c.range);
  const atkEffect = classified.find(c => c.type === 'attackBuff' && c.range);
  const consumed = new Set([hpEffect, atkEffect].filter(Boolean).map(c => c.key));

  if (hpEffect) {
    const buffPercent = interpolateRange(hpEffect.range, heroLevel);
    const baseHP = troopStatsAtLevel.hp;
    base.hp = {
      effectKey: hpEffect.key,
      buffPercent,
      baseHP,
      effectiveHP: (typeof baseHP === 'number' && typeof buffPercent === 'number') ? Math.round(baseHP * (1 + buffPercent / 100)) : null,
      source: base.source
    };
  }
  if (atkEffect) {
    const buffPercent = interpolateRange(atkEffect.range, heroLevel);
    const baseDamage = troopStatsAtLevel.damage;
    base.damage = {
      effectKey: atkEffect.key,
      buffPercent,
      baseDamage,
      effectiveDamage: (typeof baseDamage === 'number' && typeof buffPercent === 'number') ? Math.round(baseDamage * (1 + buffPercent / 100)) : null,
      source: base.source
    };
  }

  base.otherEffects = classified
    .filter(c => !consumed.has(c.key))
    .map(c => ({
      key: c.key,
      raw: c.raw,
      type: c.type,
      valueAtHeroLevel: c.range ? interpolateRange(c.range, heroLevel) : null,
      note: 'Not a direct HP/Damage stat multiplier on the troop — reported as-is (e.g. thorns/return-damage, evasion, enemy-damage debuff, or unparsed text).'
    }));

  if (!hpEffect && !atkEffect) {
    base.reason = `${hero.name}'s talent applies to ${troop.name} but doesn't directly buff HP or Damage — see otherEffects for the raw values.`;
  }

  return base;
}

// ---------------------------------------------------------------
// 6. COMBINED TROOP + HERO ANALYSIS
// ---------------------------------------------------------------

function analyzeTroopWithHeroes({ troopName, troopLevel, heroes = [], heroLevels = [] } = {}) {
  const troop = queryEngine.getTroop(troopName);
  const troopBaseStats = queryEngine.getTroopLevel(troopName, troopLevel);
  if (!troop || !troopBaseStats) return { error: `Could not resolve troop "${troopName}" at level ${troopLevel}.` };

  const heroEffects = heroes.map((heroName, i) => {
    const lvl = heroLevels[i] !== undefined ? heroLevels[i] : 10;
    return calculateHeroTalentEffect({ heroName, heroLevel: lvl, troopName, troopLevel });
  });

  let hpBuffTotal = 0, dmgBuffTotal = 0;
  const hpSources = [], dmgSources = [];
  heroEffects.forEach(e => {
    if (e && e.applies && e.hp && typeof e.hp.buffPercent === 'number') { hpBuffTotal += e.hp.buffPercent; hpSources.push(e.hp.source); }
    if (e && e.applies && e.damage && typeof e.damage.buffPercent === 'number') { dmgBuffTotal += e.damage.buffPercent; dmgSources.push(e.damage.source); }
  });
  hpBuffTotal = _round(hpBuffTotal, 2);
  dmgBuffTotal = _round(dmgBuffTotal, 2);

  const effectiveStats = {
    hp: { base: troopBaseStats.hp, totalBuffPercent: hpBuffTotal, effective: typeof troopBaseStats.hp === 'number' ? Math.round(troopBaseStats.hp * (1 + hpBuffTotal / 100)) : null, sources: hpSources },
    damage: { base: troopBaseStats.damage, totalBuffPercent: dmgBuffTotal, effective: typeof troopBaseStats.damage === 'number' ? Math.round(troopBaseStats.damage * (1 + dmgBuffTotal / 100)) : null, sources: dmgSources },
    defense: { base: troopBaseStats.defense, totalBuffPercent: 0, effective: troopBaseStats.defense, sources: [] }
  };

  const combinedSynergy = {
    anyApplicableHero: heroEffects.some(e => e && e.applies),
    applicableHeroCount: heroEffects.filter(e => e && e.applies).length,
    totalHeroesChecked: heroEffects.length,
    stackingAssumption: "Multiple percentage buffs of the SAME stat are summed additively (e.g. +25% and +10% HP = +35% HP), consistent with the additive totalBonusPct convention gameKnowledge.js already uses for collection/weapon/armor bonuses — not multiplied together."
  };

  const lvl10 = queryEngine.getTroopLevel(troopName, 10);
  const estimatedPerformance = {
    hpVsOwnLevel10CeilingPercent: (lvl10 && lvl10.hp && effectiveStats.hp.effective !== null) ? _round((effectiveStats.hp.effective / lvl10.hp) * 100, 2) : null,
    damageVsOwnLevel10CeilingPercent: (lvl10 && lvl10.damage && effectiveStats.damage.effective !== null) ? _round((effectiveStats.damage.effective / lvl10.damage) * 100, 2) : null,
    note: "Compares the hero-buffed effective stat against this troop's own UNBUFFED level-10 ceiling — can exceed 100% with strong hero buffs."
  };

  const strengths = [];
  const weaknesses = [];
  if (hpBuffTotal > 0) strengths.push(`Effective HP raised by ${hpBuffTotal}% via ${hpSources.join(', ')}.`);
  if (dmgBuffTotal > 0) strengths.push(`Effective damage raised by ${dmgBuffTotal}% via ${dmgSources.join(', ')}.`);
  if (troop.analysis && troop.analysis.strengths) strengths.push(...troop.analysis.strengths);
  if (!combinedSynergy.anyApplicableHero && heroes.length) {
    weaknesses.push(`None of the selected heroes (${heroes.join(', ')}) have a talent that applies to ${troop.name}'s categories (${(troop.categories || []).join(', ')}).`);
  }
  if (troop.analysis && troop.analysis.weaknesses) weaknesses.push(...troop.analysis.weaknesses);

  const recommendation = combinedSynergy.anyApplicableHero
    ? `${troop.name} Lv${troopBaseStats.level} with the selected hero(es): +${hpBuffTotal}% HP, +${dmgBuffTotal}% damage.${(troop.analysis && troop.analysis.primaryRole === 'Tank') ? ' HP buffs are especially valuable given its Tank role.' : ''}`
    : `The selected hero(es) provide no applicable talent buff to ${troop.name}. Check findBestHeroesForTroop("${troop.name}") for heroes that actually synergize.`;

  return {
    troopBaseStats,
    heroEffects,
    effectiveStats,
    combinedSynergy,
    estimatedPerformance,
    strengths,
    weaknesses,
    recommendation
  };
}
// ---------------------------------------------------------------
// 7. COLLECTION / POWER BONUS  (kept strictly separate from talent buffs)
// ---------------------------------------------------------------

function calculateBattlePower(options = {}) {
  const result = queryEngine.calculateFinalPower(options);
  if (result === null) {
    return { error: 'Could not calculate battle power — one or more referenced troops/heroes/levels could not be resolved against gameKnowledge.js.' };
  }
  return {
    ...result,
    note: "This is the collection/power-multiplier system (army power + hero power, scaled by weapon/armor mastery % and heroCollectionBonusPct) from gameQueryEngine.calculateFinalPower(). It is a SEPARATE system from hero talent HP/Damage buffs — a 60% collection/power bonus is not the same thing as a 60% HP or damage buff. Use calculateHeroTalentEffect / analyzeTroopWithHeroes for talent buffs."
  };
}

// ---------------------------------------------------------------
// 9. RANKING HELPERS (used by answerStrategyQuery — no universal "best" formula)
// ---------------------------------------------------------------

function _rankTankCandidates(level, limit) {
  const ranked = queryEngine.getBestTroopForRole('Tank', { level, limit });
  return ranked.map(r => {
    const troop = queryEngine.getTroop(r.troopName);
    const idx = level - 1;
    return { troopId: r.troopId, troopName: r.troopName, level, scoreComponents: { hp: r.hp, defense: troop ? troop.levels.defense[idx] : null } };
  });
}

function _rankDamageCandidates(level, limit, category) {
  const ranked = queryEngine.getBestTroopForAttack({ level, limit, category });
  return ranked.map(r => {
    const troop = queryEngine.getTroop(r.troopName);
    return {
      troopId: r.troopId, troopName: r.troopName, level,
      scoreComponents: { damage: r.damage, attackSpeed: troop && troop.baseStats ? troop.baseStats.attackSpeed : null, isAoE: troop ? (troop.tags || []).includes('AoE') : null }
    };
  });
}

// ---------------------------------------------------------------
// 8. STRATEGIC QUESTION ENGINE
// ---------------------------------------------------------------

function _extractLevel(str) {
  const m = str.match(/level\s*(\d+)|lv\.?\s*(\d+)/i);
  if (!m) return null;
  const v = parseInt(m[1] || m[2], 10);
  return (v >= 1 && v <= 10) ? v : null;
}

function answerStrategyQuery(query) {
  let type = null, params = {};

  if (query && typeof query === 'object' && query.type) {
    // Preferred usage: structured input from the bot's intent layer
    type = query.type;
    params = query.params || {};
  } else if (typeof query === 'string') {
    const q = query.trim();
    const qLower = q.toLowerCase();
    let m;
    if (qLower.match(/best\s+tank/)) {
      type = 'bestTank'; params = { level: _extractLevel(q) || 10 };
    } else if ((m = qLower.match(/best\s+(\w+)\s+troop(?:\s+at\s+level\s*(\d+))?/))) {
      type = 'bestTroopInCategory'; params = { category: m[1].charAt(0).toUpperCase() + m[1].slice(1), level: m[2] ? parseInt(m[2], 10) : 10 };
    } else if ((m = q.match(/is\s+(.+?)\s+lv\.?\s*(\d+)\s+worth\s+upgrading\s+from\s+lv\.?\s*(\d+)/i))) {
      type = 'upgradeWorthIt'; params = { troopName: m[1].trim(), levelHigh: parseInt(m[2], 10), levelLow: parseInt(m[3], 10) };
    } else if ((m = qLower.match(/which\s+heroe?s?\s+increases?\s+(\w+)\s+(hp|attack|defense)/))) {
      type = 'heroesForCategoryBuff'; params = { category: m[1].charAt(0).toUpperCase() + m[1].slice(1), buffType: m[2] };
    } else if ((m = q.match(/which\s+hero\s+is\s+best\s+for\s+(.+?)\??$/i))) {
      type = 'bestHeroForTroop'; params = { troopName: m[1].trim() };
    } else if ((m = q.match(/how\s+good\s+is\s+(.+?)\s+lv\.?\s*(\d+)\s+with\s+a\s+(\d+)%\s*(hp|damage)\s*buff/i))) {
      type = 'simulateFlatBuff'; params = { troopName: m[1].trim(), level: parseInt(m[2], 10), buffPercent: parseInt(m[3], 10), statType: m[4].toLowerCase() };
    } else if ((m = qLower.match(/highest\s+damage\s+at\s+level\s*(\d+)/))) {
      type = 'highestDamageAtLevel'; params = { level: parseInt(m[1], 10) };
    } else if ((m = q.match(/(.+?)\s+vs\s+(.+)/i))) {
      // 🚀 NEW: Entity Comparison Matcher (e.g. "anavin vs trishtan")
      type = 'compareEntities'; params = { nameA: m[1].trim(), nameB: m[2].trim() };
    } else {
      type = 'unrecognized';
    }
  } else {
    type = 'unrecognized';
  }

  switch (type) {
    case 'compareEntities': {
      const res = compareEntities(params.nameA, params.nameB);
      if (res.error) {
        return { queryType: 'compareEntities', data: null, calculations: null, candidates: [], ranking: [], recommendation: null, confidence: 'low', missingInformation: [res.error] };
      }
      return {
        queryType: 'compareEntities',
        data: res,
        calculations: { methodology: 'Direct 1:1 entity extraction from gameKnowledge.js via gameQueryEngine.findEntityByName' },
        candidates: [res.entityA.name, res.entityB.name],
        ranking: [],
        recommendation: `Comparing ${res.entityA.name} and ${res.entityB.name}.`,
        confidence: 'high',
        missingInformation: []
      };
    }

    case 'bestTank': {
      const level = params.level || 10;
      const candidates = _rankTankCandidates(level, params.limit || 5);
      return {
        queryType: 'bestTank', data: { level },
        calculations: { methodology: 'Ranked by HP at the given level among troops whose analysis.primaryRole === "Tank" (gameQueryEngine.getBestTroopForRole); defense shown as a secondary component.' },
        candidates, ranking: candidates.map(c => c.troopName),
        recommendation: candidates[0] ? `${candidates[0].troopName} has the highest HP (${candidates[0].scoreComponents.hp}) among Tank-role troops at level ${level}.` : `No Tank-role troops found at level ${level}.`,
        confidence: candidates.length ? 'high' : 'low',
        missingInformation: candidates.length ? [] : ['No matching troops in gameKnowledge.js.']
      };
    }

    case 'bestTroopInCategory': {
      const level = params.level || 10;
      const resolvedCategory = _resolveCategory(params.category);
      const pool = resolvedCategory ? queryEngine.findTroops({ category: resolvedCategory }) : [];
      const idx = level - 1;
      const byHP = pool.map(t => ({ troopId: t.id, troopName: t.name, hp: t.levels.hp[idx] })).sort((a, b) => b.hp - a.hp);
      const byDamage = pool.map(t => ({ troopId: t.id, troopName: t.name, damage: t.levels.damage[idx] })).sort((a, b) => b.damage - a.damage);
      return {
        queryType: 'bestTroopInCategory', data: { categoryRequested: params.category, categoryResolved: resolvedCategory, level },
        calculations: { methodology: `No single universal "best" score is used — troops in category "${resolvedCategory || params.category}" are ranked separately by HP and by Damage at level ${level} so the choice depends on what you actually need.` },
        candidates: { byHP: byHP.slice(0, 5), byDamage: byDamage.slice(0, 5) },
        ranking: { byHP: byHP.slice(0, 5).map(c => c.troopName), byDamage: byDamage.slice(0, 5).map(c => c.troopName) },
        recommendation: (byHP[0] && byDamage[0])
          ? `For survivability: ${byHP[0].troopName} (${byHP[0].hp} HP). For offense: ${byDamage[0].troopName} (${byDamage[0].damage} damage).${byHP[0].troopName === byDamage[0].troopName ? ' Same troop leads both.' : ''}`
          : `No troops found in category "${params.category}".`,
        confidence: pool.length ? 'high' : 'low',
        missingInformation: pool.length ? [] : [resolvedCategory ? `Category resolved to "${resolvedCategory}" but no troops matched.` : `"${params.category}" doesn't match any known troop category in gameKnowledge.js (known categories: ${KNOWN_TROOP_CATEGORIES.join(', ')}).`]
      };
    }
      case 'upgradeWorthIt': {
      const cmp = compareTroopLevels(params.troopName, params.levelLow, params.levelHigh);
      if (cmp.error) {
        return { queryType: 'upgradeWorthIt', data: null, calculations: null, candidates: [], ranking: [], recommendation: null, confidence: 'low', missingInformation: [cmp.error] };
      }
      return {
        queryType: 'upgradeWorthIt',
        data: { troopName: params.troopName, levelLow: params.levelLow, levelHigh: params.levelHigh },
        calculations: cmp, candidates: [], ranking: [],
        recommendation: cmp.verdict, confidence: 'high', missingInformation: []
      };
    }

    case 'heroesForCategoryBuff': {
      const catCap = params.category.charAt(0).toUpperCase() + params.category.slice(1).toLowerCase();
      const buffCap = params.buffType.toLowerCase() === 'hp' ? 'HP' : (params.buffType.charAt(0).toUpperCase() + params.buffType.slice(1).toLowerCase());
      const indexKey = `buffs${catCap}${buffCap}`;
      const heroIds = (heroSynergyIndex && heroSynergyIndex[indexKey]) || [];
      const candidates = heroIds.map(id => {
        const h = _localFindHero(id);
        return h ? { heroId: h.id, heroName: h.name, talentName: h.talent ? h.talent.name : null, talentEffects: h.talent ? h.talent.effects : null } : { heroId: id, heroName: 'unknown' };
      });
      return {
        queryType: 'heroesForCategoryBuff',
        data: { category: params.category, buffType: params.buffType, indexKeyUsed: indexKey },
        calculations: { methodology: `Read directly from gameLibrary.heroSynergyIndex["${indexKey}"] — a curated exact list, not re-derived.` },
        candidates, ranking: candidates.map(c => c.heroName),
        recommendation: candidates.length ? `${candidates.map(c => c.heroName).join(' and ')} increase ${params.category} ${params.buffType.toUpperCase()} via their talents.` : `No heroes are indexed under "${indexKey}" in gameKnowledge.js.`,
        confidence: candidates.length ? 'high' : 'medium',
        missingInformation: candidates.length ? [] : [`No curated index entry found for "${indexKey}" in gameLibrary.heroSynergyIndex — this combination may not exist in the current hero roster.`]
      };
    }

    case 'bestHeroForTroop': {
      const result = findBestHeroesForTroop(params.troopName);
      if (result.error) {
        return { queryType: 'bestHeroForTroop', data: null, calculations: null, candidates: [], ranking: [], recommendation: null, confidence: 'low', missingInformation: [result.error] };
      }
      return {
        queryType: 'bestHeroForTroop', data: { troopName: result.troopName },
        calculations: { methodology: 'Ranked from gameKnowledge.js troopHeroSynergy (curated per-troop list), sorted by number of matched buff tags (Attack-Buff/HP-Buff/Defense-Buff/Boss-Damage/Healing/Shielding/Evasion-Buff).' },
        candidates: result.candidates, ranking: result.candidates.map(c => c.heroName),
        recommendation: result.candidates[0] ? `${result.candidates[0].heroName} is the top curated synergy pick for ${result.troopName}: ${result.candidates[0].reason}` : result.message,
        confidence: result.candidates.length ? 'high' : 'medium',
        missingInformation: result.candidates.length ? [] : [result.message]
      };
    }

    case 'simulateFlatBuff': {
      const statsAtLevel = queryEngine.getTroopLevel(params.troopName, params.level);
      if (!statsAtLevel) {
        return { queryType: 'simulateFlatBuff', data: null, calculations: null, candidates: [], ranking: [], recommendation: null, confidence: 'low', missingInformation: [`Could not resolve "${params.troopName}" at level ${params.level}.`] };
      }
      const base = params.statType === 'hp' ? statsAtLevel.hp : statsAtLevel.damage;
      const effective = Math.round(base * (1 + params.buffPercent / 100));
      return {
        queryType: 'simulateFlatBuff',
        data: { troopName: statsAtLevel.troopName, level: params.level, statType: params.statType, buffPercent: params.buffPercent },
        calculations: { base, buffPercent: params.buffPercent, effective, note: 'Manual hypothetical buff simulation (no specific hero named) — not tied to any hero talent in gameKnowledge.js.' },
        candidates: [], ranking: [],
        recommendation: `With a ${params.buffPercent}% ${params.statType.toUpperCase()} buff, ${statsAtLevel.troopName} Lv${params.level} would have ${effective} ${params.statType === 'hp' ? 'HP' : 'damage'} (base ${base}).`,
        confidence: 'high', missingInformation: []
      };
    }

    case 'highestDamageAtLevel': {
      const candidates = _rankDamageCandidates(params.level, params.limit || 5, params.category);
      return {
        queryType: 'highestDamageAtLevel', data: { level: params.level },
        calculations: { methodology: 'Ranked by damage at the given level (gameQueryEngine.getBestTroopForAttack); attack speed and AoE tag shown as secondary components.' },
        candidates, ranking: candidates.map(c => c.troopName),
        recommendation: candidates[0] ? `${candidates[0].troopName} deals the most damage (${candidates[0].scoreComponents.damage}) at level ${params.level}.` : `No troop data at level ${params.level}.`,
        confidence: candidates.length ? 'high' : 'low',
        missingInformation: []
      };
    }

    default:
      return {
        queryType: 'unrecognized', data: null, calculations: null, candidates: [], ranking: [], recommendation: null, confidence: 'low',
        missingInformation: [
          `Could not match "${typeof query === 'string' ? query : JSON.stringify(query)}" to a supported query pattern.`,
          'Supported patterns: best tank / best <category> troop [at level N] / "is X Lv.A worth upgrading from Lv.B" / which hero increases <category> hp|attack|defense / which hero is best for <troop> / how good is <troop> Lv.N with a N% hp|damage buff / what troop gives highest damage at level N / X vs Y.',
          'For reliable routing (recommended for production use), pass a structured { type, params } object instead of a free-text string.'
        ]
      };
  }
}

// ---------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------

module.exports = {
  analyzeTroopAtLevel,
  compareTroopLevels,
  analyzeTroopProgression,
  findBestHeroesForTroop,
  calculateHeroTalentEffect,
  analyzeTroopWithHeroes,
  calculateBattlePower,
  answerStrategyQuery,
  compareEntities
};
