/**
 * router/gameDomainRouter.js
 * 
 * PURPOSE: Routes deterministically to JS engines or falls back to AI.
 * FIXED: Renamed export to "route" to match index.js and test file calls,
 * and updated internal paths to correctly map to your file structure.
 */

const { classify, resolveEntities } = require('./gameIntentClassifier.js');
const { build } = require('./strategyContextBuilder.js');
const queryEngine = require('../engine/gameQueryEngine.js');
const strategyEngine = require('../engine/gameStrategyEngine.js');
const { simulateHeroBonus } = require('../engine/heroBonusSimulator.js');
const { compareSquads } = require('../engine/squadCalculator.js');

// Handle both export styles (module.exports = { economyRatios } OR module.exports = { gold: {}, gems: {} })
const ecoModule = require('../data/economyRatios.js');
const economyRatios = ecoModule.economyRatios || ecoModule;

function route(text) {
  const { intent, entities } = classify(text);

  // 1. GOLD / GEM ENGINE (Deterministic)
  if (intent === 'GOLD' || intent === 'GEM') {
    const isGold = intent === 'GOLD';
    const ratios = isGold ? economyRatios.gold : economyRatios.gems;
    
    // Check if they asked for a specific amount
    const amountMatch = text.match(/\b(\d+k?|\d+)\b/i);
    if (amountMatch) {
      let amountStr = amountMatch[1].toLowerCase();
      let amount = amountStr.includes('k') ? parseInt(amountStr) * 1000 : parseInt(amountStr);
      let calcStr = `**Calculated ${isGold ? 'Gold' : 'Gem'} Spending Plan for ${amount.toLocaleString()}:**\n`;
      for (const [category, pct] of Object.entries(ratios)) {
        calcStr += `- **${category} (${pct}%):** ${Math.round(amount * (pct / 100)).toLocaleString()}\n`;
      }
      return { resolved: true, reply: calcStr };
    }
    return { 
      resolved: true, 
      reply: `**Optimal ${isGold ? 'Gold' : 'Gem'} Ratio:**\n` + Object.entries(ratios).map(([k, v]) => `- ${k}: ${v}%`).join('\n') 
    };
  }

  // 2. FACT ENGINE (Deterministic)
  if (intent === 'FACT' && entities.troopName) {
    if (entities.levels.length === 0) {
        return { resolved: true, reply: `Which level of ${entities.troopName} are you looking for? (1-10)` };
    }
    const data = queryEngine.getTroopLevel(entities.troopName, entities.levels[0]);
    if (data) {
      if (entities.ability) {
        const ability = queryEngine.getTroopAbility(entities.troopName, entities.levels[0]);
        if (ability && ability.name) {
          return { resolved: true, reply: `**${data.troopName} Lv${data.level} Ability (${ability.name}):**\n${ability.description}\nStats: ${JSON.stringify(ability.statsAtLevel)}` };
        }
      }
      return { resolved: true, reply: `**${data.troopName} Lv${data.level} Facts:**\n❤️ HP: ${data.hp?.toLocaleString()}\n⚔️ DMG: ${data.damage?.toLocaleString()}\n🛡️ DEF: ${data.defense}\n👥 Units: ${data.units}` };
    }
  }

  // 3. CALC ENGINE (Deterministic)
  if (intent === 'CALC' && entities.troopNames && entities.troopNames.length > 0) {
    
    // Squad Comparison
    if (entities.troopNames.length >= 2) {
      const squadA = [{ troop: entities.troopNames[0], level: entities.levels[0] || 10, count: entities.counts[0] || 1 }];
      const squadB = [{ troop: entities.troopNames[1], level: entities.levels[1] || entities.levels[0] || 10, count: entities.counts[1] || 1 }];
      const squadResult = compareSquads(squadA, squadB);
      
      if (squadResult && !squadResult.note) {
         const aTot = squadResult.squadA.totals;
         const bTot = squadResult.squadB.totals;
         return { 
           resolved: true, 
           reply: `**Squad Comparison:**\n` +
                  `🛡️ **Squad 1 (${squadA[0].count}x ${squadA[0].troop} Lv${squadA[0].level}):** ${aTot.totalHp.toLocaleString()} HP | ${aTot.totalDamage.toLocaleString()} DMG\n` +
                  `⚔️ **Squad 2 (${squadB[0].count}x ${squadB[0].troop} Lv${squadB[0].level}):** ${bTot.totalHp.toLocaleString()} HP | ${bTot.totalDamage.toLocaleString()} DMG`
         };
      }
    }

    // Hero Bonus Simulation
    if (entities.percentages.length > 0) {
       const sim = simulateHeroBonus({ troopName: entities.troopName, level: entities.levels[0] || 10, hpBonusPct: entities.percentages[0], damageBonusPct: entities.percentages[0] });
       if (sim && !sim.error) {
         return { resolved: true, reply: `*${sim.disclaimer}*\n**${entities.troopName} Lv${entities.levels[0] || 10} with +${entities.percentages[0]}% Buff:**\n❤️ HP: ${sim.calculated.hp.toLocaleString()} (Base: ${sim.base.hp})\n⚔️ DMG: ${sim.calculated.damage.toLocaleString()} (Base: ${sim.base.damage})` };
       }
    }

    // Direct Level Comparison
    if (entities.levels.length === 2) {
      const growth = strategyEngine.getTroopGrowth(entities.troopName, entities.levels[0], entities.levels[1]);
      if (growth && growth.hp.absolute !== null) {
        return { resolved: true, reply: `**${entities.troopName} (Lv${entities.levels[0]} → Lv${entities.levels[1]}):**\n❤️ HP: +${growth.hp.absolute.toLocaleString()} (+${growth.hp.percent}%)\n⚔️ DMG: +${growth.damage.absolute.toLocaleString()} (+${growth.damage.percent}%)` };
      }
    }
  }

  // 4. STRATEGY ENGINE (Requires AI)
  const strategyData = build(intent, entities);
  
  return { 
    resolved: false, 
    intent, 
    entities, 
    context: strategyData.sufficient ? strategyData.context : null 
  };
}

module.exports = { route };
