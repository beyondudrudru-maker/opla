/**
 * engine/heroBonusSimulator.js
 *
 * IMPORTANT: gameKnowledge.js defines an OFFICIAL "hero collection bonus"
 * mechanic (see gameLibrary.formulas — heroCollectionBonusPct feeds into
 * armyPower via calculateHeroBonus/calculateFinalPower in
 * gameQueryEngine.js). That mechanic affects overall ARMY POWER, not a
 * specific troop's HP/damage stat directly.
 *
 * A flat "give this one troop +N% HP/damage" bonus is NOT defined
 * anywhere in gameKnowledge.js. This module simulates that as a clearly
 * labeled HYPOTHETICAL, never as an official mechanic. If the caller
 * wants the real, data-backed hero bonus math, use
 * queryEngine.calculateHeroBonus / calculateFinalPower instead.
 */

const queryEngine = require('./gameQueryEngine.js');

/**
 * simulateHeroBonus({ troopName, level, hpBonusPct, damageBonusPct })
 * -> { base, bonus, calculated, disclaimer } or { error }
 */
function simulateHeroBonus({ troopName, level, hpBonusPct = 0, damageBonusPct = 0 } = {}) {
  const stats = queryEngine.getTroopLevel(troopName, level);
  if (!stats) {
    return { error: `Could not resolve "${troopName}" at level ${level}.` };
  }

  const base = { hp: stats.hp, damage: stats.damage };
  const calculated = {
    hp: base.hp !== null ? Math.round(base.hp * (1 + hpBonusPct / 100)) : null,
    damage: base.damage !== null ? Math.round(base.damage * (1 + damageBonusPct / 100)) : null
  };

  return {
    troopName: stats.troopName,
    level: stats.level,
    base,
    bonus: { hpBonusPct, damageBonusPct },
    calculated,
    disclaimer: 'Hypothetical flat bonus simulation — this is NOT an official game mechanic defined in gameKnowledge.js. The game\'s actual documented hero bonus (heroCollectionBonusPct) affects total army power, not a single troop\'s HP/damage directly. Use queryEngine.calculateHeroBonus() for the real formula.'
  };
}

module.exports = { simulateHeroBonus };
