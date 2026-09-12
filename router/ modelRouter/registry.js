/**
 * router/modelRouter/registry.js
 *6
 * MODEL CAPABILITY REGISTRY (scores 0-10 — routing heuristics, not
 * objective benchmark claims) plus the weight-class and provider-tier
 * constants used to score candidates in classification.js.
 *
 * MODEL REGISTRY REFRESH (verified live 2026-08-24)
 *   - Groq, Gemini, and Cloudflare slugs below were checked against each
 *     provider's live docs/pricing pages and are unchanged/still active.
 *   - Gemini Gen 3 (gemini-3.6-flash, gemini-3.5-flash-lite) CONFIRMED GA on
 *     the free tier -- both already sit at the top of the Gemini tier below
 *     and inherit GEMINI_PRIMARY_BONUS + providerTierBonus('gemini') same as
 *     every other Gemini rung, so no separate wiring was needed.
 *   - qwen/qwen3.6-27b REMOVED per explicit instruction to drop Qwen from
 *     the registry entirely. Its stand-in replacement,
 *     moonshotai/kimi-k2-instruct-0905, was ALSO REMOVED 2026-08-24 after
 *     confirming it 404s (INVALID_MODEL) -- both are now hard-blocked from
 *     re-entering via discovery too (see discovery.js DISCOVERY_BLOCKLIST).
 *     llama-3.1-8b-instant was separately confirmed dead and removed;
 *     groq/compound-mini (already live, no 404s in logs) is now tagged
 *     weightClass:'light' and carries the primary LIGHT slot on Groq
 *     alongside openai/gpt-oss-20b.
 *   - OpenRouter's meta-llama/llama-3.3-70b-instruct:free was CONFIRMED
 *     REMOVED from OpenRouter's free catalog -- it 404s. Replaced with
 *     nvidia/nemotron-3-ultra-550b-a55b:free (heavy) and
 *     nvidia/nemotron-nano-9b-v2:free (light), both live on OpenRouter's
 *     current :free listing alongside openai/gpt-oss-20b:free and
 *     openrouter/free.
 */

// costTier: 'free' | 'free-limited' | 'paid'
// status: 'active' | 'discovered' | 'disabled' (mutated at runtime; never
// persisted, reset on process restart, which is fine — cheap to re-derive).
const MODEL_REGISTRY = {
  gemini: {
    'gemini-3.6-flash': {
      provider: 'gemini', model: 'gemini-3.6-flash',
      quality: 9, speed: 7, reasoning: 9, coding: 9, math: 8, casualChat: 7,
      creativeWriting: 8, multilingual: 8, hindi: 7, structuredOutput: 9,
      gameStrategy: 9, longContext: 9, toolUse: 9, reliability: 8,
      costTier: 'free-limited', supportsSampling: false, maxOutputTokens: 8192,
      status: 'active'
    },
    'gemini-3.5-flash': {
      provider: 'gemini', model: 'gemini-3.5-flash',
      quality: 8, speed: 7, reasoning: 8, coding: 8, math: 7, casualChat: 8,
      creativeWriting: 8, multilingual: 8, hindi: 7, structuredOutput: 8,
      gameStrategy: 8, longContext: 9, toolUse: 8, reliability: 8,
      costTier: 'free-limited', supportsSampling: true, maxOutputTokens: 8192,
      status: 'active'
    },
    'gemini-3.5-flash-lite': {
      provider: 'gemini', model: 'gemini-3.5-flash-lite',
      quality: 6, speed: 9, reasoning: 5, coding: 5, math: 4, casualChat: 9,
      creativeWriting: 6, multilingual: 7, hindi: 6, structuredOutput: 6,
      gameStrategy: 5, longContext: 7, toolUse: 5, reliability: 8,
      costTier: 'free-limited', supportsSampling: false, maxOutputTokens: 4096,
      status: 'active'
    },
    'gemini-3.1-flash-lite': {
      provider: 'gemini', model: 'gemini-3.1-flash-lite',
      quality: 5, speed: 9, reasoning: 4, coding: 4, math: 3, casualChat: 8,
      creativeWriting: 5, multilingual: 6, hindi: 5, structuredOutput: 5,
      gameStrategy: 4, longContext: 6, toolUse: 4, reliability: 7,
      costTier: 'free-limited', supportsSampling: true, maxOutputTokens: 4096,
      status: 'active'
    }
  },

  groq: {
    // Primary HEAVYWEIGHT target — top overall pick for reasoning/coding/
    // gameStrategy on Groq.
    'openai/gpt-oss-120b': {
      provider: 'groq', model: 'openai/gpt-oss-120b',
      quality: 9, speed: 8, reasoning: 9, coding: 9, math: 8, casualChat: 6,
      creativeWriting: 5, multilingual: 7, hindi: 5, structuredOutput: 8,
      gameStrategy: 9, longContext: 7, toolUse: 8, reliability: 8,
      costTier: 'free-limited', weightClass: 'heavy', maxOutputTokens: 4096, status: 'active'
    },
    // Primary LIGHTWEIGHT/fast target — quick, cheap responses for casual/
    // shortFactual/hinglish traffic on Groq.
    'openai/gpt-oss-20b': {
      provider: 'groq', model: 'openai/gpt-oss-20b',
      quality: 7, speed: 9, reasoning: 7, coding: 7, math: 6, casualChat: 7,
      creativeWriting: 5, multilingual: 6, hindi: 4, structuredOutput: 6,
      gameStrategy: 6, longContext: 6, toolUse: 6, reliability: 8,
      costTier: 'free-limited', weightClass: 'light', maxOutputTokens: 4096, status: 'active'
    },
    // 🐛 REMOVED 2026-08-24: 'moonshotai/kimi-k2-instruct-0905' confirmed
    // 404ing (INVALID_MODEL) — its replacement-of-Qwen slug turned out to be
    // dead too. Left the heavy Groq slot with only openai/gpt-oss-120b as a
    // GA rung until Groq lists a working secondary heavy model; re-add here
    // with the correct current slug when one is confirmed live.
    'groq/compound': {
      provider: 'groq', model: 'groq/compound',
      quality: 8, speed: 6, reasoning: 8, coding: 6, math: 6, casualChat: 5,
      creativeWriting: 4, multilingual: 6, hindi: 4, structuredOutput: 6,
      gameStrategy: 6, longContext: 6, toolUse: 9, reliability: 6,
      costTier: 'free-limited', maxOutputTokens: 4096, status: 'active'
    },
    // Now the primary LIGHTWEIGHT/fast target on Groq (2026-08-24) — Groq's
    // own compound-mini tool-use model, confirmed healthy in logs (no 404s
    // seen) — filling the gap left by removing llama-3.1-8b-instant (dead)
    // and kimi-k2 (dead). Tagged weightClass:'light' so it actually gets the
    // light-task scoring bonus instead of sitting untagged.
    'groq/compound-mini': {
      provider: 'groq', model: 'groq/compound-mini',
      quality: 6, speed: 8, reasoning: 6, coding: 5, math: 5, casualChat: 6,
      creativeWriting: 4, multilingual: 6, hindi: 4, structuredOutput: 5,
      gameStrategy: 5, longContext: 5, toolUse: 8, reliability: 6,
      costTier: 'free-limited', weightClass: 'light', maxOutputTokens: 4096, status: 'active'
    }
    // 🐛 REMOVED 2026-08-23: 'llama-3.3-70b-versatile' confirmed 404ing on
    // BOTH configured Groq keys ("does not exist or you do not have access
    // to it") — this is a permanently-retired model, not a transient issue.
    // 🐛 REMOVED 2026-08-24: 'llama-3.1-8b-instant' also confirmed dead —
    // both former LIGHTWEIGHT rungs on Groq are gone; groq/compound-mini
    // above now carries that slot alone. If Groq re-adds either slug (or a
    // renamed successor), re-add the entry with the correct current model
    // ID rather than restoring these verbatim.
  },

  openrouter: {
    // Primary HEAVYWEIGHT target on OpenRouter -- top-quality entry on
    // OpenRouter's live free catalog (1M context, tool use). Replaces the
    // now-delisted meta-llama/llama-3.3-70b-instruct:free (confirmed gone
    // from OpenRouter's :free listing as of 2026-08-14 -- calls 404).
    'nvidia/nemotron-3-ultra-550b-a55b:free': {
      provider: 'openrouter', model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      quality: 8, speed: 5, reasoning: 8, coding: 7, math: 6, casualChat: 5,
      creativeWriting: 5, multilingual: 6, hindi: 4, structuredOutput: 7,
      gameStrategy: 7, longContext: 8, toolUse: 6, reliability: 5,
      costTier: 'free', weightClass: 'heavy', maxOutputTokens: 4096, status: 'active'
    },
    // Secondary HEAVYWEIGHT/general-purpose target -- solid mid-size free
    // model, useful when the top Nemotron rung is cooling down.
    'openai/gpt-oss-20b:free': {
      provider: 'openrouter', model: 'openai/gpt-oss-20b:free',
      quality: 6, speed: 6, reasoning: 6, coding: 6, math: 5, casualChat: 5,
      creativeWriting: 4, multilingual: 5, hindi: 3, structuredOutput: 5,
      gameStrategy: 5, longContext: 5, toolUse: 5, reliability: 5,
      costTier: 'free', maxOutputTokens: 2048, status: 'active'
    },
    // Primary LIGHTWEIGHT/fast target on OpenRouter -- small, quick model
    // for casual/shortFactual/hinglish traffic.
    'nvidia/nemotron-nano-9b-v2:free': {
      provider: 'openrouter', model: 'nvidia/nemotron-nano-9b-v2:free',
      quality: 5, speed: 8, reasoning: 4, coding: 4, math: 3, casualChat: 6,
      creativeWriting: 4, multilingual: 5, hindi: 3, structuredOutput: 4,
      gameStrategy: 4, longContext: 5, toolUse: 4, reliability: 5,
      costTier: 'free', weightClass: 'light', maxOutputTokens: 2048, status: 'active'
    },
    // Secondary LIGHTWEIGHT/general fallback -- OpenRouter's own
    // provider-agnostic free routing endpoint.
    'openrouter/free': {
      provider: 'openrouter', model: 'openrouter/free',
      quality: 6, speed: 6, reasoning: 6, coding: 6, math: 5, casualChat: 6,
      creativeWriting: 5, multilingual: 6, hindi: 4, structuredOutput: 5,
      gameStrategy: 5, longContext: 6, toolUse: 5, reliability: 5,
      costTier: 'free', weightClass: 'light', maxOutputTokens: 2048, status: 'active'
    }
  },

  cloudflare: {
    '@cf/meta/llama-3.1-8b-instruct': {
      provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct',
      quality: 5, speed: 7, reasoning: 4, coding: 4, math: 3, casualChat: 6,
      creativeWriting: 4, multilingual: 5, hindi: 3, structuredOutput: 4,
      gameStrategy: 3, longContext: 4, toolUse: 2, reliability: 5,
      costTier: 'free', maxOutputTokens: 1024, status: 'active'
    }
  }
};

// A separate, bounded pool for models discovered at runtime that aren't in
// the static registry. They get conservative default scores and start in
// an 'unknown capability' tier — never auto-promoted to primary routing.
const DISCOVERED_POOL_LIMIT = 20;
const discoveredModels = new Map(); // key: `${provider}:${model}` -> entry

function allRegistryEntries() {
  const out = [];
  for (const provider of Object.keys(MODEL_REGISTRY)) {
    for (const model of Object.keys(MODEL_REGISTRY[provider])) {
      out.push(MODEL_REGISTRY[provider][model]);
    }
  }
  for (const entry of discoveredModels.values()) out.push(entry);
  return out;
}

// ------------------------------------------------------------
// Soft provider-preference bonus applied on top of capability score.
// Tunable without touching scoring logic elsewhere.
// ------------------------------------------------------------
const GEMINI_PRIMARY_BONUS = {
  casual: 6,
  shortFactual: 3,
  creative: 6,
  hinglish: 5,
  reasoning: 2,
  gameStrategy: 2,
  coding: 0,   // capability-driven, no thumb on the scale
  math: 0      // capability-driven, no thumb on the scale
};

// ------------------------------------------------------------
// INTENT-BASED WEIGHT-CLASS ROUTING
// ------------------------------------------------------------
// Categories are grouped into two task "weights". Heavyweight categories
// (reasoning-, coding-, and game-strategy-heavy queries) get a large score
// boost for models tagged weightClass:'heavy' — pulling the big 70b/120b
// models to the front of the candidate list. Lightweight categories
// (casual chat, short factual answers, hinglish banter) get the inverse
// boost for weightClass:'light' models — small, fast models that save
// compute and respond instantly, rather than burning a big model on
// "hey" or "lol".
//
// This is a scoring nudge on top of the existing capability scores, not a
// hard filter — a heavy-class model can still be picked for a light task
// (and vice versa) if every weight-matched model is unhealthy/cooling down.
const HEAVY_CATEGORIES = new Set(['gameStrategy', 'reasoning', 'coding']);
const LIGHT_CATEGORIES = new Set(['casual', 'shortFactual', 'hinglish']);

const WEIGHT_CLASS_MATCH_BONUS = 14;   // model's class matches the task's weight
const WEIGHT_CLASS_MISMATCH_PENALTY = 5; // model's class actively fights the task's weight

// ------------------------------------------------------------
// STRICT PROVIDER FALLBACK HIERARCHY
// ------------------------------------------------------------
// Independent of weight-class/capability scoring above, the overall
// candidate order must still honor: Groq -> Gemini -> OpenRouter ->
// Cloudflare. This is applied as a large, fixed per-provider offset so
// weight-class and capability scores only break ties *within* a provider
// tier, never across tiers — e.g. a mediocre Groq model still sorts ahead
// of a great OpenRouter model. buildCandidates()/generate() still walk the
// whole sorted list on failure, so if every Groq candidate is exhausted or
// cooling down, Gemini candidates (next tier down) are tried next, then
// OpenRouter, then Cloudflare — the emergency-fallback block mirrors the
// same order as a last resort.
const PROVIDER_TIER_RANK = { groq: 0, gemini: 1, openrouter: 2, cloudflare: 3 };
const PROVIDER_TIER_BONUS = 100; // dwarfs capability/weight-class deltas

function providerTierBonus(provider) {
  const rank = PROVIDER_TIER_RANK[provider];
  if (rank === undefined) return 0;
  // Higher-priority tiers (lower rank number) get a bigger bonus.
  return (Object.keys(PROVIDER_TIER_RANK).length - rank) * PROVIDER_TIER_BONUS;
}

module.exports = {
  MODEL_REGISTRY,
  DISCOVERED_POOL_LIMIT,
  discoveredModels,
  allRegistryEntries,
  GEMINI_PRIMARY_BONUS,
  HEAVY_CATEGORIES,
  LIGHT_CATEGORIES,
  WEIGHT_CLASS_MATCH_BONUS,
  WEIGHT_CLASS_MISMATCH_PENALTY,
  PROVIDER_TIER_RANK,
  PROVIDER_TIER_BONUS,
  providerTierBonus
};
