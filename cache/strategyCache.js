/**
 * cache/strategyCache.js
 *
 * PURPOSE
 *   gameStrategyEngine computes deterministic, zero-hallucination answers
 *   (compareEntities, bestTank, upgradeWorthIt, ...) straight from game data.
 *   This module:
 *     1. Caches the deterministic RESULT (CPU-only, zero tokens).
 *     2. Caches the AI's NARRATION of that result too (zero tokens on repeat).
 *     3. Provides a SHORT "narrate this data" prompt (~120 tokens) instead of
 *        the full STRATEGY_SYSTEM_INSTRUCTION + <GameData> stack.
 *
 *   Open-ended combo/PvP asks still go through the full pipeline in aiFallback.
 *
 * CACHE INVALIDATION
 *   The cache lives in process memory, so every Render deploy/restart clears it.
 *   DATA_VERSION is only a safety net for hot-patched data; TTLs cover the rest.
 *
 * 🚀 v2 UPGRADES
 *   • Symmetric keys: "A vs B" and "B vs A" now share one entry (values sorted, not just keys).
 *   • LRU cap (MAX_ENTRIES) + periodic sweep → bounded memory on Render.
 *   • Engine errors never crash the flow; caller falls back to the full pipeline.
 *   • Results are cloned in/out so neither the engine's data tables nor callers can mutate cache.
 *   • Narration cache (1h) → repeat questions cost 0 tokens.
 *   • User text is XML-escaped inside the explain prompt (injection guard).
 *   • Boss-aware explain instruction (hard hero exclusions).
 */

const gameStrategyEngine = require('../engine/gameStrategyEngine.js');

const DATA_VERSION = 'v1';                 // bump only if you hot-patch game data without restarting
const TTL_MS = 6 * 60 * 60 * 1000;         // deterministic result TTL
const NARRATION_TTL_MS = 60 * 60 * 1000;   // AI narration TTL
const MAX_ENTRIES = 300;                   // per cache map
const SWEEP_MS = 30 * 60 * 1000;

const results = new Map();     // key -> { value, expiresAt }
const narrations = new Map();  // key -> { value, expiresAt }
const stats = { hits: 0, misses: 0, narrationHits: 0, errors: 0 };

// Query types where the order of the two entities does not change the answer.
// Remove a type from this set if its narration/ranking depends on A-vs-B order.
const SYMMETRIC_TYPES = new Set(['compareEntities']);
const PAIR_KEY_RE = /^(a|b|entity_?[ab12]|first|second|left|right|name[12]|hero[12]|troop[12])$/i;

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

// ── helpers ──────────────────────────────────────────────────
function _clone(v) {
  try { return structuredClone(v); } catch (_) {
    try { return JSON.parse(JSON.stringify(v)); } catch (__) { return v; }
  }
}

function _normalize(queryType, params) {
  const out = {};
  for (const k of Object.keys(params || {}).sort()) {
    const v = params[k];
    if (typeof v === 'string') out[k] = v.trim().toLowerCase();
    else if (Array.isArray(v)) {
      const arr = v.map(x => (typeof x === 'string' ? x.trim().toLowerCase() : x));
      out[k] = SYMMETRIC_TYPES.has(queryType) && arr.every(x => typeof x === 'string') ? arr.sort() : arr;
    } else out[k] = v;
  }
  if (SYMMETRIC_TYPES.has(queryType)) {
    const pairKeys = Object.keys(out).filter(k => PAIR_KEY_RE.test(k) && typeof out[k] === 'string');
    if (pairKeys.length >= 2) {
      const vals = pairKeys.map(k => out[k]).sort();
      pairKeys.sort().forEach((k, i) => { out[k] = vals[i]; });
    }
  }
  return out;
}

function _key(queryType, params, suffix = '') {
  return `${DATA_VERSION}:${queryType}:${JSON.stringify(_normalize(queryType, params))}${suffix}`;
}

function _lruGet(map, key) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { map.delete(key); return null; }
  map.delete(key); map.set(key, hit);          // refresh recency
  return hit.value;
}

function _lruSet(map, key, value, ttl) {
  map.delete(key);
  map.set(key, { value, expiresAt: Date.now() + ttl });
  while (map.size > MAX_ENTRIES) map.delete(map.keys().next().value); // evict least-recent
}

function _sweep() {
  const now = Date.now();
  for (const map of [results, narrations]) {
    for (const [k, v] of map) if (now > v.expiresAt) map.delete(k);
  }
}
setInterval(_sweep, SWEEP_MS).unref();

// ── deterministic result ─────────────────────────────────────
/**
 * Returns { hit, result, cacheable }. Never throws. Does NOT call the AI.
 */
function getDeterministicResult(queryType, params = {}) {
  if (!CACHEABLE_TYPES.has(queryType)) return { hit: false, result: null, cacheable: false };

  try {
    const key = _key(queryType, params);
    const cached = _lruGet(results, key);
    if (cached) { stats.hits++; return { hit: true, result: _clone(cached), cacheable: true }; }

    stats.misses++;
    const fresh = gameStrategyEngine.answerStrategyQuery({ type: queryType, params });
    if (fresh && fresh.confidence !== 'low') _lruSet(results, key, _clone(fresh), TTL_MS);
    return { hit: false, result: fresh, cacheable: true };
  } catch (err) {
    stats.errors++;
    console.error(`[strategyCache] engine error for ${queryType}:`, err.message);
    return { hit: false, result: null, cacheable: false }; // caller falls back to full pipeline
  }
}

// ── narration cache ──────────────────────────────────────────
function getNarration(queryType, params, { isBoss = false } = {}) {
  const v = _lruGet(narrations, _key(queryType, params, isBoss ? ':boss' : ''));
  if (v) stats.narrationHits++;
  return v;
}

function setNarration(queryType, params, text, { isBoss = false } = {}) {
  if (typeof text === 'string' && text.trim()) {
    _lruSet(narrations, _key(queryType, params, isBoss ? ':boss' : ''), text, NARRATION_TTL_MS);
  }
}

// ── prompts ──────────────────────────────────────────────────
function _escapeXml(text, max = 500) {
  return String(text || '')
    .slice(0, max)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const EXPLAIN_ONLY_INSTRUCTION = `You are Melody, strategist for "Kingdom Clash".
The <PrecomputedResult> below is already correct and complete — it was calculated by deterministic game logic, not by you.
Your ONLY job: explain it to the player in your professional, analytical voice, 3-6 sentences, vertical bullets where useful.
STRICT: Do not add, invent, or estimate any number, name, or stat not already present in <PrecomputedResult>. Do not hedge about accuracy — the data is authoritative.
No planning text, no meta-commentary, no markdown tables.`;

const BOSS_EXPLAIN_ADDENDUM = `
BOSS RULE: Never recommend Harkon, Fire Fury Xana, or Pyrotechnician for boss fights (their abilities are disabled there) — omit them even if they appear in the data. Bosses cannot be frozen, stunned or pulled.`;

function buildExplainInstruction(queryFlags = {}) {
  return queryFlags && queryFlags.isBossQuery
    ? EXPLAIN_ONLY_INSTRUCTION + BOSS_EXPLAIN_ADDENDUM
    : EXPLAIN_ONLY_INSTRUCTION;
}

function buildExplainPrompt(userMessage, precomputedResult) {
  return `<UserQuestion>${_escapeXml(userMessage)}</UserQuestion>
<PrecomputedResult>${JSON.stringify(precomputedResult)}</PrecomputedResult>
[INSTRUCTION: Narrate PrecomputedResult for the user. Nothing else.]`;
}

module.exports = {
  getDeterministicResult,
  getNarration,
  setNarration,
  buildExplainPrompt,
  buildExplainInstruction,
  EXPLAIN_ONLY_INSTRUCTION,
  CACHEABLE_TYPES,
  getStats: () => ({ ...stats, results: results.size, narrations: narrations.size }),
  _cacheSizeForDebug: () => results.size,
};
