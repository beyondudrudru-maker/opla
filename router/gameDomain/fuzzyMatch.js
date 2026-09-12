/**
 * router/gameDomain/fuzzyMatch.js
 *
 * 🔤 FUZZY / TYPO MATCHING — Levenshtein distance
 * ─────────────────────────────────────────────────────────────────────────
 * Complements (does not replace) the exact word-boundary match and the
 * no-space substring "typo" match used by entityScraper.js. Those two catch
 * missing spaces or exact-but-glued names; they do NOT catch genuine
 * misspellings like "Dagno" for "Dagon" or "Bonebraker" for "Bonebreaker" —
 * a single transposed/dropped/substituted letter never produces a no-space
 * substring hit. This adds that missing case via classic Levenshtein
 * edit-distance, checked per-word against each known entity name (or against
 * each word of a multi-word name), so a single typo'd token in a longer
 * sentence still resolves correctly.
 *
 * Same Scunthorpe-safe gate as the existing typo pass: only names longer
 * than 4 characters are eligible, so short names ("Imp", "Ash", "Kai")
 * never get a fuzzy pass and can't misfire on unrelated short words.
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

// Max edit distance allowed, scaled to name length. Note: plain Levenshtein
// charges 2 (not 1) for a transposed pair of adjacent letters (e.g.
// "dagon" -> "dagno" is distance 2), which is one of the most common typo
// shapes, so names in the 5-7 char range need distance 2 to catch it — not
// 1. Very short eligible names (just over the >4 gate, e.g. 5 chars) still
// only tolerate distance 1 to avoid collapsing into unrelated 5-char words;
// names 6+ chars tolerate 2. Keeps false-positive risk low without a single
// fixed threshold across very different name lengths (e.g. "Xana" vs
// "Firetamer Anavin").
function maxEditDistanceFor(len) {
  if (len <= 4) return 1; // shouldn't normally hit — nameWords are already >4 gated
  if (len <= 5) return 2; // e.g. "dagon" (5) must tolerate a transposition -> "dagno" (distance 2)
  return 2;
}

/**
 * fuzzyNameHit(candidateName, textWords)
 * candidateName: lowercase entity name (may be multi-word, e.g. "bone dragon").
 * textWords: array of lowercase alphanumeric-only tokens from the user's message.
 * Returns true if ANY word in textWords is within edit distance of ANY word
 * in candidateName (both sides gated to > 4 chars, matching the existing
 * no-space typo pass's threshold).
 */
function fuzzyNameHit(candidateName, textWords) {
  const nameWords = candidateName.split(/\s+/).filter(w => w.length > 4);
  if (nameWords.length === 0) return false;

  for (const nameWord of nameWords) {
    const maxDist = maxEditDistanceFor(nameWord.length);
    for (const textWord of textWords) {
      if (textWord.length <= 4) continue; // same short-name safety gate
      // Cheap pre-filter before running full Levenshtein: skip pairs whose
      // length difference alone already exceeds the allowed edit distance.
      if (Math.abs(textWord.length - nameWord.length) > maxDist) continue;
      if (levenshtein(nameWord, textWord) <= maxDist) return true;
    }
  }
  return false;
}

module.exports = { levenshtein, maxEditDistanceFor, fuzzyNameHit };
