/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Intelligent Multi-Provider Model Router — v5 (Registry + Capability Edition)
 *
 *   Providers: Gemini, Groq, OpenRouter, Cloudflare Workers AI.
 *   Instead of a fixed cascade, every request is classified, scored against
 *   a capability registry, and routed to the best currently-healthy model.
 *   Unhealthy/quota-exhausted/invalid models are cooled down per-failure-type
 *   and skipped without hammering dead providers.
 *
 * PUBLIC CONTRACT (unchanged — required by callers/gemini.js)
 *   const { result, modelUsed } = await modelRouter.generate({ ... });
 *   modelRouter.getRouterHealth()
 *
 * NOTES ON MODEL IDS (verified at time of writing, Aug 2026)
 *   - Gemini 2.0 models are fully shut down. Gemini 3.x Flash family is current:
 *     gemini-3.6-flash, gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite.
 *   - temperature/top_p/top_k are DEPRECATED starting with gemini-3.6-flash and
 *     gemini-3.5-flash-lite — the API ignores or rejects them, so they are
 *     omitted for those two models specifically.
 *   - Groq deprecated llama-3.3-70b-versatile and llama-3.1-8b-instant
 *     (shutdown Aug 16, 2026). Router uses openai/gpt-oss-120b / gpt-oss-20b /
 *     qwen/qwen3.6-27b instead, with the old Llama IDs kept ONLY as a
 *     best-effort legacy rung in case a given account still has access.
 *   - OpenRouter's free-model roster rotates frequently. Router defaults to
 *     OpenRouter's own "openrouter/free" auto-router plus an optional
 *     configured allowlist, rather than hardcoding a long list that will rot.
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');

let INTENTS;
try {
  // Optional — router works fine without the classifier module too.
  ({ INTENTS } = require('../classifier/intentClassifier'));
} catch (_) {
  INTENTS = {};
}

// ============================================================
// 0. ENV / SAFETY SWITCHES
// ============================================================
const DEBUG = String(process.env.MODEL_ROUTER_DEBUG || 'false').toLowerCase() === 'true';
const FREE_ONLY_MODE = String(process.env.FREE_ONLY_MODE || 'true').toLowerCase() !== 'false';
const OPENROUTER_FREE_ONLY = String(process.env.OPENROUTER_FREE_ONLY || 'true').toLowerCase() !== 'false';

function dlog(...args) {
  if (DEBUG) console.log('[ROUTER]', ...args);
}
function ilog(...args) {
  console.log('[ROUTER]', ...args);
}
function wlog(...args) {
  console.warn('[ROUTER]', ...args);
}

// ============================================================
// 1. MODEL CAPABILITY REGISTRY
// ============================================================
// Scores are 0-10, hand-tuned heuristics — cheap to evaluate, not an ML model.
// costTier: 'free' | 'free-limited' | 'paid'
const MODEL_REGISTRY = {
  gemini: {
    'gemini-3.6-flash': {
      provider: 'gemini', model: 'gemini-3.6-flash',
      quality: 9, speed: 7, reasoning: 9, coding: 9, casualChat: 7,
      multilingual: 8, structuredOutput: 9, gameStrategy: 9, longContext: 9,
      toolUse: 9, reliability: 8, costTier: 'free-limited',
      supportsSampling: false, // deprecated params on this model
      maxOutputTokens: 8192
    },
    'gemini-3.5-flash': {
      provider: 'gemini', model: 'gemini-3.5-flash',
      quality: 8, speed: 7, reasoning: 8, coding: 8, casualChat: 8,
      multilingual: 8, structuredOutput: 8, gameStrategy: 8, longContext: 9,
      toolUse: 8, reliability: 8, costTier: 'free-limited',
      supportsSampling: true,
      maxOutputTokens: 8192
    },
    'gemini-3.5-flash-lite': {
      provider: 'gemini', model: 'gemini-3.5-flash-lite',
      quality: 6, speed: 9, reasoning: 5, coding: 5, casualChat: 9,
      multilingual: 7, structuredOutput: 6, gameStrategy: 5, longContext: 7,
      toolUse: 5, reliability: 8, costTier: 'free-limited',
      supportsSampling: false, // deprecated params on this model
      maxOutputTokens: 4096
    },
    'gemini-3.1-flash-lite': {
      provider: 'gemini', model: 'gemini-3.1-flash-lite',
      quality: 5, speed: 9, reasoning: 4, coding: 4, casualChat: 8,
      multilingual: 6, structuredOutput: 5, gameStrategy: 4, longContext: 6,
      toolUse: 4, reliability: 7, costTier: 'free-limited',
      supportsSampling: true,
      maxOutputTokens: 4096
    }
  },

  groq: {
    'openai/gpt-oss-120b': {
      provider: 'groq', model: 'openai/gpt-oss-120b',
      quality: 9, speed: 8, reasoning: 9, coding: 9, casualChat: 6,
      multilingual: 7, structuredOutput: 8, gameStrategy: 9, longContext: 7,
      toolUse: 8, reliability: 8, costTier: 'free-limited',
      maxOutputTokens: 4096
    },
    'openai/gpt-oss-20b': {
      provider: 'groq', model: 'openai/gpt-oss-20b',
      quality: 7, speed: 9, reasoning: 7, coding: 7, casualChat: 7,
      multilingual: 6, structuredOutput: 6, gameStrategy: 6, longContext: 6,
      toolUse: 6, reliability: 8, costTier: 'free-limited',
      maxOutputTokens: 4096
    },
    'qwen/qwen3.6-27b': {
      provider: 'groq', model: 'qwen/qwen3.6-27b',
      quality: 7, speed: 8, reasoning: 7, coding: 7, casualChat: 7,
      multilingual: 9, structuredOutput: 6, gameStrategy: 6, longContext: 6,
      toolUse: 5, reliability: 6, costTier: 'free-limited', preview: true,
      maxOutputTokens: 4096
    },
    'groq/compound': {
      provider: 'groq', model: 'groq/compound',
      quality: 8, speed: 6, reasoning: 8, coding: 6, casualChat: 5,
      multilingual: 6, structuredOutput: 6, gameStrategy: 6, longContext: 6,
      toolUse: 9, reliability: 6, costTier: 'free-limited',
      maxOutputTokens: 4096
    },
    'groq/compound-mini': {
      provider: 'groq', model: 'groq/compound-mini',
      quality: 6, speed: 8, reasoning: 6, coding: 5, casualChat: 6,
      multilingual: 6, structuredOutput: 5, gameStrategy: 5, longContext: 5,
      toolUse: 8, reliability: 6, costTier: 'free-limited',
      maxOutputTokens: 4096
    },
    // Legacy rung kept ONLY as a best-effort extra option for accounts that
    // may still have residual access before the Aug 16 2026 shutdown.
    // Router will simply mark these unhealthy (404) once truly gone.
    'llama-3.3-70b-versatile': {
      provider: 'groq', model: 'llama-3.3-70b-versatile',
      quality: 7, speed: 7, reasoning: 6, coding: 6, casualChat: 7,
      multilingual: 6, structuredOutput: 6, gameStrategy: 6, longContext: 6,
      toolUse: 5, reliability: 3, costTier: 'free-limited', legacy: true,
      maxOutputTokens: 2048
    },
    'llama-3.1-8b-instant': {
      provider: 'groq', model: 'llama-3.1-8b-instant',
      quality: 5, speed: 9, reasoning: 4, coding: 4, casualChat: 6,
      multilingual: 5, structuredOutput: 4, gameStrategy: 3, longContext: 4,
      toolUse: 3, reliability: 3, costTier: 'free-limited', legacy: true,
      maxOutputTokens: 1024
    }
  },

  openrouter: {
    // OpenRouter's own auto-router — always routes within free models when
    // the request is tagged free-only. Roster is rotated by OpenRouter itself.
    'openrouter/free': {
      provider: 'openrouter', model: 'openrouter/free',
      quality: 6, speed: 6, reasoning: 6, coding: 6, casualChat: 6,
      multilingual: 6, structuredOutput: 5, gameStrategy: 5, longContext: 6,
      toolUse: 5, reliability: 5, costTier: 'free',
      maxOutputTokens: 2048
    },
    // Reasonably-stable named free anchor, kept as a secondary option.
    // Validated against costTier/allowlist rules before ever being used.
    'meta-llama/llama-3.3-70b-instruct:free': {
      provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free',
      quality: 6, speed: 5, reasoning: 6, coding: 5, casualChat: 6,
      multilingual: 6, structuredOutput: 5, gameStrategy: 5, longContext: 6,
      toolUse: 4, reliability: 4, costTier: 'free',
      maxOutputTokens: 1024
    }
  },

  cloudflare: {
    // Workers AI OpenAI-compatible free-tier text model. Only activated if
    // CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN are both configured.
    '@cf/meta/llama-3.1-8b-instruct': {
      provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct',
      quality: 5, speed: 7, reasoning: 4, coding: 4, casualChat: 6,
      multilingual: 5, structuredOutput: 4, gameStrategy: 3, longContext: 4,
      toolUse: 2, reliability: 5, costTier: 'free',
      maxOutputTokens: 1024
    }
  }
};

function allModelEntries() {
  const out = [];
  for (const provider of Object.keys(MODEL_REGISTRY)) {
    for (const model of Object.keys(MODEL_REGISTRY[provider])) {
      out.push(MODEL_REGISTRY[provider][model]);
    }
  }
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

let cloudflareInitAttempted = false;
let cloudflareConfig = null;
function getCloudflareConfig() {
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
  AUTH: 'auth',
  INVALID_MODEL: 'invalid_model',
  QUOTA_EXHAUSTED: 'quota_exhausted',
  RATE_LIMIT: 'rate_limit',
  OVERLOADED: 'overloaded',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  UNSUPPORTED_FEATURE: 'unsupported_feature',
  OUTAGE: 'outage',
  UNKNOWN: 'unknown'
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
  if (status === 404 || /model not found|not found|does not exist|unknown model/.test(msg)) {
    return FAILURE.INVALID_MODEL;
  }
  if (status === 400 && /(unsupported|not supported|capability|does not support)/.test(msg)) {
    return FAILURE.UNSUPPORTED_FEATURE;
  }
  if (status === 429 || /rate.?limit/.test(msg)) {
    // Distinguish quota exhaustion (daily/monthly) from short rate limiting where possible.
    if (/quota|daily limit|billing|exceeded your current/.test(msg)) return FAILURE.QUOTA_EXHAUSTED;
    return FAILURE.RATE_LIMIT;
  }
  if (status === 503 || /overloaded|service unavailable/.test(msg)) {
    return FAILURE.OVERLOADED;
  }
  if (status && status >= 500) {
    return FAILURE.OUTAGE;
  }
  if (/timeout|timed out|etimedout/.test(msg)) {
    return FAILURE.TIMEOUT;
  }
  if (/network|econnreset|enotfound|econnrefused|fetch failed/.test(msg)) {
    return FAILURE.NETWORK;
  }
  return FAILURE.UNKNOWN;
}

// Cooldown policy per failure type (ms). Long cooldowns disable a model for
// a while without permanently forgetting it — a later health cycle can retry.
const COOLDOWN_MS = {
  [FAILURE.AUTH]: 15 * 60 * 1000,          // 15 min — likely needs human fix
  [FAILURE.INVALID_MODEL]: 30 * 60 * 1000, // 30 min — model probably retired
  [FAILURE.QUOTA_EXHAUSTED]: 10 * 60 * 1000,
  [FAILURE.RATE_LIMIT]: 60 * 1000,          // default; Retry-After overrides
  [FAILURE.OVERLOADED]: 8 * 1000,           // short exponential, base value
  [FAILURE.TIMEOUT]: 5 * 1000,
  [FAILURE.NETWORK]: 5 * 1000,
  [FAILURE.UNSUPPORTED_FEATURE]: 60 * 60 * 1000, // essentially "don't use this way again"
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
// 4. CIRCUIT BREAKER (per provider+model+credential, concurrency-safe)
// ============================================================
const CIRCUIT_STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };
const breakers = new Map();
const BREAKER_MAP_LIMIT = 200; // bounded — avoid unbounded growth on Render free tier

function breakerId(provider, modelName, credentialFingerprint) {
  return `${provider}::${modelName}::${credentialFingerprint || 'default'}`;
}

function getBreaker(id) {
  if (!breakers.has(id)) {
    if (breakers.size >= BREAKER_MAP_LIMIT) {
      const oldestKey = breakers.keys().next().value;
      breakers.delete(oldestKey);
    }
    breakers.set(id, {
      state: CIRCUIT_STATE.CLOSED,
      openedAt: 0,
      cooldownMs: 0,
      trippedBy: null,
      failureType: null,
      probeInFlight: false,
      successCount: 0,
      failureCount: 0,
      rateLimitCount: 0,
      requestCount: 0,
      lastUsed: 0,
      lastFailure: 0,
      lastSuccess: 0,
      avgLatencyMs: 0,
      disabled: false,
      disabledReason: null
    });
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

  // Exponential backoff with jitter for transient categories on repeated failures.
  if (failureType === FAILURE.OVERLOADED || failureType === FAILURE.TIMEOUT || failureType === FAILURE.OUTAGE) {
    const streak = Math.min(b.failureCount, 5);
    cooldown = cooldown * Math.pow(2, streak) + Math.random() * 250;
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
  if (failureType === FAILURE.RATE_LIMIT || failureType === FAILURE.QUOTA_EXHAUSTED) b.rateLimitCount += 1;

  if (failureType === FAILURE.AUTH) {
    b.disabled = true;
    b.disabledReason = 'auth_failure';
    wlog(`${id} DISABLED (auth failure) — check credential.`);
  } else {
    wlog(`${id} breaker OPEN [${failureType}] cooldown=${Math.round(cooldown)}ms`);
  }
}

function recordSuccess(id, latencyMs) {
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
}

function releaseProbe(id) {
  const b = getBreaker(id);
  if (b.state === CIRCUIT_STATE.HALF_OPEN) b.probeInFlight = false;
}

function isHardLimitError(error) {
  const t = classifyFailure(error);
  return t === FAILURE.RATE_LIMIT || t === FAILURE.QUOTA_EXHAUSTED || t === FAILURE.OVERLOADED
    || t === FAILURE.INVALID_MODEL || t === FAILURE.AUTH || t === FAILURE.UNSUPPORTED_FEATURE;
}

// ============================================================
// 5. ROUND-ROBIN KEY SELECTOR (Gemini multi-key support)
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
// 6. REQUEST CLASSIFICATION -> TASK PROFILE
// ============================================================
const GAME_INTENTS = new Set(['FACT', 'STRATEGY', 'CALC', 'GOLD', 'GEM', 'game-query']);
const CODE_REGEX = /```|code|script|debug|function|python|javascript|java\b|c\+\+|sql|json|regex|api|stack ?trace|error:|exception/i;
const MATH_REGEX = /\b(calculate|equation|solve|integral|derivative|algebra|geometry|probability|matrix)\b/i;
const REASONING_REGEX = /deep analysis|quantum|architecture|complex breakdown|thesis|geopolitics|explain in detail|analyze/i;
const CREATIVE_REGEX = /\b(poem|story|essay|lyrics|write a|creative|stotram|mantra)\b/i;
const HINDI_REGEX = /[\u0900-\u097F]|\b(kya|hai|nahi|kaise|kyu|bhai|yaar|acha|theek)\b/i;
const SHORT_CASUAL_REGEX = /^(hey|hi|hello|lol|lmao|haha|hola|yo|sup|good morning|good night|gm|gn|bruh|ok|okay|hmm)\W*$/i;

function classifyRequest({ classification, prompt, userMessage }) {
  const intent = classification?.intent || 'social';
  const text = String(userMessage || prompt || '');
  const lower = text.toLowerCase();

  const isGame = GAME_INTENTS.has(intent) || /\b(stats|hp|damage|hero|troop|game|clash)\b/i.test(text) || /\[GAME DATA\]/i.test(text);
  const isCode = CODE_REGEX.test(text);
  const isMath = MATH_REGEX.test(text);
  const isReasoningHeavy = intent === (INTENTS && INTENTS.HEAVY_TASK) || REASONING_REGEX.test(text);
  const isCreative = CREATIVE_REGEX.test(text);
  const isHindi = HINDI_REGEX.test(text);
  const isShortCasual = SHORT_CASUAL_REGEX.test(text.trim()) || text.trim().length <= 6;
  const isLong = text.length > 2000;

  let category = 'casual';
  if (isGame) category = 'gameStrategy';
  else if (isCode) category = 'coding';
  else if (isMath) category = 'math';
  else if (isReasoningHeavy || isLong) category = 'reasoning';
  else if (isCreative) category = 'creative';
  else if (isShortCasual) category = 'shortFactual';
  else category = 'casual';

  return { category, isHindi, isLong, intent };
}

// Weight vector per category — which registry fields matter, and how much.
const CATEGORY_WEIGHTS = {
  casual: { casualChat: 3, speed: 2, quality: 1, multilingual: 1, reliability: 1 },
  shortFactual: { speed: 3, reliability: 2, casualChat: 1, quality: 1 },
  coding: { coding: 3, reasoning: 2, quality: 2, reliability: 1 },
  math: { reasoning: 3, coding: 1, quality: 2, reliability: 1 },
  reasoning: { reasoning: 3, longContext: 2, quality: 2, reliability: 1 },
  gameStrategy: { gameStrategy: 3, reasoning: 2, structuredOutput: 1, reliability: 1 },
  creative: { quality: 2, casualChat: 1, longContext: 1, reliability: 1, multilingual: 1 }
};

function scoreModel(entry, category, opts = {}) {
  if (!entry) return -Infinity;
  const weights = CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS.casual;
  let score = 0;
  for (const [field, weight] of Object.entries(weights)) {
    score += (entry[field] || 0) * weight;
  }
  score += entry.reliability || 0;

  if (opts.isHindi) score += (entry.multilingual || 0) * 0.5;
  if (opts.isLong) score += (entry.longContext || 0) * 0.5;

  if (entry.costTier === 'paid') score -= 1000; // never surface paid unless explicitly allowed elsewhere
  if (entry.legacy) score -= 5; // deprioritize soon-to-be-shutdown models
  if (entry.preview) score -= 1; // preview models slightly deprioritized for reliability

  return score;
}

// ============================================================
// 7. TOKEN COMPRESSION (Emergency Tier)
// ============================================================
const EMERGENCY_MEMORY_CHAR_CAP = 300;
function compressForEmergency(prompt) {
  if (!prompt) return prompt;
  let compressed = prompt;
  compressed = compressed.replace(/<LongTermMemory>[\s\S]*?<\/LongTermMemory>/i, '');
  compressed = compressed.replace(/<RecentChatHistory>([\s\S]*?)<\/RecentChatHistory>/i, (match, inner) => {
    if (inner.length <= EMERGENCY_MEMORY_CHAR_CAP) return match;
    const truncated = inner.slice(-EMERGENCY_MEMORY_CHAR_CAP);
    return `<RecentChatHistory>\n...[truncated for emergency]...\n${truncated}\n</RecentChatHistory>`;
  });
  compressed = compressed.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return compressed;
}

// ============================================================
// 8. RETRY HELPERS
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
      const noRetryTypes = [FAILURE.INVALID_MODEL, FAILURE.AUTH, FAILURE.UNSUPPORTED_FEATURE, FAILURE.QUOTA_EXHAUSTED];
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
// 9. API EXECUTORS (one per provider, normalized output)
// ============================================================
async function execGemini({ apiKey, modelName, prompt, systemInstruction, temp }) {
  const entry = MODEL_REGISTRY.gemini[modelName];
  const genAI = getGeminiClient(apiKey);

  const generationConfig = {};
  if (entry && entry.supportsSampling && typeof temp === 'number') {
    generationConfig.temperature = temp;
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
    tools: [
      { googleSearchRetrieval: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.2 } } }
    ],
    ...(Object.keys(generationConfig).length ? { generationConfig } : {})
  });

  const response = await model.generateContent(prompt);
  return response.response.text();
}

async function execOpenAICompatible(client, { modelName, prompt, systemInstruction, maxTokens, temp }) {
  const completion = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    temperature: temp,
    max_tokens: maxTokens
  });
  return completion.choices[0].message.content;
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
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// 10. UNIFIED MODEL RUNNER (per candidate, breaker-guarded)
// ============================================================
async function runCandidate(candidate, ctx) {
  const { provider, model: modelName } = candidate;
  const { prompt, systemInstruction, temp, maxTokens, geminiKeys, groqClient, hasGroq, openRouterFreeOnly } = ctx;

  if (provider === 'gemini') {
    if (!geminiKeys || geminiKeys.length === 0) return null;
    const order = nextKeyOrder(`gemini:${modelName}`, geminiKeys);
    for (const { key, index } of order) {
      const fp = String(key).slice(-6);
      const id = breakerId('gemini', modelName, fp);
      if (isBreakerOpen(id)) continue;

      const start = Date.now();
      try {
        const text = await withRetry(() => execGemini({ apiKey: key, modelName, prompt, systemInstruction, temp }));
        recordSuccess(id, Date.now() - start);
        return { result: text, modelUsed: `${modelName} (gemini, key ${index + 1})`, provider: 'gemini', metadata: { latencyMs: Date.now() - start } };
      } catch (error) {
        const type = classifyFailure(error);
        wlog(`gemini/${modelName} key=${index + 1} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
        if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
      }
    }
    return null;
  }

  if (provider === 'groq') {
    if (!hasGroq || !groqClient) return null;
    const id = breakerId('groq', modelName, 'default');
    if (isBreakerOpen(id)) return null;
    const start = Date.now();
    try {
      const text = await withRetry(() => execOpenAICompatible(groqClient, { modelName, prompt, systemInstruction, maxTokens, temp }));
      recordSuccess(id, Date.now() - start);
      return { result: text, modelUsed: `${modelName} (groq)`, provider: 'groq', metadata: { latencyMs: Date.now() - start } };
    } catch (error) {
      const type = classifyFailure(error);
      wlog(`groq/${modelName} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
      if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
      return null;
    }
  }

  if (provider === 'openrouter') {
    const client = getOpenRouterClient();
    if (!client) return null;
    const entry = MODEL_REGISTRY.openrouter[modelName];
    if (openRouterFreeOnly && entry && entry.costTier !== 'free') {
      dlog(`skipping openrouter/${modelName} — not free and OPENROUTER_FREE_ONLY is set`);
      return null;
    }
    const id = breakerId('openrouter', modelName, 'default');
    if (isBreakerOpen(id)) return null;
    const start = Date.now();
    try {
      const text = await withRetry(() => execOpenAICompatible(client, { modelName, prompt, systemInstruction, maxTokens, temp }));
      recordSuccess(id, Date.now() - start);
      return { result: text, modelUsed: `${modelName} (openrouter)`, provider: 'openrouter', metadata: { latencyMs: Date.now() - start } };
    } catch (error) {
      const type = classifyFailure(error);
      wlog(`openrouter/${modelName} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
      if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
      return null;
    }
  }

  if (provider === 'cloudflare') {
    const cfg = getCloudflareConfig();
    if (!cfg) return null;
    const id = breakerId('cloudflare', modelName, 'default');
    if (isBreakerOpen(id)) return null;
    const start = Date.now();
    try {
      const text = await withRetry(() => execCloudflare({ modelName, prompt, systemInstruction, maxTokens, temp }));
      recordSuccess(id, Date.now() - start);
      return { result: text, modelUsed: `${modelName} (cloudflare)`, provider: 'cloudflare', metadata: { latencyMs: Date.now() - start } };
    } catch (error) {
      const type = classifyFailure(error);
      wlog(`cloudflare/${modelName} -> ${type}: ${String(error.message || error).slice(0, 120)}`);
      if (isHardLimitError(error)) tripBreaker(id, error); else releaseProbe(id);
      return null;
    }
  }

  return null;
}

// ============================================================
// 11. CANDIDATE RANKING
// ============================================================
function isProviderLikelyDown(provider, credentialCount = 1) {
  // Heuristic: if every known breaker id for a provider is currently OPEN
  // (not half-open) and disabled/cooldown-heavy, treat provider as down so
  // we don't waste time cycling through all its models.
  let sawAny = false;
  let allOpen = true;
  for (const [id, b] of breakers.entries()) {
    if (!id.startsWith(`${provider}::`)) continue;
    sawAny = true;
    if (b.state !== CIRCUIT_STATE.OPEN && !b.disabled) {
      allOpen = false;
    }
  }
  return sawAny && allOpen;
}

function buildCandidates({ category, isHindi, isLong, geminiKeys, hasGroq, openRouterFreeOnly, cloudflareEnabled }) {
  const candidates = [];

  for (const entry of allModelEntries()) {
    if (entry.provider === 'gemini' && (!geminiKeys || geminiKeys.length === 0)) continue;
    if (entry.provider === 'groq' && !hasGroq) continue;
    if (entry.provider === 'openrouter' && !getOpenRouterClient()) continue;
    if (entry.provider === 'cloudflare' && !cloudflareEnabled) continue;
    if (entry.costTier === 'paid') continue; // FREE_ONLY_MODE / no-paid-accidents guard
    if (isLong && (entry.longContext || 0) < 5) continue; // drop models too weak for long context

    const score = scoreModel(entry, category, { isHindi, isLong });
    candidates.push({ ...entry, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ============================================================
// 12. MAIN GENERATOR
// ============================================================
async function generate({ classification, prompt, userMessage, systemInstruction, geminiKeys = [], groqClient, hasGroq }) {
  const { category, isHindi, isLong, intent } = classifyRequest({ classification, prompt, userMessage });
  const temp = getDynamicTemp(intent);
  const cloudflareEnabled = !!getCloudflareConfig();
  const openRouterFreeOnly = FREE_ONLY_MODE || OPENROUTER_FREE_ONLY;

  let candidates = buildCandidates({
    category, isHindi, isLong, geminiKeys, hasGroq, openRouterFreeOnly, cloudflareEnabled
  });

  if (candidates.length === 0) {
    throw new Error('No providers configured/available for routing.');
  }

  dlog(`intent=${category} candidates=${candidates.map(c => `${c.provider}/${c.model}`).join(', ')}`);

  const ctx = { prompt, systemInstruction, temp, maxTokens: 1024, geminiKeys, groqClient, hasGroq, openRouterFreeOnly };
  let lastError = null;
  let lastProviderTried = null;

  for (const candidate of candidates) {
    // Skip cycling through more models of a provider that looks fully down —
    // move to the next distinct provider instead, unless it's the only one left.
    if (lastProviderTried === candidate.provider) {
      const stillHasOtherProviders = candidates.some(c => c.provider !== candidate.provider);
      if (stillHasOtherProviders && isProviderLikelyDown(candidate.provider)) {
        continue;
      }
    }

    const outcome = await runCandidate(candidate, ctx);
    lastProviderTried = candidate.provider;

    if (outcome && outcome.result) {
      ilog(`selected=${candidate.model} provider=${candidate.provider} intent=${category} latency=${outcome.metadata?.latencyMs || '?'}ms`);
      return { result: outcome.result, modelUsed: outcome.modelUsed, provider: outcome.provider, metadata: outcome.metadata };
    }
  }

  // ==========================================
  // EMERGENCY FALLBACK: smallest reliable model, compressed prompt
  // ==========================================
  ilog('primary candidates exhausted — attempting emergency fallback');
  const compressedPrompt = compressForEmergency(prompt);
  const emergencyCtx = { ...ctx, prompt: compressedPrompt, maxTokens: 400 };

  const emergencyOrder = [
    hasGroq ? { provider: 'groq', model: 'openai/gpt-oss-20b' } : null,
    hasGroq ? { provider: 'groq', model: 'llama-3.1-8b-instant' } : null,
    getOpenRouterClient() ? { provider: 'openrouter', model: 'openrouter/free' } : null,
    getOpenRouterClient() ? { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' } : null,
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
// 13. OBSERVABILITY
// ============================================================
function getRouterHealth() {
  const snapshot = [];
  const now = Date.now();
  for (const [id, b] of breakers.entries()) {
    const cooldownRemaining = b.state === CIRCUIT_STATE.OPEN
      ? Math.max(0, b.cooldownMs - (now - b.openedAt))
      : 0;
    snapshot.push({
      id,
      state: b.disabled ? 'DISABLED' : b.state,
      failureType: b.failureType,
      trippedBy: b.trippedBy,
      cooldownRemainingMs: cooldownRemaining,
      probeInFlight: b.probeInFlight,
      successCount: b.successCount,
      failureCount: b.failureCount,
      rateLimitCount: b.rateLimitCount,
      requestCount: b.requestCount,
      avgLatencyMs: b.avgLatencyMs,
      lastSuccess: b.lastSuccess || null,
      lastFailure: b.lastFailure || null,
      disabledReason: b.disabledReason || null
    });
  }
  return {
    breakers: snapshot,
    rrPointers: Object.fromEntries(rrPointers.entries()),
    providersEnabled: {
      gemini: null, // depends on geminiKeys passed per-request; not known statically
      groq: null,   // depends on hasGroq passed per-request
      openrouter: !!getOpenRouterClient(),
      cloudflare: !!getCloudflareConfig()
    },
    freeOnlyMode: FREE_ONLY_MODE,
    openRouterFreeOnly: OPENROUTER_FREE_ONLY
  };
}

module.exports = { generate, getRouterHealth, MODEL_REGISTRY };
