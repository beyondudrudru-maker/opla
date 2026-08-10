/**
 * router/gameDomainRouter.js
 * 
 * PURPOSE: Resolves user queries into visual Embed Cards AND passes strict deterministic
 * data contexts to the AI pipeline for deep, hallucination-free strategic analysis.
 * 🌟 FINAL UPGRADE: Scenario D added for Advanced 2-Hero Combos, Equipment, Scenarios, and COUNTERS!
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

  // 🛡️ BULLETPROOF ENTITY SCRAPER 
  if (!entities.heroNames) entities.heroNames = [];
  if (!entities.troopNames) entities.troopNames = [];
  if (entities.heroName && !entities.heroNames.includes(entities.heroName)) entities.heroNames.push(entities.heroName);
  if (entities.troopName && !entities.troopNames.includes(entities.troopName)) entities.troopNames.push(entities.troopName);

  const allKnownHeroes = typeof queryEngine.findHeroes === 'function' ? queryEngine.findHeroes() : [];
  const allKnownTroops = typeof queryEngine.findTroops === 'function' ? queryEngine.findTroops() : [];
  
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const textNoSpace = text.toLowerCase().replace(/[^a-z0-9]/g, '');

  allKnownHeroes.forEach(h => {
      const hName = h.name.toLowerCase();
      const hNameNoSpace = hName.replace(/\s+/g, '');
      if ((normalizedText.includes(hName) || textNoSpace.includes(hNameNoSpace)) && !entities.heroNames.some(e => e.toLowerCase() === hName)) {
          entities.heroNames.push(h.name);
      }
  });

  allKnownTroops.forEach(t => {
      const tName = t.name.toLowerCase();
      const tNameNoSpace = tName.replace(/\s+/g, '');
      if ((normalizedText.includes(tName) || textNoSpace.includes(tNameNoSpace)) && !entities.troopNames.some(e => e.toLowerCase() === tName)) {
          entities.troopNames.push(t.name);
      }
  });

  if (entities.heroNames.length > 0) entities.heroName = entities.heroNames[0];
  if (entities.troopNames.length > 0) entities.troopName = entities.troopNames[0];

  // 🌍 MULTILINGUAL & ADVANCED SYNERGY REGEX
  const isSynergyQuery = /\b(best with|synergy|alongside|use with|combination|combo|formation|weapon|armor|equipment|gear|which hero|which troop|which troops|konse hero|konse troop|kiske sath|accha outcome|mejor con|melhor com|meilleur avec|terbaik dengan|sinergia|synergie)\b/i.test(text);

  // ⚔️ COUNTER & COMBAT REGEX
  const isCounterQuery = /\b(counter|beat|against|harana|opponents?|enemy|enemies|kill|defeat|samne)\b/i.test(text);

  // 🧠 FORCE STRATEGY INTENT
  if (isSynergyQuery || isCounterQuery) {
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

  if ((isExplicitVs || isExactlyTwoHeroes) && !isSynergyQuery && !isCounterQuery) {
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
  if (!strategyData) strategyData = { sufficient: false, context: null };
  if (!strategyData.context) strategyData.context = {};
  
  let enrichmentAdded = false;

  // Compute generic game tags early for efficient matching
  const gameTags = ['tank', 'mage', 'archer', 'undead', 'human', 'beast', 'support', 'melee', 'ranged', 'ranger', 'summoner', 'assassin', 'boss', 'pvp', 'defense'];
  const mentionedTags = gameTags.filter(tag => new RegExp(`\\b${tag}s?\\b`, 'i').test(text));

  // 🌟 SCENARIO A: EXPLICIT DATA INJECTION
  if (entities.heroNames.length > 0) {
      strategyData.context.mentionedHeroes = [];
      entities.heroNames.forEach(name => {
          const data = queryEngine.findEntityByName(name);
          if (data && data.data) strategyData.context.mentionedHeroes.push(data.data);
      });
      if (strategyData.context.mentionedHeroes.length > 0) enrichmentAdded = true;
  }

  if (entities.troopNames.length > 0) {
      strategyData.context.mentionedTroops = [];
      entities.troopNames.forEach(name => {
          const data = queryEngine.findEntityByName(name);
          if (data && data.data) strategyData.context.mentionedTroops.push(data.data);
      });
      if (strategyData.context.mentionedTroops.length > 0) enrichmentAdded = true;
  }

  // 🌟 SCENARIO B: BIDIRECTIONAL SMART SYNERGY ENRICHMENT 🌟
  if (isSynergyQuery && !isCounterQuery) {
      if (entities.troopNames && entities.troopNames.length > 0) {
          let troopIdentifiers = new Set();
          entities.troopNames.forEach(tName => {
              const tEntity = queryEngine.findEntityByName(tName);
              if (tEntity && tEntity.data) {
                  const tData = tEntity.data;
                  if (tData.faction) troopIdentifiers.add(String(tData.faction).toUpperCase());
                  if (tData.type) troopIdentifiers.add(String(tData.type).toUpperCase());
                  if (Array.isArray(tData.tags)) tData.tags.forEach(t => troopIdentifiers.add(String(t).toUpperCase()));
                  if (tData.analysis && Array.isArray(tData.analysis.secondaryRoles)) tData.analysis.secondaryRoles.forEach(t => troopIdentifiers.add(String(t).toUpperCase()));
                  if (tData.analysis && tData.analysis.primaryRole) troopIdentifiers.add(String(tData.analysis.primaryRole).toUpperCase());
              }
          });

          if (troopIdentifiers.size > 0) {
              const tIdArray = Array.from(troopIdentifiers);
              const matchingHeroes = allKnownHeroes.filter(h => {
                  let hId = [];
                  if (h.faction) hId.push(String(h.faction).toUpperCase());
                  if (h.type) hId.push(String(h.type).toUpperCase());
                  if (Array.isArray(h.tags)) hId.push(...h.tags.map(t => String(t).toUpperCase()));
                  if (Array.isArray(h.synergies)) hId.push(...h.synergies.map(t => String(t).toUpperCase()));
                  return hId.some(id => tIdArray.includes(id));
              });

              if (matchingHeroes.length > 0) {
                  strategyData.context.heroRecommendations = matchingHeroes.map(h => ({
                      name: h.name,
                      synergy_links: h.faction || h.type || (h.tags ? h.tags.join(', ') : 'N/A'),
                      rarity: h.rarity,
                      talent: h.talent ? (h.talent.description || h.talent) : 'N/A'
                  }));
                  enrichmentAdded = true;
              }
          }
      }

      if (entities.heroNames && entities.heroNames.length > 0) {
          let heroIdentifiers = new Set();
          entities.heroNames.forEach(hName => {
              const hEntity = queryEngine.findEntityByName(hName);
              if (hEntity && hEntity.data) {
                  const hData = hEntity.data;
                  if (hData.faction) heroIdentifiers.add(String(hData.faction).toUpperCase());
                  if (hData.type) heroIdentifiers.add(String(hData.type).toUpperCase());
                  if (Array.isArray(hData.tags)) hData.tags.forEach(t => heroIdentifiers.add(String(t).toUpperCase()));
                  if (Array.isArray(hData.synergies)) hData.synergies.forEach(t => heroIdentifiers.add(String(t).toUpperCase()));
              }
          });

          if (heroIdentifiers.size > 0) {
              const hIdArray = Array.from(heroIdentifiers);
              const matchingTroops = allKnownTroops.filter(t => {
                  let tId = [];
                  if (t.faction) tId.push(String(t.faction).toUpperCase());
                  if (t.type) tId.push(String(t.type).toUpperCase());
                  if (Array.isArray(t.tags)) tId.push(...t.tags.map(tag => String(tag).toUpperCase()));
                  if (t.analysis && Array.isArray(t.analysis.secondaryRoles)) tId.push(...t.analysis.secondaryRoles.map(tag => String(tag).toUpperCase()));
                  if (t.analysis && t.analysis.primaryRole) tId.push(String(t.analysis.primaryRole).toUpperCase());
                  return tId.some(id => hIdArray.includes(id));
              });

              if (matchingTroops.length > 0) {
                  strategyData.context.troopRecommendations = matchingTroops.map(t => ({
                      name: t.name,
                      synergy_links: t.faction || (t.tags ? t.tags.join(', ') : 'N/A'),
                      rarity: t.rarity
                  }));
                  enrichmentAdded = true;
              }
          }
      }
  }

  // 🌟 SCENARIO C: CATEGORY & ROLE SCANNER 🌟
  if (!enrichmentAdded && mentionedTags.length > 0 && !isCounterQuery) {
      const matchingHeroes = allKnownHeroes.filter(h => {
          let hId = [];
          if (h.faction) hId.push(String(h.faction).toLowerCase());
          if (h.type) hId.push(String(h.type).toLowerCase());
          if (Array.isArray(h.tags)) hId.push(...h.tags.map(t => String(t).toLowerCase()));
          if (Array.isArray(h.synergies)) hId.push(...h.synergies.map(t => String(t).toLowerCase()));
          
          return mentionedTags.some(mt => hId.some(id => id.includes(mt)));
      });

      if (matchingHeroes.length > 0) {
          strategyData.context.targetCategory = mentionedTags.join(', ').toUpperCase();
          strategyData.context.heroRecommendations = matchingHeroes.map(h => ({
              name: h.name,
              synergy_links: h.faction || h.type || (h.tags ? h.tags.join(', ') : 'N/A'),
              rarity: h.rarity,
              talent: h.talent ? (h.talent.description || h.talent) : 'N/A'
          }));
          enrichmentAdded = true;
      }
  }

  // 🌟 SCENARIO D: ADVANCED COMBOS, EQUIPMENT & COUNTERS 🌟
  const strategiesData = queryEngine.gameLibrary ? queryEngine.gameLibrary.strategies : null;
  
  if (strategiesData) {
      // 1. Equipment Guide Check
      if (/\b(weapon|armor|equipment|gear|item|items)\b/i.test(text) && strategiesData.equipmentSynergies) {
          strategyData.context.equipmentGuide = strategiesData.equipmentSynergies;
          enrichmentAdded = true;
      }

      // 2. COUNTER STRATEGY CHECK (NEW)
      if (isCounterQuery && strategiesData.counterGuides) {
          const relevantCounters = strategiesData.counterGuides.filter(guide => {
              const guideString = JSON.stringify(guide).toLowerCase();
              return entities.heroNames.some(h => guideString.includes(h.toLowerCase())) ||
                     entities.troopNames.some(t => guideString.includes(t.toLowerCase())) ||
                     text.toLowerCase().includes(guide.targetOpponent.toLowerCase());
          });

          if (relevantCounters.length > 0) {
              strategyData.context.counterGuides = relevantCounters;
              enrichmentAdded = true;
          }
      }

      // 3. 2-Hero Formations Check
      if (isSynergyQuery && !isCounterQuery && strategiesData.optimalFormations) {
          const relevantFormations = strategiesData.optimalFormations.filter(form => {
              const formString = JSON.stringify(form).toLowerCase();
              return entities.heroNames.some(h => formString.includes(h.toLowerCase())) ||
                     entities.troopNames.some(t => formString.includes(t.toLowerCase())) ||
                     mentionedTags.some(tag => formString.includes(tag.toLowerCase()));
          });

          if (relevantFormations.length > 0) {
              strategyData.context.optimalFormations = strategiesData.optimalFormations.slice(0, 3);
              enrichmentAdded = true;
          }
      }

      // 4. Scenario Strategy Guides (Bosses, PvP, Scenarios)
      if (strategiesData.scenarioGuides && !isCounterQuery) {
          const relevantScenarios = strategiesData.scenarioGuides.filter(scen => {
              const scenString = JSON.stringify(scen).toLowerCase();
              return mentionedTags.some(tag => scenString.includes(tag.toLowerCase())) || 
                     text.toLowerCase().includes("scenario") || 
                     text.toLowerCase().includes("fight") ||
                     text.toLowerCase().includes("boss");
          });
          
          if (relevantScenarios.length > 0) {
              strategyData.context.scenarioGuides = relevantScenarios;
              enrichmentAdded = true;
          }
      }
  }

  if (enrichmentAdded) {
      strategyData.sufficient = true;
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