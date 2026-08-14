/**
 * router/strategyContextBuilder.js
 *
 * UPGRADES IN THIS VERSION
 * ─────────────────────────
 * Pillar 4: Continuous Context Integration (User Correction Ledger)
 *   - build() now accepts an optional 3rd argument: userCorrections (array).
 *   - When present, corrections are normalized and injected at the very top
 *     of the returned context as `context.userCorrections`, ahead of every
 *     other field, so the AI reads them before anything else in <GameData>.
 *   - Corrections are also used to override ambiguous entity resolution:
 *     if a recent correction says "I meant the hero, not the troop" (or the
 *     reverse), and the current turn still has both a heroName and a
 *     troopName candidate, the correction's preferred type wins and the
 *     other candidate is dropped before the rest of the lookup logic runs.
 *   - Fully backward compatible: build(intent, entities) with no 3rd arg
 *     behaves exactly as before.
 */

const strategyEngine = require('../engine/gameStrategyEngine.js');
const queryEngine = require('../engine/gameQueryEngine.js');

// ─────────────────────────────────────────────────────────────────────────────
// Pillar 4 helpers — User Correction Ledger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _normalizeCorrections(userCorrections)
 * Defensively normalizes whatever shape the caller passes (array of strings,
 * array of {text, type} objects, etc.) into a clean array of short strings
 * safe to inject directly into <GameData>. Never throws — worst case returns [].
 */
function _normalizeCorrections(userCorrections) {
  if (!Array.isArray(userCorrections) || userCorrections.length === 0) return [];

  return userCorrections
    .map(c => {
      if (typeof c === 'string') return c.trim();
      if (c && typeof c === 'object') {
        if (typeof c.text === 'string') return c.text.trim();
        if (typeof c.correction === 'string') return c.correction.trim();
      }
      return null;
    })
    .filter(Boolean)
    .slice(-5); // keep only the most recent 5 — protects context window, oldest-first order preserved
}

/**
 * _detectEntityTypeOverride(correctionStrings)
 * Scans normalized correction strings for an explicit "I meant the hero, not
 * the troop" / "I meant the troop, not the hero" signal (multi-lingual-lite,
 * matches the project's existing English + Hinglish register). Returns
 * 'hero' | 'troop' | null. Only the MOST RECENT matching correction wins.
 */
function _detectEntityTypeOverride(correctionStrings) {
  const HERO_OVERRIDE  = /\bmeant\s+(?:the\s+)?hero\b.{0,20}\bnot\s+(?:the\s+)?troop\b/i;
  const TROOP_OVERRIDE = /\bmeant\s+(?:the\s+)?troop\b.{0,20}\bnot\s+(?:the\s+)?hero\b/i;

  // Iterate from most recent (end of array) backwards so the latest correction wins.
  for (let i = correctionStrings.length - 1; i >= 0; i--) {
    const s = correctionStrings[i];
    if (HERO_OVERRIDE.test(s))  return 'hero';
    if (TROOP_OVERRIDE.test(s)) return 'troop';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────

function build(intent, entities, userCorrections = []) {
  let { troopName, troopNames, heroNames, levels, heroName, category, isComparison, rawText } = entities;

  // ── Pillar 4: normalize + apply correction overrides BEFORE any resolution ──
  const normalizedCorrections = _normalizeCorrections(userCorrections);
  const entityTypeOverride    = normalizedCorrections.length > 0
    ? _detectEntityTypeOverride(normalizedCorrections)
    : null;

  if (entityTypeOverride === 'hero' && (troopName || (troopNames && troopNames.length > 0))) {
    // User corrected us toward "hero" — drop the troop candidates for this turn only.
    troopName  = undefined;
    troopNames = [];
  } else if (entityTypeOverride === 'troop' && (heroName || (heroNames && heroNames.length > 0))) {
    // User corrected us toward "troop" — drop the hero candidates for this turn only.
    heroName  = undefined;
    heroNames = [];
  }

  // 🛡️ FALSE-POSITIVE "VS" GUARD (Fix: "Bengali vs Vikings" banter trap)
  // Previously this fell back to its own bare `/\b(vs|versus|...)\b/i` test
  // against rawText, which reintroduced the false-positive bug even after
  // gameIntentClassifier.js's entities.isComparison was fixed to require
  // real game entities. That fallback regex has been removed — this builder
  // now trusts entities.isComparison exactly as computed upstream, since
  // that flag is already gated on 2+ recognized heroes/troops/levels.
  // A bare "vs"/"versus" with no known entities must NOT be treated as a
  // comparison here, or the "insufficient data" error resurfaces for banter.
  const isActuallyComparing = isComparison === true;

  let result = null;

  // 🚀 1. Hero Comparison (2 Heroes strictly when explicitly comparing)
  if (!result && isActuallyComparing && heroNames && heroNames.length >= 2) {
    const cmp = strategyEngine.compareEntities(heroNames[0], heroNames[1]);
    if (cmp.error) {
      result = { context: null, sufficient: false, error: cmp.error };
    } else {
      result = {
        sufficient: true,
        context: {
          formatInstruction: "Do NOT output a simple mathematical stat comparison (e.g. 'HP: X > Y') or declare a winner by raw stats alone. Explain the tactical difference: core identity/abilities and what they DO, PvP/Arena performance, Boss Encounter value, and optimal synergies/gear with mechanical reasoning, before reaching a situational verdict. Base all facts STRICTLY on the provided data without hallucinating stats.",
          hero1: cmp.entityA,
          hero2: cmp.entityB
        }
      };
    }
  }

  // 🚀 2. Single Hero Lookup (Ensures single entity focus even if list has 1 item)
  if (!result && heroNames && heroNames.length === 1 && !troopName && (!troopNames || troopNames.length === 0)) {
    const h1 = queryEngine.findEntityByName(heroNames[0]);
    if (!h1 || h1.type !== 'hero') {
      result = { context: null, sufficient: false, error: `Hero ${heroNames[0]} not found in database.` };
    } else {
      result = {
        sufficient: true,
        context: {
          task: "Provide exact stats and strategic usage for this database-verified hero.",
          formatInstruction: "Do not invent abilities or stats. Use ONLY the provided database record.",
          recognizedHero: h1.data
        }
      };
    }
  }

  // 🚀 3. Troop Comparison (2 Troops with Level Scaling strictly when comparing)
  if (!result && isActuallyComparing && troopNames && troopNames.length >= 2) {
    const lvl1 = (levels && levels[0]) ? levels[0] : 10;
    const lvl2 = (levels && levels[1]) ? levels[1] : lvl1;

    const t1 = queryEngine.getTroopLevel(troopNames[0], lvl1);
    const t2 = queryEngine.getTroopLevel(troopNames[1], lvl2);

    if (!t1 || !t2) {
      result = { context: null, sufficient: false, error: "One or both troops could not be found in the database." };
    } else {
      result = {
        sufficient: true,
        context: {
          formatInstruction: "Do NOT declare a winner based ONLY on raw stats (HP/Damage/Defense) and do NOT output a bare mathematical comparison. Explain what each troop's ability actually does and its battlefield role, how each performs in PvP/Arena vs Boss Encounters, and note any hero/gear synergies from the provided data, before giving a situational verdict. Base all facts ONLY on these exact database stats without hallucinating numbers.",
          troop1: t1,
          troop2: t2
        }
      };
    }
  }

  // 🚀 4. Mixed Comparison Fallback (Explicit vs keyword check)
  if (!result && isActuallyComparing && rawText) {
    const match = rawText.match(/(.+?)\s+(?:vs|versus)\s+(.+)/i);
    if (match) {
      const cmp = strategyEngine.compareEntities(match[1].trim(), match[2].trim());
      if (!cmp.error) {
        result = {
          sufficient: true,
          context: {
            formatInstruction: "Do NOT output a bare stat comparison or declare a winner by raw numbers alone. Explain the tactical difference — abilities, roles, PvP/Arena vs Boss Encounter performance, and synergies — using the provided deterministic stats. Do not guess or hallucinate any numbers.",
            comparisonData: cmp
          }
        };
      }
    }
  }

  // 🚀 5. Single Troop Level Analysis
  if (!result && troopName && (!levels || levels.length <= 1)) {
    const level = (levels && levels[0]) ? levels[0] : 10;
    const analysis = strategyEngine.analyzeTroopAtLevel(troopName, level);
    if (analysis.error) {
      result = { context: null, sufficient: false, error: analysis.error };
    } else {
      result = {
        sufficient: true,
        context: {
          troop: {
            name: analysis.troop.name,
            level: analysis.level,
            hp: analysis.stats.hp,
            damage: analysis.stats.damage,
            defense: analysis.stats.defense,
            units: analysis.stats.units,
            ability: analysis.ability,
            tags: analysis.troop.tags
          },
          role: analysis.role,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses
        }
      };
    }
  }

  // 🚀 6. Troop Level Progression (Same Troop, 2 Levels)
  if (!result && troopName && levels && levels.length >= 2) {
    const cmp = strategyEngine.compareTroopLevels(troopName, levels[0], levels[1]);
    result = cmp.error
      ? { context: null, sufficient: false, error: cmp.error }
      : { sufficient: true, context: { troopName, ...cmp } };
  }

  // 🚀 7. Best Heroes for a Troop
  if (!result && troopName && !heroName && (!heroNames || heroNames.length === 0)) {
    const found = strategyEngine.findBestHeroesForTroop(troopName);
    result = found.error
      ? { context: null, sufficient: false, error: found.error }
      : { sufficient: true, context: { troop: { name: found.troopName }, compatibleHeroes: found.candidates.slice(0, 5) } };
  }

  // 🚀 8. Category Strategy
  if (!result && category) {
    result = { sufficient: true, context: { category, note: 'Strategy for category buffers based on gameKnowledge.js.' } };
  }

  if (!result) {
    result = { context: null, sufficient: false, error: 'Not enough resolved entities to build a deterministic strategy context.' };
  }

  // ── Pillar 4: inject corrections at the very top of <GameData> ─────────────
  // Runs regardless of which branch above produced the result, and even when
  // sufficient is false — a correction is still useful context for the AI's
  // clarification response. Injected LAST so it lands first in key order for
  // any consumer that renders context object keys in insertion order.
  if (normalizedCorrections.length > 0) {
    const priorContext = result.context || {};
    result.context = { userCorrections: normalizedCorrections, ...priorContext };
    // A correction alone (even with no other resolved entity) is still
    // useful signal — don't force sufficient=true, but don't strip it either.
  }

  return result;
}

module.exports = { build };
