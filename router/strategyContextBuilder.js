/**
 * router/strategyContextBuilder.js
 */

const strategyEngine = require('../engine/gameStrategyEngine.js');
const queryEngine = require('../engine/gameQueryEngine.js');

function build(intent, entities) {
  const { troopName, troopNames, heroNames, levels, heroName, category, isComparison, rawText } = entities;

  // 🚀 0. SAFETY GUARD: Check if comparison is a false positive (e.g., single entity mentioned with descriptive text)
  const isActuallyComparing = isComparison || (rawText && /\b(vs|versus|compared to|better than)\b/i.test(rawText));

  // 🚀 1. Hero Comparison (2 Heroes strictly when explicitly comparing)
  if (isActuallyComparing && heroNames && heroNames.length >= 2) {
    const cmp = strategyEngine.compareEntities(heroNames[0], heroNames[1]);
    if (cmp.error) return { context: null, sufficient: false, error: cmp.error };
    
    return {
        sufficient: true,
        context: {
            formatInstruction: "Compare these two heroes using clean markdown formatting. Use sections: 1. Core Stats Face-Off (HP, Defense, Attack), 2. Abilities & Synergy, 3. Final Verdict. Base your answer STRICTLY on the provided data without hallucinating stats.",
            hero1: cmp.entityA,
            hero2: cmp.entityB
        }
    };
  }

  // 🚀 2. Single Hero Lookup (Ensures single entity focus even if list has 1 item)
  if (heroNames && heroNames.length === 1 && !troopName && (!troopNames || troopNames.length === 0)) {
    const h1 = queryEngine.findEntityByName(heroNames[0]);
    if (!h1 || h1.type !== 'hero') return { context: null, sufficient: false, error: `Hero ${heroNames[0]} not found in database.` };
    
    return {
        sufficient: true,
        context: {
            task: "Provide exact stats and strategic usage for this database-verified hero.",
            formatInstruction: "Do not invent abilities or stats. Use ONLY the provided database record.",
            recognizedHero: h1.data
        }
    };
  }

  // 🚀 3. Troop Comparison (2 Troops with Level Scaling strictly when comparing)
  if (isActuallyComparing && troopNames && troopNames.length >= 2) {
    const lvl1 = (levels && levels[0]) ? levels[0] : 10;
    const lvl2 = (levels && levels[1]) ? levels[1] : lvl1;
    
    const t1 = queryEngine.getTroopLevel(troopNames[0], lvl1);
    const t2 = queryEngine.getTroopLevel(troopNames[1], lvl2);
    
    if (!t1 || !t2) return { context: null, sufficient: false, error: "One or both troops could not be found in the database." };

    return {
      sufficient: true,
      context: {
        formatInstruction: "Compare these two troops cleanly with bullet points and declare a winner based ONLY on these exact database stats.",
        troop1: t1,
        troop2: t2
      }
    };
  }

  // 🚀 4. Mixed Comparison Fallback (Explicit vs keyword check)
  if (isActuallyComparing && rawText) {
      const match = rawText.match(/(.+?)\s+(?:vs|versus)\s+(.+)/i);
      if (match) {
          const cmp = strategyEngine.compareEntities(match[1].trim(), match[2].trim());
          if (!cmp.error) {
              return {
                  sufficient: true,
                  context: {
                      formatInstruction: "Compare these two entities cleanly using the provided deterministic stats. Do not guess or hallucinate any numbers.",
                      comparisonData: cmp
                  }
              };
          }
      }
  }

  // 🚀 5. Single Troop Level Analysis
  if (troopName && (!levels || levels.length <= 1)) {
    const level = (levels && levels[0]) ? levels[0] : 10;
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

  // 🚀 6. Troop Level Progression (Same Troop, 2 Levels)
  if (troopName && levels && levels.length >= 2) {
    const cmp = strategyEngine.compareTroopLevels(troopName, levels[0], levels[1]);
    if (cmp.error) return { context: null, sufficient: false, error: cmp.error };
    return { sufficient: true, context: { troopName, ...cmp } };
  }

  // 🚀 7. Best Heroes for a Troop
  if (troopName && !heroName && (!heroNames || heroNames.length === 0)) {
    const result = strategyEngine.findBestHeroesForTroop(troopName);
    if (result.error) return { context: null, sufficient: false, error: result.error };
    return { sufficient: true, context: { troop: { name: result.troopName }, compatibleHeroes: result.candidates.slice(0, 5) } };
  }

  // 🚀 8. Category Strategy
  if (category) {
    return { sufficient: true, context: { category, note: 'Strategy for category buffers based on gameKnowledge.js.' } };
  }

  return { context: null, sufficient: false, error: 'Not enough resolved entities to build a deterministic strategy context.' };
}

module.exports = { build };
