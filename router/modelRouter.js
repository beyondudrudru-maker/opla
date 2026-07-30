/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Routes prompts to the appropriate lineup of Gemini models based on the 
 *   IntentClassifier output. Owns the Smart Cascade fallback mechanism to 
 *   protect against API rate limits (429) and server overloads (503).
 *
 * RESPONSIBILITIES
 *   - Map {intent, complexity, isModeration} -> model cascade lineup.
 *   - Execute the API call and gracefully degrade to lighter/older models 
 *     if the primary choices are rate-limited.
 *   - Own the fallback-on-error loop.
 */

const { INTENTS } = require('../classifier/intentClassifier');

// Intents that require the highest accuracy, longest context, or strictest obedience
const ROUTE_TO_HEAVY = new Set([
  INTENTS.HEAVY_TASK, 
  INTENTS.MODERATION, 
  INTENTS.COMMAND, 
  INTENTS.QUESTION,
  INTENTS.EMOTIONAL_DISCLOSURE // Needs high emotional intelligence
]);

/**
 * Builds an array of models to try in order, based on the task's intent.
 */
function buildModelLineup(intent, models) {
  if (ROUTE_TO_HEAVY.has(intent)) {
    // Heavy Lineup: Start with the absolute smartest models, cascade down to fast ones
    return [models.flash36, models.flash35, models.lite35, models.lite31];
  }
  
  // Light Lineup (Banter, Social): Start with older/lighter models to save 
  // your premium quotas, and cascade upwards only if the light models are busy
  return [models.flash2, models.flash25, models.lite31, models.lite35, models.flash35];
}

/**
 * Executes the generation process, automatically falling back through the lineup
 * if rate limits are encountered.
 * 
 * @param {Object} args.classification - The output from intentClassifier
 * @param {String} args.prompt - The final assembled prompt
 * @param {Object} args.models - An object containing all initialized generative models
 */
async function generate({ classification, prompt, models }) {
  const lineup = buildModelLineup(classification.intent, models);
  let lastError;

  for (const model of lineup) {
    if (!model) continue; // Safety check if a model wasn't passed correctly

    try {
      // Attempt to generate the response
      const result = await model.generateContent(prompt);
      
      // Return the specific model's name (e.g., 'gemini-3.5-flash-lite') for your debug logs
      return { result, modelUsed: model.model };
      
    } catch (error) {
      const isRateLimit = error.status === 429;
      const isOverloaded = error.status === 503;
      
      if (isRateLimit || isOverloaded) {
        console.warn(`⚠️ [ROUTER] ${model.model} is busy (Error ${error.status}). Cascading to next model...`);
        lastError = error; // Save the error, but let the loop continue to the next model
      } else {
        // Unhandled error (like a network crash or malformed prompt), throw immediately
        throw error;
      }
    }
  }

  // If the loop finishes and we are here, it means EVERY model in the lineup failed.
  console.error('❌ [ROUTER] Critical: All models in the cascade are currently rate-limited!');
  throw lastError; // Throwing this triggers the "thoughts tangled up" message in api/gemini.js
}

module.exports = { buildModelLineup, generate };
