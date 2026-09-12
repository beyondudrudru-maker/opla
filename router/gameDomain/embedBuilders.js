/**
 * router/gameDomain/embedBuilders.js
 *
 * All Discord EmbedBuilder construction for the game domain router lives
 * here: single hero/troop fact cards, 1v1 comparison cards, the generic
 * synergy-entity card, and the Gold/Gem economy calculator embed.
 *
 * Kept separate from routing logic so visual/formatting tweaks (colors,
 * field layout, emoji) never require touching the entity-resolution or
 * intent-detection code paths.
 */

const { EmbedBuilder } = require('discord.js');
const { formatStat } = require('./statFormatter.js');

/**
 * buildHeroCard(hero)
 * Full stat card for a single resolved hero record.
 */
function buildHeroCard(hero) {
  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle(`🦸‍♂️ ${hero.name}`)
    .addFields(
      { name: 'Faction',     value: hero.faction || 'N/A',                                  inline: true },
      { name: 'Rarity',      value: hero.rarity  || 'N/A',                                  inline: true },
      { name: '❤️ HP',       value: formatStat(hero.stats?.hp),      inline: true },
      { name: '🛡️ Defense', value: formatStat(hero.stats?.defense), inline: true },
      { name: '⚔️ Attack',  value: formatStat(hero.stats?.attack),  inline: true }
    );
  if (hero.talent) {
    embed.addFields({ name: `🌟 Talent: ${hero.talent.name}`, value: hero.talent.description });
  }
  if (hero.ability && hero.ability.description) {
    embed.addFields({ name: `✨ Ability: ${hero.ability.name || 'Skill'}`, value: hero.ability.description });
  }
  return embed;
}

/**
 * buildTroopCard(data, ability)
 * data: result of queryEngine.getTroopLevel(troopQuery, lvl)
 * ability: result of queryEngine.getTroopAbility(troopQuery, lvl) (optional)
 */
function buildTroopCard(data, ability, lvl) {
  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`📜 ${data.troopName} (Lv. ${data.level})`)
    .addFields(
      { name: '❤️ HP',      value: data.hp?.toLocaleString()      || 'N/A', inline: true },
      { name: '⚔️ Damage', value: data.damage?.toLocaleString()   || 'N/A', inline: true },
      { name: '🛡️ Defense',value: String(data.defense             || 'N/A'), inline: true },
      { name: '👥 Units',   value: String(data.units              || 1),    inline: true }
    );

  if (ability && ability.name) {
    let abText = ability.description;
    if (ability.statsAtLevel) {
      abText += `\n\n**Stats at Lv. ${lvl}:**\n` +
        Object.entries(ability.statsAtLevel)
          .map(([k, v]) => `• **${k}:** ${v}`)
          .join('\n');
    }
    embed.addFields({ name: `✨ Ability: ${ability.name}`, value: abText });
  }
  return embed;
}

/**
 * buildComparisonCards(h1, h2)
 * Returns [embed1, embed2] for a resolved 1v1 hero-vs-hero comparison.
 */
function buildComparisonCards(h1, h2) {
  const embed1 = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle(`🦸‍♂️ ${h1.name}`)
    .addFields(
      { name: 'Faction / Rarity', value: `${h1.faction || 'N/A'} (${h1.rarity || 'N/A'})`, inline: false },
      { name: '❤️ HP',            value: formatStat(h1.stats?.hp),      inline: true },
      { name: '🛡️ Defense',      value: formatStat(h1.stats?.defense), inline: true },
      { name: '⚔️ Attack',       value: formatStat(h1.stats?.attack),  inline: true }
    );
  if (h1.talent)  embed1.addFields({ name: `🌟 Talent: ${h1.talent.name}`,  value: h1.talent.description });
  if (h1.ability) embed1.addFields({ name: `✨ Ability: ${h1.ability.name}`, value: h1.ability.description });

  const embed2 = new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle(`🦸‍♂️ ${h2.name}`)
    .addFields(
      { name: 'Faction / Rarity', value: `${h2.faction || 'N/A'} (${h2.rarity || 'N/A'})`, inline: false },
      { name: '❤️ HP',            value: formatStat(h2.stats?.hp),      inline: true },
      { name: '🛡️ Defense',      value: formatStat(h2.stats?.defense), inline: true },
      { name: '⚔️ Attack',       value: formatStat(h2.stats?.attack),  inline: true }
    );
  if (h2.talent)  embed2.addFields({ name: `🌟 Talent: ${h2.talent.name}`,  value: h2.talent.description });
  if (h2.ability) embed2.addFields({ name: `✨ Ability: ${h2.ability.name}`, value: h2.ability.description });

  return [embed1, embed2];
}

/**
 * buildEntityEmbed(entity, type)
 * Shared embed builder used by any code path (not just a lone "what is X"
 * lookup) so any resolved hero/troop — including ones surfaced inside a
 * multi-entity synergy query — gets a real Discord embed instead of the AI
 * having to type out HP/Talent/Ability text in prose from memory.
 */
function buildEntityEmbed(entity, type) {
  if (!entity) return null;
  if (type === 'hero') return buildHeroCard(entity);
  if (type === 'troop') {
    const troop = entity;
    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle(`📜 ${troop.name}`);

    embed.addFields(
      { name: '❤️ HP',       value: formatStat(troop.levels?.hp ?? troop.stats?.hp),           inline: true },
      { name: '⚔️ Damage',   value: formatStat(troop.levels?.damage ?? troop.stats?.damage),   inline: true },
      { name: '🛡️ Defense', value: formatStat(troop.levels?.defense ?? troop.stats?.defense), inline: true },
      { name: 'Rarity',      value: troop.rarity || 'N/A',                                     inline: true }
    );

    if (troop.ability && troop.ability.description) {
      embed.addFields({ name: `✨ Ability: ${troop.ability.name || 'Skill'}`, value: troop.ability.description });
    }
    return embed;
  }
  return null;
}

/**
 * buildEconomyEmbed(intent, economyRatios, text)
 * Builds the deterministic Gold/Gem spending-plan dashboard embed.
 */
function buildEconomyEmbed(intent, economyRatios, text) {
  const isGold  = intent === 'GOLD';
  const ratios  = isGold ? economyRatios.gold : economyRatios.gems;
  const amountMatch = text.match(/\b(\d+k?|\d+)\b/i);

  const embed = new EmbedBuilder()
    .setColor(isGold ? '#FFD700' : '#2ECC71')
    .setTitle(isGold ? '💰 Ultimate Gold Blueprint' : '💎 Premium Gem Matrix');

  if (amountMatch) {
    let amountStr = amountMatch[1].toLowerCase();
    let amount    = amountStr.includes('k') ? parseInt(amountStr) * 1000 : parseInt(amountStr);
    embed.setDescription(`**Calculated Spending Plan for ${amount.toLocaleString()} ${isGold ? 'Gold' : 'Gems'}**`);
    for (const [category, pct] of Object.entries(ratios)) {
      embed.addFields({ name: `${category} (${pct}%)`, value: Math.round(amount * (pct / 100)).toLocaleString(), inline: true });
    }
  } else {
    embed.setDescription('**Optimal Spending Ratios**');
    for (const [category, pct] of Object.entries(ratios)) {
      embed.addFields({ name: category, value: `${pct}%`, inline: true });
    }
  }
  return embed;
}

module.exports = {
  buildHeroCard,
  buildTroopCard,
  buildComparisonCards,
  buildEntityEmbed,
  buildEconomyEmbed
};
