/**
 * router/gameDomainRouter.js
 * 
 * PURPOSE: Routes deterministically to JS engines or falls back to AI.
 * UPDATED: Now returns beautiful Discord Embeds for a premium "Card" experience.
 */

const { EmbedBuilder } = require('discord.js'); // 🚀 IMPORTED EMBED BUILDER
const { classify, resolveEntities } = require('./gameIntentClassifier.js');
const { build } = require('./strategyContextBuilder.js');
const queryEngine = require('../engine/gameQueryEngine.js');
const strategyEngine = require('../engine/gameStrategyEngine.js');
const { simulateHeroBonus } = require('../engine/heroBonusSimulator.js');
const { compareSquads } = require('../engine/squadCalculator.js');

const ecoModule = require('../data/economyRatios.js');
const economyRatios = ecoModule.economyRatios || ecoModule;

function route(text) {
  const { intent, entities } = classify(text);

  // ==========================================
  // 1. GOLD / GEM ENGINE (Deterministic Embed)
  // ==========================================
  if (intent === 'GOLD' || intent === 'GEM') {
    const isGold = intent === 'GOLD';
    const ratios = isGold ? economyRatios.gold : economyRatios.gems;
    const amountMatch = text.match(/\b(\d+k?|\d+)\b/i);
    
    const embed = new EmbedBuilder()
        .setColor(isGold ? '#FFD700' : '#2ECC71') // Gold or Emerald Green
        .setTitle(isGold ? '💰 Ultimate Gold Blueprint' : '💎 Premium Gem Matrix');

    if (amountMatch) {
      let amountStr = amountMatch[1].toLowerCase();
      let amount = amountStr.includes('k') ? parseInt(amountStr) * 1000 : parseInt(amountStr);
      embed.setDescription(`**Calculated Spending Plan for ${amount.toLocaleString()} ${isGold ? 'Gold' : 'Gems'}**`);
      
      for (const [category, pct] of Object.entries(ratios)) {
        embed.addFields({ name: `${category} (${pct}%)`, value: Math.round(amount * (pct / 100)).toLocaleString(), inline: true });
      }
    } else {
      embed.setDescription(`**Optimal Spending Ratios**`);
      for (const [category, pct] of Object.entries(ratios)) {
        embed.addFields({ name: category, value: `${pct}%`, inline: true });
      }
    }
    return { resolved: true, embeds: [embed] };
  }

  // ==========================================
  // 2. FACT ENGINE (Troop "Card" Embed)
  // ==========================================
  if (intent === 'FACT' && entities.troopName) {
    // 🚀 If no level is provided, default to Max Level (10) for the ultimate "Card" view
    const lvl = entities.levels.length > 0 ? entities.levels[0] : 10;
    const data = queryEngine.getTroopLevel(entities.troopName, lvl);
    
    if (data) {
      const embed = new EmbedBuilder()
        .setColor('#2b2d31') // Discord dark theme color
        .setTitle(`📜 ${data.troopName} (Lv. ${data.level})`)
        .addFields(
          { name: '❤️ HP', value: data.hp?.toLocaleString() || 'N/A', inline: true },
          { name: '⚔️ Damage', value: data.damage?.toLocaleString() || 'N/A', inline: true },
          { name: '🛡️ Defense', value: String(data.defense || 'N/A'), inline: true },
          { name: '👥 Units', value: String(data.units || 1), inline: true }
        );

      const ability = queryEngine.getTroopAbility(entities.troopName, lvl);
      if (ability && ability.name) {
          let abText = ability.description;
          if (ability.statsAtLevel) {
              abText += `\n\n**Stats at Lv. ${lvl}:**\n` + Object.entries(ability.statsAtLevel)
                  .map(([k, v]) => `• **${k}:** ${v}`)
                  .join('\n');
          }
          embed.addFields({ name: `✨ Ability: ${ability.name}`, value: abText });
      }

      return { resolved: true, embeds: [embed] };
    }
  }

  // ==========================================
  // 3. CALC ENGINE (Comparison Embeds)
  // ==========================================
  if (intent === 'CALC' && entities.troopNames && entities.troopNames.length > 0) {
    
    // ⚔️ Squad Comparison
    if (entities.troopNames.length >= 2) {
      const squadA = [{ troop: entities.troopNames[0], level: entities.levels[0] || 10, count: entities.counts[0] || 1 }];
      const squadB = [{ troop: entities.troopNames[1], level: entities.levels[1] || entities.levels[0] || 10, count: entities.counts[1] || 1 }];
      const squadResult = compareSquads(squadA, squadB);
      
      if (squadResult && !squadResult.note) {
         const aTot = squadResult.squadA.totals;
         const bTot = squadResult.squadB.totals;

         const embed = new EmbedBuilder()
            .setColor('#E74C3C') // Red for battle
            .setTitle('⚔️ Squad Comparison')
            .addFields(
                { name: `🛡️ Squad 1 (${squadA[0].count}x ${squadA[0].troop} Lv${squadA[0].level})`, value: `**❤️ HP:** ${aTot.totalHp.toLocaleString()}\n**⚔️ DMG:** ${aTot.totalDamage.toLocaleString()}`, inline: true },
                { name: `🗡️ Squad 2 (${squadB[0].count}x ${squadB[0].troop} Lv${squadB[0].level})`, value: `**❤️ HP:** ${bTot.totalHp.toLocaleString()}\n**⚔️ DMG:** ${bTot.totalDamage.toLocaleString()}`, inline: true }
            );

         return { resolved: true, embeds: [embed] };
      }
    }

    // 📈 Level Comparison (Growth)
    if (entities.levels.length === 2) {
      const growth = strategyEngine.getTroopGrowth(entities.troopName, entities.levels[0], entities.levels[1]);
      if (growth && growth.hp.absolute !== null) {
        const embed = new EmbedBuilder()
            .setColor('#3498DB') // Blue for stats
            .setTitle(`📈 ${entities.troopName} Growth (Lv${entities.levels[0]} → Lv${entities.levels[1]})`)
            .addFields(
                { name: '❤️ HP Growth', value: `+${growth.hp.absolute.toLocaleString()} (+${growth.hp.percent}%)`, inline: true },
                { name: '⚔️ DMG Growth', value: `+${growth.damage.absolute.toLocaleString()} (+${growth.damage.percent}%)`, inline: true }
            );
        return { resolved: true, embeds: [embed] };
      }
    }
  }

  // ==========================================
  // 4. STRATEGY ENGINE (Requires AI)
  // ==========================================
  const strategyData = build(intent, entities);
  
  return { 
    resolved: false, 
    intent, 
    entities, 
    context: strategyData.sufficient ? strategyData.context : null 
  };
}

module.exports = { route };
