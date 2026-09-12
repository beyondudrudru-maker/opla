/**
 * router/gameDomain/summaries.js
 *
 * Pillar / Feature: Context Window Protection.
 * Compacts a full hero/troop record down to the minimal fields the AI needs
 * to reason about it in bulk: Name, Rarity, Primary Role, Talent Name.
 * Used whenever more than 3 heroes/troops are mentioned in a single message.
 */

function toHeroSummary(hero) {
  if (!hero) return null;
  return {
    name: hero.name || 'Unknown',
    rarity: hero.rarity || 'N/A',
    primaryRole: (hero.analysis && hero.analysis.primaryRole) || hero.type || hero.faction || 'N/A',
    talentName: (hero.talent && hero.talent.name) || 'N/A'
  };
}

function toTroopSummary(troop) {
  if (!troop) return null;
  return {
    name: troop.name || 'Unknown',
    rarity: troop.rarity || 'N/A',
    primaryRole: (troop.analysis && troop.analysis.primaryRole) || troop.type || troop.faction || 'N/A',
    talentName: (troop.talent && troop.talent.name) || (troop.ability && troop.ability.name) || 'N/A'
  };
}

module.exports = { toHeroSummary, toTroopSummary };
