/**
 * router/strategyContextBuilder.js
 */

const strategyEngine = require('../engine/gameStrategyEngine.js');
const queryEngine = require('../engine/gameQueryEngine.js');

function build(intent, entities) {
  const { troopName, troopNames, heroNames, levels, heroName, category } = entities;

  // 🚀 If comparing two Troops via AI ("Alchemist vs Lava Golem who is better")
  if (troopNames && troopNames.length >= 2) {
    const t1 = queryEngine.getTroopLevel(troopNames[0], levels[0] || 10);
    const t2 = queryEngine.getTroopLevel(troopNames[1], levels[1] || levels[0] || 10);
    return {
      sufficient: true,
      context: {
        task: "Compare these two troops based on the provided stats and explain which is better and in what scenarios.",
        troop1: t1,
        troop2: t2
      }
    };
  }

  // 🚀 If comparing two Heroes via AI ("Tristan vs Anavin")
  if (heroNames && heroNames.length >= 2) {
    const h1 = queryEngine.getHero(heroNames[0]);
    const h2 = queryEngine.getHero(heroNames[1]);
    return {
        sufficient: true,
        context: {
            task: "Compare these two heroes based on their synergies, abilities, and faction.",
            hero1: h1,
            hero2: h2
        }
    };
  }

  // Single-level strategy question: "How to use Alchemist effectively?"
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
          ability: analysis.ability,
          tags: analysis.troop.tags
        },
        role: analysis.role,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses
      }
    };
  }

  // Level-vs-level strategy question with an interpretive angle
  if (troopName && levels.length >= 2) {
    const cmp = strategyEngine.compareTroopLevels(troopName, levels[0], levels[1]);
    if (cmp.error) return { context: null, sufficient: false, error: cmp.error };
    return { sufficient: true, context: { troopName, ...cmp } };
  }

  // "Which hero is best for X"
  if (troopName && !heroName) {
    const result = strategyEngine.findBestHeroesForTroop(troopName);
    if (result.error) return { context: null, sufficient: false, error: result.error };
    return { sufficient: true, context: { troop: { name: result.troopName }, compatibleHeroes: result.candidates.slice(0, 5) } };
  }

  if (category) {
    return { sufficient: true, context: { category, note: 'Strategy for category buffers.' } };
  }

  return { context: null, sufficient: false, error: 'Not enough resolved entities to build a strategy context.' };
}

module.exports = { build };
