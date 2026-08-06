/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   True Smart Cascading Hybrid Router — v3 (Concurrency Safe Edition)
 *   - Groq (Llama-3.3-70B): Primary for Code, Math, and Data.
 *   - Gemini 3.6-Flash (3rd Gen): Strictly for Heavy/Complex tasks & Fallback.
 *   - Gemini 3.5-Flash-Lite (3rd Gen): Primary for fast, everyday chat.
 *
 * WHAT'S NEW IN v3
 *   1. HALF_OPEN Probe Lock: Prevents race conditions during recovery. Only
 *      one concurrent request is allowed to test a cooling-down API.
 *   2. Cleaned up documentation around Tier 2 fallback logic.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { INTENTS } = require('../classifier/intentClassifier');

// ============================================================
// 1. CLIENT CACHE
// ============================================================
const genAiClientCache = new Map();

function getGeminiClient(apiKey) {
  if (!genAiClientCache.has(apiKey)) {
    genAiClientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return genAiClientCache.get(apiKey);
}

// ============================================================
// 2. CIRCUIT BREAKER (Concurrency Safe)
// ============================================================
const CIRCUIT_STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };
const BREAKER_COOLDOWN_MS = 60 * 1000; 

const GROQ_CLIENT_ID = 'groq-single-client';
const breakers = new Map(); 

function breakerId(apiKeyOrClientId, modelName) {
  const fingerprint = String(apiKeyOrClientId).slice(-6);
  return `${modelName}::${fingerprint}`;
}

function getBreaker(id) {
  if (!breakers.has(id)) {
    // 🚀 FIX: Added probeInFlight lock to prevent concurrent probe spam
    breakers.set(id, { state: CIRCUIT_STATE.CLOSED, openedAt: 0, trippedBy: null, probeInFlight: false });
  }
  return breakers.get(id);
}

function isBreakerOpen(id) {
  const b = getBreaker(id);
  
  if (b.state === CIRCUIT_STATE.CLOSED) return false;

  // 🚀 FIX: Concurrency Lock Check
  if (b.state === CIRCUIT_STATE.HALF_OPEN) {
    if (b.probeInFlight) return true; // Treat as OPEN if a probe is already testing the API
    b.probeInFlight = true; // Lock it for this request!
    return false;
  }

  const elapsed = Date.now() - b.openedAt;
  if (elapsed > BREAKER_COOLDOWN_MS) {
    // Cooldown finished. Transition to HALF_OPEN and instantly lock the probe!
    b.state = CIRCUIT_STATE.HALF_OPEN;
    b.probeInFlight = true; 
    return false;
  }
  
  return b.state === CIRCUIT_STATE.OPEN;
}

function tripBreaker(id, reason) {
  const b = getBreaker(id);
  b.state = CIRCUIT_STATE.OPEN;
  b.openedAt = Date.now();
  b.trippedBy = reason;
  b.probeInFlight = false; // Reset lock on hard fail
  console.warn(`🔌 [BREAKER] OPEN for ${id} (${reason}) — cooling down 60s`);
}

function resetBreaker(id) {
  const b = getBreaker(id);
  if (b.state !== CIRCUIT_STATE.CLOSED) {
    console.info(`✅ [BREAKER] CLOSED for ${id} — recovered`);
  }
  b.state = CIRCUIT_STATE.CLOSED;
  b.openedAt = 0;
  b.trippedBy = null;
  b.probeInFlight = false; // Safely remove lock on success
}

function releaseProbe(id) {
  const b = getBreaker(id);
  if (b.state === CIRCUIT_STATE.HALF_OPEN) {
    b.probeInFlight = false; // Release lock if a non-429 transient error blocked the probe
  }
}

function isHardLimitError(error) {
  const msg = String((error && error.message) || error);
  return /\b429\b/.test(msg) || /\b503\b/.test(msg) || /rate.?limit/i.test(msg) || /overloaded/i.test(msg);
}

// ============================================================
// 3. ROUND-ROBIN KEY SELECTOR
// ============================================================
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

// ============================================================
// 4. ROUTING CLASSIFIERS
// ============================================================
function isGroqDomain(userMessage) {
  if (!userMessage) return false;
  const GROQ_EXPERT_REGEX = /math|calculate|equation|code|script|debug|python|javascript|html|css|sql|json|database|algorithm/i;
  return GROQ_EXPERT_REGEX.test(userMessage.toLowerCase());
}

function isComplexTask(intent, userMessage) {
  if (intent === INTENTS.HEAVY_TASK) return true;
  if (!userMessage) return false;
  const HEAVY_ANALYSIS_REGEX = /deep analysis|quantum|architecture|complex breakdown|thesis|geopolitics/i;
  return HEAVY_ANALYSIS_REGEX.test(userMessage.toLowerCase());
}

// ============================================================
// 5. DYNAMIC TEMPERATURE
// ============================================================
function getDynamicTemp(intent) {
  switch (intent) {
    case INTENTS.MODERATION:
    case INTENTS.COMMAND: return 0.1;
    case INTENTS.HEAVY_TASK: return 0.3;
    case INTENTS.EMOTIONAL_DISCLOSURE: return 0.9;
    default: return 0.8;
  }
}

// ============================================================
// 6. TOKEN COMPRESSION (Emergency Tier)
// ============================================================
const EMERGENCY_MEMORY_CHAR_CAP = 300;

function compressForEmergency(prompt) {
  if (!prompt) return prompt;
  let compressed = prompt;
  compressed = compressed.replace(/<LongTermMemory>[\s\S]*?<\/LongTermMemory>/i, '');
  compressed = compressed.replace(/<RecentChatHistory>([\s\S]*?)<\/RecentChatHistory>/i, (match, inner) => {
    if (inner.length <= EMERGENCY_MEMORY_CHAR_CAP) return match;
    const truncated = inner.slice(-EMERGENCY_MEMORY_CHAR_CAP);
    return `<RecentChatHistory>\n...[truncated for emergency]...\n${truncated}\n</RecentChatHistory>`;
  });
  compressed = compressed.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return compressed;
}

// ============================================================
// 7. RETRY HELPERS
// ============================================================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      if (isHardLimitError(error) || attempt >= retries) throw error;
      const delay = backoffDelay(attempt);
      console.warn(`🔁 [RETRY] Transient error. Retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
      attempt++;
    }
  }
}

// ============================================================
// 8. API EXECUTORS
// ============================================================
async function callGroq(groqClient, modelName, prompt, systemInstruction, maxTokens, temp) {
  const completion = await groqClient.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    temperature: temp,
    max_tokens: maxTokens
  });
  return completion.choices[0].message.content;
}

async function callGemini(apiKey, modelName, prompt, systemInstruction) {
  const genAI = getGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
    tools: [
      {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.2 }
        }
      }
    ]
  });
  const response = await model.generateContent(prompt);
  return response.response.text();
}

// ============================================================
// 9. POOL RUNNERS
// ============================================================
async function runGeminiPool(poolName, modelName, geminiKeys, prompt, systemInstruction, labelFn) {
  const order = nextKeyOrder(poolName, geminiKeys);

  for (const { key, index } of order) {
    const id = breakerId(key, modelName);
    if (isBreakerOpen(id)) continue;

    try {
      const text = await withRetry(() => callGemini(key, modelName, prompt, systemInstruction));
      resetBreaker(id);
      return { result: text, modelUsed: labelFn(index) };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] ${modelName} failed (Key ${index + 1}): ${error.message}`);
      if (isHardLimitError(error)) {
        tripBreaker(id, error.message);
      } else {
        releaseProbe(id); // Safely release lock if failure was just a transient timeout
      }
    }
  }
  return null;
}

async function runGroqGuarded(groqClient, modelName, prompt, systemInstruction, maxTokens, temp) {
  const id = breakerId(GROQ_CLIENT_ID, modelName);
  if (isBreakerOpen(id)) return null;

  try {
    const text = await withRetry(() => callGroq(groqClient, modelName, prompt, systemInstruction, maxTokens, temp));
    resetBreaker(id);
    return text;
  } catch (error) {
    console.warn(`⚠️ [ROUTER] Groq ${modelName} failed: ${error.message}`);
    if (isHardLimitError(error)) {
      tripBreaker(id, error.message);
    } else {
      releaseProbe(id);
    }
    throw error;
  }
}

// ============================================================
// 10. MAIN CASCADING GENERATOR
// ============================================================
async function generate({ classification, prompt, userMessage, systemInstruction, geminiKeys = [], groqClient, hasGroq }) {
  const currentIntent = classification?.intent || 'social';
  const groqTemp = getDynamicTemp(currentIntent);

  const needsGroq = isGroqDomain(userMessage);
  const complex = isComplexTask(currentIntent, userMessage);

  let lastError;

  // ==========================================
  // TIER 1: GROQ EXPERTISE (Math, Code, Data)
  // ==========================================
  if (needsGroq && hasGroq) {
    try {
      const text = await runGroqGuarded(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1024, 0.2);
      if (text !== null) return { result: text, modelUsed: 'Groq-Llama-3.3-70B [Primary-Expert]' };
      console.warn('🔌 [ROUTER] Groq Expert breaker open. Cascading down...');
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq Expert Route failed. Cascading down...`);
      lastError = error;
    }
  }

  // ==========================================
  // TIER 2: HEAVY / COMPLEX (Gemini 3.6 Primary)
  // ==========================================
  if (complex || needsGroq) {
    const heavy = await runGeminiPool(
      'gemini-3.6-heavy',
      'gemini-3.6-flash',
      geminiKeys,
      prompt,
      systemInstruction,
      (i) => `Gemini-3.6-Flash (Key ${i + 1}) [Heavy-Tier]`
    );
    if (heavy) return heavy;

    // 🚀 FIX: Documented logic: If needsGroq is true, Groq 70B ALREADY failed in Tier 1.
    // We strictly use `!needsGroq` to prevent pointlessly double-hitting a dead API.
    if (hasGroq && !needsGroq) {
      try {
        const text = await runGroqGuarded(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000, groqTemp);
        if (text !== null) return { result: text, modelUsed: 'Groq-Llama-3.3-70B [Complex-Fallback]' };
        console.warn('🔌 [ROUTER] Groq Complex-Fallback breaker open. Cascading down...');
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 70B fallback failed. Cascading down...`);
        lastError = error;
      }
    }
  }

  // ==========================================
  // TIER 3: EVERYDAY CHAT (Gemini 3.5 Flash-Lite)
  // ==========================================
  const fast = await runGeminiPool(
    'gemini-3.5-fast',
    'gemini-3.5-flash-lite',
    geminiKeys,
    prompt,
    systemInstruction,
    (i) => `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Primary-Fast]`
  );
  if (fast) return fast;

  // ==========================================
  // TIER 4: EMERGENCY ESCALATIONS
  // ==========================================
  const escalated = await runGeminiPool(
    'gemini-3.6-escalation',
    'gemini-3.6-flash',
    geminiKeys,
    prompt,
    systemInstruction,
    (i) => `Gemini-3.6-Flash (Key ${i + 1}) [Escalated-Emergency]`
  );
  if (escalated) return escalated;

  if (hasGroq) {
    try {
      const compressedPrompt = compressForEmergency(prompt);
      const text = await runGroqGuarded(groqClient, 'llama-3.1-8b-instant', compressedPrompt, systemInstruction, 400, groqTemp);
      if (text !== null) {
        return { result: text, modelUsed: 'Groq-Llama-3.1-8B [Ultimate-Fallback, Compressed]' };
      }
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq 8B fallback failed.`);
      lastError = error;
    }
  }

  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini) failed or are cooling down.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

// ============================================================
// 11. OBSERVABILITY
// ============================================================
function getRouterHealth() {
  const snapshot = [];
  for (const [id, b] of breakers.entries()) {
    snapshot.push({ id, state: b.state, trippedBy: b.trippedBy, openedAt: b.openedAt || null, probeInFlight: b.probeInFlight });
  }
  return { breakers: snapshot, rrPointers: Object.fromEntries(rrPointers.entries()) };
}

module.exports = { generate, getRouterHealth };
