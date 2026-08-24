/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Intelligent Multi-Provider Model Router — v7 (Groq-Primary, Intent-Weighted Edition)
 *
 *   Providers, in strict fallback priority order: Groq -> Gemini ->
 *   OpenRouter -> Cloudflare Workers AI. Every request is classified into a
 *   task category, that category is bucketed into a task WEIGHT CLASS
 *   ('heavy' for gameStrategy/reasoning/coding, 'light' for casual/
 *   shortFactual/hinglish), and candidates are scored against a capability
 *   registry with (a) a large fixed per-provider tier bonus enforcing the
 *   Groq > Gemini > OpenRouter > Cloudflare order, and (b) a weight-class
 *   match bonus that pulls big models (openai/gpt-oss-120b,
 *   nvidia/nemotron-3-ultra-550b-a55b:free) to the front for heavy tasks,
 *   and small/fast models (openai/gpt-oss-20b, groq/compound-mini,
 *   nvidia/nemotron-nano-9b-v2:free) to the front for light tasks.
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
 *     re-entering via discovery too (see DISCOVERY_BLOCKLIST). llama-3.1-8b-
 *     instant was separately confirmed dead and removed; groq/compound-mini
 *     (already live, no 404s in logs) is now tagged weightClass:'light' and
 *     carries the primary LIGHT slot on Groq alongside openai/gpt-oss-20b.
 *   - OpenRouter's meta-llama/llama-3.3-70b-instruct:free was CONFIRMED
 *     REMOVED from OpenRouter's free catalog -- it 404s. Replaced with
 *     nvidia/nemotron-3-ultra-550b-a55b:free (heavy) and
 *     nvidia/nemotron-nano-9b-v2:free (light), both live on OpenRouter's
 *     current :free listing alongside openai/gpt-oss-20b:free and
 *     openrouter/free.
 *   Unhealthy/quota-exhausted/invalid models are cooled down per-failure-
 *   type and skipped without hammering dead providers. Optional periodic
 *   model discovery keeps the registry honest without ever calling out to
 *   a provider on every Discord message, and now hard-blocklists explicitly
 *   banned model families (currently: Qwen) so a live provider catalog can
 *   never silently re-add them to the discovered pool.
 *
 * PUBLIC CONTRACT (unchanged — required by gemini.js)
 *   const { result, modelUsed } = await modelRouter.generate({
 *     classification, prompt, userMessage, systemInstruction,
 *     geminiKeys, groqKeys
 *   });
 *   modelRouter.getRouterHealth()
 *
 * DESIGN NOTES
 *   - Provider order is a HARD priority tier (PROVIDER_TIER_BONUS = 100 per
 *     rung), not a soft nudge: it dominates weight-class/capability deltas
 *     so ordering across providers never flips, while those smaller deltas
 *     still decide which model wins within the same provider tier.
 *   - Gemini keeps its existing soft per-category bonus (GEMINI_PRIMARY_BONUS)
 *     for conversational/creative/hinglish quality — this only affects
 *     ordering *within* the Gemini tier relative to other Gemini models,
 *     since the provider tier bonus already separates it from Groq/OpenRouter.
 *   - temperature/top_p/top_k are omitted for Gemini models whose metadata
 *     says supportsSampling:false (current Gemini 3.6/3.5-Lite behavior).
 *   - groq/compound-mini is now a first-class primary LIGHT target (llama-
 *     3.1-8b-instant, its predecessor, was confirmed dead and removed).
 *     llama-3.3-70b-versatile was REMOVED 2026-08-23 (confirmed 404 on both
 *     keys — permanently retired, not transient). openai/gpt-oss-120b is
 *     currently the sole GA HEAVY target on Groq (moonshotai/kimi-k2-
 *     instruct-0905 was removed 2026-08-24 after confirming it 404s).
 *   - Model discovery (Groq /models, OpenRouter /models) is OPTIONAL,
 *     cached for MODEL_DISCOVERY_TTL_MS, and never blocks the hot path —
 *     a discovery failure is silently ignored and the static registry wins.
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');

let INTENTS;
try {
  ({ INTENTS } = require('../classifier/intentClassifier'));
} catch (_) {
  INTENTS = {};
}

// 🛟 Reuse promptAssembler's priority-aware GameData trimmer for the
// emergency-fallback path below, instead of a blind character slice.
// Guarded require — a missing/renamed file just falls back to the old
// naive-slice behavior rather than crashing the router.
let fitGameDataToBudget = null;
try {
  ({ fitGameDataToBudget } = require('../promptBuilder/promptAssembler'));
} catch (_) {
  fitGameDataToBudget = null;
}

// ============================================================
// 0. ENV / SAFETY SWITCHES
// ============================================================
function envBool(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return def;
  return String(raw).toLowerCase() !== 'false' && String(raw).toLowerCase() !== '0';
}

const DEBUG = envBool('MODEL_ROUTER_DEBUG', false);
const FREE_ONLY_MODE = envBool('FREE_ONLY_MODE', true);
const OPENROUTER_FREE_ONLY = envBool('OPENROUTER_FREE_ONLY', true);

const ENABLE_GEMINI = envBool('ENABLE_GEMINI', true);
const ENABLE_GROQ = envBool('ENABLE_GROQ', true);
const ENABLE_OPENROUTER = envBool('ENABLE_OPENROUTER', true);
const ENABLE_CLOUDFLARE = envBool('ENABLE_CLOUDFLARE', true);

const MODEL_DISCOVERY_TTL_MS = Number(process.env.MODEL_ROUTER_HEALTH_INTERVAL_MS) > 0
  ? Number(process.env.MODEL_ROUTER_HEALTH_INTERVAL_MS)
  : 30 * 60 * 1000; // 30 min default

// Soft provider-preference bonus applied on top of capability score.
// Tunable without touching scoring logic elsewhere.
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

function dlog(...args) { if (DEBUG) console.log('[ROUTER]', ...args); }
function ilog(...args) { console.log('[ROUTER]', ...args); }
function wlog(...args) { console.warn('[ROUTER]', ...args); }

// ============================================================
// 1. MODEL CAPABILITY REGISTRY
// ============================================================
// Scores 0-10 — routing heuristics, not objective benchmark claims.
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

// ============================================================
// 2. CLIENT CACHE (created once, never per-request)
// ============================================================
const genAiClientCache = new Map();
function getGeminiClient(apiKey) {
  if (!genAiClientCache.has(apiKey)) {
    genAiClientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return genAiClientCache.get(apiKey);
}

let openRouterClient = null;
let openRouterInitAttempted = false;
function getOpenRouterClient() {
  if (!ENABLE_OPENROUTER) return null;
  if (openRouterInitAttempted) return openRouterClient;
  openRouterInitAttempted = true;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    dlog('OPENROUTER_API_KEY not set — OpenRouter tier disabled.');
    return null;
  }
  openRouterClient = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || '',
      'X-Title': process.env.OPENROUTER_SITE_NAME || ''
    }
  });
  return openRouterClient;
}

// Groq clients are built internally from the raw API keys the caller
// passes in (groqKeys), the same way Gemini clients are built from
// geminiKeys — callers should never need to construct an SDK client
// themselves. Cached per-key so repeated calls don't re-instantiate.
const groqClientCache = new Map();
function getGroqClient(apiKey) {
  if (!apiKey) return null;
  if (!groqClientCache.has(apiKey)) {
    groqClientCache.set(apiKey, new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    }));
  }
  return groqClientCache.get(apiKey);
}

let cloudflareInitAttempted = false;
let cloudflareConfig = null;
function getCloudflareConfig() {
  if (!ENABLE_CLOUDFLARE) return null;
  if (cloudflareInitAttempted) return cloudflareConfig;
  cloudflareInitAttempted = true;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    dlog('Cloudflare credentials not set — Cloudflare tier disabled.');
    return null;
  }
  cloudflareConfig = {
    accountId,
    apiToken,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
  };
  return cloudflareConfig;
}

// ============================================================
// 3. FAILURE CLASSIFICATION
// ============================================================
const FAILURE = {
  AUTH: 'AUTH',
  INVALID_MODEL: 'INVALID_MODEL',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  RATE_LIMIT: 'RATE_LIMIT',
  OVERLOADED: 'OVERLOADED',
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
  UNSUPPORTED_FEATURE: 'UNSUPPORTED_FEATURE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  OUTAGE: 'OUTAGE',
  UNKNOWN: 'UNKNOWN'
};

function extractStatus(error) {
  if (!error) return null;
  if (typeof error.status === 'number') return error.status;
  if (typeof error.statusCode === 'number') return error.statusCode;
  const msg = String(error.message || error);
  const m = msg.match(/\b(4\d\d|5\d\d)\b/);
  return m ? Number(m[1]) : null;
}

function classifyFailure(error) {
  const status = extractStatus(error);
  const msg = String((error && error.message) || error || '').toLowerCase();

  if (status === 401 || status === 403 || /invalid api key|unauthorized|forbidden/.test(msg)) {
    return FAILURE.AUTH;
  }
  if (status === 404 || /model not found|not found|does not exist|unknown model|decommissioned/.test(msg)) {
    return FAILURE.INVALID_MODEL;
  }
  if (status === 400 && /(unsupported|not supported|capability|does not support)/.test(msg)) {
    return FAILURE.UNSUPPORTED_FEATURE;
  }
  if (status === 413 || /request entity too large|payload too large|request too large/.test(msg)) {
    return FAILURE.PAYLOAD_TOO_LARGE;
  }
  if (status === 429 || /rate.?limit/.test(msg)) {
    if (/quota|daily limit|billing|exceeded your current/.test(msg)) return FAILURE.QUOTA_EXHAUSTED;
    return FAILURE.RATE_LIMIT;
  }
  if (status === 503 || /overloaded|service unavailable/.test(msg)) {
    return FAILURE.OVERLOADED;
  }
  if (status && status >= 500) return FAILURE.OUTAGE;
  // 🆕 Catches both our own explicit timeoutError() (Gemini path) and the
  // OpenAI SDK's APIUserAbortError thrown when AbortController fires
  // (Groq/OpenRouter path) — neither says "timeout" verbatim.
  if (/timeout|timed out|etimedout|abort/i.test(msg) || error?.name === 'APIUserAbortError' || error?.name === 'AbortError') return FAILURE.TIMEOUT;
  if (/network|econnreset|enotfound|econnrefused|fetch failed/.test(msg)) return FAILURE.NETWORK;
  return FAILURE.UNKNOWN;
}

const COOLDOWN_MS = {
  [FAILURE.AUTH]: 30 * 60 * 1000,           // long disable until config fixed
  [FAILURE.INVALID_MODEL]: 45 * 60 * 1000,  // long — model likely retired; eligible for later re-probe
  [FAILURE.QUOTA_EXHAUSTED]: 15 * 60 * 1000, // overridden by estimated reset time if known
  [FAILURE.RATE_LIMIT]: 60 * 1000,           // default; Retry-After overrides
  [FAILURE.OVERLOADED]: 8 * 1000,            // short exponential base
  [FAILURE.TIMEOUT]: 5 * 1000,
  [FAILURE.NETWORK]: 5 * 1000,
  [FAILURE.UNSUPPORTED_FEATURE]: 60 * 60 * 1000,
  [FAILURE.PAYLOAD_TOO_LARGE]: 3 * 60 * 1000,  // same prompt will fail again; not quota-scarce, just needs the emergency-compressed path
  [FAILURE.OUTAGE]: 20 * 1000,
  [FAILURE.UNKNOWN]: 10 * 1000
};

function extractRetryAfterMs(error) {
  const headers = (error && (error.headers || (error.response && error.response.headers))) || null;
  if (!headers) return null;
  const raw = typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after'];
  if (!raw) return null;
  const seconds = Number(raw);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

// ============================================================
// 4. QUOTA HEADER TRACKING (best-effort, never fabricated)
// ============================================================
function parseQuotaHeaders(headers) {
  if (!headers) return null;
  const get = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k]);
  const remainingRequests = get('x-ratelimit-remaining-requests');
  const limitRequests = get('x-ratelimit-limit-requests');
  const remainingTokens = get('x-ratelimit-remaining-tokens');
  const limitTokens = get('x-ratelimit-limit-tokens');
  const resetRequests = get('x-ratelimit-reset-requests');
  const resetTokens = get('x-ratelimit-reset-tokens');

  if (!remainingRequests && !remainingTokens) return null;

  return {
    remainingRequests: remainingRequests != null ? Number(remainingRequests) : null,
    limitRequests: limitRequests != null ? Number(limitRequests) : null,
    remainingTokens: remainingTokens != null ? Number(remainingTokens) : null,
    limitTokens: limitTokens != null ? Number(limitTokens) : null,
    resetRequests: resetRequests || null,
    resetTokens: resetTokens || null,
    observedAt: Date.now()
  };
}

// ============================================================
// 5. CIRCUIT BREAKER (per provider+model+credential, concurrency-safe)
// ============================================================
const CIRCUIT_STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };
const breakers = new Map();
const BREAKER_MAP_LIMIT = 200; // bounded for low-RAM environment

function fingerprint(credential) {
  if (!credential) return 'default';
  const s = String(credential);
  return s.length <= 6 ? '***' : `***${s.slice(-4)}`;
}

function breakerId(provider, modelName, credential) {
  return `${provider}::${modelName}::${fingerprint(credential)}`;
}

function newBreakerState() {
  return {
    state: CIRCUIT_STATE.CLOSED,
    openedAt: 0,
    cooldownMs: 0,
    trippedBy: null,
    failureType: null,
    probeInFlight: false,
    successCount: 0,
    failureCount: 0,
    rateLimitCount: 0,
    quotaFailures: 0,
    requestCount: 0,
    lastUsed: 0,
    lastFailure: 0,
    lastSuccess: 0,
    avgLatencyMs: 0,
    disabled: false,
    disabledReason: null,
    quota: null
  };
}

function getBreaker(id) {
  if (!breakers.has(id)) {
    if (breakers.size >= BREAKER_MAP_LIMIT) {
      const oldestKey = breakers.keys().next().value;
      breakers.delete(oldestKey);
    }
    breakers.set(id, newBreakerState());
  }
  return breakers.get(id);
}

function isBreakerOpen(id) {
  const b = getBreaker(id);
  if (b.disabled) return true;
  if (b.state === CIRCUIT_STATE.CLOSED) return false;

  if (b.state === CIRCUIT_STATE.HALF_OPEN) {
    if (b.probeInFlight) return true;
    b.probeInFlight = true;
    return false;
  }

  const elapsed = Date.now() - b.openedAt;
  if (elapsed > b.cooldownMs) {
    b.state = CIRCUIT_STATE.HALF_OPEN;
    b.probeInFlight = true;
    return false;
  }
  return true;
}

function tripBreaker(id, error) {
  const b = getBreaker(id);
  const failureType = classifyFailure(error);
  const retryAfterMs = extractRetryAfterMs(error);
  let cooldown = COOLDOWN_MS[failureType] || COOLDOWN_MS[FAILURE.UNKNOWN];

  if (failureType === FAILURE.OVERLOADED || failureType === FAILURE.TIMEOUT || failureType === FAILURE.OUTAGE) {
    const streak = Math.min(b.failureCount, 5);
    cooldown = cooldown * Math.pow(2, streak) + Math.random() * 250;
  }

  if (failureType === FAILURE.QUOTA_EXHAUSTED && b.quota && b.quota.resetRequests) {
    const resetMs = parseResetToMs(b.quota.resetRequests);
    if (resetMs) cooldown = resetMs;
  }
  if (retryAfterMs) cooldown = retryAfterMs;

  b.state = CIRCUIT_STATE.OPEN;
  b.openedAt = Date.now();
  b.cooldownMs = cooldown;
  b.trippedBy = String((error && error.message) || error).slice(0, 200);
  b.failureType = failureType;
  b.probeInFlight = false;
  b.failureCount += 1;
  b.lastFailure = Date.now();
  if (failureType === FAILURE.RATE_LIMIT) b.rateLimitCount += 1;
  if (failureType === FAILURE.QUOTA_EXHAUSTED) b.quotaFailures += 1;

  if (failureType === FAILURE.AUTH) {
    b.disabled = true;
    b.disabledReason = 'auth_failure';
    wlog(`${id} DISABLED (auth failure) — check credential.`);
  } else if (failureType === FAILURE.INVALID_MODEL) {
    wlog(`${id} breaker OPEN [INVALID_MODEL] — cooling ${Math.round(cooldown / 60000)}min, eligible for re-probe after.`);
  } else {
    wlog(`${id} breaker OPEN [${failureType}] cooldown=${Math.round(cooldown)}ms`);
  }
}

// Parses "reset" header values that Groq/OpenAI-style APIs send, typically
// like "1s", "6m30s", or a raw seconds count. Returns ms or null.
function parseResetToMs(raw) {
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw) * 1000;
  const m = String(raw).match(/(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (!m) return null;
  const minutes = Number(m[1] || 0);
  const seconds = Number(m[2] || 0);
  const total = minutes * 60 + seconds;
  return total > 0 ? total * 1000 : null;
}

function recordSuccess(id, latencyMs, quota) {
  const b = getBreaker(id);
  if (b.state !== CIRCUIT_STATE.CLOSED) {
    ilog(`${id} breaker CLOSED — recovered`);
  }
  b.state = CIRCUIT_STATE.CLOSED;
  b.openedAt = 0;
  b.cooldownMs = 0;
  b.trippedBy = null;
  b.failureType = null;
  b.probeInFlight = false;
  b.successCount += 1;
  b.requestCount += 1;
  b.lastUsed = Date.now();
  b.lastSuccess = Date.now();
  b.avgLatencyMs = b.avgLatencyMs === 0 ? latencyMs : Math.round(b.avgLatencyMs * 0.7 + latencyMs * 0.3);
  if (quota) b.quota = quota;
}

function releaseProbe(id) {
  const b = getBreaker(id);
  if (b.state === CIRCUIT_STATE.HALF_OPEN) b.probeInFlight = false;
}

function isHardLimitError(error) {
  const t = classifyFailure(error);
  return t === FAILURE.RATE_LIMIT || t === FAILURE.QUOTA_EXHAUSTED || t === FAILURE.OVERLOADED
    || t === FAILURE.INVALID_MODEL || t === FAILURE.AUTH || t === FAILURE.UNSUPPORTED_FEATURE
    || t === FAILURE.PAYLOAD_TOO_LARGE;
}

// Quota risk penalty derived from last observed headers (0 if unknown).
function quotaRiskPenalty(id) {
  const b = breakers.get(id);
  if (!b || !b.quota) return 0;
  const { remainingRequests, limitRequests, remainingTokens, limitTokens } = b.quota;
  let riskiest = 1;
  if (limitRequests && remainingRequests != null) riskiest = Math.min(riskiest, remainingRequests / limitRequests);
  if (limitTokens && remainingTokens != null) riskiest = Math.min(riskiest, remainingTokens / limitTokens);
  if (riskiest >= 1) return 0;
  if (riskiest <= 0.05) return 8;
  if (riskiest <= 0.2) return 4;
  if (riskiest <= 0.5) return 1;
  return 0;
}

// ============================================================
// 6. ROUND-ROBIN KEY SELECTOR (Gemini multi-key support)
// ============================================================
const rrPointers = new Map();
function nextKeyOrder(poolName, keys) {
  if (!keys || keys.length === 0) return [];
  const start = (rrPointers.get(poolName) || 0) % keys.length;
  rrPointers.set(poolName, (start + 1) % keys.length);
  const ordered = [];
  for (let i = 0; i < keys.length; i++) {
    const idx = (start + i) % keys.length;
    ordered.push({ key: keys[idx], index: idx });
  }
  return ordered;
}

// ============================================================
// 7. REQUEST CLASSIFICATION -> TASK PROFILE
// ============================================================
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query']);
const CODE_REGEX = /```|code|script|debug|function|python|javascript|java\b|c\+\+|sql|json|regex|api|stack ?trace|error:|exception/i;
const MATH_REGEX = /\b(calculate|equation|solve|integral|derivative|algebra|geometry|probability|matrix)|[0-9]\s*[+\-*/^]\s*[0-9]|=\s*0\b/i;
const REASONING_REGEX = /deep analysis|quantum|architecture|complex breakdown|thesis|geopolitics|explain in detail|analyze/i;
const CREATIVE_REGEX = /\b(poem|story|essay|lyrics|write a|creative|stotram|mantra)\b/i;
const HINDI_DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const HINGLISH_REGEX = /\b(kya|hai|nahi|kaise|kyu|bhai|yaar|acha|theek|kar|raha|rahi|tum|aap|mera|tera)\b/i;
const SHORT_CASUAL_REGEX = /^(hey|hi|hello|lol|lmao|haha|hola|yo|sup|good morning|good night|gm|gn|bruh|ok|okay|hmm)\W*$/i;

function classifyRequest({ classification, prompt, userMessage }) {
  const intent = classification?.intent || 'social';
  const text = String(userMessage || prompt || '');
  const trimmed = text.trim();

  const isGame = GAME_INTENTS.has(intent) || /\b(stats|hp|damage|hero|troop|game|clash)\b/i.test(text) || /\[GAME DATA\]/i.test(text);
  const isCode = CODE_REGEX.test(text);
  const isMath = MATH_REGEX.test(text);
  const isReasoningHeavy = intent === (INTENTS && INTENTS.HEAVY_TASK) || REASONING_REGEX.test(text);
  const isCreative = CREATIVE_REGEX.test(text);
  const isDevanagari = HINDI_DEVANAGARI_REGEX.test(text);
  const isHinglish = !isDevanagari && HINGLISH_REGEX.test(text);
  const isShortCasual = SHORT_CASUAL_REGEX.test(trimmed) || trimmed.length <= 6;
  const isLong = text.length > 2000;

  let category = 'casual';
  if (isGame) category = 'gameStrategy';
  else if (isCode) category = 'coding';
  else if (isMath) category = 'math';
  else if (isReasoningHeavy || isLong) category = 'reasoning';
  else if (isCreative) category = 'creative';
  else if (isDevanagari || isHinglish) category = 'hinglish';
  else if (isShortCasual) category = 'shortFactual';
  else category = 'casual';

  return { category, isHindi: isDevanagari || isHinglish, isLong, intent };
}

// Weight vector per category — which registry fields matter, and how much.
const CATEGORY_WEIGHTS = {
  casual: { casualChat: 3, speed: 2, quality: 1, reliability: 2 },
  shortFactual: { speed: 3, reliability: 2, casualChat: 1, quality: 1 },
  coding: { coding: 3, reasoning: 2, quality: 2, reliability: 1 },
  math: { math: 3, reasoning: 2, quality: 1, reliability: 1 },
  reasoning: { reasoning: 3, longContext: 2, quality: 2, reliability: 1 },
  gameStrategy: { gameStrategy: 3, reasoning: 2, structuredOutput: 1, reliability: 1 },
  creative: { creativeWriting: 3, quality: 2, longContext: 1, reliability: 1 },
  hinglish: { hindi: 3, multilingual: 2, casualChat: 2, reliability: 1 }
};

// Dynamic max output tokens by category — avoids wasting free-tier tokens
// on casual chat while still allowing room for genuinely long answers.
const MAX_TOKENS_BY_CATEGORY = {
  shortFactual: 384,
  casual: 768,
  hinglish: 768,
  creative: 1536,
  gameStrategy: 1536,
  coding: 3072,
  math: 2048,
  reasoning: 4096
};

function scoreModel(entry, category, opts = {}) {
  if (!entry || entry.status === 'disabled') return -Infinity;
  const weights = CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS.casual;
  let score = 0;
  for (const [field, weight] of Object.entries(weights)) {
    score += (entry[field] || 0) * weight;
  }
  score += entry.reliability || 0;

  if (opts.isLong) score += (entry.longContext || 0) * 0.5;

  if (entry.provider === 'gemini') {
    score += GEMINI_PRIMARY_BONUS[category] || 0;
  }

  // Intent-based weight-class routing: heavyweight tasks favor big models
  // (openai/gpt-oss-120b, the OpenRouter Nemotron free model); lightweight
  // tasks favor small/fast models (gpt-oss-20b, groq/compound-mini,
  // openrouter/free). See HEAVY_CATEGORIES / LIGHT_CATEGORIES above.
  if (entry.weightClass === 'heavy') {
    if (HEAVY_CATEGORIES.has(category)) score += WEIGHT_CLASS_MATCH_BONUS;
    else if (LIGHT_CATEGORIES.has(category)) score -= WEIGHT_CLASS_MISMATCH_PENALTY;
  } else if (entry.weightClass === 'light') {
    if (LIGHT_CATEGORIES.has(category)) score += WEIGHT_CLASS_MATCH_BONUS;
    else if (HEAVY_CATEGORIES.has(category)) score -= WEIGHT_CLASS_MISMATCH_PENALTY;
  }

  // Strict provider fallback hierarchy: Groq > Gemini > OpenRouter >
  // Cloudflare. Applied as a large fixed offset so it dominates ordering
  // across providers while weight-class/capability scores still decide
  // which model wins within the same provider tier.
  score += providerTierBonus(entry.provider);

  if (entry.costTier === 'paid') score -= 1000;
  if (entry.legacy) score -= 6;
  if (entry.preview) score -= 1;
  if (entry.status === 'discovered') score -= 3;

  return score;
}

// ============================================================
// 8. TOKEN COMPRESSION (Emergency Tier)
// ============================================================
// 🐛 FIX: execGemini/execOpenAICompatible had NO request timeout at all —
// only execCloudflare did (20s AbortController). Observed in production:
// OpenRouter's nvidia/nemotron-3-ultra-550b:free taking 50-127 SECONDS on a
// single call, with the router just awaiting it to completion every time —
// stalling the entire Discord response and burning the whole retry budget
// on one slow candidate instead of failing fast to the next one. This is a
// shared budget for Gemini + Groq/OpenRouter (Cloudflare keeps its own
// existing 20s constant untouched).
const GENERATION_TIMEOUT_MS = 25000;

function timeoutError(label, ms) {
  const err = new Error(`${label} request timed out after ${ms}ms`);
  err.status = 408;
  return err;
}
const EMERGENCY_GAMEDATA_CHAR_CAP = 800;
function compressForEmergency(prompt) {
  if (!prompt) return prompt;
  let compressed = prompt;
  compressed = compressed.replace(/<LongTermMemory>[\s\S]*?<\/LongTermMemory>/i, '');
  compressed = compressed.replace(/<ChatHistory>[\s\S]*?<\/ChatHistory>/i, '');
  compressed = compressed.replace(/<RecentChatHistory>([\s\S]*?)<\/RecentChatHistory>/i, (match, inner) => {
    if (inner.length <= EMERGENCY_MEMORY_CHAR_CAP) return match;
    const truncated = inner.slice(-EMERGENCY_MEMORY_CHAR_CAP);
    return `<RecentChatHistory>\n...[truncated for emergency]...\n${truncated}\n</RecentChatHistory>`;
  });
  // 🆕 GameData is now frequently the largest block (full hero/troop stat
  // sets, formations, boss records). It's already minified JSON by the time
  // it reaches here.
  // 🐛 FIX: this used to be a blind `.slice(0, CAP)` on the serialized JSON,
  // which chops mid-object — whichever field happened to be serialized last
  // (often `bossModifiers`/`matchedBosses`, the exact fields that disambiguate
  // "this hero's CC is for swarms, not bosses") would get cut off entirely,
  // leaving the model with an incomplete picture and room to invent. Now it
  // parses the JSON and reuses promptAssembler's priority-aware trimmer —
  // verbose lore/description dropped first, long reasoning/notes text
  // shortened next, low-priority arrays dropped last — so the fields the
  // model needs most to stay factually grounded are the last thing cut.
  // Falls back to the old naive-slice behavior if parsing fails or the
  // trimmer module isn't available (e.g. a path/require mismatch).
  compressed = compressed.replace(/<GameData>([\s\S]*?)<\/GameData>/i, (match, inner) => {
    const trimmedInner = inner.trim();
    if (trimmedInner.length <= EMERGENCY_GAMEDATA_CHAR_CAP) return match;

    let smart = null;
    if (fitGameDataToBudget) {
      try {
        const parsed = JSON.parse(trimmedInner);
        smart = fitGameDataToBudget(parsed, EMERGENCY_GAMEDATA_CHAR_CAP);
      } catch (_) {
        smart = null; // not valid JSON (already partially truncated elsewhere, or a plain string) — fall back below
      }
    }

    if (smart === null) {
      smart = `${trimmedInner.slice(0, EMERGENCY_GAMEDATA_CHAR_CAP)}...[truncated for emergency]`;
    }

    return `<GameData>\n${smart}\n</GameData>`;
  });
  compressed = compressed.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return compressed;
}

// ============================================================
// 9. RETRY HELPERS
// ============================================================
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function backoffDelay(attempt) {
  const base = 500 * Math.pow(2, attempt);
  const jitter = Math.random() * 250;
  return base + jitter;
}
async function withRetry(fn, { retries = 1 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      const type = classifyFailure(error);
      // 🐛 FIX: TIMEOUT wasn't in this list, so a candidate that just took
      // 25s to time out would get retried once MORE on the exact same slow
      // model before the router ever moved on — doubling the worst-case
      // wait (e.g. the 50-127s OpenRouter nemotron calls seen in
      // production) instead of failing fast to the next candidate.
      const noRetryTypes = [FAILURE.INVALID_MODEL, FAILURE.AUTH, FAILURE.UNSUPPORTED_FEATURE, FAILURE.QUOTA_EXHAUSTED, FAILURE.PAYLOAD_TOO_LARGE, FAILURE.TIMEOUT];
      if (noRetryTypes.includes(type) || attempt >= retries) throw error;
      const delay = backoffDelay(attempt);
      dlog(`transient error [${type}], retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
      attempt++;
    }
  }
}

function getDynamicTemp(intent) {
  switch (intent) {
    case (INTENTS && INTENTS.MODERATION):
    case (INTENTS && INTENTS.COMMAND): return 0.1;
    case (INTENTS && INTENTS.HEAVY_TASK): return 0.3;
    case (INTENTS && INTENTS.EMOTIONAL_DISCLOSURE): return 0.9;
    default: return 0.8;
  }
}

// ============================================================
// 10. API EXECUTORS (normalized output + quota extraction)
// ============================================================
async function execGemini({ apiKey, modelName, prompt, systemInstruction, temp, maxTokens }) {
  const entry = MODEL_REGISTRY.gemini[modelName];
  const genAI = getGeminiClient(apiKey);

  const generationConfig = { maxOutputTokens: maxTokens };
  if (entry && entry.supportsSampling && typeof temp === 'number') {
    generationConfig.temperature = temp;
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
    tools: [
      { googleSearchRetrieval: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.2 } } }
    ],
    generationConfig
  });

  // 🐛 FIX: no timeout previously — a slow Gemini call would hang the whole
  // request indefinitely. Promise.race can't cancel the underlying HTTP
  // call (the Gemini SDK here doesn't take an abort signal), but it stops
  // the router from waiting on it — the router moves on to the next
  // candidate instead of stalling the user's response for 60-120+ seconds.
  const response = await Promise.race([
    model.generateContent(prompt),
    sleep(GENERATION_TIMEOUT_MS).then(() => { throw timeoutError('Gemini', GENERATION_TIMEOUT_MS); })
  ]);
  // Gemini SDK doesn't expose raw rate-limit headers through this call path.
  return { text: response.response.text(), quota: null };
}

async function execOpenAICompatible(client, { modelName, prompt, systemInstruction, maxTokens, temp }) {
  let data, headers = null;
  const payload = {
    model: modelName,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    temperature: temp,
    max_tokens: maxTokens
  };

  // 🐛 FIX: no timeout previously — this executor handles BOTH Groq and
  // OpenRouter, and was observed in production awaiting a single OpenRouter
  // call (nvidia/nemotron-3-ultra-550b:free) for up to 127 SECONDS with
  // nothing to stop it. Real AbortController + the SDK's `signal` request
  // option, so the underlying HTTP request is actually cancelled (not just
  // abandoned like a bare Promise.race would do) — the connection is torn
  // down and the router moves on to the next candidate immediately.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  // Some SDK versions/paths return a plain Promise from .create() (no
  // .withResponse() chain method) instead of the APIPromise this prefers.
  // Distinguish "this SDK doesn't support .withResponse()" from "the
  // request itself failed" by checking BEFORE awaiting — chaining
  // .withResponse() onto an already-in-flight promise and only checking
  // in the catch block double-fires the request on every real failure
  // (doubling quota burn) and can also surface as an unhandled rejection
  // on the un-awaited first promise.
  try {
    const initial = client.chat.completions.create(payload, { signal: controller.signal });
    if (typeof initial.withResponse === 'function') {
      try {
        const withResp = await initial.withResponse();
        data = withResp.data;
        headers = withResp.response ? withResp.response.headers : null;
      } catch (e) {
        // withResponse() exists but the request itself failed — propagate,
        // do NOT re-issue the request.
        throw e;
      }
    } else {
      // No .withResponse() support on this SDK path/version — the plain
      // call IS the real request; let its rejection propagate naturally.
      data = await initial;
    }
  } finally {
    clearTimeout(timeout);
  }

  const text = data.choices?.[0]?.message?.content || '';
  return { text, quota: parseQuotaHeaders(headers) };
}

async function execCloudflare({ modelName, prompt, systemInstruction, maxTokens, temp }) {
  const cfg = getCloudflareConfig();
  if (!cfg) throw new Error('Cloudflare not configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${cfg.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: temp,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Cloudflare ${res.status}: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content || '', quota: parseQuotaHeaders(res.headers) };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// 11. UNIFIED MODEL RUNNER (per candidate, breaker-guarded)
// ============================================================
async function runCandidate(candidate, ctx) {
  const { provider, model: modelName } = candidate;
  const { prompt, systemInstruction, temp, maxTokens, geminiKeys, groqKeys, openRouterFreeOnly } = ctx;
  let lastFailureType = null;

  if (provider === 'gemini') {
    if (!ENABLE_GEMINI || !geminiKeys || geminiKeys.length === 0) return null;
    const order = nextKeyOrder(`gemini:${modelName}`, geminiKeys);
    for (const { key, index } of order) {
      const id = breakerId('gemini', modelName, key);
      if (isBreakerOpen(id)) continue;

      const start = Date.now();
      try {
        const { text } = await withRetry(() => execGemini({ apiKey: key, modelName, prompt, systemInstruction, temp, maxTokens }));
        recordSuccess(id, Date.now() - start, null);
        return { result: text, modelUsed: `${modelName} (gemini, key ${index + 1})`, provider: 'gemini', metadata: { latencyMs: Date.now() - start } };
      } catch (error) {
        const type = classifyFailure(error);
        wlog(`gemini/${modelName} key=${index + 1} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
        if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
        lastFailureType = type;
      }
    }
    return { result: null, failureType: lastFailureType };
  }

  if (provider === 'groq') {
    if (!ENABLE_GROQ || !groqKeys || groqKeys.length === 0) return null;
    // Rotate through both configured Groq keys (opla/OPLA/GROQ_API_KEY/
    // GROQ_API_KEY_2, deduped upstream by the caller) the same way Gemini
    // rotates through its keys, so a rate-limited/quota-exhausted key
    // doesn't take the whole Groq tier down with it.
    const order = nextKeyOrder(`groq:${modelName}`, groqKeys);
    for (const { key, index } of order) {
      const id = breakerId('groq', modelName, key);
      if (isBreakerOpen(id)) continue;

      const client = getGroqClient(key);
      if (!client) continue;

      const start = Date.now();
      try {
        const { text, quota } = await withRetry(() => execOpenAICompatible(client, { modelName, prompt, systemInstruction, maxTokens, temp }));
        recordSuccess(id, Date.now() - start, quota);
        return { result: text, modelUsed: `${modelName} (groq, key ${index + 1})`, provider: 'groq', metadata: { latencyMs: Date.now() - start, quota } };
      } catch (error) {
        const type = classifyFailure(error);
        wlog(`groq/${modelName} key=${index + 1} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
        if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
        lastFailureType = type;
      }
    }
    return { result: null, failureType: lastFailureType };
  }

  if (provider === 'openrouter') {
    const client = getOpenRouterClient();
    if (!client) return null;
    const entry = MODEL_REGISTRY.openrouter[modelName] || discoveredModels.get(`openrouter:${modelName}`);
    if (openRouterFreeOnly && entry && entry.costTier !== 'free') {
      dlog(`skipping openrouter/${modelName} — not free and OPENROUTER_FREE_ONLY is set`);
      return null;
    }
    const id = breakerId('openrouter', modelName, process.env.OPENROUTER_API_KEY);
    if (isBreakerOpen(id)) return null;
    const start = Date.now();
    try {
      const { text, quota } = await withRetry(() => execOpenAICompatible(client, { modelName, prompt, systemInstruction, maxTokens, temp }));
      recordSuccess(id, Date.now() - start, quota);
      return { result: text, modelUsed: `${modelName} (openrouter)`, provider: 'openrouter', metadata: { latencyMs: Date.now() - start, quota } };
    } catch (error) {
      const type = classifyFailure(error);
      wlog(`openrouter/${modelName} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
      if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
      return { result: null, failureType: type };
    }
  }

  if (provider === 'cloudflare') {
    const cfg = getCloudflareConfig();
    if (!cfg) return null;
    const id = breakerId('cloudflare', modelName, cfg.apiToken);
    if (isBreakerOpen(id)) return null;
    const start = Date.now();
    try {
      const { text, quota } = await withRetry(() => execCloudflare({ modelName, prompt, systemInstruction, maxTokens, temp }));
      recordSuccess(id, Date.now() - start, quota);
      return { result: text, modelUsed: `${modelName} (cloudflare)`, provider: 'cloudflare', metadata: { latencyMs: Date.now() - start, quota } };
    } catch (error) {
      const type = classifyFailure(error);
      wlog(`cloudflare/${modelName} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
      if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
      return { result: null, failureType: type };
    }
  }

  return null;
}

// ============================================================
// 12. CANDIDATE RANKING
// ============================================================
function isProviderLikelyDown(provider) {
  let sawAny = false;
  let allOpen = true;
  for (const [id, b] of breakers.entries()) {
    if (!id.startsWith(`${provider}::`)) continue;
    sawAny = true;
    if (b.state !== CIRCUIT_STATE.OPEN && !b.disabled) allOpen = false;
  }
  return sawAny && allOpen;
}

function buildCandidates({ category, isLong, geminiKeys, groqKeys, openRouterFreeOnly, cloudflareEnabled }) {
  const candidates = [];

  for (const entry of allRegistryEntries()) {
    if (entry.provider === 'gemini' && (!ENABLE_GEMINI || !geminiKeys || geminiKeys.length === 0)) continue;
    if (entry.provider === 'groq' && (!ENABLE_GROQ || !groqKeys || groqKeys.length === 0)) continue;
    if (entry.provider === 'openrouter' && (!ENABLE_OPENROUTER || !getOpenRouterClient())) continue;
    if (entry.provider === 'cloudflare' && (!ENABLE_CLOUDFLARE || !cloudflareEnabled)) continue;
    if (entry.costTier === 'paid') continue;
    if (isLong && (entry.longContext || 0) < 5) continue;

    const score = scoreModel(entry, category, { isLong });
    if (score === -Infinity) continue;

    // Fold in live quota risk using the most-likely credential fingerprint.
    // Gemini and Groq both round-robin across multiple keys, so the exact
    // key used per-request isn't known here — skip the approximate lookup
    // for both and rely on per-key circuit breakers (checked in
    // runCandidate) instead. Only single-credential providers get the
    // upfront penalty folded into ranking.
    let riskAdjusted = score;
    if (entry.provider === 'openrouter' || entry.provider === 'cloudflare') {
      const cred = entry.provider === 'openrouter'
        ? process.env.OPENROUTER_API_KEY
        : (getCloudflareConfig() || {}).apiToken;
      riskAdjusted -= quotaRiskPenalty(breakerId(entry.provider, entry.model, cred));
    }

    candidates.push({ ...entry, score: riskAdjusted });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ============================================================
// 13. OPTIONAL MODEL DISCOVERY (cached, never on hot path)
// ============================================================
let lastDiscoveryAt = 0;
let discoveryInFlight = false;

async function maybeRunDiscovery({ groqKeys }) {
  const now = Date.now();
  if (discoveryInFlight) return;
  if (now - lastDiscoveryAt < MODEL_DISCOVERY_TTL_MS) return;
  discoveryInFlight = true;
  lastDiscoveryAt = now;

  try {
    if (ENABLE_GROQ && groqKeys && groqKeys.length > 0) {
      const groqClient = getGroqClient(groqKeys[0]);
      if (groqClient) {
        await discoverGroqModels(groqClient).catch((e) => dlog('groq discovery failed (non-fatal):', e.message));
      }
    }
    const orClient = getOpenRouterClient();
    if (orClient) {
      await discoverOpenRouterModels(orClient).catch((e) => dlog('openrouter discovery failed (non-fatal):', e.message));
    }
  } finally {
    discoveryInFlight = false;
  }
}

// Models that must never enter the discovered pool, regardless of what a
// provider's live /models list returns — e.g. Qwen was explicitly dropped
// from the registry (see header notes), but discovery only skipped
// whisper/tts/guard by default, so a live Groq/OpenRouter listing could
// silently re-add it as a 'discovered' candidate. Matched against the raw
// model id, case-insensitive, substring match (so 'qwen', 'qwen3.6-27b',
// 'org/qwen-whatever' are all caught).
const DISCOVERY_BLOCKLIST = [/qwen/i];

function isBlockedFromDiscovery(modelId) {
  return DISCOVERY_BLOCKLIST.some((re) => re.test(modelId));
}

// Best-effort weightClass inference from the model id itself, so newly
// discovered models still get scored sensibly against HEAVY_CATEGORIES /
// LIGHT_CATEGORIES instead of sitting permanently untagged (no bonus,
// no penalty either way). Heuristic only — a real registry entry with
// explicit scores always wins if one exists; this just prevents raw
// discovered entries from being invisible to weight-class scoring.
function inferWeightClass(modelId) {
  const id = modelId.toLowerCase();
  if (/mini|nano|lite|small|8b|9b|1b|3b|instant/.test(id)) return 'light';
  if (/70b|120b|400b|ultra|large|maxi|72b|235b/.test(id)) return 'heavy';
  return undefined; // unknown — no weight-class bonus/penalty either way
}

function upsertDiscovered(provider, modelId, defaults) {
  if (isBlockedFromDiscovery(modelId)) {
    dlog(`discovery blocked ${provider} model: ${modelId} (blocklisted)`);
    return;
  }
  if (MODEL_REGISTRY[provider] && MODEL_REGISTRY[provider][modelId]) {
    MODEL_REGISTRY[provider][modelId].status = 'active';
    return;
  }
  const key = `${provider}:${modelId}`;
  if (discoveredModels.has(key)) return;
  if (discoveredModels.size >= DISCOVERED_POOL_LIMIT) return;

  const weightClass = inferWeightClass(modelId);
  discoveredModels.set(key, {
    provider, model: modelId,
    quality: 4, speed: 5, reasoning: 4, coding: 4, math: 3, casualChat: 4,
    creativeWriting: 3, multilingual: 4, hindi: 3, structuredOutput: 3,
    gameStrategy: 3, longContext: 3, toolUse: 3, reliability: 3,
    costTier: defaults.costTier || 'free-limited',
    maxOutputTokens: 1024,
    ...(weightClass ? { weightClass } : {}),
    status: 'discovered'
  });
  dlog(`discovered new ${provider} model: ${modelId} (unknown-capability pool${weightClass ? `, weightClass=${weightClass}` : ''})`);
}

async function discoverGroqModels(groqClient) {
  const list = await groqClient.models.list();
  const ids = (list?.data || []).map((m) => m.id).filter(Boolean);
  for (const id of ids) {
    if (/whisper|tts|guard/i.test(id)) continue;
    upsertDiscovered('groq', id, { costTier: 'free-limited' });
  }
}

async function discoverOpenRouterModels(orClient) {
  const list = await orClient.models.list();
  const items = list?.data || [];
  for (const item of items) {
    const id = item.id;
    if (!id) continue;
    const isFree = /:free$/i.test(id) || (item.pricing && Number(item.pricing.prompt) === 0);
    if (!isFree) continue;
    upsertDiscovered('openrouter', id, { costTier: 'free' });
  }
}

// ============================================================
// 14. MAIN GENERATOR
// ============================================================
async function generate({ classification, prompt, userMessage, systemInstruction, geminiKeys = [], groqKeys = [] }) {
  const { category, isLong, intent } = classifyRequest({ classification, prompt, userMessage });
  const temp = getDynamicTemp(intent);
  const cloudflareEnabled = !!getCloudflareConfig();
  const openRouterFreeOnly = FREE_ONLY_MODE || OPENROUTER_FREE_ONLY;
  const maxTokens = MAX_TOKENS_BY_CATEGORY[category] || 768;

  // Fire-and-forget cache refresh; never awaited beyond the cheap
  // TTL/in-flight checks above, so it never adds latency to a request.
  maybeRunDiscovery({ groqKeys }).catch(() => {});

  const candidates = buildCandidates({
    category, isLong, geminiKeys, groqKeys, openRouterFreeOnly, cloudflareEnabled
  });

  if (candidates.length === 0) {
    throw new Error('No providers configured/available for routing.');
  }

  dlog(`intent=${category} maxTokens=${maxTokens} candidates=${candidates.map(c => `${c.provider}/${c.model}(${c.score.toFixed(1)})`).join(', ')}`);

  const ctx = { prompt, systemInstruction, temp, maxTokens, geminiKeys, groqKeys, openRouterFreeOnly };
  let lastError = null;
  let lastProviderTried = null;
  // 🆕 Once we see a real PAYLOAD_TOO_LARGE from any provider, the prompt
  // itself is the problem — every remaining candidate would just 413 again
  // on the same oversized payload. Compress ctx.prompt in place ONE time
  // and keep walking the *same* candidate list with the smaller prompt,
  // instead of burning a dead round-trip on every remaining candidate and
  // only compressing after the whole list is exhausted (the old behavior,
  // visible in the logs as 5-6 back-to-back 413s before the 14s+ emergency
  // fallback). This reuses the same priority-aware compressForEmergency()
  // trimmer the emergency path already uses, so quality doesn't regress —
  // it just runs at the right time instead of the last possible moment.
  let alreadyCompressedForSize = false;

  for (const candidate of candidates) {
    if (lastProviderTried === candidate.provider) {
      const stillHasOtherProviders = candidates.some(c => c.provider !== candidate.provider);
      if (stillHasOtherProviders && isProviderLikelyDown(candidate.provider)) {
        continue;
      }
    }

    const outcome = await runCandidate(candidate, ctx);
    lastProviderTried = candidate.provider;

    if (outcome && outcome.result) {
      ilog(`intent=${category} selected=${candidate.model} provider=${candidate.provider} latency=${outcome.metadata?.latencyMs || '?'}ms`);
      return { result: outcome.result, modelUsed: outcome.modelUsed, provider: outcome.provider, metadata: outcome.metadata };
    }

    if (!alreadyCompressedForSize && outcome && outcome.failureType === FAILURE.PAYLOAD_TOO_LARGE) {
      const shrunk = compressForEmergency(ctx.prompt);
      if (shrunk && shrunk.length < ctx.prompt.length) {
        ilog(`PAYLOAD_TOO_LARGE on ${candidate.provider}/${candidate.model} — compressing prompt (${ctx.prompt.length} -> ${shrunk.length} chars) and continuing candidate list`);
        ctx.prompt = shrunk;
        alreadyCompressedForSize = true;
      }
    }
  }

  // ==========================================
  // EMERGENCY FALLBACK: smallest reliable model, compressed prompt
  // ==========================================
  ilog('primary candidates exhausted — attempting emergency fallback');
  const compressedPrompt = compressForEmergency(prompt);
  const emergencyCtx = { ...ctx, prompt: compressedPrompt, maxTokens: 384 };

  // Mirrors the strict provider fallback hierarchy: Groq -> Gemini ->
  // OpenRouter -> Cloudflare. Within Groq, the small/fast models go first
  // since the emergency path already means we're compressing the prompt
  // and want the cheapest, most-likely-to-succeed rung.
  const emergencyOrder = [
    (ENABLE_GROQ && groqKeys.length) ? { provider: 'groq', model: 'openai/gpt-oss-20b' } : null,
    (ENABLE_GROQ && groqKeys.length) ? { provider: 'groq', model: 'groq/compound-mini' } : null,
    (ENABLE_GEMINI && geminiKeys.length) ? { provider: 'gemini', model: 'gemini-3.5-flash-lite' } : null,
    getOpenRouterClient() ? { provider: 'openrouter', model: 'openrouter/free' } : null,
    getOpenRouterClient() ? { provider: 'openrouter', model: 'nvidia/nemotron-nano-9b-v2:free' } : null,
    cloudflareEnabled ? { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct' } : null
  ].filter(Boolean);

  for (const candidate of emergencyOrder) {
    const outcome = await runCandidate(candidate, emergencyCtx).catch((e) => { lastError = e; return null; });
    if (outcome && outcome.result) {
      ilog(`emergency fallback selected=${candidate.model} provider=${candidate.provider}`);
      return { result: outcome.result, modelUsed: `${outcome.modelUsed} [emergency]`, provider: outcome.provider, metadata: outcome.metadata };
    }
  }

  console.error('[ROUTER] Critical: all providers failed or are cooling down.');
  throw lastError || new Error('All model providers exhausted or cooling down.');
}

// ============================================================
// 15. OBSERVABILITY
// ============================================================
function getRouterHealth() {
  const snapshot = [];
  const now = Date.now();
  for (const [id, b] of breakers.entries()) {
    const [provider, model, credFingerprint] = id.split('::');
    const cooldownRemaining = b.state === CIRCUIT_STATE.OPEN
      ? Math.max(0, b.cooldownMs - (now - b.openedAt))
      : 0;
    snapshot.push({
      provider,
      model,
      credentialFingerprint: credFingerprint,
      state: b.disabled ? 'DISABLED' : b.state,
      failureType: b.failureType,
      cooldownRemainingMs: cooldownRemaining,
      probeInFlight: b.probeInFlight,
      successCount: b.successCount,
      failureCount: b.failureCount,
      rateLimitCount: b.rateLimitCount,
      quotaFailures: b.quotaFailures,
      requestCount: b.requestCount,
      averageLatencyMs: b.avgLatencyMs,
      lastUsed: b.lastUsed || null,
      lastSuccess: b.lastSuccess || null,
      lastFailure: b.lastFailure || null,
      disabledReason: b.disabledReason || null,
      quota: b.quota ? {
        remainingRequests: b.quota.remainingRequests,
        limitRequests: b.quota.limitRequests,
        remainingTokens: b.quota.remainingTokens,
        limitTokens: b.quota.limitTokens,
        observedAt: b.quota.observedAt
      } : null
    });
  }
  return {
    breakers: snapshot,
    discoveredModels: Array.from(discoveredModels.values()).map(m => ({ provider: m.provider, model: m.model, costTier: m.costTier, status: m.status })),
    lastDiscoveryAt: lastDiscoveryAt || null,
    rrPointers: Object.fromEntries(rrPointers.entries()),
    flags: {
      freeOnlyMode: FREE_ONLY_MODE,
      openRouterFreeOnly: OPENROUTER_FREE_ONLY,
      enableGemini: ENABLE_GEMINI,
      enableGroq: ENABLE_GROQ,
      enableOpenRouter: ENABLE_OPENROUTER,
      enableCloudflare: ENABLE_CLOUDFLARE
    },
    providersConfigured: {
      openrouter: !!getOpenRouterClient(),
      cloudflare: !!getCloudflareConfig()
    }
  };
}

module.exports = { generate, getRouterHealth, MODEL_REGISTRY };
