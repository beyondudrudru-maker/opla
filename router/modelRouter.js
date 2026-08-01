/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Executes Dynamic Contextual Routing and Rate-Limit Handling.
 *   Maximizes efficiency by prioritizing models based on task complexity.
 */

const { INTENTS } = require('../classifier/intentClassifier');

// Keywords that demand high intelligence
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

// 🛡️ TIERED ARRAYS: Separating models by capability and speed
const SMART_MODELS = [
  "llama-3.3-70b-versatile", // Highest intelligence
  "llama3-70b-8192"          // Highly capable legacy backup
];

const FAST_MODELS = [
  "llama-3.1-8b-instant",    // Maximum speed & efficiency
  "llama3-8b-8192"           // Lightweight legacy backup
];

async function generate({ classification, prompt, systemInstruction, aiClient }) {
  // 1. LOGIC GATE: Determine task complexity
  const complex = isComplexTask(classification?.intent, prompt);
  let lastError;

  // 2. DYNAMIC ROUTING: Build the lineup based on the logic gate
  // Complex = Smart first. Simple = Fast first.
  const activeLineup = complex 
    ? [...SMART_MODELS, ...FAST_MODELS] 
    : [...FAST_MODELS, ...SMART_MODELS];

  // 3. EXECUTION: Cascade through the intelligently sorted lineup
  for (const modelName of activeLineup) {
    
    // Try up to 2 times for rate limits
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const completion = await aiClient.chat.completions.create({
          model: modelName,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          temperature: complex ? 0.4 : 0.7, // Lower temperature for complex tasks (more logical)
          max_tokens: complex ? 1000 : 400  // Efficient quota management
        });
        
        const tierTag = complex ? 'Groq-Heavy-Logic' : 'Groq-Fast-Social';
        
        return { 
          result: completion.choices[0].message.content, 
          modelUsed: `${modelName} [${tierTag}]` 
        };
        
      } catch (error) {
        const status = error.status || error?.response?.status || 'Error';
        
        if (status === 429 || String(error.message).includes('429')) {
          console.warn(`⚠️ [ROUTER] Rate limit hit on ${modelName}. Pausing ${attempt * 1500}ms...`);
          await delay(attempt * 1500);
          continue; 
        }

        console.warn(`⚠️ [ROUTER] ${modelName} rejected request (${status}). Switching to next logical fallback...`);
        lastError = error;
        break; 
      }
    }
  }

  console.error('❌ [ROUTER] Critical: All primary and fallback models failed.');
  throw lastError || new Error('All model quotas exhausted.');
}

module.exports = { generate };
