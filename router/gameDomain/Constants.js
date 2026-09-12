/**
 * router/gameDomain/constants.js
 *
 * All static lookup tables and regex dictionaries used by the game domain
 * router, in one place for easy long-term maintenance.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Boss & Category Keyword Lists
// ─────────────────────────────────────────────────────────────────────────────

const BOSS_KEYWORDS = ['dagon', 'kraken', 'kalidor', 'balthazar', 'ashira'];

// Category/role keywords that trigger roster-count enrichment.
// Keep this list in sync with the categories and roles defined in troops.js / heroes.js.
const CATEGORY_KEYWORDS = [
  'tank', 'tanks',
  'mage', 'mages',
  'archer', 'archers',
  'ranger', 'rangers',
  'assassin', 'assassins',
  'support',
  'healer', 'healers',
  'summoner', 'summoners',
  'debuffer', 'debuffers',
  'controller', 'controllers',
  'undead',
  'human',
  'beast', 'beasts',
  'dreads',
  'elevates',
  'melee',
  'ranged'
];

// Generic tag list for scenario / category matching against hero/troop records.
const GAME_TAGS = ['tank', 'mage', 'archer', 'undead', 'human', 'beast', 'support', 'melee', 'ranged', 'ranger', 'summoner', 'assassin', 'boss', 'pvp', 'defense'];

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic Fallback Library (Pillar 1)
// ─────────────────────────────────────────────────────────────────────────────
// General, category-level strategic guidance used ONLY when a specific boss or
// entity lookup returns null from queryEngine. Keeps the AI grounded in a
// sound general principle instead of inventing specifics for missing data.
const HEURISTIC_FALLBACKS = {
  boss: {
    summary: 'Specific boss data is unavailable for this target.',
    generalRule: 'Prioritize high single-target DPS and sustain (healing/shields). Bosses typically punish squishy backlines, so front-load tank/defense units and stagger cooldown-based burst rather than committing it all at once. Hero abilities/persistent effects matter far more than raw stats for bosses. Never recommend Harkon, Fire Fury Xana, or Pyrotechnician for boss fights — their kits are disabled or non-functional in boss battles. Every boss resists either Melee or Ranged damage (30% protection), but which type is active ROTATES each season — never assume which one; ask the player to check the boss\'s in-game passive card, then deploy the opposite damage type as primary DPS.'
  },
  hero: {
    summary: 'This hero could not be found in the local database.',
    generalRule: 'Without verified stats, recommend the user double-check the spelling or confirm the hero exists in the current roster rather than guessing at a talent, ability, or rarity.'
  },
  troop: {
    summary: 'This troop could not be found in the local database.',
    generalRule: 'Without verified stats, recommend the user double-check the spelling/level or confirm the troop exists in the current roster rather than guessing at stats.'
  },
  category: {
    summary: 'No specific data was found for this category.',
    generalRule: 'General army-composition principle: balance frontline tanks, mid-line sustained damage, and backline burst/control rather than stacking a single role.'
  },
  // 🆕 ADVANCEMENT: dedicated fallback for the "named entity resolved by the
  // classifier but rejected by the DB-validation guard" case (entityScraper's
  // validateSeededEntities). Distinct copy from `hero`/`troop` so the AI's
  // wording can be tuned independently later without touching those paths.
  unvalidatedEntity: {
    summary: 'No known hero, troop, or boss matched this message.',
    generalRule: 'Treat this as ordinary conversation rather than a game-data lookup — do not invent or assume stats, talents, or abilities for a name that is not in the local roster.'
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTENT_PATTERNS — Consolidated regex dictionary
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_PATTERNS = {
  // Synergy / "best paired with" style queries — multilingual variants included
  // to match existing user base phrasing (Hinglish, Spanish, Portuguese, French, Indonesian).
  // 🆕 FIX: "best hero for X" / "best troop for X" is extremely natural
  // phrasing that was previously NOT caught by this pattern — it only had
  // "best with", not "best hero for" / "best troop for" / "best X for Y".
  synergy: /\b(best with|best (hero|troop|heroes|troops)\s+(for|to use|to pair)|synergy|alongside|use with|pair(ed)?\s+with|combination|combo|formation|weapon|armor|equipment|gear|which hero|which troop|which troops|konse hero|konse troop|kiske sath|accha outcome|mejor con|melhor com|meilleur avec|terbaik dengan|sinergia|synergie)\b/i,

  // Counter / "how do I beat" style queries — multilingual variants included.
  counter: /\b(counter|beat|against|harana|opponents?|enemy|enemies|kill|defeat|samne)\b/i,

  // Category/roster count queries — "how many tank troops", "list all mages", etc.
  categoryCountA: /\b(how many|list|all|count|total|what|which)\b.{0,40}\b(troop|hero|unit|mage|tank|archer|healer|summoner|debuffer|ranger|controller|assassin)\b/i,
  categoryCountB: /\b(mage|tank|archer|healer|summoner|debuffer|ranger|controller|assassin)s?\b.{0,30}\b(list|count|all|total|we have|available|roster)\b/i,

  // 🆕 Macro/Taxonomy queries — asking about the classification system itself
  // rather than a specific category, e.g. "how many roles are there",
  // "what types of categories exist", "all factions", "what are the tags".
  taxonomyQuery: /\b(how many|what|which|list|all)\b.{0,40}\b(roles?|categories|category|factions?|tags?|classifications?|types? of (troop|hero|unit|role|categor))\b/i,

  // Pronoun / follow-up resolution trigger — multilingual variants included.
  followUp: /\b(uska|iske|woh|he|she|it|they|him|her|this|that|its|stats|ability|skill)\b/i,

  // Fact-style follow-up disambiguation ("what's its ability", "how much hp").
  factFollowUp: /\b(ability|skill|stat|stats|hp|damage|health)\b/i,

  // Explicit "X vs Y" comparison phrasing.
  explicitVs: /(?:.+?)\s+vs\s+(?:.+)/i,
  vsSplit: /(.+?)\s+vs\s+(.+)/i,

  // Equipment/gear guide queries.
  equipment: /\b(weapon|armor|equipment|gear|item|items)\b/i,

  // Generic scenario/fight/boss phrasing used for loose scenario matching.
  genericScenario: /\b(scenario|fight|boss)\b/i,

  // Dashboard/mechanical commands — strict prefix, never gets an AI voice.
  dashboardCommand: /^!/,

  // 🆕 Deep Question Detector — messages that open with or heavily feature
  // "why", "how", "explain", "what makes" get forced into STRATEGY intent so
  // the AI's reasoning pipeline (not the flat fact-card path) handles them.
  deepQuestionLead: /^\s*(why|how|explain|what makes)\b/i,
  deepQuestionAnywhere: /\b(why|how does|how do|explain|what makes)\b/i
};

module.exports = {
  BOSS_KEYWORDS,
  CATEGORY_KEYWORDS,
  GAME_TAGS,
  HEURISTIC_FALLBACKS,
  INTENT_PATTERNS
};
