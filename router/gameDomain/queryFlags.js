/**
 * router/gameDomain/queryFlags.js
 *
 * Builds the `queryFlags` object handed to aiFallback.buildInstruction()
 * (drives which instruction segments load) and the optional `deterministic`
 * cache-candidate descriptor for a clean 1v1 comparison.
 */

const { INTENT_PATTERNS } = require('./constants.js');

/**
 * buildQueryFlags({ text, entities, isSynergyQuery, isBossQuery, isCounterQuery })
 *
 * isComparisonQuery is a pure "X vs Y" with exactly 2 total entities and no
 * synergy/boss/counter signal — anything else (e.g. "combo for pvp effective
 * with X") stays on the full reasoning path in aiFallback, which is correct
 * since a combo recommendation needs judgment, not just a stat comparison.
 *
 * 🆕 ADVANCEMENT — `hasValidatedEntity` is surfaced alongside isSingleEntity
 * as a defense-in-depth signal for aiFallback: it's true only when the
 * single matched name actually resolved against the live roster via
 * queryEngine.findEntityByName (not just present in entities.heroNames /
 * troopNames, which — pre entityScraper.validateSeededEntities — could still
 * theoretically be reached by a future caller that skips validation). aiFallback
 * can use this to add an extra "if this doesn't check out, don't fabricate"
 * guard on the deterministic-explain/short-instruction path.
 */
function buildQueryFlags({ text, entities, isSynergyQuery, isBossQuery, isCounterQuery, queryEngine }) {
  const totalEntities = entities.heroNames.length + entities.troopNames.length;
  const isComparisonQuery =
    INTENT_PATTERNS.explicitVs.test(text) &&
    totalEntities === 2 &&
    !isSynergyQuery && !isBossQuery && !isCounterQuery;

  const isSingleEntity = totalEntities === 1;

  let hasValidatedEntity = false;
  if (isSingleEntity && queryEngine && typeof queryEngine.findEntityByName === 'function') {
    const soleName = entities.heroNames[0] || entities.troopNames[0];
    hasValidatedEntity = Boolean(queryEngine.findEntityByName(soleName));
  }

  const queryFlags = {
    isBossQuery,
    isSynergyQuery,
    isComparisonQuery,
    isSingleEntity,
    hasValidatedEntity,
    needsGear: INTENT_PATTERNS.equipment.test(text),
  };

  // Only offered as a deterministic-cache candidate for a clean 1v1 with
  // both names resolved — gameStrategyEngine.compareEntities() needs both
  // exact names to do the CPU-only lookup. aiFallback/strategyCache decide
  // whether to actually use it; this just flags the possibility.
  const deterministic = isComparisonQuery
    ? {
        queryType: 'compareEntities',
        params: {
          nameA: entities.heroNames[0] || entities.troopNames[0],
          nameB: entities.heroNames[1] || entities.troopNames[1],
        },
      }
    : null;

  return { queryFlags, deterministic };
}

module.exports = { buildQueryFlags };
