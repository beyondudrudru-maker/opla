/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   True Smart Cascading Hybrid Router with Full Error Logging & Cooldowns.
 *   - Groq (Llama-3.3-70B): Primary for Code, Math, and Data.
 *   - Gemini 3.6-Flash: Strictly for Heavy/Complex tasks & Fallback.
 *   - Gemini 3.5-Flash-Lite: Primary for fast, everyday chat & general questions.
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
function isGroqDomain(prompt) {
  if (!prompt) return false;
  const recentUserText = prompt.slice(-200).toLowerCase();
  const GROQ_EXPERT_REGEX = /math|calculate|equation|code|script|debug|python|javascript|html|css|sql|json|database|algorithm/i;
  return GROQ_EXPERT_REGEX.test(recentUserText);
}

function isComplexTask(intent, prompt) {
  // 🚀 FIX: Removed INTENTS.QUESTION so regular questions go to Gemini 3.5 Flash-Lite!
  if (intent === INTENTS.HEAVY_TASK) return true;
  
  if (!prompt) return false;
  const recentUserText = prompt.slice(-200).toLowerCase();
  const HEAVY_ANALYSIS_REGEX = /deep analysis|quantum|architecture|complex breakdown|thesis/i;
  return HEAVY_ANALYSIS_REGEX.test(recentUserText);
}

// 3. DYNAMIC TEMPERATURE CONTROLLER
function getDynamicTemp(intent) {
  switch (intent) {
    case INTENTS.MODERATION:
    case INTENTS.COMMAND:
      return 0.1; // Extremely precise/strict for code/logic
    case INTENTS.HEAVY_TASK:
      return 0.3; // Low hallucination risk
    case INTENTS.EMOTIONAL_DISCLOSURE:
      return 0.9; // Highly empathetic
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
    generationConfig: { temperature: temp },
    tools: [
      {
        googleSearch: {}
      }
    ]
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
  const complex = isComplexTask(currentIntent, prompt);
  
  let lastError;

  // ==========================================
  // ROUTE A: GROQ EXPERTISE (Math, Code, Data)
  // ==========================================
  if (needsGroq && hasGroq) {
    try {
      const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1024, 0.2);
      return { result: text, modelUsed: `Groq-Llama-3.3-70B [Primary-Expert] [Temp: 0.2]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq Expert Route failed: ${error.message}. Cascading to Gemini.`);
      lastError = error;
      
      for (let i = 0; i < geminiKeys.length; i++) {
        const key = geminiKeys[i];
        if (isKeyCoolingDown(key)) continue;
        try {
          const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, 0.2);
          return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Groq-Fallback] [Temp: 0.2]` };
        } catch (e) {
          console.warn(`⚠️ [ROUTER] Gemini 3.6 fallback failed (Key ${i + 1}): ${e.message}`);
          if (String(e.message).includes('429') || String(e.message).includes('503')) {
            cooldownKey(key);
          }
        }
      }
    }
  }

  // ==========================================
  // ROUTE B: HEAVY / COMPLEX TASKS ONLY (Gemini 3.6 Primary)
  // ==========================================
  else if (complex) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Primary-Complex] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.6 failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
        if (String(error.message).includes('429') || String(error.message).includes('503')) {
          cooldownKey(key);
        }
      }
    }

    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000, dynamicTemp);
        return { result: text, modelUsed: `Groq-Llama-3.3-70B [Complex-Fallback] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 70B complex fallback failed: ${error.message}`);
        lastError = error;
      }
    }
  } 
  
  // ==========================================
  // ROUTE C: EVERYDAY CHAT & QUESTIONS (Gemini 3.5 Primary)
  // ==========================================
  else {
    // 1. Primary: Fast Gemini 3.5 Lite for all questions, social chat, and banter
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.5-flash-lite', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Primary-Fast] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.5 Lite failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
        if (String(error.message).includes('429') || String(error.message).includes('503')) {
          cooldownKey(key);
        }
      }
    }

    // 2. Escalation: Try Gemini 3.6 if 3.5 Lite is cooling down
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Escalated-Normal] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.6 Escalation failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
      }
    }

    // 3. Ultimate Fallback: Groq 8B Instant
    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.1-8b-instant', prompt, systemInstruction, 400, dynamicTemp);
        return { result: text, modelUsed: `Groq-Llama-3.1-8B [Ultimate-Fallback] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 8B fallback failed: ${error.message}`);
        lastError = error;
      }
    }
  }

  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini) failed or are cooling down.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

module.exports = { generate };
