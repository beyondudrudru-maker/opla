/**
 * router/modelRouter/candidateRunner.js
 *
 * UNIFIED MODEL RUNNER (per candidate, breaker-guarded). Tries a single
 * {provider, model} candidate, rotating through multi-key pools for Gemini/
 * Groq, and reports back a normalized { result, modelUsed, provider,
 * metadata } on success or { result: null, failureType } on failure.
 */

const { MODEL_REGISTRY, discoveredModels } = require('./registry.js');
const { getGroqClient, getOpenRouterClient, getCloudflareConfig } = require('./clients.js');
const { classifyFailure, isHardLimitError } = require('./failures.js');
const {
  breakerId,
  isBreakerOpen,
  tripBreaker,
  recordSuccess,
  releaseProbe,
  nextKeyOrder
} = require('./circuitBreaker.js');
const { execGemini, execOpenAICompatible, execCloudflare } = require('./executors.js');
const { withRetry } = require('./asyncUtils.js');
const { ENABLE_GEMINI, ENABLE_GROQ, dlog, wlog } = require('./envFlags.js');

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

module.exports = { runCandidate };
