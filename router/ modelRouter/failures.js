/**
 * router/modelRouter/failures.js
 *
 * FAILURE CLASSIFICATION + QUOTA HEADER TRACKING (best-effort, never
 * fabricated). Shared by the circuit breaker and every provider executor.
 */

const FAILURE = {
  AUTH: 'AUTH',
  INVALID_MODEL: 'INVALID_MODEL',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  RATE_LIMIT: 'RATE_LIMIT',
  OVERLOADED: 'OVERLOADED',
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
  UNSUPPORTED_FEATURE: 'UNSUPPORTED_FEATURE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  OUTAGE: 'OUTAGE',
  UNKNOWN: 'UNKNOWN'
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
  if (status === 404 || /model not found|not found|does not exist|unknown model|decommissioned/.test(msg)) {
    return FAILURE.INVALID_MODEL;
  }
  if (status === 400 && /(unsupported|not supported|capability|does not support)/.test(msg)) {
    return FAILURE.UNSUPPORTED_FEATURE;
  }
  if (status === 413 || /request entity too large|payload too large|request too large/.test(msg)) {
    return FAILURE.PAYLOAD_TOO_LARGE;
  }
  if (status === 429 || /rate.?limit/.test(msg)) {
    if (/quota|daily limit|billing|exceeded your current/.test(msg)) return FAILURE.QUOTA_EXHAUSTED;
    return FAILURE.RATE_LIMIT;
  }
  if (status === 503 || /overloaded|service unavailable/.test(msg)) {
    return FAILURE.OVERLOADED;
  }
  if (status && status >= 500) return FAILURE.OUTAGE;
  // Catches both our own explicit timeoutError() (Gemini path) and the
  // OpenAI SDK's APIUserAbortError thrown when AbortController fires
  // (Groq/OpenRouter path) — neither says "timeout" verbatim.
  if (/timeout|timed out|etimedout|abort/i.test(msg) || error?.name === 'APIUserAbortError' || error?.name === 'AbortError') return FAILURE.TIMEOUT;
  if (/network|econnreset|enotfound|econnrefused|fetch failed/.test(msg)) return FAILURE.NETWORK;
  return FAILURE.UNKNOWN;
}

const COOLDOWN_MS = {
  [FAILURE.AUTH]: 30 * 60 * 1000,           // long disable until config fixed
  [FAILURE.INVALID_MODEL]: 45 * 60 * 1000,  // long — model likely retired; eligible for later re-probe
  [FAILURE.QUOTA_EXHAUSTED]: 15 * 60 * 1000, // overridden by estimated reset time if known
  [FAILURE.RATE_LIMIT]: 60 * 1000,           // default; Retry-After overrides
  [FAILURE.OVERLOADED]: 8 * 1000,            // short exponential base
  [FAILURE.TIMEOUT]: 5 * 1000,
  [FAILURE.NETWORK]: 5 * 1000,
  [FAILURE.UNSUPPORTED_FEATURE]: 60 * 60 * 1000,
  [FAILURE.PAYLOAD_TOO_LARGE]: 3 * 60 * 1000,  // same prompt will fail again; not quota-scarce, just needs the emergency-compressed path
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

// Parses "reset" header values that Groq/OpenAI-style APIs send, typically
// like "1s", "6m30s", or a raw seconds count. Returns ms or null.
function parseResetToMs(raw) {
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw) * 1000;
  const m = String(raw).match(/(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (!m) return null;
  const minutes = Number(m[1] || 0);
  const seconds = Number(m[2] || 0);
  const total = minutes * 60 + seconds;
  return total > 0 ? total * 1000 : null;
}

function parseQuotaHeaders(headers) {
  if (!headers) return null;
  const get = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k]);
  const remainingRequests = get('x-ratelimit-remaining-requests');
  const limitRequests = get('x-ratelimit-limit-requests');
  const remainingTokens = get('x-ratelimit-remaining-tokens');
  const limitTokens = get('x-ratelimit-limit-tokens');
  const resetRequests = get('x-ratelimit-reset-requests');
  const resetTokens = get('x-ratelimit-reset-tokens');

  if (!remainingRequests && !remainingTokens) return null;

  return {
    remainingRequests: remainingRequests != null ? Number(remainingRequests) : null,
    limitRequests: limitRequests != null ? Number(limitRequests) : null,
    remainingTokens: remainingTokens != null ? Number(remainingTokens) : null,
    limitTokens: limitTokens != null ? Number(limitTokens) : null,
    resetRequests: resetRequests || null,
    resetTokens: resetTokens || null,
    observedAt: Date.now()
  };
}

function isHardLimitError(error) {
  const t = classifyFailure(error);
  return t === FAILURE.RATE_LIMIT || t === FAILURE.QUOTA_EXHAUSTED || t === FAILURE.OVERLOADED
    || t === FAILURE.INVALID_MODEL || t === FAILURE.AUTH || t === FAILURE.UNSUPPORTED_FEATURE
    || t === FAILURE.PAYLOAD_TOO_LARGE;
}

module.exports = {
  FAILURE,
  extractStatus,
  classifyFailure,
  COOLDOWN_MS,
  extractRetryAfterMs,
  parseResetToMs,
  parseQuotaHeaders,
  isHardLimitError
};
