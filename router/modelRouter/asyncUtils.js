/**
 * router/modelRouter/asyncUtils.js
 *
 * RETRY HELPERS + timeout error factory, shared by executors.js
 * (Promise.race timeouts) and candidateRunner.js (withRetry wrapping).
 */

const { FAILURE, classifyFailure } = require('./failures.js');
const { DEBUG, dlog } = require('./envFlags.js');

function timeoutError(label, ms) {
  const err = new Error(`${label} request timed out after ${ms}ms`);
  err.status = 408;
  return err;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function backoffDelay(attempt) {
  const base = 500 * Math.pow(2, attempt);
  const jitter = Math.random() * 250;
  return base + jitter;
}

async function withRetry(fn, { retries = 1 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      const type = classifyFailure(error);
      // TIMEOUT is deliberately excluded from retry — a candidate that just
      // took 25s to time out should never be retried once MORE on the exact
      // same slow model before the router moves on (doubling the worst-case
      // wait instead of failing fast to the next candidate).
      const noRetryTypes = [FAILURE.INVALID_MODEL, FAILURE.AUTH, FAILURE.UNSUPPORTED_FEATURE, FAILURE.QUOTA_EXHAUSTED, FAILURE.PAYLOAD_TOO_LARGE, FAILURE.TIMEOUT];
      if (noRetryTypes.includes(type) || attempt >= retries) throw error;
      const delay = backoffDelay(attempt);
      dlog(`transient error [${type}], retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
      attempt++;
    }
  }
}

module.exports = { timeoutError, sleep, backoffDelay, withRetry };
