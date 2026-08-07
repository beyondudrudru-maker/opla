/**
 * engine/squadCalculator.js
 *
 * Compares two squads made of { troop, level, count } entries.
 * Uses queryEngine.getTroopLevel exclusively — no new combat mechanics
 * are invented. Anything the source data doesn't define comes back as
 * "unknown" rather than an estimate.
 */

const queryEngine = require('../gameQueryEngine.js');

function _summarizeSquad(squad) {
  const rows = [];
  let totalHp = 0;
  let totalDamage = 0;
  let totalUnits = 0;
  let anyUnknown = false;

  for (const entry of squad) {
    const stats = queryEngine.getTroopLevel(entry.troop, entry.level);
    if (!stats) {
      rows.push({ troop: entry.troop, level: entry.level, count: entry.count, error: 'unknown / not available' });
      anyUnknown = true;
      continue;
    }
    const count = entry.count || 1;
    const rowHp = stats.hp !== null ? stats.hp * count : null;
    const rowDamage = stats.damage !== null ? stats.damage * count : null;
    const rowUnits = (stats.units !== null ? stats.units : 1) * count;

    if (rowHp === null || rowDamage === null) anyUnknown = true;
    if (rowHp !== null) totalHp += rowHp;
    if (rowDamage !== null) totalDamage += rowDamage;
    totalUnits += rowUnits;

    rows.push({
      troop: stats.troopName,
      level: stats.level,
      count,
      hpPerSquadCard: stats.hp,
      damagePerSquadCard: stats.damage,
      unitsPerSquadCard: stats.units,
      totalHp: rowHp,
      totalDamage: rowDamage,
      totalUnits: rowUnits
    });
  }

  return {
    rows,
    totals: { totalHp, totalDamage, totalUnits },
    complete: !anyUnknown
  };
}

/**
 * compareSquads(squadA, squadB)
 * squadA/squadB: [{ troop, level, count }]
 */
function compareSquads(squadA, squadB) {
  const a = _summarizeSquad(squadA || []);
  const b = _summarizeSquad(squadB || []);

  const delta = (a.complete && b.complete)
    ? {
        hp: a.totals.totalHp - b.totals.totalHp,
        damage: a.totals.totalDamage - b.totals.totalDamage,
        units: a.totals.totalUnits - b.totals.totalUnits
      }
    : null;

  return {
    squadA: a,
    squadB: b,
    delta,
    note: (!a.complete || !b.complete)
      ? 'One or more troop/level combinations were not found — totals for that squad are incomplete.'
      : null
  };
}

module.exports = { compareSquads };
