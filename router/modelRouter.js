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
 * 🆕 REFACTOR — Split into router/modelRouter/*.js modules for
 * maintainability. This file is now a thin orchestrator (generate() +
 * getRouterHealth() + the emergency-fallback tier). See router/modelRouter/
 * for everything else:
 *   - envFlags.js          env switches + loggers
 *   - registry.js          MODEL_REGISTRY, weight-class & provider-tier constants
 *   - clients.js           SDK/HTTP client caches (Gemini, Groq, OpenRouter, Cloudflare)
 *   - failures.js          failure classification, cooldowns, quota header parsing
 *   - circuitBreaker.js    breaker state machine + key round-robin (rrPointers)
 *   - classification.js    request -> task-category classification & model scoring
 *   - asyncUtils.js        sleep/backoff/withRetry/timeoutError
 *   - promptCompression.js emergency prompt compression (🆕 see bug-fix note below)
 *   - executors.js         per-provider API call wrappers (with timeouts)
 *   - candidateRunner.js   runCandidate() — breaker-guarded per-candidate execution
 *   - candidateBuilder.js  buildCandidates() — score + sort + availability filter
 *   - discovery.js         optional periodic model discovery from live catalogs
 *
 * 🆕 BUG FIX FOUND DURING THIS SPLIT
 *   `EMERGENCY_MEMORY_CHAR_CAP` was referenced inside compressForEmergency()'s
 *   `<RecentChatHistory>` branch but was never declared anywhere in the
 *   original file (confirmed via full-file grep). Any emergency-compression
 *   pass that actually hit an oversized `<RecentChatHistory>` block would
 *   throw a ReferenceError and silently kill the emergency-fallback request.
 *   Now declared in router/modelRouter/promptCompression.js.
 *
 * DESIGN NOTES (retained from the pre-split monolith)
 *   - Provider order is a HARD priority tier (PROVIDER_TIER_BONUS = 100 per
 *     rung): Groq -> Gemini -> OpenRouter -> Cloudflare, dominates weight-
 *     class/capability deltas so ordering across providers never flips.
 *   - Gemini keeps its existing soft per-category bonus (GEMINI_PRIMARY_BONUS)
 *     for conversational/creative/hinglish quality.
 *   - temperature/top_p/top_k are omitted for Gemini models whose metadata
 *     says supportsSampling:false.
 *   - Unhealthy/quota-exhausted/invalid models are cooled down per-failure-
 *     type and skipped without hammering dead providers. Optional periodic
 *     model discovery keeps the registry honest without ever calling out to
 *     a provider on every Discord message, and hard-blocklists explicitly
 *     banned model families (currently: Qwen).
 */

'use strict';

const { MODEL_REGISTRY, discoveredModels } = require('./modelRouter/registry.js');
const { classifyRequest, getDynamicTemp, MAX_TOKENS_BY_CATEGORY } = require('./modelRouter/classification.js');
const { compressForEmergency } = require('./modelRouter/promptCompression.js');
const { buildCandidates } = require('./modelRouter/candidateBuilder.js');
const { runCandidate } = require('./modelRouter/candidateRunner.js');
const { maybeRunDiscovery, getLastDiscoveryAt } = require('./modelRouter/discovery.js');
const { getOpenRouterClient, getCloudflareConfig } = require('./modelRouter/clients.js');
const { breakers, CIRCUIT_STATE, rrPointers } = require('./modelRouter/circuitBreaker.js');
const { FAILURE } = require('./modelRouter/failures.js');
const {
  DEBUG, FREE_ONLY_MODE, OPENROUTER_FREE_ONLY,
  ENABLE_GEMINI, ENABLE_GROQ, ENABLE_OPENROUTER, ENABLE_CLOUDFLARE,
  dlog, ilog
} = require('./modelRouter/envFlags.js');
const { isProviderLikelyDown } = require('./modelRouter/circuitBreaker.js');

// ============================================================
// MAIN GENERATOR
// ============================================================
async function generate({ classification, prompt, userMessage, systemInstruction, geminiKeys = [], groqKeys = [] }) {
  const { category, isLong, intent } = classifyRequest({ classification, prompt, userMessage });
  const temp = getDynamicTemp(intent);
  const cloudflareEnabled = !!getCloudflareConfig();
  const openRouterFreeOnly = FREE_ONLY_MODE || OPENROUTER_FREE_ONLY;
  const maxTokens = MAX_TOKENS_BY_CATEGORY[category] || 768;

  // Fire-and-forget cache refresh; never awaited beyond the cheap
  // TTL/in-flight checks inside maybeRunDiscovery, so it never adds latency
  // to a request.
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
  // Once we see a real PAYLOAD_TOO_LARGE from any provider, the prompt
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
