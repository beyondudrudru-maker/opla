/**
 * router/strategyContextBuilder.js
 *
 * The ONLY bridge between deterministic engines and the AI layer.
 * Builds the smallest JSON payload that answers the question, never the
 * raw gameLibrary. Reuses gameStrategyEngine's already-computed analysis
 * instead of recomputing anything.
 */

const strategyEngine = require('../gameStrategyEngine.js');
const queryEngine = require('../gameQueryEngine.js');

/**
 * build(intent, entities, rawText) -> { context, sufficient }
 * `sufficient: false` means the router couldn't resolve enough to build a
 * useful context (e.g. unknown troop) — caller should surface an error
 * instead of calling AI.
 */
function build(intent, entities /*, rawText */) {
  const { troopName, troopNames, levels, heroName, category } = entities;

  // Single-level strategy question: "Is Lava Golem good at level 7?"
  if (troopName && levels.length <= 1) {
    const level = levels[0] || 10;
    const analysis = strategyEngine.analyzeTroopAtLevel(troopName, level);
    if (analysis.error) return { context: null, sufficient: false, error: analysis.error };

    return {
      sufficient: true,
      context: {
        troop: {
          name: analysis.troop.name,
          level: analysis.level,
          hp: analysis.stats.hp,
          damage: analysis.stats.damage,
          defense: analysis.stats.defense,
          units: analysis.stats.units,
          speed: analysis.stats.speed,
          attackSpeed: analysis.stats.attackSpeed,
          attackRange: analysis.stats.attackRange,
          ability: analysis.ability,
          tags: analysis.troop.tags
        },
        role: analysis.role,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        performanceScore: analysis.performanceScore
      }
    };
  }

  // Level-vs-level strategy question with an interpretive angle:
  // "Where does Lava Golem spike?" / "Is lvl9 worth it?"
  if (troopName && levels.length >= 2) {
    const cmp = strategyEngine.compareTroopLevels(troopName, levels[0], levels[1]);
    if (cmp.error) return { context: null, sufficient: false, error: cmp.error };

    return {
      sufficient: true,
      context: {
        troopName,
        levelA: cmp.levelA,
        levelB: cmp.levelB,
        absoluteGrowth: cmp.absoluteGrowth,
        percentageGrowth: cmp.percentageGrowth,
        importantBreakpoints: cmp.importantBreakpoints,
        verdict: cmp.verdict
      }
    };
  }

  // "Which hero is best for X" / "which mage buffs HP"
  if (troopName && !heroName) {
    const result = strategyEngine.findBestHeroesForTroop(troopName);
    if (result.error) return { context: null, sufficient: false, error: result.error };

    return {
      sufficient: true,
      context: {
        troop: { name: result.troopName },
        compatibleHeroes: result.candidates.slice(0, 5)
      }
    };
  }

  // Category-only hero buff question: "which mage buffs HP"
  if (category) {
    return {
      sufficient: true,
      context: {
        category,
        note: 'Use gameStrategyEngine.answerStrategyQuery({ type: "heroesForCategoryBuff", params: { category, buffType } }) upstream for the curated hero list; this context is a fallback shape.'
      }
    };
  }

  return { context: null, sufficient: false, error: 'Not enough resolved entities to build a strategy context.' };
}

module.exports = { build };
