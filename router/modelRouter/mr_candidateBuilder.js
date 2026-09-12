/**
 * router/modelRouter/candidateBuilder.js
 *
 * CANDIDATE RANKING — turns the static+discovered registry into a sorted,
 * availability-filtered candidate list for a single request.
 */

const { allRegistryEntries } = require('./registry.js');
const { scoreModel } = require('./classification.js');
const { getOpenRouterClient, getCloudflareConfig } = require('./clients.js');
const { breakerId, quotaRiskPenalty } = require('./circuitBreaker.js');
const { ENABLE_GEMINI, ENABLE_GROQ, ENABLE_OPENROUTER, ENABLE_CLOUDFLARE } = require('./envFlags.js');

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

module.exports = { buildCandidates };
