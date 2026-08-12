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
          formatInstruction: "Compare these two heroes using clean markdown formatting. Use sections: 1. Core Stats Face-Off (HP, Defense, Attack), 2. Abilities & Synergy, 3. Final Verdict. Base your answer STRICTLY on the provided data without hallucinating stats.",
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
      // 🆕 FIX: "Durand stats" was returning ONLY the hero record with no
      // candidate troops attached. When the AI's response touched on troop
      // synergy (which STRATEGY_SYSTEM_INSTRUCTION invites it to do), it had
      // no real troop data to draw from and invented a plausible-sounding
      // but nonexistent troop ("Ironclad Golems"). Every hero lookup now
      // proactively includes real synergy candidates via the hero's
      // faction/type/tags overlap against the troop roster — the same
      // matching logic already proven correct in gameDomainRouter.js's
      // SCENARIO B — so the AI always has grounded troops to reference,
      // whether or not the user explicitly asked for synergy.
      const heroData = h1.data;
      const heroIdentifiers = new Set();
      if (heroData.faction) heroIdentifiers.add(String(heroData.faction).toUpperCase());
      if (heroData.type)    heroIdentifiers.add(String(heroData.type).toUpperCase());
      if (Array.isArray(heroData.tags)) heroData.tags.forEach(t => heroIdentifiers.add(String(t).toUpperCase()));

      const allTroops = queryEngine.gameLibrary.troops || [];
      const hIdArray = Array.from(heroIdentifiers);
      const matchingTroops = allTroops.filter(t => {
        const tId = [];
        if (t.faction) tId.push(String(t.faction).toUpperCase());
        if (t.type)    tId.push(String(t.type).toUpperCase());
        if (Array.isArray(t.tags))       tId.push(...t.tags.map(x => String(x).toUpperCase()));
        if (Array.isArray(t.categories)) tId.push(...t.categories.map(x => String(x).toUpperCase()));
        if (t.analysis && t.analysis.primaryRole) tId.push(String(t.analysis.primaryRole).toUpperCase());
        if (t.analysis && Array.isArray(t.analysis.secondaryRoles)) tId.push(...t.analysis.secondaryRoles.map(x => String(x).toUpperCase()));
        return tId.some(id => hIdArray.includes(id));
      });

      result = {
        sufficient: true,
        context: {
          task: "Provide exact stats and strategic usage for this database-verified hero.",
          // 🛡️ Zero-hallucination guardrail — explicitly extended to cover
          // troop names, not just stats/abilities. If synergyCandidates is
          // empty, the AI must say so rather than inventing a plausible name.
          formatInstruction: "Do not invent abilities, stats, or troop names. Use ONLY the provided database record. If asked which troop pairs well with this hero, choose ONLY from synergyCandidates below — if synergyCandidates is empty, say no strong synergy match was found in the database rather than naming a troop.",
          recognizedHero: heroData,
          synergyCandidates: matchingTroops.slice(0, 5).map(t => ({
            name:        t.name,
            rarity:      t.rarity,
            primaryRole: t.analysis ? t.analysis.primaryRole : null,
            matchedOn:   hIdArray.filter(id =>
              [t.faction, t.type, ...(t.tags || []), ...(t.categories || [])]
                .filter(Boolean).map(x => String(x).toUpperCase()).includes(id)
            )
          }))
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
          formatInstruction: "Compare these two troops cleanly with bullet points and declare a winner based ONLY on these exact database stats.",
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
            formatInstruction: "Compare these two entities cleanly using the provided deterministic stats. Do not guess or hallucinate any numbers.",
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
          // 🛡️ Zero-hallucination guardrail — matches the pattern used on
          // every other branch. Previously missing here, leaving this path
          // as free-form as the single-hero lookup was before the fix.
          formatInstruction: "Do not invent stats, abilities, or other troop/hero names not present in this context. Use ONLY the provided database record.",
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
      : {
          sufficient: true,
          context: {
            // 🛡️ Zero-hallucination guardrail — previously missing here.
            formatInstruction: "Do not invent stats or numbers. Use ONLY the provided level-progression data.",
            troopName,
            ...cmp
          }
        };
  }

  // 🚀 7. Best Heroes for a Troop
  if (!result && troopName && !heroName && (!heroNames || heroNames.length === 0)) {
    const found = strategyEngine.findBestHeroesForTroop(troopName);
    result = found.error
      ? { context: null, sufficient: false, error: found.error }
      : {
          sufficient: true,
          context: {
            // 🛡️ Zero-hallucination guardrail — the reverse direction of the
            // Durand/Ironclad Golems bug. If compatibleHeroes comes back
            // empty, the AI must say so instead of naming a plausible-
            // sounding hero that isn't in candidates.
            formatInstruction: "Recommend heroes ONLY from compatibleHeroes below. If compatibleHeroes is empty, say no strong hero match was found in the database rather than naming one.",
            troop: { name: found.troopName },
            compatibleHeroes: found.candidates.slice(0, 5)
          }
        };
  }

  // 🚀 8. Category Strategy
  if (!result && category) {
    result = {
      sufficient: true,
      context: {
        // 🛡️ Zero-hallucination guardrail — this branch supplies the LEAST
        // grounded data of any path (just a category label and a generic
        // note), making it the highest-risk branch for invented specifics
        // (fabricated troop/hero names, made-up numbers). The instruction
        // is stricter here: general category-level reasoning is fine, but
        // any named entity or exact stat must come from a real lookup.
        formatInstruction: "This is general category-level guidance only — no specific troop/hero records are attached. Speak in terms of the category's general role and playstyle. Do NOT invent specific troop names, hero names, or exact stat numbers; if the user wants specifics, say they should ask about a named hero/troop instead.",
        category,
        note: 'Strategy for category buffers based on gameKnowledge.js.'
      }
    };
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
