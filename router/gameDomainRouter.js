/**
 * router/gameDomainRouter.js
 * 
 * PURPOSE: Returns visual cards AND passes context to the AI pipeline for deep intelligent comparisons.
 */

const { EmbedBuilder } = require('discord.js');
const { classify, resolveEntities } = require('./gameIntentClassifier.js');
const { build } = require('./strategyContextBuilder.js');
const queryEngine = require('../engine/gameQueryEngine.js');
const strategyEngine = require('../engine/gameStrategyEngine.js');
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

  // 3. COMPARISON ENGINE (🚀 GENERATES DUAL EMBED CARDS + PASSES DATA TO AI FOR INTELLIGENT ANALYSIS)
  let prebuiltEmbeds = [];
  if (intent === 'CALC' || (entities.heroNames && entities.heroNames.length >= 2)) {
    if (entities.heroNames && entities.heroNames.length >= 2) {
      const h1 = queryEngine.getHero(entities.heroNames[0]);
      const h2 = queryEngine.getHero(entities.heroNames[1]);

      if (h1 && h2) {
        const embed1 = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`🦸‍♂️ ${h1.name}`)
          .addFields(
            { name: 'Faction / Rarity', value: `${h1.faction} (${h1.rarity})`, inline: false },
            { name: '❤️ HP', value: h1.stats?.hp ? h1.stats.hp.toLocaleString() : 'N/A', inline: true },
            { name: '🛡️ Defense', value: String(h1.stats?.defense || 'N/A'), inline: true },
            { name: '⚔️ Attack', value: h1.stats?.attack ? h1.stats.attack.toLocaleString() : 'N/A', inline: true }
          );
        if (h1.talent) embed1.addFields({ name: `🌟 Talent: ${h1.talent.name}`, value: h1.talent.description });
        if (h1.ability) embed1.addFields({ name: `✨ Ability: ${h1.ability.name}`, value: h1.ability.description });

        const embed2 = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle(`🦸‍♂️ ${h2.name}`)
          .addFields(
            { name: 'Faction / Rarity', value: `${h2.faction} (${h2.rarity})`, inline: false },
            { name: '❤️ HP', value: h2.stats?.hp ? h2.stats.hp.toLocaleString() : 'N/A', inline: true },
            { name: '🛡️ Defense', value: String(h2.stats?.defense || 'N/A'), inline: true },
            { name: '⚔️ Attack', value: h2.stats?.attack ? h2.stats.attack.toLocaleString() : 'N/A', inline: true }
          );
        if (h2.talent) embed2.addFields({ name: `🌟 Talent: ${h2.talent.name}`, value: h2.talent.description });
        if (h2.ability) embed2.addFields({ name: `✨ Ability: ${h2.ability.name}`, value: h2.ability.description });

        prebuiltEmbeds = [embed1, embed2];
      }
    }
  }

  // 4. STRATEGY & AI INTELLIGENCE PIPELINE
  const strategyData = build(intent, entities);
  
  return { 
    resolved: false, // <--- Triggers AI pipeline so Melody analyzes the stats!
    embeds: prebuiltEmbeds.length > 0 ? prebuiltEmbeds : null, // <--- Sends visual cards alongside AI text!
    intent, 
    entities, 
    context: strategyData.sufficient ? strategyData.context : null 
  };
}

module.exports = { route };
