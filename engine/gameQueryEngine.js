/**
 * MELODY Game Query Engine
 */

const { gameLibrary } = require('../data/gameKnowledge.js');

const { troops, heroes, bosses, arena, meta, troopHeroSynergy, heroSynergyIndex, indexes, formulas } = gameLibrary;

function normalize(str) {
  if (str === null || str === undefined) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _findTroopEntry(name) {
  if (!name) return null;
  const n = normalize(name);
  let hit = troops.find(t => normalize(t.name) === n || normalize(t.id) === n || normalize(t.id.replace(/^tr-/, '')) === n);
  if (!hit) {
    hit = troops.find(t => normalize(t.name).includes(n) || n.includes(normalize(t.name)));
  }
  return hit || null;
}

function _findHeroEntry(name) {
  if (!name) return null;
  const n = normalize(name);
  let hit = heroes.find(h => normalize(h.name) === n || normalize(h.id) === n);
  if (!hit) {
    hit = heroes.find(h => normalize(h.name).includes(n) || n.includes(normalize(h.name)) || normalize(h.id).includes(n));
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

function getTroop(name) {
  return _findTroopEntry(name) || null;
}

// 🚀 NEW: Exported getHero function
function getHero(name) {
  return _findHeroEntry(name) || null;
}

function getTroopLevel(name, level) {
  const troop = _findTroopEntry(name);
  if (!troop) return null;
  const idx = _levelIndex(level);
  if (idx === null) return null;

  const out = {
    troopId: troop.id,
    troopName: troop.name,
    level: troop.levels.level[idx],
    units: troop.levels.units[idx] !== undefined ? troop.levels.units[idx] : null,
    hp: troop.levels.hp[idx] !== undefined ? troop.levels.hp[idx] : null,
    damage: troop.levels.damage[idx] !== undefined ? troop.levels.damage[idx] : null,
    defense: troop.levels.defense[idx] !== undefined ? troop.levels.defense[idx] : null
  };
  if (troop.levels.evasion) out.evasion = troop.levels.evasion[idx] !== undefined ? troop.levels.evasion[idx] : null;

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
    troopId: troop.id,
    troopName: troop.name,
    name: troop.ability.name || null,
    description: troop.ability.description || null,
    levelStats: troop.ability.levelStats || null,
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
    troopId: troop.id,
    troopName: troop.name,
    levelA: a,
    levelB: b,
    deltas: {
      hp: delta(a.hp, b.hp),
      damage: delta(a.damage, b.damage),
      defense: delta(a.defense, b.defense),
      units: delta(a.units, b.units)
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
    const percent = x === 0 ? null : Math.round((absolute / x) * 10000) / 100; 
    return { absolute, percent };
  }

  return {
    troopId: troop.id,
    troopName: troop.name,
    fromLevel: a.level,
    toLevel: b.level,
    hp: growth(a.hp, b.hp),
    damage: growth(a.damage, b.damage),
    defense: growth(a.defense, b.defense),
    units: growth(a.units, b.units),
    scaling: troop.analysis ? troop.analysis.scaling : null
  };
}

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
      results = results.filter(t => typeof t.levels.hp[idx] === 'number' && t.levels.hp[idx] >= criteria.minHpAtLevel.value);
    }
  }
  if (criteria.minDamageAtLevel && typeof criteria.minDamageAtLevel.level === 'number') {
    const idx = _levelIndex(criteria.minDamageAtLevel.level);
    if (idx !== null) {
      results = results.filter(t => typeof t.levels.damage[idx] === 'number' && t.levels.damage[idx] >= criteria.minDamageAtLevel.value);
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
      heroId: s.heroId,
      heroName: hero ? hero.name : 'unknown',
      reason: s.reason
    };
  });

  return { troopId: troop.id, troopName: troop.name, heroSynergies: enriched };
}

function _heroPower(heroId, level) {
  const hero = heroes.find(h => h.id === heroId) || _findHeroEntry(heroId);
  if (!hero) return null;
  const idx = _levelIndex(level);
  if (idx === null) return null;
  const key = _rarityKeyForPower(hero.rarity);
  const table = formulas.lookupTables.HERO_POWER[key];
  if (!table || table[idx] === undefined) return null;
  return table[idx];
}

function _troopPower(troopIdOrName, level, squads = 1) {
  const troop = _findTroopEntry(troopIdOrName);
  if (!troop) return null;
  const idx = _levelIndex(level);
  if (idx === null) return null;
  const key = _rarityKeyForPower(troop.rarity);
  const table = formulas.lookupTables.TROOP_POWER[key];
  if (!table || table[idx] === undefined) return null;
  return table[idx] * (squads || 1);
}

function calculateHeroBonus(opts = {}) {
  const {
    hero1Id = null, hero1Level = 1,
    hero2Id = null, hero2Level = 1,
    weaponName = 'none', weaponLevel = 0,
    armorName = 'none', armorLevel = 0,
    heroCollectionBonusPct = null
  } = opts;

  const hero1Power = hero1Id ? _heroPower(hero1Id, hero1Level) : 0;
  const hero2Power = hero2Id ? _heroPower(hero2Id, hero2Level) : 0;

  if (hero1Id && hero1Power === null) return null;
  if (hero2Id && hero2Power === null) return null;

  const totalHeroPower = (hero1Power || 0) + (hero2Power || 0);
  const weaponBonusPct = (weaponName && weaponName !== 'none') ? (weaponLevel || 0) * 0.20 : 0;
  const armorBonusPct = (armorName && armorName !== 'none') ? (armorLevel || 0) * 0.20 : 0;
  const collectionPct = (typeof heroCollectionBonusPct === 'number') ? heroCollectionBonusPct : 0;
  const totalBonusPct = collectionPct + weaponBonusPct + armorBonusPct;
  const multiplier = 1 + totalBonusPct / 100;

  return {
    hero1Power: hero1Power,
    hero2Power: hero2Power,
    totalHeroPower,
    weaponBonusPct,
    armorBonusPct,
    heroCollectionBonusPct: (typeof heroCollectionBonusPct === 'number') ? heroCollectionBonusPct : null,
    totalBonusPct,
    multiplier
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
      troopId: troop.id,
      troopName: troop.name,
      level: row.level,
      squads: row.squads || 1,
      power: pwr
    });
  }

  const heroBonus = calculateHeroBonus(opts);
  if (heroBonus === null) return null;

  const basePower = armyPower + heroBonus.totalHeroPower;
  const finalPower = Math.round(basePower * heroBonus.multiplier);

  return { armyPower, troopBreakdown, heroBonus, basePower, finalPower };
}

function getBestTroopForRole(role, opts = {}) {
  const level = opts.level || 10;
  const limit = opts.limit || 5;
  const idx = _levelIndex(level);
  if (idx === null) return [];

  const matches = findTroops({ role });
  const ranked = matches
    .map(t => ({ troop: t, hp: (typeof t.levels.hp[idx] === 'number') ? t.levels.hp[idx] : null }))
    .filter(x => x.hp !== null)
    .sort((a, b) => b.hp - a.hp)
    .slice(0, limit)
    .map(x => ({ troopId: x.troop.id, troopName: x.troop.name, level, hp: x.hp }));

  return ranked;
}

function getBestTroopForAttack(opts = {}) {
  const level = opts.level || 10;
  const limit = opts.limit || 5;
  const idx = _levelIndex(level);
  if (idx === null) return [];

  let pool = troops;
  if (opts.category) pool = findTroops({ category: opts.category });

  const ranked = pool
    .map(t => ({ troop: t, damage: (typeof t.levels.damage[idx] === 'number') ? t.levels.damage[idx] : null }))
    .filter(x => x.damage !== null)
    .sort((a, b) => b.damage - a.damage)
    .slice(0, limit)
    .map(x => ({ troopId: x.troop.id, troopName: x.troop.name, level, damage: x.damage }));

  return ranked;
}

function getBestHeroForTroop(troopName, opts = {}) {
  const limit = opts.limit || 5;
  const synergy = findHeroSynergies(troopName);
  if (!synergy) return null;

  const ranked = synergy.heroSynergies
    .map(s => {
      const hero = heroes.find(h => h.id === s.heroId);
      const buffCount = hero ? hero.tags.filter(t => ['Attack-Buff', 'HP-Buff', 'Defense-Buff', 'Boss-Damage', 'Healing', 'Shielding'].includes(t)).length : 0;
      return { heroId: s.heroId, heroName: s.heroName, reason: s.reason, buffCount };
    })
    .sort((a, b) => b.buffCount - a.buffCount)
    .slice(0, limit);

  return ranked;
}

module.exports = {
  gameLibrary,
  getTroop,
  getHero,
  getTroopLevel,
  getTroopAbility,
  compareTroop,
  getTroopGrowth,
  findTroops,
  findHeroes,
  findHeroSynergies,
  calculateHeroBonus,
  calculateFinalPower,
  getBestTroopForRole,
  getBestTroopForAttack,
  getBestHeroForTroop
};
