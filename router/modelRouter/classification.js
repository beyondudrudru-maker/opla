/**
 * router/modelRouter/classification.js
 *
 * REQUEST CLASSIFICATION -> TASK PROFILE, and per-model scoring against a
 * task category. This is the "which model fits this message best" logic.
 *
 * 🚀 FIX: Removed the -1000 penalty for paid models so they rank correctly when allowed.
 * 🚀 UPGRADE: Added temperature mappings for new persona intents (FLIRT, JEALOUSY, HOSTILE).
 */

let INTENTS;
try {
  ({ INTENTS } = require('../../classifier/intentClassifier'));
} catch (_) {
  INTENTS = {};
}

const {
  GEMINI_PRIMARY_BONUS,
  HEAVY_CATEGORIES,
  LIGHT_CATEGORIES,
  WEIGHT_CLASS_MATCH_BONUS,
  WEIGHT_CLASS_MISMATCH_PENALTY,
  providerTierBonus
} = require('./registry.js');

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

// Weight vector per category
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

// Dynamic max output tokens by category
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

  if (entry.weightClass === 'heavy') {
    if (HEAVY_CATEGORIES.has(category)) score += WEIGHT_CLASS_MATCH_BONUS;
    else if (LIGHT_CATEGORIES.has(category)) score -= WEIGHT_CLASS_MISMATCH_PENALTY;
  } else if (entry.weightClass === 'light') {
    if (LIGHT_CATEGORIES.has(category)) score += WEIGHT_CLASS_MATCH_BONUS;
    else if (HEAVY_CATEGORIES.has(category)) score -= WEIGHT_CLASS_MISMATCH_PENALTY;
  }

  score += providerTierBonus(entry.provider);

  // 🚀 FIX: Removed the `entry.costTier === 'paid'` -1000 penalty here.
  // candidateBuilder.js already guarantees paid models only reach this point if they are explicitly allowed.
  if (entry.legacy) score -= 6;
  if (entry.preview) score -= 1;
  if (entry.status === 'discovered') score -= 3;

  return score;
}

function getDynamicTemp(intent) {
  switch (intent) {
    case (INTENTS && INTENTS.MODERATION):
    case (INTENTS && INTENTS.COMMAND): return 0.1;
    case (INTENTS && INTENTS.HEAVY_TASK): return 0.3;
    // 🚀 UPGRADE: Fine-tuned temperatures for complex and emotional personas
    case (INTENTS && INTENTS.HOSTILE):
    case (INTENTS && INTENTS.TROLL): return 0.85; 
    case (INTENTS && INTENTS.FLIRT):
    case (INTENTS && INTENTS.JEALOUSY):
    case (INTENTS && INTENTS.EMOTIONAL_DISCLOSURE): return 0.9;
    default: return 0.8;
  }
}

module.exports = {
  GAME_INTENTS,
  classifyRequest,
  CATEGORY_WEIGHTS,
  MAX_TOKENS_BY_CATEGORY,
  scoreModel,
  getDynamicTemp
};
