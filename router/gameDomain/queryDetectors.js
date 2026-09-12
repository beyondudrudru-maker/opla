/**
 * router/gameDomain/queryDetectors.js
 *
 * Small stateless predicate helpers that read the user's raw text and
 * classify what *kind* of game question it is. Kept separate from the main
 * router so each detector can be unit-tested (or tuned) in isolation.
 */

const { INTENT_PATTERNS, CATEGORY_KEYWORDS } = require('./constants.js');

/**
 * detectCategoryQueries(text)
 * Returns the unique set of category/role keywords explicitly mentioned in text.
 * Uses strict word-boundary matching so "ranged" doesn't match "arranged".
 */
function detectCategoryQueries(text) {
  const found = new Set();
  const lower = text.toLowerCase();
  for (const kw of CATEGORY_KEYWORDS) {
    // Singular form of plural keyword for canonical lookup
    const canonical = kw.replace(/s$/, '');
    if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
      found.add(canonical);
    }
  }
  return Array.from(found);
}

/**
 * isCategoryCountQuery(text)
 * Returns true when the message is asking for a count or list of a category
 * ("how many tank troops", "list all mages", "what mages do we have").
 */
function isCategoryCountQuery(text) {
  return INTENT_PATTERNS.categoryCountA.test(text) || INTENT_PATTERNS.categoryCountB.test(text);
}

/**
 * isTaxonomyQuery(text)
 * Pillar / Feature: Macro/Taxonomy Detector.
 * True when the user is asking about the game's classification system
 * itself ("how many roles are there", "what factions exist", "list all
 * categories") rather than asking about one specific known category value.
 * Distinct from isCategoryCountQuery, which fires on a named keyword like
 * "tank" or "mage" — this fires on the meta-question about the taxonomy.
 */
function isTaxonomyQuery(text) {
  return INTENT_PATTERNS.taxonomyQuery.test(text);
}

/**
 * isDeepQuestion(text)
 * Pillar / Feature: Deep Question Detector.
 * True when the message opens with, or heavily features, a reasoning-style
 * question word ("why", "how", "explain", "what makes"). Used to force
 * STRATEGY intent even over what would otherwise look like a flat FACT query.
 */
function isDeepQuestion(text) {
  return INTENT_PATTERNS.deepQuestionLead.test(text) || INTENT_PATTERNS.deepQuestionAnywhere.test(text);
}

/**
 * isDashboardCommand(text)
 * Strict dashboard commands (bot-prefix `!` commands) are the ONLY path
 * allowed to short-circuit with `resolved: true` — they're intentionally
 * silent/mechanical (e.g. `!inventory`, `!setrole`) and were never meant to
 * carry the bot's conversational persona.
 */
function isDashboardCommand(text) {
  return INTENT_PATTERNS.dashboardCommand.test(text.trim());
}

/**
 * isShortAmbiguousName(name)
 * Pillar 2: Confidence Scoring.
 * Flags very short entity names (<= 4 chars) as low-confidence matches —
 * these are the names most likely to have fired off common-word collisions
 * elsewhere in the pipeline (e.g. "Imp", "Orc", "Ash").
 */
function isShortAmbiguousName(name) {
  return typeof name === 'string' && name.replace(/\s+/g, '').length <= 4;
}

module.exports = {
  detectCategoryQueries,
  isCategoryCountQuery,
  isTaxonomyQuery,
  isDeepQuestion,
  isDashboardCommand,
  isShortAmbiguousName
};
