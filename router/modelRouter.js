/**
 * router/modelRouter.js
 *
 * Intelligent Multi-Provider Model Router — v7 (Groq-Primary, Intent-Weighted Edition)
 *
 * PUBLIC CONTRACT (unchanged — required by gemini.js)
 *   const { result, modelUsed } = await modelRouter.generate({
 *     classification, prompt, userMessage, systemInstruction,
 *     geminiKeys, groqKeys
 *   });
 *   modelRouter.getRouterHealth()
 *   modelRouter.MODEL_REGISTRY
 *
 * 🚀 UPGRADE: Verified 2026 Gemini Endpoints (3.5-flash-lite) for emergency routing.
 * 🚀 UPGRADE: Extreme Cutoff added for repeated PAYLOAD_TOO_LARGE failures.
 * 🛡️ FIX: Added .catch() block to the main candidate loop to prevent pipeline crashes.
 */

'use strict';

const { MODEL_REGISTRY, discoveredModels } = require('./modelRouter/registry.js');
const { classifyRequest, getDynamicTemp, MAX_TOKENS_BY_CATEGORY } = require('./modelRouter/classification.js');
const { compressForEmergency } = require('./modelRouter/promptCompression.js');
const { buildCandidates } = require('./modelRouter/candidateBuilder.js');
const { runCandidate } = require('./modelRouter/candidateRunner.js');
const { maybeRunDiscovery, getLastDiscoveryAt } = require('./modelRouter/discovery.js');
const { getOpenRouterClient, getCloudflareConfig } = require('./modelRouter/clients.js');
const { breakers, CIRCUIT_STATE, rrPointers, isProviderLikelyDown } = require('./modelRouter/circuitBreaker.js');
const { FAILURE } = require('./modelRouter/failures.js');
const {
  DEBUG, FREE_ONLY_MODE, OPENROUTER_FREE_ONLY,
  ENABLE_GEMINI, ENABLE_GROQ, ENABLE_OPENROUTER, ENABLE_CLOUDFLARE,
  dlog, ilog
} = require('./modelRouter/envFlags.js');

// ============================================================
// MAIN GENERATOR
// ============================================================
async function generate({ classification, prompt, userMessage, systemInstruction, geminiKeys = [], groqKeys = [] }) {
  const { category, isLong, intent } = classifyRequest({ classification, prompt, userMessage });
  const temp = getDynamicTemp(intent);
  const cloudflareEnabled = !!getCloudflareConfig();
  const openRouterFreeOnly = FREE_ONLY_MODE || OPENROUTER_FREE_ONLY;
  const maxTokens = MAX_TOKENS_BY_CATEGORY[category] || 768;

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
  let alreadyCompressedForSize = false;

  for (const candidate of candidates) {
    if (lastProviderTried === candidate.provider) {
      const stillHasOtherProviders = candidates.some(c => c.provider !== candidate.provider);
      if (stillHasOtherProviders && isProviderLikelyDown(candidate.provider)) {
        continue;
      }
    }

    const outcome = await runCandidate(candidate, ctx).catch((e) => {
      console.error(`[ROUTER] Unhandled exception in runCandidate for ${candidate.provider}/${candidate.model}:`, e);
      lastError = e;
      return null;
    });

    lastProviderTried = candidate.provider;

    if (outcome && outcome.result) {
      ilog(`intent=${category} selected=${candidate.model} provider=${candidate.provider} latency=${outcome.metadata?.latencyMs || '?'}ms`);
      return { result: outcome.result, modelUsed: outcome.modelUsed, provider: outcome.provider, metadata: outcome.metadata };
    }

    if (outcome && outcome.failureType === FAILURE.PAYLOAD_TOO_LARGE) {
      let shrunk = compressForEmergency(ctx.prompt);
      
      if (alreadyCompressedForSize) {
        // Extreme truncation if standard compression still yields a 413
        shrunk = shrunk.substring(shrunk.length - 6000);
      }

      if (shrunk && shrunk.length < ctx.prompt.length) {
        ilog(`PAYLOAD_TOO_LARGE on ${candidate.provider}/${candidate.model} — compressing prompt (${ctx.prompt.length} -> ${shrunk.length} chars)`);
        ctx.prompt = shrunk;
        alreadyCompressedForSize = true;
      }
    }
  }

  // ==========================================
  // EMERGENCY FALLBACK: smallest reliable model, compressed prompt
  // ==========================================
  ilog('primary candidates exhausted — attempting emergency fallback');
  let compressedPrompt = compressForEmergency(prompt);
  
  if (compressedPrompt.length > 8000) {
      compressedPrompt = compressedPrompt.substring(compressedPrompt.length - 8000);
  }
  
  const emergencyCtx = { ...ctx, prompt: compressedPrompt, maxTokens: 384 };

  // Strict fallback hierarchy. Qwen is completely excluded.
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
// OBSERVABILITY
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
    lastDiscoveryAt: getLastDiscoveryAt() || null,
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
