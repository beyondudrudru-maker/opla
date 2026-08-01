/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Executes Smart Tier Routing and Rate-Limit Handling for Groq AI.
 *   Cascades through free models to guarantee 0-error fault tolerance.
 */

const { INTENTS } = require('../classifier/intentClassifier');

const COMPLEX_CATEGORY_REGEX = /science|tech|technology|space|physics|coding|code|script|business|finance|economy|analyze|explain|history|stotram|mantra|lyrics/i;

const HEAVY_INTENTS = new Set([
  INTENTS.HEAVY_TASK, 
  INTENTS.MODERATION, 
  INTENTS.COMMAND, 
  INTENTS.QUESTION,
  INTENTS.EMOTIONAL_DISCLOSURE
]);

function isComplexTask(intent, prompt) {
  if (HEAVY_INTENTS.has(intent)) return true;
  if (COMPLEX_CATEGORY_REGEX.test(prompt)) return true;
  if (prompt.length > 120) return true;
  return false;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🛡️ Groq Free-Tier Fallback Lineup
const GROQ_MODELS = [
  "llama-3.1-8b-instant",  // Primary: Extremely fast
  "llama3-8b-8192",        // Backup 1
  "gemma2-9b-it",          // Backup 2
  "mixtral-8x7b-32768"     // Backup 3 (Heavy)
];

async function generate({ classification, prompt, systemInstruction, aiClient }) {
  const complex = isComplexTask(classification?.intent, prompt);
  let lastError;

  // 🔄 Iterate through the safe Groq models
  for (const modelName of GROQ_MODELS) {
    
    // Try up to 2 times per model with a short backoff if 429 is hit
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        // Execute API Call
        const completion = await aiClient.chat.completions.create({
          model: modelName,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: complex ? 1500 : 800
        });
        
        const tierTag = complex ? 'Groq-Heavy' : 'Groq-Light';
        
        return { 
          result: completion.choices[0].message.content, 
          modelUsed: `${modelName} [${tierTag}]` 
        };
        
      } catch (error) {
        const status = error.status || error?.response?.status || 'Error';
        
        // Handle Rate Limits (429) gracefully
        if (status === 429 || String(error.message).includes('429')) {
          console.warn(`⚠️ [ROUTER] Rate limit (429) hit on ${modelName}. Backing off for ${attempt * 1500}ms...`);
          await delay(attempt * 1500);
          continue; // Try again
        }

        // Non-429 error, break retry loop and cascade to next model
        console.warn(`⚠️ [ROUTER] Model ${modelName} skipped due to error (${status}). Cascading...`);
        lastError = error;
        break; 
      }
    }
  }

  console.error('❌ [ROUTER] Critical: All Groq models failed.');
  throw lastError || new Error('All model quotas exhausted or invalid configuration.');
}

module.exports = { generate };
