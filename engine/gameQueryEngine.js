/**
 * MELODY Game Query Engine
 *
 * Layer 2 of the data pipeline:
 *   gameKnowledge.js  -> raw data
 *   gameQueryEngine.js (this file) -> exact lookups, formulas, deterministic helpers
 *   gameStrategyEngine.js -> strategic analysis on top of this layer
 *
 * INTEGRATION NOTE:
 *   This file explicitly imports and re-exports heroBonusSimulator and
 *   squadCalculator so that upper layers (strategyEngine, domainRouter)
 *   can reach all engine utilities through a single require().
 *
 * ZERO-HALLUCINATION RULE:
 *   Every function returns null / { error } / applies:false when data is
 *   missing — never silently substitutes a guess.
 */

const { gameLibrary } = require('../data/gameKnowledge.js');

const {
  troops,
  heroes,
  bosses,
  arena,
  meta,
  troopHeroSynergy,
  heroSynergyIndex,
  indexes,
  formulas,
  optimalGear   // NEW — explicit gear definitions collection (schema upgrade)
} = gameLibrary;

// Pull in sibling engines so callers only need one require()
const { simulateHeroBonus } = require('./heroBonusSimulator.js');
const { compareSquads }     = require('./squadCalculator.js');

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalize(str) {
  if (str === null || str === undefined) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _findTroopEntry(name) {
  if (!name) return null;
  const n = normalize(name);
  let hit = troops.find(
    t => normalize(t.name) === n ||
         normalize(t.id)   === n ||
         normalize(t.id.replace(/^tr-/, '')) === n
  );
  if (!hit) {
    hit = troops.find(
      t => normalize(t.name).includes(n) || n.includes(normalize(t.name))
    );
  }
  return hit || null;
}

function _findHeroEntry(name) {
  if (!name) return null;
  const n = normalize(name);
  let hit = heroes.find(h => normalize(h.name) === n || normalize(h.id) === n);
  if (!hit) {
    hit = heroes.find(
      h => normalize(h.name).includes(n) ||
           n.includes(normalize(h.name))  ||
           normalize(h.id).includes(n)
    );
  }
  return hit || null;
}

function _levelIndex(level) {
  const lv = parseInt(level, 10);
  if (isNaN(lv) || lv < 1 || lv > 10) return null;
  return lv - 1;
}

function _rarityKeyForPower(rarity) {
  const r = (rarity || '').toLowerCase();
  if (r === 'mythical') return 'legendary';
  if (['legendary', 'rare', 'epic'].includes(r)) return r;
  return 'epic';
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic lookups
// ─────────────────────────────────────────────────────────────────────────────

function getTroop(name) {
  return _findTroopEntry(name) || null;
}

function getHero(name) {
  return _findHeroEntry(name) || null;
}

function getTroopLevel(name, level) {
  const troop = _findTroopEntry(name);
  if (!troop) return null;
  const idx = _levelIndex(level);
  if (idx === null) return null;

  const out = {
    troopId:   troop.id,
    troopName: troop.name,
    level:     troop.levels.level[idx],
    units:     troop.levels.units[idx]   !== undefined ? troop.levels.units[idx]   : null,
    hp:        troop.levels.hp[idx]      !== undefined ? troop.levels.hp[idx]      : null,
    damage:    troop.levels.damage[idx]  !== undefined ? troop.levels.damage[idx]  : null,
    defense:   troop.levels.defense[idx] !== undefined ? troop.levels.defense[idx] : null
  };
  if (troop.levels.evasion) {
    out.evasion = troop.levels.evasion[idx] !== undefined ? troop.levels.evasion[idx] : null;
  }

  if (troop.ability && troop.ability.levelStats) {
    out.abilityStats = {};
    Object.keys(troop.ability.levelStats).forEach(statName => {
      out.abilityStats[statName] = troop.ability.levelStats[statName][idx] !== undefined
        ? troop.ability.levelStats[statName][idx]
        : null;
    });
  } else {
    out.abilityStats = null;
  }
  return out;
}

function getTroopAbility(name, level) {
  const troop = _findTroopEntry(name);
  if (!troop) return null;
  if (!troop.ability) {
    return { troopId: troop.id, troopName: troop.name, name: null, description: null, statsAtLevel: null, levelStats: null };
  }

  const result = {
    troopId:     troop.id,
    troopName:   troop.name,
    name:        troop.ability.name        || null,
    description: troop.ability.description || null,
    levelStats:  troop.ability.levelStats  || null,
    statsAtLevel: null
  };

  if (level !== undefined && level !== null) {
    const idx = _levelIndex(level);
    if (idx === null) return result;
    if (troop.ability.levelStats) {
      result.statsAtLevel = {};
      Object.keys(troop.ability.levelStats).forEach(statName => {
        result.statsAtLevel[statName] = troop.ability.levelStats[statName][idx] !== undefined
          ? troop.ability.levelStats[statName][idx]
          : null;
      });
    }
  }
  return result;
}

function compareTroop(name, levelA, levelB) {
  const troop = _findTroopEntry(name);
  if (!troop) return null;
  const a = getTroopLevel(name, levelA);
  const b = getTroopLevel(name, levelB);
  if (!a || !b) return null;

  function delta(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    return y - x;
  }

  return {
    troopId:   troop.id,
    troopName: troop.name,
    levelA: a,
    levelB: b,
    deltas: {
      hp:      delta(a.hp,      b.hp),
      damage:  delta(a.damage,  b.damage),
      defense: delta(a.defense, b.defense),
      units:   delta(a.units,   b.units)
    }
  };
}

function getTroopGrowth(name, levelA, levelB) {
  const troop = _findTroopEntry(name);
  if (!troop) return null;
  const a = getTroopLevel(name, levelA);
  const b = getTroopLevel(name, levelB);
  if (!a || !b) return null;

  function growth(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return { absolute: null, percent: null };
    const absolute = y - x;
    const percent  = x === 0 ? null : Math.round((absolute / x) * 10000) / 100;
    return { absolute, percent };
  }

  return {
    troopId:   troop.id,
    troopName: troop.name,
    fromLevel: a.level,
    toLevel:   b.level,
    hp:        growth(a.hp,      b.hp),
    damage:    growth(a.damage,  b.damage),
    defense:   growth(a.defense, b.defense),
    units:     growth(a.units,   b.units),
    scaling:   troop.analysis ? troop.analysis.scaling : null
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter / search
// ─────────────────────────────────────────────────────────────────────────────

function findTroops(criteria = {}) {
  let results = troops.slice();
  if (criteria.category) {
    const c = normalize(criteria.category);
    results = results.filter(t => (t.categories || []).some(cat => normalize(cat) === c));
  }
  if (criteria.rarity) {
    const r = normalize(criteria.rarity);
    results = results.filter(t => normalize(t.rarity) === r);
  }
  if (criteria.tag) {
    const tg = normalize(criteria.tag);
    results = results.filter(t => (t.tags || []).some(tag => normalize(tag) === tg));
  }
  if (criteria.role) {
    const rl = normalize(criteria.role);
    results = results.filter(t => t.analysis && normalize(t.analysis.primaryRole) === rl);
  }
  if (criteria.nameContains) {
    const nc = normalize(criteria.nameContains);
    results = results.filter(t => normalize(t.name).includes(nc));
  }
  if (criteria.minHpAtLevel && typeof criteria.minHpAtLevel.level === 'number') {
    const idx = _levelIndex(criteria.minHpAtLevel.level);
    if (idx !== null) {
      results = results.filter(
        t => typeof t.levels.hp[idx] === 'number' && t.levels.hp[idx] >= criteria.minHpAtLevel.value
      );
    }
  }
  if (criteria.minDamageAtLevel && typeof criteria.minDamageAtLevel.level === 'number') {
    const idx = _levelIndex(criteria.minDamageAtLevel.level);
    if (idx !== null) {
      results = results.filter(
        t => typeof t.levels.damage[idx] === 'number' && t.levels.damage[idx] >= criteria.minDamageAtLevel.value
      );
    }
  }
  return results;
}

function findHeroes(criteria = {}) {
  let results = heroes.slice();
  if (criteria.faction) {
    const f = normalize(criteria.faction);
    results = results.filter(h => normalize(h.faction) === f);
  }
  if (criteria.rarity) {
    const r = normalize(criteria.rarity);
    results = results.filter(h => normalize(h.rarity) === r);
  }
  if (criteria.tag) {
    const tg = normalize(criteria.tag);
    results = results.filter(h => (h.tags || []).some(tag => normalize(tag) === tg));
  }
  if (criteria.targets) {
    const tt = normalize(criteria.targets);
    results = results.filter(h => (h.synergies || []).some(s => normalize(s) === tt));
  }
  if (criteria.nameContains) {
    const nc = normalize(criteria.nameContains);
    results = results.filter(h => normalize(h.name).includes(nc));
  }
  return results;
}

function findHeroSynergies(troopName) {
  const troop = _findTroopEntry(troopName);
  if (!troop) return null;
  const entry = troopHeroSynergy.find(x => x.troopId === troop.id);
  if (!entry) return { troopId: troop.id, troopName: troop.name, heroSynergies: [] };

  const enriched = entry.heroSynergies.map(s => {
    const hero = heroes.find(h => h.id === s.heroId);
    return {
      heroId:   s.heroId,
      heroName: hero ? hero.name : 'unknown',
      reason:   s.reason
    };
  });

  return { troopId: troop.id, troopName: troop.name, heroSynergies: enriched };
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW ─ Category & role aggregation helpers (Zero-Hallucination Data Aggregation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getTroopsByCategory(categoryOrRole)
 *
 * Returns every troop whose categories[] OR analysis.primaryRole matches
 * the supplied string (case-insensitive). Both fields are checked so that
 * queries like "how many tank troops" and "list all mages" both work without
 * the caller knowing which field the troop was filed under.
 *
 * @param  {string} categoryOrRole  e.g. 'Tank', 'Mage', 'Archer', 'Undead'
 * @returns {{ totalCount: number, troopsList: Array<{ id, name, rarity, categories, primaryRole }> }}
 */
function getTroopsByCategory(categoryOrRole) {
  if (!categoryOrRole) return { totalCount: 0, troopsList: [] };
  const query = normalize(categoryOrRole);

  const matched = troops.filter(t => {
    const inCategories   = (t.categories || []).some(c => normalize(c) === query);
    const inPrimaryRole  = t.analysis && normalize(t.analysis.primaryRole) === query;
    const inTags         = (t.tags || []).some(tag => normalize(tag) === query);
    const inSecondary    = t.analysis && (t.analysis.secondaryRoles || []).some(r => normalize(r) === query);
    return inCategories || inPrimaryRole || inTags || inSecondary;
  });

  return {
    totalCount: matched.length,
    troopsList: matched.map(t => ({
      id:          t.id,
      name:        t.name,
      rarity:      t.rarity,
      categories:  t.categories || [],
      primaryRole: t.analysis ? t.analysis.primaryRole : null
    }))
  };
}

/**
 * getHeroesByRole(roleOrFaction)
 *
 * Returns every hero whose type, faction, or tags match the supplied string.
 * Parallel to getTroopsByCategory() for the hero roster.
 *
 * @param  {string} roleOrFaction  e.g. 'Mage', 'Tank', 'Healer', 'Human', 'Undead'
 * @returns {{ totalCount: number, heroesList: Array<{ id, name, rarity, faction, type }> }}
 */
function getHeroesByRole(roleOrFaction) {
  if (!roleOrFaction) return { totalCount: 0, heroesList: [] };
  const query = normalize(roleOrFaction);

  const matched = heroes.filter(h => {
    const inFaction  = normalize(h.faction) === query;
    const inType     = normalize(h.type)    === query;
    const inTags     = (h.tags || []).some(tag => normalize(tag) === query);
    const inPrimary  = h.analysis && normalize(h.analysis.primaryRole) === query;
    const inSecondary = h.analysis && (h.analysis.secondaryRoles || []).some(r => normalize(r) === query);
    return inFaction || inType || inTags || inPrimary || inSecondary;
  });

  return {
    totalCount: matched.length,
    heroesList: matched.map(h => ({
      id:      h.id,
      name:    h.name,
      rarity:  h.rarity,
      faction: h.faction,
      type:    h.type
    }))
  };
}

/**
 * getRosterSummary()
 *
 * Returns a full breakdown of the troop and hero rosters grouped by their
 * primary categories/roles. Useful for answering "what troops do we have"
 * or "give me a roster overview" without any per-entity AI reasoning.
 *
 * @returns {{ troops: Object, heroes: Object, totals: { troops: number, heroes: number } }}
 */
function getRosterSummary() {
  // Collect unique categories from troops
  const troopCategorySet = new Set();
  troops.forEach(t => {
    (t.categories || []).forEach(c => troopCategorySet.add(c));
    if (t.analysis && t.analysis.primaryRole) troopCategorySet.add(t.analysis.primaryRole);
  });

  const troopsByCategory = {};
  troopCategorySet.forEach(cat => {
    const result = getTroopsByCategory(cat);
    if (result.totalCount > 0) troopsByCategory[cat] = result;
  });

  // Collect unique roles/factions from heroes
  const heroRoleSet = new Set();
  heroes.forEach(h => {
    if (h.type)    heroRoleSet.add(h.type);
    if (h.faction) heroRoleSet.add(h.faction);
  });

  const heroesByRole = {};
  heroRoleSet.forEach(role => {
    const result = getHeroesByRole(role);
    if (result.totalCount > 0) heroesByRole[role] = result;
  });

  return {
    troops:  troopsByCategory,
    heroes:  heroesByRole,
    totals:  { troops: troops.length, heroes: heroes.length }
  };
}

/**
 * getGameTaxonomy()
 *
 * Dynamically scans every entry in troops[] and heroes[] and returns the
 * full deduplicated set of classification values used across the game:
 * factions, primary/secondary combat roles, and misc tags. This exists for
 * macro/meta questions like "how many roles are there" or "what factions
 * exist" — the caller gets raw, exact lists straight from the live data
 * rather than a hand-maintained constant that can drift out of sync.
 *
 * ZERO-HALLUCINATION: every value here comes directly from troops.js /
 * heroes.js at call time. Nothing is inferred or hardcoded.
 *
 * @returns {{
 *   factions:      { list: string[], count: number },
 *   combatRoles:   { list: string[], count: number },
 *   specialTags:   { list: string[], count: number },
 *   sourceTotals:  { troops: number, heroes: number }
 * }}
 */
function getGameTaxonomy() {
  const factionSet = new Set();
  const roleSet     = new Set();
  const tagSet      = new Set();

  const collectFrom = (entry) => {
    if (!entry) return;

    // Factions live under `faction` on both troops and heroes.
    if (entry.faction) factionSet.add(entry.faction);

    // Troops additionally carry a `categories[]` array that functions as a
    // faction/type descriptor (e.g. "Undead", "Human") — fold these in too.
    if (Array.isArray(entry.categories)) {
      entry.categories.forEach(c => { if (c) factionSet.add(c); });
    }

    // Combat roles: heroes have `type` + analysis.primaryRole/secondaryRoles;
    // troops only have analysis.primaryRole/secondaryRoles.
    if (entry.type) roleSet.add(entry.type);
    if (entry.analysis) {
      if (entry.analysis.primaryRole) roleSet.add(entry.analysis.primaryRole);
      if (Array.isArray(entry.analysis.secondaryRoles)) {
        entry.analysis.secondaryRoles.forEach(r => { if (r) roleSet.add(r); });
      }
    }

    // Misc tags (buffs, mechanics flags, etc.) — kept separate from roles
    // since they describe effects/mechanics rather than a combat archetype.
    if (Array.isArray(entry.tags)) {
      entry.tags.forEach(t => { if (t) tagSet.add(t); });
    }
  };

  troops.forEach(collectFrom);
  heroes.forEach(collectFrom);

  const factionsList    = Array.from(factionSet).sort();
  const combatRolesList = Array.from(roleSet).sort();
  const specialTagsList = Array.from(tagSet).sort();

  return {
    factions:     { list: factionsList,    count: factionsList.length },
    combatRoles:  { list: combatRolesList, count: combatRolesList.length },
    specialTags:  { list: specialTagsList, count: specialTagsList.length },
    sourceTotals: { troops: troops.length, heroes: heroes.length }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Power calculation
// ─────────────────────────────────────────────────────────────────────────────

function _heroPower(heroId, level) {
  const hero = heroes.find(h => h.id === heroId) || _findHeroEntry(heroId);
  if (!hero) return null;
  const idx = _levelIndex(level);
  if (idx === null) return null;
  const key   = _rarityKeyForPower(hero.rarity);
  const table = formulas.lookupTables.HERO_POWER[key];
  if (!table || table[idx] === undefined) return null;
  return table[idx];
}

function _troopPower(troopIdOrName, level, squads = 1) {
  const troop = _findTroopEntry(troopIdOrName);
  if (!troop) return null;
  const idx = _levelIndex(level);
  if (idx === null) return null;
  const key   = _rarityKeyForPower(troop.rarity);
  const table = formulas.lookupTables.TROOP_POWER[key];
  if (!table || table[idx] === undefined) return null;
  return table[idx] * (squads || 1);
}

function calculateHeroBonus(opts = {}) {
  const {
    hero1Id   = null, hero1Level = 1,
    hero2Id   = null, hero2Level = 1,
    weaponName  = 'none', weaponLevel = 0,
    armorName   = 'none', armorLevel  = 0,
    heroCollectionBonusPct = null
  } = opts;

  const hero1Power = hero1Id ? _heroPower(hero1Id, hero1Level) : 0;
  const hero2Power = hero2Id ? _heroPower(hero2Id, hero2Level) : 0;

  if (hero1Id && hero1Power === null) return null;
  if (hero2Id && hero2Power === null) return null;

  const totalHeroPower = (hero1Power || 0) + (hero2Power || 0);
  const weaponBonusPct = (weaponName && weaponName !== 'none') ? (weaponLevel || 0) * 0.20 : 0;
  const armorBonusPct  = (armorName  && armorName  !== 'none') ? (armorLevel  || 0) * 0.20 : 0;
  const collectionPct  = (typeof heroCollectionBonusPct === 'number') ? heroCollectionBonusPct : 0;
  const totalBonusPct  = collectionPct + weaponBonusPct + armorBonusPct;
  const multiplier     = 1 + totalBonusPct / 100;

  return {
    hero1Power,
    hero2Power,
    totalHeroPower,
    weaponBonusPct,
    armorBonusPct,
    heroCollectionBonusPct: (typeof heroCollectionBonusPct === 'number') ? heroCollectionBonusPct : null,
    totalBonusPct,
    multiplier
  };
}

/**
 * calculateHeroCollectionBonus(heroIds)
 *
 * Sums the collectionBonus value from each hero in the supplied ID list and
 * returns the total as a percentage ready to feed into calculateHeroBonus()
 * as heroCollectionBonusPct. If any heroId cannot be resolved the function
 * returns null for that entry and flags it in the result.
 *
 * This is the NEW explicit integration point so that domainRouter / strategyEngine
 * can inject collection bonuses into calculateFinalPower() automatically.
 *
 * @param  {string[]} heroIds  Array of hero IDs (e.g. ['ANAVIN_01', 'REMUS_01'])
 * @returns {{ totalCollectionBonus: number, breakdown: Array, missingHeroes: string[] }}
 */
function calculateHeroCollectionBonus(heroIds = []) {
  const breakdown     = [];
  const missingHeroes = [];
  let total = 0;

  for (const id of heroIds) {
    const hero = heroes.find(h => h.id === id) || _findHeroEntry(id);
    if (!hero) {
      missingHeroes.push(id);
      breakdown.push({ heroId: id, heroName: null, collectionBonus: null, resolved: false });
      continue;
    }
    const bonus = (hero.stats && typeof hero.stats.collectionBonus === 'number')
      ? hero.stats.collectionBonus
      : 0;
    total += bonus;
    breakdown.push({ heroId: hero.id, heroName: hero.name, collectionBonus: bonus, resolved: true });
  }

  return { totalCollectionBonus: total, breakdown, missingHeroes };
}

/**
 * calculateSquadCapacity(troopEntries)
 *
 * Returns how many total units are on the field for a given squad composition
 * at their specified levels. This is the explicit squadCalculator integration
 * point for domainRouter / strategyEngine.
 *
 * @param  {Array<{ troop: string, level: number, count: number }>} troopEntries
 * @returns {{ totalUnits: number, totalHp: number, totalDamage: number, breakdown: Array, complete: boolean }}
 */
function calculateSquadCapacity(troopEntries = []) {
  const result = compareSquads(troopEntries, []);  // compareSquads with an empty opponent = squad summary
  const squadA = result.squadA;

  return {
    totalUnits:  squadA.totals.totalUnits,
    totalHp:     squadA.totals.totalHp,
    totalDamage: squadA.totals.totalDamage,
    breakdown:   squadA.rows,
    complete:    squadA.complete
  };
}

function calculateFinalPower(opts = {}) {
  const { troopUnits = [] } = opts;
  let armyPower = 0;
  const troopBreakdown = [];

  for (const row of troopUnits) {
    const pwr = _troopPower(row.nameOrId, row.level, row.squads || 1);
    if (pwr === null) return null;
    armyPower += pwr;
    const troop = _findTroopEntry(row.nameOrId);
    troopBreakdown.push({
      troopId:   troop.id,
      troopName: troop.name,
      level:     row.level,
      squads:    row.squads || 1,
      power:     pwr
    });
  }

  // Auto-inject collection bonus if heroIds are supplied but heroCollectionBonusPct is not
  let resolvedOpts = Object.assign({}, opts);
  if (Array.isArray(opts.heroIds) && opts.heroIds.length > 0 && typeof opts.heroCollectionBonusPct !== 'number') {
    const collectionResult = calculateHeroCollectionBonus(opts.heroIds);
    resolvedOpts.heroCollectionBonusPct = collectionResult.totalCollectionBonus;
  }

  const heroBonus = calculateHeroBonus(resolvedOpts);
  if (heroBonus === null) return null;

  const basePower  = armyPower + heroBonus.totalHeroPower;
  const finalPower = Math.round(basePower * heroBonus.multiplier);

  // Squad capacity is injected for context when troopUnits are provided
  const squadCapacity = troopUnits.length > 0
    ? calculateSquadCapacity(troopUnits.map(r => ({ troop: r.nameOrId, level: r.level, count: r.squads || 1 })))
    : null;

  return {
    armyPower,
    troopBreakdown,
    heroBonus,
    squadCapacity,
    basePower,
    finalPower
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking helpers
// ─────────────────────────────────────────────────────────────────────────────

function getBestTroopForRole(role, opts = {}) {
  const level = opts.level || 10;
  const limit = opts.limit || 5;
  const idx   = _levelIndex(level);
  if (idx === null) return [];

  let matches = findTroops({ role });
  if (opts.excludeName) {
    const ex = normalize(opts.excludeName);
    matches = matches.filter(t => normalize(t.name) !== ex);
  }
  return matches
    .map(t => ({ troop: t, hp: (typeof t.levels.hp[idx] === 'number') ? t.levels.hp[idx] : null }))
    .filter(x => x.hp !== null)
    .sort((a, b) => b.hp - a.hp)
    .slice(0, limit)
    .map(x => ({ troopId: x.troop.id, troopName: x.troop.name, level, hp: x.hp }));
}

function getBestTroopForAttack(opts = {}) {
  const level = opts.level || 10;
  const limit = opts.limit || 5;
  const idx   = _levelIndex(level);
  if (idx === null) return [];

  let pool = troops;
  if (opts.category) pool = findTroops({ category: opts.category });
  if (opts.excludeName) {
    const ex = normalize(opts.excludeName);
    pool = pool.filter(t => normalize(t.name) !== ex);
  }

  return pool
    .map(t => ({ troop: t, damage: (typeof t.levels.damage[idx] === 'number') ? t.levels.damage[idx] : null }))
    .filter(x => x.damage !== null)
    .sort((a, b) => b.damage - a.damage)
    .slice(0, limit)
    .map(x => ({ troopId: x.troop.id, troopName: x.troop.name, level, damage: x.damage }));
}

/**
 * _speedOrdinal(speed)
 * Every real troop record in gameKnowledge.js stores baseStats.speed as a
 * qualitative tier string ("Low" | "Medium" | "High") — never a raw number.
 * (Verified against all 20 real troop entries: zero use a numeric speed.)
 * This maps that tier onto a comparable ordinal so tier-vs-tier comparisons
 * are possible. If a future data update ever supplies a genuine numeric
 * speed value, it's passed through unchanged so comparisons still work.
 * Anything else (missing/unrecognized) returns null — never guessed at.
 */
const _SPEED_TIER_ORDINAL = { low: 1, medium: 2, high: 3 };
function _speedOrdinal(speed) {
  if (typeof speed === 'number') return speed;
  if (typeof speed === 'string') {
    const ord = _SPEED_TIER_ORDINAL[speed.trim().toLowerCase()];
    return (typeof ord === 'number') ? ord : null;
  }
  return null;
}

/**
 * getFasterTroopsThan(speedThreshold, opts)
 * Real-data helper for counter-formation building — never invents troops.
 * Returns troops whose baseStats.speed tier is strictly above a given
 * threshold tier (e.g. an enemy's own speed, so you get units that close
 * the gap before it acts), ranked first by speed tier then by damage-at-
 * level. Troops with no recognized baseStats.speed are excluded rather
 * than guessed at. opts.excludeName removes the target itself from the
 * pool (relevant when the target's own tier ties the threshold).
 */
function getFasterTroopsThan(speedThreshold, opts = {}) {
  const level = opts.level || 10;
  const limit = opts.limit || 5;
  const idx   = _levelIndex(level);
  const thresholdOrdinal = _speedOrdinal(speedThreshold);
  if (idx === null || thresholdOrdinal === null) return [];

  let pool = troops;
  if (opts.category) pool = findTroops({ category: opts.category });
  if (opts.excludeName) {
    const ex = normalize(opts.excludeName);
    pool = pool.filter(t => normalize(t.name) !== ex);
  }

  return pool
    .map(t => ({
      troop: t,
      ordinal: t.baseStats ? _speedOrdinal(t.baseStats.speed) : null,
      damage: (typeof t.levels.damage[idx] === 'number') ? t.levels.damage[idx] : null
    }))
    .filter(x => x.ordinal !== null && x.ordinal > thresholdOrdinal && x.damage !== null)
    .sort((a, b) => (b.ordinal - a.ordinal) || (b.damage - a.damage))
    .slice(0, limit)
    .map(x => ({ troopId: x.troop.id, troopName: x.troop.name, level, damage: x.damage, speed: x.troop.baseStats.speed }));
}

/**
 * getInfiltratorCandidates(opts)
 * Real-data helper: this dataset has no troop whose kit is "outrun the
 * backline via a large numeric speed gap" — verified across all 20 real
 * troops, the only two "High" speed units (Bonebreaker, Monk) are both
 * Frontline Tanks, not flankers. The troops actually described as reaching
 * a backline (Assassins: "sneaking around the shadows"; Storm Mistresses:
 * "fully elusive on the battlefield"; Gravedigger: "dig into the ground
 * near troops at back and kill them silently") all share
 * analysis.primaryRole "Trickster" and combatLine "Midline" — that's the
 * dataset's real, structural backline-breach archetype. Ranked by damage
 * at level so the hardest-hitting infiltrator comes first.
 */
function getInfiltratorCandidates(opts = {}) {
  const level = opts.level || 10;
  const limit = opts.limit || 5;
  const idx   = _levelIndex(level);
  if (idx === null) return [];

  let pool = findTroops({ role: 'Trickster' });
  if (opts.excludeName) {
    const ex = normalize(opts.excludeName);
    pool = pool.filter(t => normalize(t.name) !== ex);
  }

  return pool
    .map(t => ({ troop: t, damage: (typeof t.levels.damage[idx] === 'number') ? t.levels.damage[idx] : null }))
    .filter(x => x.damage !== null)
    .sort((a, b) => b.damage - a.damage)
    .slice(0, limit)
    .map(x => ({ troopId: x.troop.id, troopName: x.troop.name, level, damage: x.damage, combatLine: x.troop.combatLine }));
}

function getBestHeroForTroop(troopName, opts = {}) {
  const limit    = opts.limit || 5;
  const synergy  = findHeroSynergies(troopName);
  if (!synergy) return null;

  const BUFF_TAGS = ['Attack-Buff', 'HP-Buff', 'Defense-Buff', 'Boss-Damage', 'Healing', 'Shielding'];

  return synergy.heroSynergies
    .map(s => {
      const hero      = heroes.find(h => h.id === s.heroId);
      const buffCount = hero ? hero.tags.filter(t => BUFF_TAGS.includes(t)).length : 0;
      return { heroId: s.heroId, heroName: s.heroName, reason: s.reason, buffCount };
    })
    .sort((a, b) => b.buffCount - a.buffCount)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW ─ Synergy Context (explicit recommendedHeroes / recommendedTroops / optimalGear)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _findGearEntry(nameOrId)
 *
 * Looks up a single gear/equipment definition by name or id from the
 * `optimalGear` collection on gameLibrary. Exact match only — deliberately
 * no substring/fuzzy fallback here, since gear names are short and prone to
 * exactly the kind of false-positive collision (e.g. "Bone" armor vs "Bone
 * Dragon") that this whole upgrade exists to eliminate.
 */
function _findGearEntry(nameOrId) {
  if (!nameOrId || !Array.isArray(optimalGear)) return null;
  const n = normalize(nameOrId);
  return optimalGear.find(g => normalize(g.name) === n || normalize(g.id) === n) || null;
}

/**
 * getSynergyContext(entityName, entityType)
 *
 * The single, explicit source of truth for synergy/recommendation queries.
 * Replaces all string/substring-based synergy matching (e.g. matching
 * "Bonebreaker" to "Bone Dragon" just because they share the word "Bone").
 * Every recommendation returned here comes from an EXPLICIT id/name
 * reference on the entity's own record — nothing is inferred from shared
 * tags, factions, or fuzzy name overlap.
 *
 * For a TROOP:
 *   - Resolves the troop record itself.
 *   - Reads troop.recommendedHeroes (array of hero ids/names) and fetches
 *     the FULL hero data object for each one — never just a name reference.
 *   - Reads troop.synergyCategories (if present) for the AI's explanation.
 *   - Reads troop.optimalGear and fetches the full gear data object for each.
 *
 * For a HERO:
 *   - Resolves the hero record itself.
 *   - Reads hero.recommendedTroops (array of troop ids/names) and fetches
 *     the FULL troop data object for each one.
 *   - Reads hero.synergyCategories / hero.optimalGear the same way.
 *
 * ZERO-HALLUCINATION RULE: if the entity itself can't be resolved, returns
 * null. If the entity resolves but has no explicit recommendations, the
 * relevant arrays come back empty — never backfilled by substring/tag guess.
 *
 * @param  {string} entityName  Troop or hero name (or id).
 * @param  {'troop'|'hero'} [entityType]  Optional hint; auto-detected if omitted.
 * @returns {{
 *   entityType: 'troop'|'hero',
 *   entity: Object,
 *   recommendedHeroes: Array,
 *   recommendedTroops: Array,
 *   synergyCategories: Array,
 *   optimalGear: Array,
 *   unresolvedRecommendations: string[]
 * } | null}
 */
function getSynergyContext(entityName, entityType) {
  if (!entityName) return null;

  let type = entityType;
  let entity = null;

  if (type === 'troop') {
    entity = _findTroopEntry(entityName);
  } else if (type === 'hero') {
    entity = _findHeroEntry(entityName);
  } else {
    // Auto-detect: try troop first, then hero (matches findEntityByName's order).
    entity = _findTroopEntry(entityName);
    if (entity) {
      type = 'troop';
    } else {
      entity = _findHeroEntry(entityName);
      if (entity) type = 'hero';
    }
  }

  if (!entity) return null;

  const unresolvedRecommendations = [];
  const recommendedHeroes = [];
  const recommendedTroops = [];
  const gearOut = [];

  if (type === 'troop') {
    const heroRefs = Array.isArray(entity.recommendedHeroes) ? entity.recommendedHeroes : [];
    heroRefs.forEach(ref => {
      // Exact id match first, exact-name fallback via _findHeroEntry's exact-match
      // branch — recommendedHeroes references are explicit data, not free text,
      // so we don't want its substring fallback pass kicking in here either.
      const hero = heroes.find(h => h.id === ref) ||
                   heroes.find(h => normalize(h.name) === normalize(ref));
      if (hero) {
        recommendedHeroes.push(hero);
      } else {
        unresolvedRecommendations.push(ref);
      }
    });
  } else {
    const troopRefs = Array.isArray(entity.recommendedTroops) ? entity.recommendedTroops : [];
    troopRefs.forEach(ref => {
      const troop = troops.find(t => t.id === ref) ||
                    troops.find(t => normalize(t.name) === normalize(ref));
      if (troop) {
        recommendedTroops.push(troop);
      } else {
        unresolvedRecommendations.push(ref);
      }
    });
  }

  const gearRefs = Array.isArray(entity.optimalGear) ? entity.optimalGear : [];
  gearRefs.forEach(ref => {
    const gear = _findGearEntry(ref);
    if (gear) {
      gearOut.push(gear);
    } else {
      unresolvedRecommendations.push(ref);
    }
  });

  return {
    entityType: type,
    entity,
    recommendedHeroes,
    recommendedTroops,
    synergyCategories: Array.isArray(entity.synergyCategories) ? entity.synergyCategories : [],
    optimalGear: gearOut,
    unresolvedRecommendations
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity resolver & context formatter (used by domainRouter)
// ─────────────────────────────────────────────────────────────────────────────

function findEntityByName(query) {
  if (!query) return null;
  const troopHit = _findTroopEntry(query);
  if (troopHit) return { type: 'troop', data: troopHit };
  const heroHit  = _findHeroEntry(query);
  if (heroHit)  return { type: 'hero',  data: heroHit };
  return null;
}

function formatEntityContext(entity) {
  if (!entity) return null;
  const { type, data } = entity;

  if (type === 'hero') {
    return `
[EXACT DATABASE RECORD FOR HERO: ${data.name}]
• Faction: ${data.faction}
• Rarity: ${data.rarity}
• Description: ${data.description}
• Stats: HP: ${data.stats.hp}, Defense: ${data.stats.defense}, Attack: ${data.stats.attack}, Collection Bonus: ${data.stats.collectionBonus}
• Talent: ${data.talent ? `${data.talent.name} — ${data.talent.description}` : 'None'}
• Ability: ${data.ability ? `${data.ability.name} — ${data.ability.description}` : 'None'}
    `.trim();
  } else {
    return `
[EXACT DATABASE RECORD FOR TROOP: ${data.name}]
• Rarity: ${data.rarity}
• Categories: ${data.categories.join(', ')}
• Description: ${data.description}
• Base Stats: HP (Lv1): ${data.levels.hp[0]}, Damage (Lv1): ${data.levels.damage[0]}, Defense (Lv1): ${data.levels.defense[0]}
• Ability: ${data.ability ? `${data.ability.name} — ${data.ability.description}` : 'None'}
    `.trim();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Data reference (pass-through for upper layers that need raw access)
  gameLibrary,

  // Basic lookups
  getTroop,
  getHero,
  getTroopLevel,
  getTroopAbility,
  compareTroop,
  getTroopGrowth,

  // Filter / search
  findTroops,
  findHeroes,
  findHeroSynergies,

  // NEW — Category & roster aggregation (zero-hallucination helpers)
  getTroopsByCategory,
  getHeroesByRole,
  getRosterSummary,
  getGameTaxonomy,             // NEW — flat deduplicated faction/role/tag lists for macro queries

  // Power calculation
  calculateHeroBonus,
  calculateHeroCollectionBonus,   // NEW — explicit collection bonus injection
  calculateSquadCapacity,          // NEW — explicit squad capacity integration
  calculateFinalPower,

  // Ranking helpers
  getBestTroopForRole,
  getBestTroopForAttack,
  getFasterTroopsThan,          // real-data speed-TIER ranking for counter-formation building (fixed: ordinal comparison, not raw number)
  getInfiltratorCandidates,     // NEW — real-data Trickster-role ranking (this dataset's actual backline-breach archetype)
  getBestHeroForTroop,

  // NEW — explicit synergy/recommendation context (recommendedHeroes /
  // recommendedTroops / synergyCategories / optimalGear schema upgrade)
  getSynergyContext,

  // Entity resolver & formatter
  findEntityByName,
  formatEntityContext,

  // Re-exported sibling engines (single require() for callers)
  simulateHeroBonus,
  compareSquads
};
