/**
 * router/modelRouter/candidateBuilder.js
 *
 * CANDIDATE RANKING — turns the static+discovered registry into a sorted,
 * availability-filtered candidate list for a single request.
 *
 * 🚀 FIX: `openRouterFreeOnly` flag is now actively used to allow/block paid OpenRouter models.
 */

const { allRegistryEntries } = require('./registry.js');
const { scoreModel } = require('./classification.js');
const { getOpenRouterClient, getCloudflareConfig } = require('./clients.js');
const { breakerId, quotaRiskPenalty } = require('./circuitBreaker.js');
const { ENABLE_GEMINI, ENABLE_GROQ, ENABLE_OPENROUTER, ENABLE_CLOUDFLARE } = require('./envFlags.js');

function buildCandidates({ category, isLong, geminiKeys, groqKeys, openRouterFreeOnly, cloudflareEnabled }) {
  const candidates = [];

  for (const entry of allRegistryEntries()) {
    // 1. Provider availability checks
    if (entry.provider === 'gemini' && (!ENABLE_GEMINI || !geminiKeys || geminiKeys.length === 0)) continue;
    if (entry.provider === 'groq' && (!ENABLE_GROQ || !groqKeys || groqKeys.length === 0)) continue;
    if (entry.provider === 'openrouter' && (!ENABLE_OPENROUTER || !getOpenRouterClient())) continue;
    if (entry.provider === 'cloudflare' && (!ENABLE_CLOUDFLARE || !cloudflareEnabled)) continue;
    
    // 2. Context length check
    if (isLong && (entry.longContext || 0) < 5) continue;

    // 🚀 3. FIX: Cost Tier Enforcement using openRouterFreeOnly flag
    if (entry.costTier === 'paid') {
      // Only allow paid models if they are OpenRouter AND we are NOT strictly in free-only mode
      const isAllowedPaidOpenRouter = (entry.provider === 'openrouter' && !openRouterFreeOnly);
      if (!isAllowedPaidOpenRouter) {
        continue; // Block all other paid models
      }
    }

    // 4. Baseline Scoring
    const score = scoreModel(entry, category, { isLong });
    if (score === -Infinity) continue;

    // 5. Quota Risk Adjustments (Single-credential providers only)
    let riskAdjusted = score;
    if (entry.provider === 'openrouter' || entry.provider === 'cloudflare') {
      const cred = entry.provider === 'openrouter'
        ? process.env.OPENROUTER_API_KEY
        : (getCloudflareConfig() || {}).apiToken;
      
      riskAdjusted -= quotaRiskPenalty(breakerId(entry.provider, entry.model, cred));
    }

    candidates.push({ ...entry, score: riskAdjusted });
  }

  // Sort highest score first
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

module.exports = { buildCandidates };
