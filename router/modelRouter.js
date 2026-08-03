/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Production-Grade Hybrid Routing Engine (Groq + Gemini 3.x).
 *   Features SDK client caching, automatic key cooldowns on 429 errors,
 *   intelligent fallback logic, and DYNAMIC TEMPERATURE control.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { INTENTS } = require('../classifier/intentClassifier');

// 1. IN-MEMORY CLIENT CACHE
const genAiClientCache = new Map();

// 2. IN-MEMORY KEY COOLDOWN TRACKER
const keyCooldowns = new Map();

function getGeminiClient(apiKey) {
  if (!genAiClientCache.has(apiKey)) {
    genAiClientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return genAiClientCache.get(apiKey);
}

function isKeyCoolingDown(apiKey) {
  if (!keyCooldowns.has(apiKey)) return false;
  const cooldownUntil = keyCooldowns.get(apiKey);
  if (Date.now() > cooldownUntil) {
    keyCooldowns.delete(apiKey); 
    return false;
  }
  return true; 
}

function cooldownKey(apiKey, durationMs = 3600000) {
  keyCooldowns.set(apiKey, Date.now() + durationMs);
  console.warn(`🕒 [KEY-MANAGER] API Key placed on cooldown for ${durationMs / 60000} mins due to quota exhaustion.`);
}

// Regex to identify complex topics requiring higher reasoning
const COMPLEX_CATEGORY_REGEX = /science|tech|technology|space|physics|coding|code|script|business|finance|economy|analyze|explain|history|stotram|mantra|lyrics/i;

const HEAVY_INTENTS = new Set([
  INTENTS.HEAVY_TASK, INTENTS.MODERATION, INTENTS.COMMAND, INTENTS.QUESTION, INTENTS.EMOTIONAL_DISCLOSURE
]);

function isComplexTask(intent, prompt) {
  if (HEAVY_INTENTS.has(intent)) return true;
  if (COMPLEX_CATEGORY_REGEX.test(prompt)) return true;
  if (prompt && prompt.length > 120) return true;
  return false;
}

/**
 * 🌡️ DYNAMIC TEMPERATURE CONTROLLER
 * Maps user intent to the optimal model creativity level.
 */
function getDynamicTemp(intent) {
  switch (intent) {
    case INTENTS.MODERATION:
    case INTENTS.COMMAND:
      return 0.2; // Highly strict and robotic for admin tasks
    case INTENTS.HEAVY_TASK:
    case INTENTS.QUESTION:
      return 0.3; // Low hallucination risk for facts/history/code
    case INTENTS.EMOTIONAL_DISCLOSURE:
      return 0.9; // Highly empathetic, warm, and creative
    default:
      return 0.7; // Standard conversational rhythm
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Execute Groq (Now accepts dynamic temp)
async function callGroq(groqClient, modelName, prompt, systemInstruction, maxTokens, temp) {
  const completion = await groqClient.chat.completions.create({
    model: modelName,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ],
    temperature: temp, // 🌡️ Injected here
    max_tokens: maxTokens
  });
  return completion.choices[0].message.content;
}

// Helper: Execute Gemini (Now accepts dynamic temp)
async function callGemini(apiKey, modelName, prompt, systemInstruction, temp) {
  const genAI = getGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    generationConfig: { temperature: temp } // 🌡️ Injected here
  });
  const response = await model.generateContent(prompt);
  return response.response.text();
}

/**
 * Main Production Hybrid Generator
 */
async function generate({ classification, prompt, systemInstruction, geminiKeys = [], groqClient, hasGroq }) {
  const currentIntent = classification?.intent || 'social';
  const complex = isComplexTask(currentIntent, prompt);
  
  // 🌡️ Calculate the perfect temperature for this specific turn
  const dynamicTemp = getDynamicTemp(currentIntent);
  
  let lastError;

  // ==========================================
  // ROUTE 1: COMPLEX TASKS (Gemini 3.6 -> Groq 70B)
  // ==========================================
  if (complex) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.6 failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
        if (error.status === 429 || String(error.message).includes('429') || String(error.message).includes('RESOURCE_EXHAUSTED')) {
          cooldownKey(key, 3600000); 
        }
      }
    }

    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000, dynamicTemp);
        return { result: text, modelUsed: `Groq-Llama-3.3-70B [Fallback] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 70B fallback failed: ${error.message}`);
        lastError = error;
      }
    }
  } 
  
  // ==========================================
  // ROUTE 2: SIMPLE TASKS (Groq 8B -> Gemini 3.5 Lite)
  // ==========================================
  else {
    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.1-8b-instant', prompt, systemInstruction, 400, dynamicTemp);
        return { result: text, modelUsed: `Groq-Llama-3.1-8B [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 8B failed: ${error.message}`);
        lastError = error;
      }
    }

    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.5-flash-lite', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Fallback] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.5 Lite fallback failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
        if (error.status === 429 || String(error.message).includes('429') || String(error.message).includes('RESOURCE_EXHAUSTED')) {
          cooldownKey(key, 3600000);
        }
      }
    }
  }

  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini) failed or are cooling down.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

module.exports = { generate };
