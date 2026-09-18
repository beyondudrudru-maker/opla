/**
 * router/gameDomain/entityScraper.js
 *
 * Everything responsible for figuring out WHICH real game entities (bosses,
 * heroes, troops) are actually named in a message.
 * 🚀 UPGRADE: Hardened the Typo/Fuzzy matching logic to stop false triggers 
 * on partial words like "night" matching "Night Hunter".
 */

const { BOSS_KEYWORDS } = require('./constants.js');
const { fuzzyNameHit } = require('./fuzzyMatch.js');

function scrapeBossKeywords(normalizedText, textNoSpace) {
  const bossTextWords = normalizedText.split(/\s+/).filter(Boolean);
  return BOSS_KEYWORDS.filter(k => {
    const wordBoundaryHit = new RegExp(`\\b${k}\\b`, 'i').test(normalizedText);
    const noSpaceHit      = textNoSpace.includes(k);   
    const fuzzyHit        = !wordBoundaryHit && !noSpaceHit && fuzzyNameHit(k, bossTextWords);
    return wordBoundaryHit || noSpaceHit || fuzzyHit;
  });
}

function _nameResolvesAgainstRoster(name, roster, normalizedText, textNoSpace, textWordsForFuzzy) {
  if (!name) return false;
  const nLower = String(name).toLowerCase();
  
  return roster.some(r => {
    const rName        = r.name.toLowerCase();
    const rNameNoSpace = rName.replace(/\s+/g, '');
    const safeName     = rName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (rName === nLower) return true; 
    
    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    
    // 🚀 FIX: To trigger a typo match, the text MUST contain the full unspaced name, 
    // AND we make sure the unspaced name isn't accidentally matching a tiny fragment.
    const typoMatch  = rNameNoSpace.length > 5 && textNoSpace.includes(rNameNoSpace);
    
    // 🚀 FIX: Require at least one word in the original text to be somewhat long before trying fuzzy match 
    // to avoid fuzzy-matching "night" against "Night Hunter".
    const hasLongWords = textWordsForFuzzy.some(w => w.length >= Math.min(5, rName.length - 2));
    const fuzzyMatch = !exactMatch && !typoMatch && hasLongWords && fuzzyNameHit(rName, textWordsForFuzzy);
    
    return exactMatch || typoMatch || fuzzyMatch;
  });
}

function scrapeEntities(text, normalizedText, textNoSpace, entities, allKnownHeroes, allKnownTroops) {
  const textWordsForFuzzy = normalizedText.split(/\s+/).filter(Boolean);

  allKnownHeroes.forEach(h => {
    const hName        = h.name.toLowerCase();
    const hNameNoSpace = hName.replace(/\s+/g, '');
    const safeName     = hName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    const typoMatch  = hNameNoSpace.length > 5 && textNoSpace.includes(hNameNoSpace);
    const hasLongWords = textWordsForFuzzy.some(w => w.length >= Math.min(5, hName.length - 2));
    const fuzzyMatch = !exactMatch && !typoMatch && hasLongWords && fuzzyNameHit(hName, textWordsForFuzzy);

    if ((exactMatch || typoMatch || fuzzyMatch) && !entities.heroNames.some(e => e.toLowerCase() === hName)) {
      entities.heroNames.push(h.name);
    }
  });

  allKnownTroops.forEach(t => {
    const tName        = t.name.toLowerCase();
    const tNameNoSpace = tName.replace(/\s+/g, '');
    const safeName     = tName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactMatch = new RegExp(`\\b${safeName}\\b`, 'i').test(normalizedText);
    const typoMatch  = tNameNoSpace.length > 5 && textNoSpace.includes(tNameNoSpace);
    const hasLongWords = textWordsForFuzzy.some(w => w.length >= Math.min(5, tName.length - 2));
    const fuzzyMatch = !exactMatch && !typoMatch && hasLongWords && fuzzyNameHit(tName, textWordsForFuzzy);

    if ((exactMatch || typoMatch || fuzzyMatch) && !entities.troopNames.some(e => e.toLowerCase() === tName)) {
      entities.troopNames.push(t.name);
    }
  });

  if (entities.heroNames.length  > 0) entities.heroName  = entities.heroNames[0];
  if (entities.troopNames.length > 0) entities.troopName = entities.troopNames[0];

  return entities;
}

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
