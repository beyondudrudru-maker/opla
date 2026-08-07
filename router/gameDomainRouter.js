/**
 * router/gameDomainRouter.js
 * 
 * PURPOSE: Routes comparisons by sending visual Embed Cards 
 * AND passing context to the AI for deep tactical analysis.
 */

const { EmbedBuilder } = require('discord.js');
const { classify, resolveEntities } = require('./gameIntentClassifier.js');
const { build } = require('./strategyContextBuilder.js');
const queryEngine = require('../engine/gameQueryEngine.js');
const strategyEngine = require('../engine/gameStrategyEngine.js');
const { simulateHeroBonus } = require('../engine/heroBonusSimulator.js');
const { compareSquads } = require('../engine/squadCalculator.js');

const ecoModule = require('../data/economyRatios.js');
const economyRatios = ecoModule.economyRatios || ecoModule;

function route(text, recentContext = '') {
  let { intent, entities } = classify(text);

  // 🧠 PRONOUN & FOLLOW-UP RESOLUTION
  if (!entities.troopName && !entities.heroName && /\b(her|his|him|she|he|it|this|that|them)\b/i.test(text)) {
      const pastEntities = resolveEntities(recentContext);
      if (pastEntities.troopName) entities.troopName = pastEntities.troopName;
      if (pastEntities.heroName) entities.heroName = pastEntities.heroName;
      if (pastEntities.troopNames && pastEntities.troopNames.length > 0) entities.troopNames = pastEntities.troopNames;
      if (pastEntities.heroNames && pastEntities.heroNames.length > 0) entities.heroNames = pastEntities.heroNames;
      if (pastEntities.levels && pastEntities.levels.length > 0 && entities.levels.length === 0) entities.levels = pastEntities.levels;

      if (intent === 'UNKNOWN' && /\b(ability|skill|stat|stats|hp|damage|health)\b/i.test(text)) {
          intent = 'FACT';
      } else if (intent === 'UNKNOWN') {
          intent = 'STRATEGY';
      }
  }

  // 1. GOLD / GEM ENGINE
  if (intent === 'GOLD' || intent === 'GEM') {
    const isGold = intent === 'GOLD';
    const ratios = isGold ? economyRatios.gold : economyRatios.gems;
    const amountMatch = text.match(/\b(\d+k?|\d+)\b/i);
    
    const embed = new EmbedBuilder()
        .setColor(isGold ? '#FFD700' : '#2ECC71')
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

  // 2. FACT ENGINE (Single Card)
  if (intent === 'FACT') {
    if (entities.heroName && !entities.troopName) {
        const hero = queryEngine.getHero(entities.heroName);
        if (hero) {
            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle(`🦸‍♂️ ${hero.name} (Hero Card)`)
                .addFields(
                    { name: 'Faction', value: hero.faction || 'N/A', inline: true },
                    { name: 'Rarity', value: hero.rarity || 'N/A', inline: true },
                    { name: '❤️ HP', value: hero.stats?.hp ? hero.stats.hp.toLocaleString() : 'N/A', inline: true },
                    { name: '🛡️ Defense', value: String(hero.stats?.defense || 'N/A'), inline: true },
                    { name: '⚔️ Attack', value: hero.stats?.attack ? hero.stats.attack.toLocaleString() : 'N/A', inline: true }
                );
            if (hero.talent) {
                embed.addFields({ name: `🌟 Talent: ${hero.talent.name}`, value: hero.talent.description });
            }
            if (hero.ability && hero.ability.description) {
                embed.addFields({ name: `✨ Ability: ${hero.ability.name || 'Skill'}`, value: hero.ability.description });
            }
            return { resolved: true, embeds: [embed] };
        }
    }

    if (entities.troopName) {
        const lvl = entities.levels.length > 0 ? entities.levels[0] : 10;
        const data = queryEngine.getTroopLevel(entities.troopName, lvl);
        
        if (data) {
          const embed = new EmbedBuilder()
            .setColor('#2b2d31')
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
  }

  // 🚀 CRITICAL FIX: For Hero/Troop Comparisons, we want AI Intelligence to run!
  // So we let it fall through to the Strategy Engine, but we can also pre-build context.
  
  const strategyData = build(intent, entities);
  
  return { 
    resolved: false, // <--- This forces it to pass data to Melody AI so she can write the comparison text!
    intent, 
    entities, 
    context: strategyData.sufficient ? strategyData.context : null 
  };
}

module.exports = { route };
