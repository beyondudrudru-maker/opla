/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   True Smart Cascading Hybrid Router with Full Error Logging & Cooldowns.
 *   - Groq (Llama-3.3-70B): Primary for Code, Math, and Data.
 *   - Gemini 3.6-Flash: Primary for Complex/Heavy tasks & Fallback (Internet Connected).
 *   - Gemini 3.5-Flash-Lite: Primary for fast, everyday conversational chat (Internet Connected).
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

function isComplexTask(intent) {
  return intent === INTENTS.HEAVY_TASK || intent === INTENTS.QUESTION;
}

// 3. DYNAMIC TEMPERATURE CONTROLLER
function getDynamicTemp(intent) {
  switch (intent) {
    case INTENTS.MODERATION:
    case INTENTS.COMMAND:
      return 0.1; 
    case INTENTS.HEAVY_TASK:
    case INTENTS.QUESTION:
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

async function callGemini(apiKey, modelName, prompt, systemInstruction, temp) {
  const genAI = getGeminiClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    generationConfig: { temperature: temp },
    // 🚀 THE ULTIMATE UPGRADE: Aggressive Dynamic Retrieval
    // A threshold of 0.2 forces the AI to search the internet for almost all factual claims.
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
 */
async function generate({ classification, prompt, systemInstruction, geminiKeys = [], groqClient, hasGroq }) {
  const currentIntent = classification?.intent || 'social';
  const dynamicTemp = getDynamicTemp(currentIntent);
  const needsGroq = isGroqDomain(prompt);
  const complex = isComplexTask(currentIntent);
  let lastError;

  // ROUTE A: GROQ EXPERTISE (Math, Code, Data)
  if (needsGroq && hasGroq) {
    try {
      const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1024, 0.2);
      return { result: text, modelUsed: `Groq-Llama-3.3-70B [Primary-Expert]` };
    } catch (error) {
      console.warn(`⚠️ [ROUTER] Groq failed. Cascading...`);
      lastError = error;
      for (let i = 0; i < geminiKeys.length; i++) {
        const key = geminiKeys[i];
        if (isKeyCoolingDown(key)) continue;
        try {
          const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, 0.2);
          return { result: text, modelUsed: `Gemini-3.6-Flash [Groq-Fallback]` };
        } catch (e) {
          if (String(e.message).includes('429') || String(e.message).includes('503')) cooldownKey(key);
        }
      }
    }
  }

  // ROUTE B: COMPLEX GENERAL (Gemini 3.6 Primary)
  else if (complex) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;
      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.6-Flash [Primary-Complex]` };
      } catch (error) {
        lastError = error;
        if (String(error.message).includes('429') || String(error.message).includes('503')) cooldownKey(key);
      }
    }
    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.3-70b-versatile', prompt, systemInstruction, 1000, dynamicTemp);
        return { result: text, modelUsed: `Groq-Llama-3.3-70B [Complex-Fallback]` };
      } catch (error) {
        lastError = error;
      }
    }
  } 
  
  // ROUTE C: NORMAL EVERYDAY CHAT (Gemini 3.5 Primary)
  else {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;
      try {
        const text = await callGemini(key, 'gemini-3.5-flash-lite', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.5-Flash-Lite [Primary-Fast]` };
      } catch (error) {
        lastError = error;
        if (String(error.message).includes('429') || String(error.message).includes('503')) cooldownKey(key);
      }
    }
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      if (isKeyCoolingDown(key)) continue;
      try {
        const text = await callGemini(key, 'gemini-3.6-flash', prompt, systemInstruction, dynamicTemp);
        return { result: text, modelUsed: `Gemini-3.6-Flash [Escalated-Normal]` };
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error('All model quotas exhausted or cooling down.');
}

module.exports = { generate };
