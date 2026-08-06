/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   True Smart Cascading Hybrid Router with Full Error Logging & Cooldowns.
 *   - Groq (Llama-3.3-70B): Primary for Code, Math, and Data.
 *   - Gemini 3.6-Flash (3rd Gen): Strictly for Heavy/Complex tasks & Fallback.
 *   - Gemini 3.5-Flash-Lite (3rd Gen): Primary for fast, everyday chat & general questions.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { INTENTS } = require('../classifier/intentClassifier');

// 1. IN-MEMORY CACHE & COOLDOWN MANAGEMENT
const genAiClientCache = new Map();
const keyCooldowns = new Map();

function getGeminiClient(apiKey) {
  if (!genAiClientCache.has(apiKey)) {
    genAiClientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return genAiClientCache.get(apiKey);
}

function isKeyCoolingDown(apiKey) {
  if (!keyCooldowns.has(apiKey)) return false;
  if (Date.now() > keyCooldowns.get(apiKey)) {
    keyCooldowns.delete(apiKey); 
    return false;
  }
  return true; 
}

function cooldownKey(apiKey, durationMs = 3600000) {
  keyCooldowns.set(apiKey, Date.now() + durationMs);
  console.warn(`🕒 [KEY-MANAGER] API Key placed on cooldown for quota protection (1 hour).`);
}

// 2. MEMORY-PROOF EXPERTISE & COMPLEXITY CLASSIFIERS
// 🚀 FIX: Now strictly scans the raw userMessage, ignoring the XML prompt assembly!
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

// 3. DYNAMIC TEMPERATURE CONTROLLER (Used exclusively for Groq now)
function getDynamicTemp(intent) {
  switch (intent) {
    case INTENTS.MODERATION:
    case INTENTS.COMMAND:
      return 0.1; 
    case INTENTS.HEAVY_TASK:
      return 0.3; 
    case INTENTS.EMOTIONAL_DISCLOSURE:
      return 0.9; 
    default:
      return 0.8; 
  }
}

// 4. API EXECUTORS
async function callGroq(groqClient, modelName, prompt, systemInstruction, maxTokens, temp) {
  const completion = await groqClient.chat.completions.create({
    model: modelName,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ],
    temperature: temp,
    max_tokens: maxTokens
  });
  return completion.choices[0].message.content;
}

// 🚀 FIX: Removed deprecated `temperature` to ensure 3rd Gen API compatibility
async function callGemini(apiKey, modelName, prompt, systemInstruction) {
  const genAI = getGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    // 🚀 FIX: Precise Search config for 3rd Gen models
    tools: [
      {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.2
          }
        }
      }
    ]
  });
  const response = await model.generateContent(prompt);
  return response.response.text();
}

/**
 * Main Smart Cascading Generator Function
 * 🚀 FIX: Implemented a True Waterfall Cascade. No more `else if` dead ends!
 */
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
      const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1024, 0.2);
      return { result: text, modelUsed: `Groq-Llama-3.3-70B [Primary-Expert]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq Expert Route failed: ${error.message}. Cascading down...`);
      lastError = error;
    }
  }

  // ==========================================
  // TIER 2: HEAVY / COMPLEX (Gemini 3.6 Primary)
  // ==========================================
  // Triggers if it's explicitly complex, OR if Tier 1 (Groq) failed and fell through!
  if (complex || needsGroq) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Heavy-Tier]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.6 failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
        if (String(error.message).includes('429') || String(error.message).includes('503')) cooldownKey(key);
      }
    }

    // If Gemini 3.6 heavy failed, try Groq heavy as a fallback
    if (hasGroq && !needsGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000, groqTemp);
        return { result: text, modelUsed: `Groq-Llama-3.3-70B [Complex-Fallback]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 70B fallback failed: ${error.message}`);
        lastError = error;
      }
    }
  } 
  
  // ==========================================
  // TIER 3: EVERYDAY CHAT (Gemini 3.5 Flash-Lite)
  // ==========================================
  // If it's normal chat, it starts here. If Tier 1 or 2 failed, they cascade here!
  for (let i = 0; i < geminiKeys.length; i++) {
    const key = geminiKeys[i];
    if (isKeyCoolingDown(key)) continue;

    try {
      const text = await callGemini(key, 'gemini-3.5-flash-lite', prompt, systemInstruction);
      return { result: text, modelUsed: `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Primary-Fast]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Gemini 3.5 Lite failed (Key ${i + 1}): ${error.message}`);
      lastError = error;
      if (String(error.message).includes('429') || String(error.message).includes('503')) cooldownKey(key);
    }
  }

  // ==========================================
  // TIER 4: EMERGENCY ESCALATIONS
  // ==========================================
  
  // 1. Escalate to Gemini 3.6 if 3.5 Lite is down
  for (let i = 0; i < geminiKeys.length; i++) {
    const key = geminiKeys[i];
    if (isKeyCoolingDown(key)) continue;

    try {
      const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction);
      return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Escalated-Emergency]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Gemini 3.6 Escalation failed (Key ${i + 1}): ${error.message}`);
      lastError = error;
    }
  }

  // 2. Ultimate Fallback: Groq 8B Instant
  if (hasGroq) {
    try {
      const text = await callGroq(groqClient, 'llama-3.1-8b-instant', prompt, systemInstruction, 400, groqTemp);
      return { result: text, modelUsed: `Groq-Llama-3.1-8B [Ultimate-Fallback]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq 8B fallback failed: ${error.message}`);
      lastError = error;
    }
  }

  // If we reach this line, literally every key and every model has failed.
  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini) failed or are cooling down.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

module.exports = { generate };
