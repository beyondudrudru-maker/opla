/**
 * router/gameIntentClassifier.js
 */

const queryEngine = require('../engine/gameQueryEngine.js');
const { gameLibrary } = queryEngine;

const INTENTS = {
  GOLD: 'GOLD',
  GEM: 'GEM',
  FACT: 'FACT',
  CALC: 'CALC',
  STRATEGY: 'STRATEGY',
  UNKNOWN: 'UNKNOWN'
};

const GOLD_REGEX = /\bgold\b/i;
const GEM_REGEX = /\bgems?\b/i;

// 🚀 FACT REGEX explicitly catches "Card" requests
const FACT_REGEX = /\b(card|stats|info|details|what is)\b/i;

// 🚀 STRATEGY REGEX explicitly catches "how to use", "who is better"
const STRATEGY_REGEX = /\b(good|worth|best|should i|recommend|perform|performs|performance|which hero|which mage|which heroes|synerg|counter|meta|spike|upgrading|how|use|effectively|strategy|guide|better|who wins|who is better)\b/i;

const STAT_KEYWORDS = {
  hp: /\b(hp|health)\b/i,
  damage: /\b(damage|dmg)\b/i,
  defense: /\b(defense|def)\b/i,
  units: /\bunits?\b/i,
  attackSpeed: /\battack\s*speed\b/i,
  attackRange: /\battack\s*range\b/i,
  speed: /\b(movement\s*speed|speed)\b/i,
  aoeRadius: /\b(aoe|area\s*of\s*effect)\b/i,
  ability: /\bability\b/i
};

const CALC_REGEX = /\b(gain|grow(th)?|increase|from\s+(?:lv\.?|lvl\.?|level)|to\s+(?:lv\.?|lvl\.?|level)|vs\.?\b|versus|compare|difference|change)\b/i;

function extractLevels(text) {
  const levels = [];
  const re = /\b(?:lv\.?|lvl\.?|level)\s*(\d{1,2})\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 10) levels.push(n);
  }
  return levels;
}

function extractPercentages(text) {
  const pcts = [];
  const re = /\b(\d{1,3})\s*%/g;
  let m;
  while ((m = re.exec(text)) !== null) pcts.push(parseInt(m[1], 10));
  return pcts;
}

function _troopMentionsWithIndex(text) {
  const found = [];
  for (const t of gameLibrary.troops) {
    const re = new RegExp(`\\b${t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const m = re.exec(text);
    if (m) found.push({ name: t.name, index: m.index });
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

function extractCounts(text) {
  const mentions = _troopMentionsWithIndex(text);
  const counts = [];
  for (const mention of mentions) {
    const before = text.slice(0, mention.index);
    const m = before.match(/(\d{1,3})\s*x?\s*$/i);
    counts.push(m ? parseInt(m[1], 10) : null);
  }
  return counts;
}

function extractGoldGemAmount(text) {
  const m = text.match(/\b(\d{2,9})\s*(gold|gems?)\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function findTroopMentions(text) {
  return _troopMentionsWithIndex(text).map(f => f.name);
}

function findHeroMentions(text) {
  const found = [];
  for (const h of gameLibrary.heroes || []) {
    if (!h.name) continue;
    const re = new RegExp(`\\b${h.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) found.push(h.name);
  }
  return found;
}

const CATEGORY_SYNONYMS = {
  Undead: /\bundead\b/i,
  Tank: /\btanks?\b/i,
  Mages: /\bmages?\b/i,
  Ranger: /\brangers?\b/i,
  Human: /\bhumans?\b/i,
  Support: /\bsupports?\b/i
};

function findCategory(text) {
  for (const [canonical, re] of Object.entries(CATEGORY_SYNONYMS)) {
    if (re.test(text)) return canonical;
  }
  return null;
}

function findStat(text) {
  for (const [stat, re] of Object.entries(STAT_KEYWORDS)) {
    if (re.test(text)) return stat;
  }
  return null;
}

function resolveEntities(text) {
  const troopMentions = findTroopMentions(text);
  const heroMentions = findHeroMentions(text);

  return {
    troopName: troopMentions[0] || null,
    troopNames: troopMentions,
    heroName: heroMentions[0] || null,
    heroNames: heroMentions,
    category: findCategory(text),
    tags: [],
    levels: extractLevels(text),
    stat: findStat(text),
    ability: /\bability\b/i.test(text),
    percentages: extractPercentages(text),
    counts: extractCounts(text),
    goldGemAmount: extractGoldGemAmount(text),
    isComparison: /\bvs\.?\b|versus|compare\b/i.test(text)
  };
}

function classify(text) {
  const raw = String(text || '');
  const entities = resolveEntities(raw);

  if (GOLD_REGEX.test(raw)) return { intent: INTENTS.GOLD, entities };
  if (GEM_REGEX.test(raw)) return { intent: INTENTS.GEM, entities };

  // 🚀 STRATEGY gets priority. If you ask "How to use", let the AI do it!
  if (STRATEGY_REGEX.test(raw)) {
    return { intent: INTENTS.STRATEGY, entities };
  }

  const hasTwoLevels = entities.levels.length >= 2;
  const hasTwoTroops = entities.troopNames.length >= 2;
  const looksLikeCalc = CALC_REGEX.test(raw) && (hasTwoLevels || hasTwoTroops || entities.isComparison);

  if (looksLikeCalc) {
    return { intent: INTENTS.CALC, entities };
  }

  // 🚀 FACT catches "Alchemist card" or "Anavin card"
  const isShortQuery = raw.trim().split(/\s+/).length <= 4;
  if (FACT_REGEX.test(raw) || (isShortQuery && (entities.troopName || entities.heroName))) {
    return { intent: INTENTS.FACT, entities };
  }

  return { intent: INTENTS.UNKNOWN, entities };
}

module.exports = { INTENTS, classify, resolveEntities };
