/**
 * router/modelRouter/discovery.js
 *
 * OPTIONAL MODEL DISCOVERY (cached, never on hot path). Periodically checks
 * Groq's and OpenRouter's live /models catalogs and folds any new free
 * model into the DISCOVERED pool (registry.js) at conservative default
 * scores — never auto-promoted to primary routing, and hard-blocklisted
 * families (see DISCOVERY_BLOCKLIST) can never re-enter this way even if a
 * live catalog lists them.
 */

const { MODEL_REGISTRY, DISCOVERED_POOL_LIMIT, discoveredModels } = require('./registry.js');
const { getGroqClient, getOpenRouterClient } = require('./clients.js');
const { ENABLE_GROQ, MODEL_DISCOVERY_TTL_MS, dlog } = require('./envFlags.js');

let lastDiscoveryAt = 0;
let discoveryInFlight = false;

// Models that must never enter the discovered pool, regardless of what a
// provider's live /models list returns — e.g. Qwen was explicitly dropped
// from the registry (see registry.js header notes), but discovery only
// skipped whisper/tts/guard by default, so a live Groq/OpenRouter listing
// could silently re-add it as a 'discovered' candidate. Matched against the
// raw model id, case-insensitive, substring match (so 'qwen',
// 'qwen3.6-27b', 'org/qwen-whatever' are all caught).
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

module.exports = {
  maybeRunDiscovery,
  DISCOVERY_BLOCKLIST,
  isBlockedFromDiscovery,
  inferWeightClass,
  upsertDiscovered,
  discoverGroqModels,
  discoverOpenRouterModels,
  getLastDiscoveryAt: () => lastDiscoveryAt
};
