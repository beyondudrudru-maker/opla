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

// 🚀 ADDED 'tell me about' to catch card requests naturally
const FACT_REGEX = /\b(card|stats|info|details|what is|tell me about)\b/i;

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

// 🚀 TROOP ALIASES — catches singular/plural and spacing variants that don't
// literally appear inside the official (usually plural or compound) DB name.
// Mirrors the hero alias dictionary below. Only entries where the natural
// way a player would type the name differs from the exact DB string need to
// be listed here — exact-name matches are still handled by the raw scan.
const TROOP_ALIASES = {
  'axe thrower': 'Axe Throwers',
  'axethrower': 'Axe Throwers',
  'axethrowers': 'Axe Throwers',
  'bone breaker': 'Bonebreaker',
  'bonebreakers': 'Bonebreaker',
  'storm mistress': 'Storm Mistresses',
  'assassin': 'Assassins',
  'cursed catapults': 'Cursed Catapult',
  'night hunters': 'Night Hunter',
  'magic archers': 'Magic Archer',
  'lava golems': 'Lava Golem',
  'stone golems': 'Stone Golem',
  'steel revenants': 'Steel Revenant'
};

// Strips a single trailing "s" for a lightweight, generic singular/plural
// fallback — deliberately conservative (no stemming library, no "es"/"ies"
// handling) so it can't accidentally over-match unrelated short words.
function _stripTrailingS(str) {
  return str.replace(/s\b/gi, '');
}

function _troopMentionsWithIndex(text) {
  const found = [];
  const seen = new Set();

  // 1. Exact DB-name scan (unchanged behavior for names typed as-is).
  for (const t of gameLibrary.troops) {
    const re = new RegExp(`\\b${t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const m = re.exec(text);
    if (m) {
      found.push({ name: t.name, index: m.index });
      seen.add(t.name);
    }
  }

  // 2. Alias dictionary — explicit spacing/pluralization variants.
  for (const [alias, canonicalName] of Object.entries(TROOP_ALIASES)) {
    if (seen.has(canonicalName)) continue;
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const m = re.exec(text);
    if (m) {
      found.push({ name: canonicalName, index: m.index });
      seen.add(canonicalName);
    }
  }

  // 3. Generic trailing-"s" fallback safety net — handles any troop name not
  // explicitly aliased above (e.g. a future roster addition) by comparing
  // the singularized forms of both the DB name and each word/phrase in the
  // query. Only applies to multi-character names to avoid short-word noise.
  for (const t of gameLibrary.troops) {
    if (seen.has(t.name)) continue;
    const singularName = _stripTrailingS(t.name);
    if (singularName.length < 4) continue;
    const re = new RegExp(`\\b${singularName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    const m = re.exec(text);
    if (m) {
      found.push({ name: t.name, index: m.index });
      seen.add(t.name);
    }
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

// 🚀 NEW: SMART HERO DETECTION (Aliases & Typos)
function findHeroMentions(text) {
  const found = [];
  const normalizedText = text.toLowerCase();

  // Dictionary to catch nicknames, short names, and common typos
  const aliases = {
    "anavin": "FIRETAMER ANAVIN",
    "firetamer": "FIRETAMER ANAVIN",
    "edelina": "EDELINA, QUEEN OF THE FOREST",
    "edilina": "EDELINA, QUEEN OF THE FOREST", // Typo catch
    "xana": "FIRE FURY XANA",
    "harkon": "HERALD OF FLAME HARKON",
    "brutallus": "BRUTALLUS THE TERRORBRINGER",
    "calyra": "CALYRA, CELESTIAL HEALER",
    "calira": "CALYRA, CELESTIAL HEALER",
    "atreya": "ATREYA, HAND OF VENGEANCE",
    "remus": "REMUS THE INDESTRUCTIBLE",
    "rumus": "REMUS THE INDESTRUCTIBLE", // Typo catch
    "malium": "MALIUM, THE HERALD OF CORRUPTION",
    "tristan": "CLERIC TRISTAN",
    "cleric": "CLERIC TRISTAN",
    "morgrane": "PLAGUE LORD MORGRANE",
    "durand": "INQUISITOR DURAND",
    "bumi": "BUMI THE DREAMWALKER",
    "drake": "DRAKE, TERROR OF THE SEAS",
    "keyra": "KEYRA THE WATER MAGE",
    "zaheer": "ZAHEER THE AIRLORD",
    "sigurd": "SIGURD THE ICE MAGE",
    "bone dragon": "BONE DRAGON",
    "morgana": "MORGANA THE DARK MAGE",
    "ophelia": "OPHELIA THE SPELLCASTER",
    "dragon rider": "DRAGON RIDER"
  };

  // 1. Direct Alias Matching
  for (const [alias, fullName] of Object.entries(aliases)) {
    const re = new RegExp(`\\b${alias}\\b`, 'i');
    if (re.test(text) && !found.includes(fullName)) {
      found.push(fullName);
    }
  }

  // 2. Dynamic partial word matching (safety net)
  for (const h of gameLibrary.heroes || []) {
    if (!h.name || found.includes(h.name)) continue;
    const parts = h.name.replace(/,/g, '').split(/\s+/);
    for (const part of parts) {
        // Skip common filler words, only match unique identifying parts
        if (part.length > 3 && !['THE', 'OF', 'QUEEN', 'LORD', 'HAND'].includes(part.toUpperCase())) { 
            const re = new RegExp(`\\b${part}\\b`, 'i');
            if (re.test(text)) {
                found.push(h.name);
                break;
            }
        }
    }
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

  // 🛡️ FALSE-POSITIVE "VS" GUARD (Fix: "Bengali vs Vikings" banter trap)
  // The raw presence of "vs"/"versus"/"compare" is NOT sufficient signal on
  // its own — casual phrases like "Bengali vs Vikings" or "cats vs dogs"
  // contain the word but reference nothing in the game. isComparison is now
  // only true when the "vs"-style wording co-occurs with at least two
  // recognized game entities (heroes or troops) OR two explicit level
  // references, which is the only shape a *real* game comparison can take.
  const hasVsWording = /\bvs\.?\b|versus|compare\b/i.test(text);
  const levelsFound  = extractLevels(text);
  const hasTwoKnownEntities =
    heroMentions.length >= 2 ||
    troopMentions.length >= 2 ||
    levelsFound.length   >= 2;

  return {
    troopName: troopMentions[0] || null,
    troopNames: troopMentions,
    heroName: heroMentions[0] || null,
    heroNames: heroMentions,
    category: findCategory(text),
    tags: [],
    levels: levelsFound,
    stat: findStat(text),
    ability: /\bability\b/i.test(text),
    percentages: extractPercentages(text),
    counts: extractCounts(text),
    goldGemAmount: extractGoldGemAmount(text),
    isComparison: hasVsWording && hasTwoKnownEntities
  };
}

function classify(text) {
  const raw = String(text || '');
  const entities = resolveEntities(raw);

  if (GOLD_REGEX.test(raw)) return { intent: INTENTS.GOLD, entities };
  if (GEM_REGEX.test(raw)) return { intent: INTENTS.GEM, entities };

  if (STRATEGY_REGEX.test(raw)) {
    return { intent: INTENTS.STRATEGY, entities };
  }

  const hasTwoLevels = entities.levels.length >= 2;
  const hasTwoTroops = entities.troopNames.length >= 2;
  const hasTwoHeroes = entities.heroNames.length >= 2;
  const looksLikeCalc = CALC_REGEX.test(raw) && (hasTwoLevels || hasTwoTroops || hasTwoHeroes || entities.isComparison);

  if (looksLikeCalc) {
    return { intent: INTENTS.CALC, entities };
  }

  // Allow up to 5 words to catch things like "tell me about rumus"
  const isShortQuery = raw.trim().split(/\s+/).length <= 5;
  if (FACT_REGEX.test(raw) || (isShortQuery && (entities.troopName || entities.heroName))) {
    return { intent: INTENTS.FACT, entities };
  }

  return { intent: INTENTS.UNKNOWN, entities };
}

module.exports = { INTENTS, classify, resolveEntities };