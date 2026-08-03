/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Production-Grade Hybrid Routing Engine (Groq + Gemini 3.x).
 *   Features SDK client caching, automatic key cooldowns on 429 errors,
 *   and intelligent fallback logic.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { INTENTS } = require('../classifier/intentClassifier');

// 1. IN-MEMORY CLIENT CACHE: Prevents recreating SDK instances on every request
const genAiClientCache = new Map();

// 2. IN-MEMORY KEY COOLDOWN TRACKER: Stores exhausted keys with expiration timestamps
const keyCooldowns = new Map();

/**
 * Gets or initializes a cached GoogleGenerativeAI instance for a given key.
 */
function getGeminiClient(apiKey) {
  if (!genAiClientCache.has(apiKey)) {
    genAiClientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return genAiClientCache.get(apiKey);
}

/**
 * Checks if an API key is currently on cooldown.
 */
function isKeyCoolingDown(apiKey) {
  if (!keyCooldowns.has(apiKey)) return false;
  const cooldownUntil = keyCooldowns.get(apiKey);
  if (Date.now() > cooldownUntil) {
    keyCooldowns.delete(apiKey); // Cooldown expired, restore key
    return false;
  }
  return true; // Still on cooldown
}

/**
 * Places an API key on temporary cooldown (Default: 1 hour)
 */
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Execute Groq
async function callGroq(groqClient, modelName, prompt, systemInstruction, maxTokens) {
  const completion = await groqClient.chat.completions.create({
    model: modelName,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: maxTokens
  });
  return completion.choices[0].message.content;
}

// Helper: Execute Gemini using the cached client
async function callGemini(apiKey, modelName, prompt, systemInstruction) {
  const genAI = getGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] }
  });
  const response = await model.generateContent(prompt);
  return response.response.text();
}

/**
 * Main Production Hybrid Generator
 */
async function generate({ classification, prompt, systemInstruction, geminiKeys = [], groqClient, hasGroq }) {
  const complex = isComplexTask(classification?.intent, prompt);
  let lastError;

  // ==========================================
  // ROUTE 1: COMPLEX TASKS (Gemini 3.6 -> Groq 70B)
  // ==========================================
  if (complex) {
    // 1A. Try Active Gemini Keys First
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      
      // Fast Skip: Don't call Gemini if key is on cooldown
      if (isKeyCoolingDown(key)) {
        console.log(`⏩ [ROUTER] Skipping Gemini Key ${i + 1} (Currently in cooldown).`);
        continue;
      }

      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1})` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.6 failed (Key ${i + 1}): ${error.message}`);
        lastError = error;

        // Smart Cooldown: Check if error is quota related (429 / RESOURCE_EXHAUSTED)
        if (error.status === 429 || String(error.message).includes('429') || String(error.message).includes('RESOURCE_EXHAUSTED')) {
          cooldownKey(key, 3600000); // Put on 1-hour cooldown
        }
      }
    }

    // 1B. Fallback to Groq 70B if Gemini fails
    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000);
        return { result: text, modelUsed: `Groq-Llama-3.3-70B [Fallback]` };
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
    // 2A. Try Groq 8B First
    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.1-8b-instant', prompt, systemInstruction, 400);
        return { result: text, modelUsed: `Groq-Llama-3.1-8B` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 8B failed: ${error.message}`);
        lastError = error;
      }
    }

    // 2B. Fallback to Gemini 3.5 Flash-Lite
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];

      if (isKeyCoolingDown(key)) {
        console.log(`⏩ [ROUTER] Skipping Gemini Key ${i + 1} (Currently in cooldown).`);
        continue;
      }

      try {
        const text = await callGemini(key, 'gemini-3.5-flash-lite', prompt, systemInstruction);
        return { result: text, modelUsed: `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Fallback]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.5 Lite fallback failed (Key ${i + 1}): ${error.message}`);
        lastError = error;

        if (error.status === 429 || String(error.message).includes('429') || String(error.message).includes('RESOURCE_EXHAUSTED')) {
          cooldownKey(key, 3600000); // Put on 1-hour cooldown
        }
      }
    }
  }

  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini) failed or are cooling down.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

module.exports = { generate };
