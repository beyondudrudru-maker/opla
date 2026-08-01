/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Balanced Hybrid Routing (Groq + Gemini 3.x Generation).
 *   Intelligently splits the load and automatically falls back on failure.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { INTENTS } = require('../classifier/intentClassifier');

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

// Helper: Execute Gemini (Updated for 3.x Generation API formats)
async function callGemini(apiKey, modelName, prompt, systemInstruction) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] }
  });
  const response = await model.generateContent(prompt);
  return response.response.text();
}

/**
 * Main Hybrid Generator
 */
async function generate({ classification, prompt, systemInstruction, geminiKeys = [], groqClient, hasGroq }) {
  const complex = isComplexTask(classification?.intent, prompt);
  let lastError;

  // ==========================================
  // ROUTE 1: COMPLEX TASKS (Gemini 3.6 -> Groq 70B)
  // ==========================================
  if (complex) {
    // 1A. Try Gemini 3.6 Flash First (Deep context, All-around help)
    for (let i = 0; i < geminiKeys.length; i++) {
      try {
        const text = await callGemini(geminiKeys[i], 'gemini-3.6-flash', prompt, systemInstruction);
        return { result: text, modelUsed: `Gemini-3.6-Flash (Key ${i + 1})` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.6 failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
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
    // 2A. Try Groq 8B First (Blazing instant speed)
    if (hasGroq) {
      try {
        const text = await callGroq(groqClient, 'llama-3.1-8b-instant', prompt, systemInstruction, 400);
        return { result: text, modelUsed: `Groq-Llama-3.1-8B` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Groq 8B failed: ${error.message}`);
        lastError = error;
      }
    }

    // 2B. Fallback to Gemini 3.5 Flash-Lite if Groq fails
    for (let i = 0; i < geminiKeys.length; i++) {
      try {
        const text = await callGemini(geminiKeys[i], 'gemini-3.5-flash-lite', prompt, systemInstruction);
        return { result: text, modelUsed: `Gemini-3.5-Flash-Lite (Key ${i + 1}) [Fallback]` };
      } catch (error) {
        console.warn(`⚠️ [ROUTER] Gemini 3.5 Lite fallback failed (Key ${i + 1}): ${error.message}`);
        lastError = error;
      }
    }
  }

  console.error('❌ [ROUTER] Critical: All hybrid models (Groq + Gemini 3.x) failed.');
  throw lastError || new Error('All model quotas exhausted or network down.');
}

module.exports = { generate };
