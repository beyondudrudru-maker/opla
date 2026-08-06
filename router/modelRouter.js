/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   True Smart Cascading Hybrid Router — v2 (Round-Robin + Circuit Breaker Edition)
 *   - Groq (Llama-3.3-70B): Primary for Code, Math, and Data.
 *   - Gemini 3.6-Flash (3rd Gen): Strictly for Heavy/Complex tasks & Fallback.
 *   - Gemini 3.5-Flash-Lite (3rd Gen): Primary for fast, everyday chat & general questions.
 *
 * WHAT'S NEW IN v2
 *   1. Stateful round-robin key rotation (per model pool) — spreads RPM evenly across accounts.
 *   2. A real circuit breaker (CLOSED -> OPEN -> HALF_OPEN) per model+key combo. 
 *   3. Prompt compression utility, applied ONLY on the last-resort Groq 8B emergency call.
 *   4. Jittered exponential backoff — fast retries for transient errors.
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
// 2. CIRCUIT BREAKER — per model+key combo
// ============================================================
const CIRCUIT_STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };
const BREAKER_COOLDOWN_MS = 60 * 1000; // 60s cooldown for rate limits

const GROQ_CLIENT_ID = 'groq-single-client';
const breakers = new Map(); 

function breakerId(apiKeyOrClientId, modelName) {
  const fingerprint = String(apiKeyOrClientId).slice(-6);
  return `${modelName}::${fingerprint}`;
}

function getBreaker(id) {
  if (!breakers.has(id)) {
    breakers.set(id, { state: CIRCUIT_STATE.CLOSED, openedAt: 0, trippedBy: null });
  }
  return breakers.get(id);
}

function isBreakerOpen(id) {
  const b = getBreaker(id);
  if (b.state === CIRCUIT_STATE.CLOSED) return false;

  const elapsed = Date.now() - b.openedAt;
  if (elapsed > BREAKER_COOLDOWN_MS) {
    b.state = CIRCUIT_STATE.HALF_OPEN;
    return false;
  }
  return b.state === CIRCUIT_STATE.OPEN;
}

function tripBreaker(id, reason) {
  const b = getBreaker(id);
  b.state = CIRCUIT_STATE.OPEN;
  b.openedAt = Date.now();
  b.trippedBy = reason;
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
// 4. MEMORY-PROOF EXPERTISE & COMPLEXITY CLASSIFIERS 
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
// 5. DYNAMIC TEMPERATURE CONTROLLER (Groq only)
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
// 6. TOKEN COMPRESSION — EMERGENCY TIER ONLY
// ============================================================
const EMERGENCY_MEMORY_CHAR_CAP = 300; 

function compressForEmergency(prompt) {
  if (!prompt) return prompt;

  let compressed = prompt;

  // 🚀 FINAL TOUCH: Completely drop LongTermMemory for 8B to save massive tokens
  compressed = compressed.replace(/<LongTermMemory>[\s\S]*?<\/LongTermMemory>/i, '');

  // 🚀 FINAL TOUCH: Aggressively truncate RecentChatHistory to keep ONLY the most recent messages (end of string)
  compressed = compressed.replace(/<RecentChatHistory>([\s\S]*?)<\/RecentChatHistory>/i, (match, inner) => {
    if (inner.length <= EMERGENCY_MEMORY_CHAR_CAP) return match;
    const truncated = inner.slice(-EMERGENCY_MEMORY_CHAR_CAP); // Keep the END!
    return `<RecentChatHistory>\n...[truncated for emergency]...\n${truncated}\n</RecentChatHistory>`;
  });

  // Cheap whitespace compression everywhere else.
  compressed = compressed
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return compressed;
}

// ============================================================
// 7. RETRY HELPERS — Jitter + Exponential backoff
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
// 9. GEMINI KEY-POOL RUNNER
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
      if (isHardLimitError(error)) tripBreaker(id, error.message);
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
    if (isHardLimitError(error)) tripBreaker(id, error.message);
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
      console.warn(`⚠️ [ROUTER] Groq Expert Route failed: ${error.message}. Cascading down...`);
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

    if (hasGroq && !needsGroq) {
      try {
        const text = await runGroqGuarded(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000, groqTemp);
        if (text !== null) return { result: text, modelUsed: 'Groq-Llama-3.3-70B [Complex-Fallback]' };
        console.warn('🔌 [ROUTER] Groq Complex-Fallback breaker open. Cascading down...');
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 70B fallback failed: ${error.message}`);
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
      console.warn('🔌 [ROUTER] Groq Ultimate-Fallback breaker open.');
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq 8B fallback failed: ${error.message}`);
      lastError = error;
    }
  }

  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini) failed or are cooling down.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

// 🚀 FINAL TOUCH: Fixed map iteration for getRouterHealth so it exports properly
function getRouterHealth() {
  const snapshot = [];
  for (const [id, b] of breakers.entries()) {
    snapshot.push({ id, state: b.state, trippedBy: b.trippedBy, openedAt: b.openedAt || null });
  }
  return { breakers: snapshot, rrPointers: Object.fromEntries(rrPointers.entries()) };
}

module.exports = { generate, getRouterHealth };
