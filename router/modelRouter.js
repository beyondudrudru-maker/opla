/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   True Smart Cascading Hybrid Router.
 *   Actively reads prompt context to match the task with the BEST model.
 *   - Groq (Llama): Primary for Code, Math, and Data.
 *   - Gemini 3.6: Primary for Complex Creative/General tasks.
 *   - Gemini 3.5: Primary for fast, everyday banter.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { INTENTS } = require('../classifier/intentClassifier');

// 1. IN-MEMORY CACHE & COOLDOWN
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
  console.warn(`🕒 [KEY-MANAGER] API Key placed on cooldown.`);
}

// 2. SMART TASK CLASSIFIERS
// Detects if Groq is the best tool for the job (Logic, Math, Code, Data)
const GROQ_EXPERTISE_REGEX = /math|calculate|equation|code|script|debug|python|javascript|html|css|sql|data|json|csv|database|algorithm/i;

// Detects deep/heavy topics for Gemini 3.6
const COMPLEX_CATEGORY_REGEX = /science|tech|technology|space|physics|business|finance|economy|analyze|explain|history|stotram|mantra|lyrics/i;
const HEAVY_INTENTS = new Set([INTENTS.HEAVY_TASK, INTENTS.COMMAND, INTENTS.QUESTION]);

function isGroqDomain(prompt) {
  if (!prompt) return false;
  return GROQ_EXPERTISE_REGEX.test(prompt);
}

function isComplexTask(intent, prompt) {
  if (HEAVY_INTENTS.has(intent)) return true;
  if (COMPLEX_CATEGORY_REGEX.test(prompt)) return true;
  if (prompt && prompt.length > 400) return true; 
  return false;
}

// 3. DYNAMIC TEMPERATURE
function getDynamicTemp(intent) {
  switch (intent) {
    case INTENTS.MODERATION:
    case INTENTS.COMMAND:
      return 0.1; // Extremely strict for logic/code
    case INTENTS.HEAVY_TASK:
    case INTENTS.QUESTION:
      return 0.3; 
    case INTENTS.EMOTIONAL_DISCLOSURE:
      return 0.9; 
    default:
      return 0.7; 
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
 * Main Production Hybrid Generator
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
      // Groq Llama 3 70B takes the lead for logic!
      const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1024, 0.2);
      return { result: text, modelUsed: `Groq-Llama-3.3-70B [Primary-Expert] [Temp: 0.2]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq Expert Route failed: ${error.message}. Falling back to Gemini.`);
      lastError = error;
      // Fallback to Gemini 3.6 if Groq fails its own expertise
      for (let i = 0; i < geminiKeys.length; i++) {
        const key = geminiKeys[i];
        if (isKeyCoolingDown(key)) continue;
        try {
          const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, 0.2);
          return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Fallback] [Temp: 0.2]` };
        } catch (e) {
            if (String(e.message).includes('429') || String(e.message).includes('503')) cooldownKey(key);
        }
      }
    }
  }

  // ==========================================
  // ROUTE B: COMPLEX GENERAL (Gemini 3.6 Primary)
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
        if (String(error.message).includes('429') || String(error.message).includes('503')) cooldownKey(key);
      }
    }

    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000, dynamicTemp);
        return { result: text, modelUsed: `Groq-Llama-3.3-70B [Fallback] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        lastError = error;
      }
    }
  } 
  
  // ==========================================
  // ROUTE C: NORMAL EVERYDAY CHAT (Gemini 3.5 Primary)
  // ==========================================
  else {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.5-flash-lite', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Primary-Fast] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.5 Lite failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
        if (String(error.message).includes('429') || String(error.message).includes('503')) cooldownKey(key);
      }
    }

    // Escalation: Try 3.6
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;

      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1}) [Escalated] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        lastError = error;
      }
    }

    // Ultimate Fallback: Groq 8B
    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.1-8b-instant', prompt, systemInstruction, 400, dynamicTemp);
        return { result: text, modelUsed: `Groq-Llama-3.1-8B [Fallback] [Temp: ${dynamicTemp}]` };
      } catch (error) {
        lastError = error;
      }
    }
  }

  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini) failed or are cooling down.');
  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

module.exports = { generate };
