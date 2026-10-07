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

const FIELD_MAX = 1024; // Discord embed field value limit

/** Monospace table, right-aligned, widths computed from the data (stays narrow on mobile). */
function _table(headers, rows) {
  const w = headers.map((h, i) => Math.max(String(h).length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => String(c).padStart(w[i])).join(' ');
  return '```\n' + [line(headers), ...rows.map(line)].join('\n') + '\n```';
}
const _n = v => (typeof v === 'number' ? v.toLocaleString('en-US') : String(v ?? '-'));
const _clip = (s, n = FIELD_MAX) => (String(s).length <= n ? String(s) : String(s).slice(0, n - 1) + '…');

/** Lv1–10 HP/Def/Atk table for a hero. Returns null if no per-level data exists. */
function _heroLevelTable(hero) {
  const sl = hero.statLevels;
  if (!sl || !Array.isArray(sl.hp)) return null;
  const rows = sl.hp.map((hp, i) => [i + 1, _n(hp), _n(sl.defense?.[i]), _n(sl.attack?.[i])]);
  return _table(['Lv', 'HP', 'Def', 'Atk'], rows);
}

/**
 * buildHeroCard(hero)
 * Stat card for a single resolved hero: ALL 10 levels in one table (this card is the single
 * place stats are shown, so the AI reply does not repeat them).
 */
function buildHeroCard(hero) {
  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle(`🦸‍♂️ ${hero.name}`)
    .addFields(
      { name: 'Faction',     value: hero.faction || 'N/A',                                  inline: true },
      { name: 'Rarity',      value: hero.rarity  || 'N/A',                                  inline: true }
    );
  const table = _heroLevelTable(hero);
  if (table) {
    embed.addFields({ name: '📈 Levels 1–10', value: _clip(table) });
  } else {
    embed.addFields(
      { name: '❤️ HP',       value: formatStat(hero.stats?.hp),      inline: true },
      { name: '🛡️ Defense', value: formatStat(hero.stats?.defense), inline: true },
      { name: '⚔️ Attack',  value: formatStat(hero.stats?.attack),  inline: true }
    );
  }
  if (hero.talent) {
    const eff = hero.talent.effects
      ? '\n' + Object.entries(hero.talent.effects).map(([k, v]) => `• **${k}:** ${v} (Lv1→Lv10)`).join('\n')
      : '';
    embed.addFields({ name: `🌟 Talent: ${hero.talent.name}`, value: _clip(hero.talent.description + eff) });
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
function buildTroopCard(data, ability, lvl, fullTroop) {
  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`📜 ${data.troopName} (Lv. ${data.level})`);

  const L = fullTroop && fullTroop.levels;
  if (L && Array.isArray(L.hp)) {
    // All 10 levels; '>' marks the level the user asked about.
    const rows = L.hp.map((hp, i) => [
      (i + 1 === Number(lvl) ? '>' : ' ') + (i + 1), _n(L.units?.[i]), _n(hp), _n(L.damage?.[i]), _n(L.defense?.[i]),
    ]);
    embed.addFields({ name: '📈 Levels 1–10', value: _clip(_table(['Lv', 'Un', 'HP', 'Dmg', 'Def'], rows)) });
  } else {
    embed.addFields(
      { name: '❤️ HP',      value: data.hp?.toLocaleString()      || 'N/A', inline: true },
      { name: '⚔️ Damage', value: data.damage?.toLocaleString()   || 'N/A', inline: true },
      { name: '🛡️ Defense',value: String(data.defense             || 'N/A'), inline: true },
      { name: '👥 Units',   value: String(data.units              || 1),    inline: true }
    );
  }

  if (ability && ability.name) {
    embed.addFields({ name: `✨ Ability: ${ability.name}`, value: _clip(ability.description) });
    const ls = fullTroop && fullTroop.ability && fullTroop.ability.levelStats;
    if (ls && Object.keys(ls).length) {
      const keys = Object.keys(ls);
      const lines = Array.from({ length: 10 }, (_, i) =>
        `${i + 1 === Number(lvl) ? '▶ ' : ''}L${i + 1}: ` + keys.map(k => (Array.isArray(ls[k]) ? ls[k][i] : ls[k])).join(' · '));
      embed.addFields({ name: `📊 Ability scaling (${keys.join(' · ')})`, value: _clip(lines.join('\n')) });
    } else if (ability.statsAtLevel) {
      const txt = Object.entries(ability.statsAtLevel).map(([k, v]) => `• **${k}:** ${v}`).join('\n');
      embed.addFields({ name: `📊 Stats at Lv. ${lvl}`, value: _clip(txt) });
    }
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
