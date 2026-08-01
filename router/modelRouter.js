/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Executes Smart Tier Routing, Multi-Key Failover, and Rate-Limit Handling.
 *   Built with strict undefined-filtering to prevent runtime crashes.
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

function buildModelLineup(isComplex, models) {
  // We include legacy names (flashModel, liteModel) just in case of file mismatches
  const lineup = isComplex ? [
    models.flash36, models.flash35, models.lite35, 
    models.lite31, models.flash25, models.flash2, models.flashModel
  ] : [
    models.flash25, models.flash2, models.lite31, 
    models.lite35, models.flash35, models.flash36, models.liteModel
  ];

  // 🛡️ CRITICAL SAFETY LAYER: Filter out any undefined or broken models
  return lineup.filter(model => model && typeof model.generateContent === 'function');
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generate({ classification, prompt, modelSets }) {
  const complex = isComplexTask(classification?.intent, prompt);
  let lastError;

  // 🔄 OUTER LOOP: Iterate through API Keys
  for (let keyIndex = 0; keyIndex < modelSets.length; keyIndex++) {
    const models = modelSets[keyIndex];
    const lineup = buildModelLineup(complex, models);

    if (lineup.length === 0) {
      console.warn(`⚠️ [ROUTER] Key ${keyIndex + 1} has no valid models configured. Skipping...`);
      continue;
    }

    // 🔄 INNER LOOP: Iterate through the safe models
    for (const model of lineup) {
      // Try up to 2 times per model with a short backoff if 429 is hit
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          // Execute standard generateContent safely
          const result = await model.generateContent(prompt);
          
          const tierTag = complex ? 'Gen3-Heavy' : 'Gen2-Light';
          
          return { 
            result, 
            modelUsed: `Gemini AI [${tierTag}] (Key ${keyIndex + 1})` 
          };
          
        } catch (error) {
          const status = error.status || error?.error?.code || 'Error';
          
          // Handle Rate Limits (429) gracefully
          if (status === 429 || String(error.message).includes('429') || String(error.message).includes('RESOURCE_EXHAUSTED')) {
            console.warn(`⚠️ [ROUTER] Rate limit (429) hit. Backing off for ${attempt * 1500}ms...`);
            await delay(attempt * 1500);
            continue;
          }

          // Non-429 error (e.g., 500, safety block), break retry and cascade to next model
          console.warn(`⚠️ [ROUTER] Model skipped due to error (${status}). Cascading...`);
          lastError = error;
          break; 
        }
      }
    }

    console.warn(`⚠️ [ROUTER] Key ${keyIndex + 1} lineup exhausted. Failing over to next API key...`);
  }

  console.error('❌ [ROUTER] Critical: All models across all API keys failed.');
  throw lastError || new Error('All model quotas exhausted or invalid configuration.');
}

module.exports = { buildModelLineup, generate };
