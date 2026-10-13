/**
 * router/gameDomain/groupQuery.js — deterministic troop-family lists ("mage troops", "undead troops", "all troops list").
 * Built straight from data/troops.js (zero AI tokens). Returns a Discord embed or null.
 */
const { EmbedBuilder } = require('discord.js');
const troopsMod = require('../../data/troops.js');
const TROOPS = Array.isArray(troopsMod) ? troopsMod : (troopsMod.troops || troopsMod.TROOPS || []);

const FAMILIES = { mage: 'Mages', mages: 'Mages', undead: 'Undead', human: 'Human', humans: 'Human',
  ranger: 'Ranger', rangers: 'Ranger', ranged: 'Ranger', tank: 'Tank', tanks: 'Tank',
  support: 'Support', supports: 'Support', trickster: 'Trickster', tricksters: 'Trickster' };
const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };
// strategy words mean "advice", not "list" — let the normal pipeline answer those
const ADVICE = /\b(best|better|counter|vs|against|buff|buffs|use|using|good for|should|synerg\w*|formation|boss|arena|pvp|beat|how|why|compare|with)\b/;

function _norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

function detectGroup(text) {
  const t = _norm(text);
  if (!/\btroops?\b/.test(t)) return null;
  if (ADVICE.test(t)) return null;
  const fam = Object.keys(FAMILIES).find(f => new RegExp(`\\b${f}\\s+troops?\\b|\\btroops?\\s+(?:of\\s+)?${f}\\b`).test(t));
  if (fam) return { family: FAMILIES[fam] };
  if (/\b(all|every|full|complete|total)\s+(?:the\s+)?troops?\b|\btroops?\s+list\b|\blist\s+of\s+(?:all\s+)?(?:the\s+)?troops?\b/.test(t)) return { family: null };
  return null;
}

function buildGroupEmbed(text) {
  const g = detectGroup(text);
  if (!g || !TROOPS.length) return null;
  const list = TROOPS.filter(x => !g.family || (x.categories || []).includes(g.family))
    .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) || a.name.localeCompare(b.name));
  if (!list.length) return null;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lines = list.map(x => `• **${x.name}** — ${cap(x.rarity)} · ${(x.categories || []).join(' / ')}`);
  return new EmbedBuilder()
    .setTitle(g.family ? `${g.family === 'Mages' ? 'Mage' : g.family} troops (${list.length})` : `All troops (${list.length})`)
    .setDescription(lines.join('\n').slice(0, 4000))
    .setFooter({ text: 'Ask about any troop by name for its full card.' });
}

module.exports = { detectGroup, buildGroupEmbed };
