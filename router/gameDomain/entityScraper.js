/**
 * router/gameDomain/entityScraper.js
 *
 * Everything responsible for figuring out WHICH real game entities (bosses,
 * heroes, troops) are actually named in a message.
 *
 * 🛡️ Scunthorpe-Proof Scraper
 *   Rule 1: word-boundary match is always tried.
 *   Rule 2: no-space typo match is ONLY used when the name (no spaces) is > 4
 *           chars, preventing short names ("Imp", "Ash", "Kai") from firing
 *           on unrelated words ("wish him praise him", "crashes", "kaise").
 *   Rule 3: fuzzy (Levenshtein) match catches genuine misspellings that Rule 2
 *           can't (e.g. "Dagno", "Bonebraker", "Gollem") — same > 4 char gate.
 *
 * 🆕 ADVANCEMENT — Seeded Entity DB Validation Guard
 *   `classify(text)` (gameIntentClassifier.js) can seed `entities.heroName` /
 *   `entities.troopName` from its own NLP heuristics (e.g. capitalized
 *   word-shape detection) BEFORE this scraper ever runs against the real
 *   roster. That seed was previously trusted unconditionally, which is what
 *   let phrases like "I will be Hitler, will you be my Eva Anna?" get
 *   flagged as `isSingleEntity: true` and routed into the game-strategy AI
 *   fallback — no hero named "Hitler" or "Eva Anna" exists in the roster, the
 *   classifier just pattern-matched on capitalized word shape.
 *
 *   validateSeededEntities() closes that gap: any classifier-seeded name
 *   that does NOT resolve against the real hero/troop list (exact, no-space,
 *   or fuzzy match — same rules as the scraper itself) is dropped before it
 *   can influence isSingleEntity / routing downstream. Only names the
 *   scraper can independently confirm survive.
 */

const { BOSS_KEYWORDS } = require('./constants.js');
const { fuzzyNameHit } = require('./fuzzyMatch.js');

/**
 * scrapeBossKeywords(normalizedText, textNoSpace)
 * Must run BEFORE entity scraping and BEFORE synergy/counter regex so that
 * phrasing like "how do I beat dagon" or "against balthazar" is never
 * misrouted into the PvP counter branch.
 */
function scrapeBossKeywords(normalizedText, textNoSpace) {
  const bossTextWords = normalizedText.split(/\s+/).filter(Boolean);
  return BOSS_KEYWORDS.filter(k => {
    const wordBoundaryHit = new RegExp(`\\b${k}\\b`, 'i').test(normalizedText);
    const noSpaceHit      = textNoSpace.includes(k);   // catches "Dagon's", "Dagon-Boss"
    const fuzzyHit        = !wordBoundaryHit && !noSpaceHit && fuzzyNameHit(k, bossTextWords);
    return wordBoundaryHit || noSpaceHit || fuzzyHit;
  });
}

/**
 * _nameResolvesAgainstRoster(name, roster, textForMatching, textNoSpace)
 * Shared single-name resolution check used both by the bulk scraper below
 * and by the seeded-entity validation guard. `roster` is an array of
 * records with a `.name` field (allKnownHeroes or allKnownTroops).
 */
function _nameResolvesAgainstRoster(name, roster, normalizedText, textNoSpace, textWordsForFuzzy) {
  if (!name) return false;
  const nLower = String(name).toLowerCase();
  return roster.some(r => {
    const rName        = r.name.toLowerCase();
    const rNameNoSpace = rName.replace(/\s+/g, '');
    const safeName     = rName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (rName === nLower) return true; // classifier's seed matches a roster name exactly
    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    const typoMatch  = rNameNoSpace.length > 4 && textNoSpace.includes(rNameNoSpace);
    const fuzzyMatch = !exactMatch && !typoMatch && fuzzyNameHit(rName, textWordsForFuzzy);
    return exactMatch || typoMatch || fuzzyMatch;
  });
}

/**
 * scrapeEntities(text, normalizedText, textNoSpace, entities, allKnownHeroes, allKnownTroops)
 * Mutates and returns `entities` with heroNames/troopNames populated from
 * the real roster (matched against the message text), and re-derives the
 * singular heroName/troopName convenience fields from the resulting arrays.
 */
function scrapeEntities(text, normalizedText, textNoSpace, entities, allKnownHeroes, allKnownTroops) {
  const textWordsForFuzzy = normalizedText.split(/\s+/).filter(Boolean);

  allKnownHeroes.forEach(h => {
    const hName        = h.name.toLowerCase();
    const hNameNoSpace = hName.replace(/\s+/g, '');
    const safeName     = hName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    const typoMatch  = hNameNoSpace.length > 4 && textNoSpace.includes(hNameNoSpace);
    const fuzzyMatch = !exactMatch && !typoMatch && fuzzyNameHit(hName, textWordsForFuzzy);

    if ((exactMatch || typoMatch || fuzzyMatch) && !entities.heroNames.some(e => e.toLowerCase() === hName)) {
      entities.heroNames.push(h.name);
    }
  });

  allKnownTroops.forEach(t => {
    const tName        = t.name.toLowerCase();
    const tNameNoSpace = tName.replace(/\s+/g, '');
    const safeName     = tName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    const typoMatch  = tNameNoSpace.length > 4 && textNoSpace.includes(tNameNoSpace);
    const fuzzyMatch = !exactMatch && !typoMatch && fuzzyNameHit(tName, textWordsForFuzzy);

    if ((exactMatch || typoMatch || fuzzyMatch) && !entities.troopNames.some(e => e.toLowerCase() === tName)) {
      entities.troopNames.push(t.name);
    }
  });

  if (entities.heroNames.length  > 0) entities.heroName  = entities.heroNames[0];
  if (entities.troopNames.length > 0) entities.troopName = entities.troopNames[0];

  return entities;
}

/**
 * validateSeededEntities(entities, normalizedText, textNoSpace, allKnownHeroes, allKnownTroops)
 * 🆕 ADVANCEMENT (see file header). Call this BEFORE scrapeEntities() so any
 * name the classifier seeded (entities.heroName / entities.troopName /
 * entities.heroNames / entities.troopNames) that can't be independently
 * confirmed against the real roster gets dropped instead of quietly riding
 * along into heroNames/troopNames and inflating `isSingleEntity`.
 */
function validateSeededEntities(entities, normalizedText, textNoSpace, allKnownHeroes, allKnownTroops) {
  const textWordsForFuzzy = normalizedText.split(/\s+/).filter(Boolean);

  entities.heroNames = (entities.heroNames || []).filter(name =>
    _nameResolvesAgainstRoster(name, allKnownHeroes, normalizedText, textNoSpace, textWordsForFuzzy)
  );
  entities.troopNames = (entities.troopNames || []).filter(name =>
    _nameResolvesAgainstRoster(name, allKnownTroops, normalizedText, textNoSpace, textWordsForFuzzy)
  );

  entities.heroName  = entities.heroNames.length  > 0 ? entities.heroNames[0]  : undefined;
  entities.troopName = entities.troopNames.length > 0 ? entities.troopNames[0] : undefined;

  return entities;
}

module.exports = { scrapeBossKeywords, scrapeEntities, validateSeededEntities };
