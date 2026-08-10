/**
 * router/gameDomainRouter.js
 * 
 * PURPOSE: Resolves user queries into visual Embed Cards AND passes strict deterministic
 * data contexts to the AI pipeline for deep, hallucination-free strategic analysis.
 * 🌟 UPGRADE: Advanced Tag, Role & Synergy Matching for Ultra-Smart Hero Recommendations.
 */

const { EmbedBuilder } = require('discord.js');
const { classify, resolveEntities } = require('./gameIntentClassifier.js');
const { build } = require('./strategyContextBuilder.js');
const queryEngine = require('../engine/gameQueryEngine.js');

const ecoModule = require('../data/economyRatios.js');
const economyRatios = ecoModule.economyRatios || ecoModule;

function route(text, recentContext = '') {
  let { intent, entities } = classify(text);
  entities.rawText = text;

  // 🌍 MULTILINGUAL SYNERGY REGEX
  const isSynergyQuery = /\b(best with|synergy|alongside|use with|combination|which hero|konse hero|kiske sath|accha outcome|mejor con|melhor com|meilleur avec|terbaik dengan|sinergia|synergie)\b/i.test(text);

  // 🧠 FORCE STRATEGY INTENT
  if (isSynergyQuery) {
      intent = 'STRATEGY';
  }

  // 🧠 1. STRICT PRONOUN & FOLLOW-UP RESOLUTION
  const hasFollowUpTrigger = /\b(uska|iske|woh|he|she|it|they|him|her|this|that|its|stats|ability|skill)\b/i.test(text);

  if (hasFollowUpTrigger && !entities.troopName && !entities.heroName && (!entities.heroNames || entities.heroNames.length === 0)) {
      const pastEntities = resolveEntities(recentContext);
      if (pastEntities.troopName) entities.troopName = pastEntities.troopName;
      if (pastEntities.heroName) entities.heroName = pastEntities.heroName;
      if (pastEntities.troopNames && pastEntities.troopNames.length > 0) entities.troopNames = pastEntities.troopNames;
      if (pastEntities.heroNames && pastEntities.heroNames.length > 0) entities.heroNames = pastEntities.heroNames;
      if (pastEntities.levels && pastEntities.levels.length > 0 && (!entities.levels || entities.levels.length === 0)) entities.levels = pastEntities.levels;

      if (intent === 'UNKNOWN' && /\b(ability|skill|stat|stats|hp|damage|health)\b/i.test(text)) {
          intent = 'FACT';
      } else if (intent === 'UNKNOWN') {
          intent = 'STRATEGY';
      }
  }

  // 💰 2. GOLD / GEM ENGINE
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

  let prebuiltEmbeds = [];

  // 📝 3. FACT & SINGLE ENTITY ENGINE
  if (intent === 'FACT' || intent === 'UNKNOWN' || intent === 'QUESTION' || intent === 'STRATEGY' || intent === 'game-query') {

    const isStrategyIntent = intent === 'STRATEGY';

    // Single Hero Lookup
    if ((entities.heroName || (entities.heroNames && entities.heroNames.length === 1)) && (!entities.troopName && (!entities.troopNames || entities.troopNames.length === 0))) {
        const heroQuery = entities.heroName || entities.heroNames[0];
        const entity = queryEngine.findEntityByName(heroQuery);
        
        if (entity && entity.type === 'hero') {
            const hero = entity.data;
            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle(`🦸‍♂️ ${hero.name}`)
                .addFields(
                    { name: 'Faction', value: hero.faction || 'N/A', inline: true },
                    { name: 'Rarity', value: hero.rarity || 'N/A', inline: true },
                    { name: '❤️ HP', value: hero.stats?.hp ? hero.stats.hp.toLocaleString() : 'N/A', inline: true },
                    { name: '🛡️ Defense', value: String(hero.stats?.defense || 'N/A'), inline: true },
                    { name: '⚔️ Attack', value: hero.stats?.attack ? hero.stats.attack.toLocaleString() : 'N/A', inline: true }
                );
            if (hero.talent) embed.addFields({ name: `🌟 Talent: ${hero.talent.name}`, value: hero.talent.description });
            if (hero.ability && hero.ability.description) embed.addFields({ name: `✨ Ability: ${hero.ability.name || 'Skill'}`, value: hero.ability.description });

            if (isStrategyIntent) {
                prebuiltEmbeds.push(embed);
            } else {
                return { resolved: true, embeds: [embed] };
            }
        }
    }

    // Single Troop Lookup
    if ((entities.troopName || (entities.troopNames && entities.troopNames.length === 1)) && (!entities.heroName && (!entities.heroNames || entities.heroNames.length === 0))) {
        const troopQuery = entities.troopName || entities.troopNames[0];
        const lvl = (entities.levels && entities.levels.length > 0) ? entities.levels[0] : 10;
        const data = queryEngine.getTroopLevel(troopQuery, lvl);
        
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

          const ability = queryEngine.getTroopAbility(troopQuery, lvl);
          if (ability && ability.name) {
              let abText = ability.description;
              if (ability.statsAtLevel) {
                  abText += `\n\n**Stats at Lv. ${lvl}:**\n` + Object.entries(ability.statsAtLevel)
                      .map(([k, v]) => `• **${k}:** ${v}`)
                      .join('\n');
              }
              embed.addFields({ name: `✨ Ability: ${ability.name}`, value: abText });
          }

          if (isStrategyIntent) {
              prebuiltEmbeds.push(embed);
          } else {
              return { resolved: true, embeds: [embed] };
          }
        }
    }
  }

  // ⚔️ 4. COMPARISON ENGINE (Dual Cards + AI Fallthrough)
  const isExplicitVs = /(?:.+?)\s+vs\s+(?:.+)/i.test(text);
  const isExactlyTwoHeroes = entities.heroNames && entities.heroNames.length === 2;

  if ((isExplicitVs || isExactlyTwoHeroes) && !isSynergyQuery) {
    let nameA, nameB;
    
    if (isExactlyTwoHeroes) {
        nameA = entities.heroNames[0];
        nameB = entities.heroNames[1];
    } else if (isExplicitVs) {
        const vsMatch = text.match(/(.+?)\s+vs\s+(.+)/i);
        if (vsMatch) {
            nameA = vsMatch[1].trim();
            nameB = vsMatch[2].trim();
        }
    }

    if (nameA && nameB) {
        const entityA = queryEngine.findEntityByName(nameA);
        const entityB = queryEngine.findEntityByName(nameB);

        if (entityA && entityB && entityA.type === 'hero' && entityB.type === 'hero') {
            const h1 = entityA.data;
            const h2 = entityB.data;

            const embed1 = new EmbedBuilder()
              .setColor('#3498DB')
              .setTitle(`🦸‍♂️ ${h1.name}`)
              .addFields(
                { name: 'Faction / Rarity', value: `${h1.faction || 'N/A'} (${h1.rarity || 'N/A'})`, inline: false },
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
                { name: 'Faction / Rarity', value: `${h2.faction || 'N/A'} (${h2.rarity || 'N/A'})`, inline: false },
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

  // 🧠 5. STRATEGY & AI INTELLIGENCE PIPELINE
  let strategyData = build(intent, entities);
  
  // 🌟 SMART SYNERGY ENRICHMENT (Powered by your rich tags & types) 🌟
  if (isSynergyQuery && entities.troopNames && entities.troopNames.length === 1 && (!entities.heroNames || entities.heroNames.length === 0)) {
      const troopName = entities.troopNames[0];
      const troopEntity = queryEngine.findEntityByName(troopName);

      if (troopEntity && troopEntity.data) {
          const tData = troopEntity.data;
          
          // Collect ALL possible identifiers (Faction, Type, Tags, Primary/Secondary Roles)
          let troopIdentifiers = [];
          if (tData.faction) troopIdentifiers.push(String(tData.faction).toUpperCase());
          if (tData.type) troopIdentifiers.push(String(tData.type).toUpperCase());
          if (Array.isArray(tData.tags)) {
              troopIdentifiers.push(...tData.tags.map(t => String(t).toUpperCase()));
          }
          if (tData.analysis && Array.isArray(tData.analysis.secondaryRoles)) {
              troopIdentifiers.push(...tData.analysis.secondaryRoles.map(t => String(t).toUpperCase()));
          }
          if (tData.analysis && tData.analysis.primaryRole) {
              troopIdentifiers.push(String(tData.analysis.primaryRole).toUpperCase());
          }
          
          if (troopIdentifiers.length > 0) {
              // 🚀 Automatically use your engine's existing findHeroes() function!
              let allHeroes = typeof queryEngine.findHeroes === 'function' ? queryEngine.findHeroes() : [];
              
              // Fallbacks just in case
              if (allHeroes.length === 0) {
                  if (typeof queryEngine.getAllHeroes === 'function') {
                      allHeroes = queryEngine.getAllHeroes();
                  } else if (typeof queryEngine.getAllEntities === 'function') {
                      allHeroes = queryEngine.getAllEntities().filter(e => e.type === 'hero').map(e => e.data);
                  }
              }

              // Filter heroes that share AT LEAST ONE identifier with the troop
              const matchingHeroes = allHeroes.filter(h => {
                  let hIdentifiers = [];
                  if (h.faction) hIdentifiers.push(String(h.faction).toUpperCase());
                  if (h.type) hIdentifiers.push(String(h.type).toUpperCase());
                  if (Array.isArray(h.tags)) {
                      hIdentifiers.push(...h.tags.map(t => String(t).toUpperCase()));
                  }
                  if (Array.isArray(h.synergies)) {
                      hIdentifiers.push(...h.synergies.map(t => String(t).toUpperCase()));
                  }

                  // Check for any overlap between troop and hero
                  return hIdentifiers.some(id => troopIdentifiers.includes(id));
              });

              // Inject candidates directly into the context!
              if (matchingHeroes.length > 0) {
                  if (!strategyData.context) strategyData.context = {};
                  
                  strategyData.context.targetTroop = tData;
                  strategyData.context.factionSynergyCandidates = matchingHeroes.map(h => ({
                      name: h.name,
                      synergy_links: h.faction || h.type || (h.tags ? h.tags.join(', ') : 'N/A'),
                      rarity: h.rarity,
                      talent: h.talent ? (h.talent.description || h.talent) : 'N/A',
                      ability: h.ability ? (h.ability.description || h.ability) : 'N/A'
                  }));
                  
                  strategyData.sufficient = true; 
              }
          }
      }
  }

  if (strategyData.sufficient || prebuiltEmbeds.length > 0) {
      return { 
        resolved: false, 
        embeds: prebuiltEmbeds.length > 0 ? prebuiltEmbeds : null,
        intent, 
        entities, 
        context: strategyData.sufficient ? strategyData.context : null 
      };
  }

  return { resolved: false, intent, entities, context: null };
}

module.exports = { route };
