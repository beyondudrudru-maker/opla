/**
 * router/modelRouter/registry.js
 *
 * MODEL CAPABILITY REGISTRY (scores 0-10 — routing heuristics, not
 * objective benchmark claims) plus the weight-class and provider-tier
 * constants used to score candidates in classification.js.
 *
 * 🚀 UPGRADE (2026): 
 *   - Synced Gemini with latest endpoints: gemini-3.8-flash and gemini-3.5-flash-lite.
 *   - Synced Groq with official active endpoints: openai/gpt-oss-120b and openai/gpt-oss-20b.
 *   🚫 STRICT RULE: Qwen models are absolutely excluded from this registry.
 */

// costTier: 'free' | 'free-limited' | 'paid'
// status: 'active' | 'discovered' | 'disabled'
const MODEL_REGISTRY = {
  gemini: {
    // 🚀 UPGRADE: Latest Gemini 3.8 Flash for Heavy/Quality tasks
    'gemini-3.8-flash': {
      provider: 'gemini', model: 'gemini-3.8-flash',
      quality: 9, speed: 7, reasoning: 9, coding: 9, math: 8, casualChat: 7,
      creativeWriting: 8, multilingual: 8, hindi: 7, structuredOutput: 9,
      gameStrategy: 9, longContext: 9, toolUse: 9, reliability: 8,
      costTier: 'free-limited', weightClass: 'heavy', supportsSampling: true, maxOutputTokens: 8192,
      status: 'active'
    },
    // 🚀 UPGRADE: Latest Gemini 3.5 Flash-Lite for Light/Speed tasks
    'gemini-3.5-flash-lite': {
      provider: 'gemini', model: 'gemini-3.5-flash-lite',
      quality: 6, speed: 9, reasoning: 5, coding: 5, math: 4, casualChat: 9,
      creativeWriting: 6, multilingual: 7, hindi: 6, structuredOutput: 6,
      gameStrategy: 5, longContext: 7, toolUse: 5, reliability: 8,
      costTier: 'free-limited', weightClass: 'light', supportsSampling: false, maxOutputTokens: 4096,
      status: 'active'
    }
  },

  groq: {
    // Primary HEAVYWEIGHT target on Groq
    'openai/gpt-oss-120b': {
      provider: 'groq', model: 'openai/gpt-oss-120b',
      quality: 9, speed: 8, reasoning: 9, coding: 9, math: 8, casualChat: 6,
      creativeWriting: 5, multilingual: 7, hindi: 5, structuredOutput: 8,
      gameStrategy: 9, longContext: 7, toolUse: 8, reliability: 8,
      costTier: 'free-limited', weightClass: 'heavy', maxOutputTokens: 4096, status: 'active'
    },
    // Primary LIGHTWEIGHT target on Groq
    'openai/gpt-oss-20b': {
      provider: 'groq', model: 'openai/gpt-oss-20b',
      quality: 7, speed: 9, reasoning: 7, coding: 7, math: 6, casualChat: 7,
      creativeWriting: 5, multilingual: 6, hindi: 4, structuredOutput: 6,
      gameStrategy: 6, longContext: 6, toolUse: 6, reliability: 8,
      costTier: 'free-limited', weightClass: 'light', maxOutputTokens: 4096, status: 'active'
    },
    'groq/compound': {
      provider: 'groq', model: 'groq/compound',
      quality: 8, speed: 6, reasoning: 8, coding: 6, math: 6, casualChat: 5,
      creativeWriting: 4, multilingual: 6, hindi: 4, structuredOutput: 6,
      gameStrategy: 6, longContext: 6, toolUse: 9, reliability: 6,
      costTier: 'free-limited', maxOutputTokens: 4096, status: 'active'
    },
    'groq/compound-mini': {
      provider: 'groq', model: 'groq/compound-mini',
      quality: 6, speed: 8, reasoning: 6, coding: 5, math: 5, casualChat: 6,
      creativeWriting: 4, multilingual: 6, hindi: 4, structuredOutput: 5,
      gameStrategy: 5, longContext: 5, toolUse: 8, reliability: 6,
      costTier: 'free-limited', weightClass: 'light', maxOutputTokens: 4096, status: 'active'
    }
  },

  openrouter: {
    'nvidia/nemotron-3-ultra-550b-a55b:free': {
      provider: 'openrouter', model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      quality: 8, speed: 5, reasoning: 8, coding: 7, math: 6, casualChat: 5,
      creativeWriting: 5, multilingual: 6, hindi: 4, structuredOutput: 7,
      gameStrategy: 7, longContext: 8, toolUse: 6, reliability: 5,
      costTier: 'free', weightClass: 'heavy', maxOutputTokens: 4096, status: 'active'
    },
    // 🚀 FIX: Replaced dead OpenRouter 20b model with a working free alternative
    'google/gemma-2-9b-it:free': {
      provider: 'openrouter', model: 'google/gemma-2-9b-it:free',
      quality: 6, speed: 6, reasoning: 6, coding: 6, math: 5, casualChat: 5,
      creativeWriting: 4, multilingual: 5, hindi: 3, structuredOutput: 5,
      gameStrategy: 5, longContext: 5, toolUse: 5, reliability: 5,
      costTier: 'free', weightClass: 'light', maxOutputTokens: 2048, status: 'active'
    },
    'nvidia/nemotron-nano-9b-v2:free': {
      provider: 'openrouter', model: 'nvidia/nemotron-nano-9b-v2:free',
      quality: 5, speed: 8, reasoning: 4, coding: 4, math: 3, casualChat: 6,
      creativeWriting: 4, multilingual: 5, hindi: 3, structuredOutput: 4,
      gameStrategy: 4, longContext: 5, toolUse: 4, reliability: 5,
      costTier: 'free', weightClass: 'light', maxOutputTokens: 2048, status: 'active'
    },
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

const DISCOVERED_POOL_LIMIT = 20;
const discoveredModels = new Map(); 

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

const GEMINI_PRIMARY_BONUS = {
  casual: 6,
  shortFactual: 3,
  creative: 6,
  hinglish: 5,
  reasoning: 2,
  gameStrategy: 2,
  coding: 0,   
  math: 0      
};

const HEAVY_CATEGORIES = new Set(['gameStrategy', 'reasoning', 'coding']);
const LIGHT_CATEGORIES = new Set(['casual', 'shortFactual', 'hinglish']);

const WEIGHT_CLASS_MATCH_BONUS = 14;   
const WEIGHT_CLASS_MISMATCH_PENALTY = 5; 

const PROVIDER_TIER_RANK = { groq: 0, gemini: 1, openrouter: 2, cloudflare: 3 };
const PROVIDER_TIER_BONUS = 100; 

function providerTierBonus(provider) {
  const rank = PROVIDER_TIER_RANK[provider];
  if (rank === undefined) return 0;
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
