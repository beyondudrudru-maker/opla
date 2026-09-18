/**
 * router/gameDomain/fuzzyMatch.js
 *
 * Levenshtein distance calculation and fuzzy matching logic.
 * 🚀 UPGRADE: Fixed multi-word false positives by treating entities as continuous 
 * strings and implementing bigram sliding-window checks.
 */

function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prevRow = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prevRow[j] = j;

  for (let i = 1; i <= al; i++) {
    const currRow = new Array(bl + 1);
    currRow[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    prevRow = currRow;
  }
  return prevRow[bl];
}

// Tightened to prevent false positives on 5-6 char words.
function maxEditDistanceFor(len) {
  if (len <= 4) return 1; 
  if (len <= 6) return 1; // "hitler" (6) to "healer" (6) is 2 typos, safely rejected here.
  return 2; 
}

function fuzzyNameHit(candidateName, textWords) {
  // 1. Remove spaces from the candidate name to treat it as a single block
  const nameNoSpace = candidateName.replace(/\s+/g, '').toLowerCase();
  
  // Ignore very short entities to prevent aggressive, low-confidence matching
  if (nameNoSpace.length <= 4) return false;

  const maxDist = maxEditDistanceFor(nameNoSpace.length);

  // 2. Check against single words in the text (catches "nighthuntr" typed as one word)
  for (const textWord of textWords) {
    if (textWord.length <= 4) continue; 
    // Fast-fail if the length difference is greater than the max allowed typos
    if (Math.abs(textWord.length - nameNoSpace.length) > maxDist) continue;
    
    if (levenshtein(nameNoSpace, textWord) <= maxDist) return true;
  }

  // 3. Check against word pairs (bigrams) to catch spaced typos (e.g., "night huntar")
  for (let i = 0; i < textWords.length - 1; i++) {
    const bigram = textWords[i] + textWords[i + 1];
    
    // Fast-fail length check for bigrams
    if (Math.abs(bigram.length - nameNoSpace.length) > maxDist) continue;
    
    if (levenshtein(nameNoSpace, bigram) <= maxDist) return true;
  }

  return false;
}

module.exports = { levenshtein, maxEditDistanceFor, fuzzyNameHit };
