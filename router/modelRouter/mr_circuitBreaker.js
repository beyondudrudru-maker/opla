/**
 * router/modelRouter/circuitBreaker.js
 *
 * CIRCUIT BREAKER (per provider+model+credential, concurrency-safe) +
 * ROUND-ROBIN KEY SELECTOR (Gemini/Groq multi-key support).
 *
 * `breakers` is a module-level singleton Map. Every other file that needs
 * breaker state (candidateRunner.js, candidateBuilder.js, the main
 * generate()/getRouterHealth() in ../modelRouter.js) MUST require this
 * exact file — Node's require cache guarantees they all get the same Map
 * instance, so breaker state stays consistent across the whole router
 * regardless of how many files touch it.
 */

const { FAILURE, classifyFailure, extractRetryAfterMs, parseResetToMs, COOLDOWN_MS } = require('./failures.js');
const { ilog, wlog } = require('./envFlags.js');

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

// ------------------------------------------------------------
// ROUND-ROBIN KEY SELECTOR (Gemini/Groq multi-key support)
// ------------------------------------------------------------
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

module.exports = {
  CIRCUIT_STATE,
  breakers,
  BREAKER_MAP_LIMIT,
  fingerprint,
  breakerId,
  newBreakerState,
  getBreaker,
  isBreakerOpen,
  tripBreaker,
  recordSuccess,
  releaseProbe,
  quotaRiskPenalty,
  isProviderLikelyDown,
  rrPointers,
  nextKeyOrder
};
