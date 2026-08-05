/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Advanced Production-Grade Smart Cascading Hybrid Router.
 *   - Groq 70B: Primary logic, math, and coding expert.
 *   - Gemini 3.6-Flash: Deep task analyzer, escalation, and fallback.
 *   - Gemini 3.5-Flash-Lite: Primary high-speed conversational engine.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { INTENTS } = require('../classifier/intentClassifier');

// 1. IN-MEMORY CLIENT CACHE & COOLDOWN MANAGEMENT
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
  console.warn(`🕒 [KEY-MANAGER] API Key placed on cooldown for quota protection.`);
}

// 2. MEMORY-PROOF EXPERTISE & COMPLEXITY CLASSIFIERS
function isGroqDomain(prompt) {
  if (!prompt) return false;
  // Isolate the tail-end of the prompt to avoid system prompt/memory pollution
  const recentUserText = prompt.slice(-200).toLowerCase();
  const GROQ_EXPERT_REGEX = /math|calculate|equation|code|script|debug|python|javascript|html|css|sql|json|database|algorithm/i;
  return GROQ_EXPERT_REGEX.test(recentUserText);
}

function isComplexTask(intent) {
  return intent === INTENTS.HEAVY_TASK || intent === INTENTS.QUESTION;
}

// 3. DYNAMIC TEMPERATURE CONTROLLER
function getDynamicTemp(intent) {
  switch (intent) {
    case INTENTS.MODERATION:
    case INTENTS.COMMAND:
      return 0.1; // Extremely precise/strict
    case INTENTS.HEAVY_TASK:
    case INTENTS.QUESTION:
      return 0.3; // Low hallucination risk
    default:
      return 0.8; // High conversational creativity for global users
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

async function callGemini(apiKey, modelName, prompt, systemInstruction, temp) {
  const genAI = getGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    generationConfig: { temperature: temp }
  });
  const response = await model.generateContent(prompt);
  return response.response.text();
}

/**
 * Main Smart Cascading Generator Function
 */
async function generate({ classification, prompt, systemInstruction, geminiKeys = [], groqClient, hasGroq }) {
  const currentIntent = classification?.intent || 'social';
  const dynamicTemp = getDynamicTemp(currentIntent);
  
  const needsGroq = isGroqDomain(prompt);
  const complex = isComplexTask(currentIntent);
  
  let lastError;

  // ==========================================
  // ROUTE 1: LOGIC, CODING & MATH (Groq 70B)
  // ==========================================
  if (needsGroq && hasGroq) {
    try {
      const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1024, 0.2);
      return { result: text, modelUsed: `Groq-Llama-3.3-70B [Expert-Logic]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq 70B failed, cascading to Gemini: ${error.message}`);
      lastError = error;
    }
  }

  // ==========================================
  // ROUTE 2: COMPLEX & HEAVY TASKS (Gemini 3.6-Flash)
  // ==========================================
  if (complex || (needsGroq && !hasGroq)) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Heavy-Tier]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.6 failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
        if (String(error.message).includes('429') || String(error.message).includes('503')) {
          cooldownKey(key);
        }
      }
    }
  }

  // ==========================================
  // ROUTE 3: PRIMARY CONVERSATIONAL ENGINE (Gemini 3.5-Flash-Lite)
  // ==========================================
  for (let i = 0; i < geminiKeys.length; i++) {
    const key = geminiKeys[i];
    if (isKeyCoolingDown(key)) continue;

    try {
      const text = await callGemini(key, 'gemini-3.5-flash-lite', prompt, systemInstruction, dynamicTemp);
      return { result: text, modelUsed: `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Primary-Chat]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Gemini 3.5 failed (Key ${i + 1}): ${error.message}`);
      lastError = error;
      if (String(error.message).includes('429') || String(error.message).includes('503')) {
        cooldownKey(key);
      }
    }
  }

  // ==========================================
  // ROUTE 4: EMERGENCY ULTIMATE BACKUP (Groq 8B)
  // ==========================================
  if (hasGroq) {
    try {
      const text = await callGroq(groqClient, 'llama-3.1-8b-instant', prompt, systemInstruction, 400, dynamicTemp);
      return { result: text, modelUsed: `Groq-Llama-3.1-8B [Emergency-Fallback]` };
    } catch (error) {
      lastError = error;
    }
  }

  console.error('❌ [ROUTER] Critical: All routing tiers exhausted.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

module.exports = { generate };
