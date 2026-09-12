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
  const nameWords = candidateName.split(/\s+/).filter(w => w.length > 4);
  if (nameWords.length === 0) return false;

  for (const nameWord of nameWords) {
    const maxDist = maxEditDistanceFor(nameWord.length);
    for (const textWord of textWords) {
      if (textWord.length <= 4) continue; 
      if (Math.abs(textWord.length - nameWord.length) > maxDist) continue;
      if (levenshtein(nameWord, textWord) <= maxDist) return true;
    }
  }
  return false;
}

module.exports = { levenshtein, maxEditDistanceFor, fuzzyNameHit };
