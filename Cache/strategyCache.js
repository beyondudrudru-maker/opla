/**
 * cache/strategyCache.js
 *
 * PURPOSE
 *   Your gameStrategyEngine.js already computes deterministic, zero-
 *   hallucination-risk answers (answerStrategyQuery, compareEntities,
 *   bestHeroForTroop, etc.) straight from gameKnowledge.js — no AI needed
 *   for the NUMBERS. Today those still get wrapped in a full AI call every
 *   time. This module:
 *
 *   1. Caches the deterministic result (cheap, CPU-only, no token cost).
 *   2. On a cache hit OR a fresh deterministic compute, skips the full
 *      STRATEGY_SYSTEM_INSTRUCTION + <GameData> prompt entirely and sends
 *      a SHORT "phrase this data" prompt instead — the AI is only asked to
 *      narrate numbers that are already correct, not to reason from a raw
 *      GameData dump. This is the "AI explains it a little" behavior you
 *      described.
 *
 * WHEN THIS APPLIES
 *   Only for query shapes gameStrategyEngine already handles deterministically:
 *   entity-vs-entity comparisons, "best X for level N", "is upgrade worth it",
 *   "which hero buffs category X". NOT for open-ended combo/PvP strategy asks
 *   like your Calyra/Zaheer example — those genuinely need the LLM's
 *   reasoning over multiple data sources (formations + synergy index +
 *   ownership context), so they still go through the full pipeline.
 *
 * CACHE INVALIDATION
 *   Keyed with a `dataVersion` stamp (bump this constant whenever
 *   gameKnowledge.js changes) so a game-balance patch can't serve stale
 *   cached numbers. TTL is a secondary safety net.
 */

const gameStrategyEngine = require('../engine/gameStrategyEngine.js');

const DATA_VERSION = 'v1'; // bump this on every gameKnowledge.js content update
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — deterministic data rarely changes mid-session

const cache = new Map(); // key -> { value, expiresAt }

function _key(queryType, params) {
  // Sort params so {a,b} and {b,a} for symmetric comparisons hit the same entry.
  const normalized = Object.keys(params)
    .sort()
    .reduce((acc, k) => {
      const v = params[k];
      acc[k] = typeof v === 'string' ? v.toLowerCase() : v;
      return acc;
    }, {});
  return `${DATA_VERSION}:${queryType}:${JSON.stringify(normalized)}`;
}

function _get(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function _set(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

/**
 * Deterministic query types this cache can serve without ever touching
 * gameStrategyEngine's default/unrecognized branch.
 */
const CACHEABLE_TYPES = new Set([
  'compareEntities',
  'bestTank',
  'bestTroopInCategory',
  'upgradeWorthIt',
  'heroesForCategoryBuff',
  'bestHeroForTroop',
  'simulateFlatBuff',
  'highestDamageAtLevel',
]);

/**
 * Returns { hit: boolean, result } — result is the raw gameStrategyEngine
 * payload (data/calculations/candidates/ranking/recommendation/confidence).
 * Computes + caches on miss. Does NOT call the AI.
 */
function getDeterministicResult(queryType, params) {
  if (!CACHEABLE_TYPES.has(queryType)) return { hit: false, result: null, cacheable: false };

  const key = _key(queryType, params);
  const cached = _get(key);
  if (cached) return { hit: true, result: cached, cacheable: true };

  const fresh = gameStrategyEngine.answerStrategyQuery({ type: queryType, params });
  if (fresh && fresh.confidence !== 'low') {
    _set(key, fresh);
  }
  return { hit: false, result: fresh, cacheable: true };
}

/**
 * Short instruction for phrasing an already-correct deterministic result.
 * ~120 tokens vs ~650-1550 for the full STRATEGY_SYSTEM_INSTRUCTION stack.
 * The model is explicitly told not to add unlisted numbers — it's a
 * narrator here, not a reasoner.
 */
const EXPLAIN_ONLY_INSTRUCTION = `You are Melody, strategist for "Kingdom Clash".
The <PrecomputedResult> below is already correct and complete — it was calculated by deterministic game logic, not by you.
Your ONLY job: explain it to the player in your professional, analytical voice, 3-6 sentences, vertical bullets where useful.
STRICT: Do not add, invent, or estimate any number, name, or stat not already present in <PrecomputedResult>. Do not hedge about accuracy — the data is authoritative.
No planning text, no meta-commentary, no markdown tables.`;

function buildExplainPrompt(userMessage, precomputedResult) {
  return `<UserQuestion>${userMessage}</UserQuestion>
<PrecomputedResult>${JSON.stringify(precomputedResult)}</PrecomputedResult>
[INSTRUCTION: Narrate PrecomputedResult for the user. Nothing else.]`;
}

module.exports = {
  getDeterministicResult,
  buildExplainPrompt,
  EXPLAIN_ONLY_INSTRUCTION,
  CACHEABLE_TYPES,
  _cacheSizeForDebug: () => cache.size,
};
