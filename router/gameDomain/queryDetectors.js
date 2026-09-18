/**
 * router/gameDomain/queryDetectors.js
 *
 * Small stateless predicate helpers that read the user's raw text and
 * classify what *kind* of game question it is.
 * 🚀 UPGRADE: Fixed `isDeepQuestion` false positives. It now requires strict 
 * game context to override casual conversations.
 */

const { INTENT_PATTERNS, CATEGORY_KEYWORDS } = require('./constants.js');

function detectCategoryQueries(text) {
  const found = new Set();
  const lower = text.toLowerCase();
  for (const kw of CATEGORY_KEYWORDS) {
    const canonical = kw.replace(/s$/, '');
    if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
      found.add(canonical);
    }
  }
  return Array.from(found);
}

function isCategoryCountQuery(text) {
  return INTENT_PATTERNS.categoryCountA.test(text) || INTENT_PATTERNS.categoryCountB.test(text);
}

function isTaxonomyQuery(text) {
  return INTENT_PATTERNS.taxonomyQuery.test(text);
}

/**
 * isDeepQuestion(text)
 * 🚀 FIX: Prevent casual questions ("what are you doing") from being forced into STRATEGY.
 * A deep question word ("why", "how") is NOT enough to force game strategy UNLESS 
 * the text actually contains some basic game terminology first.
 */
function isDeepQuestion(text) {
  const hasQuestionWord = INTENT_PATTERNS.deepQuestionLead.test(text) || INTENT_PATTERNS.deepQuestionAnywhere.test(text);
  if (!hasQuestionWord) return false;
  
  // Extra Guard: Ensure it has some game-related words before overriding to Strategy.
  const basicGameTerms = ['hero', 'troop', 'boss', 'stats', 'stat', 'build', 'gear', 'formation', 'counter', 'synergy'];
  const hasGameContext = basicGameTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(text));
  
  return hasQuestionWord && hasGameContext; 
}

function isDashboardCommand(text) {
  return INTENT_PATTERNS.dashboardCommand.test(text.trim());
}

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
