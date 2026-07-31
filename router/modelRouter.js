/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Routes prompts to the appropriate lineup of Gemini models based on the 
 *   IntentClassifier output. Owns the Smart Cascade fallback mechanism AND
 *   the Multi-Key Failover system to protect against API rate limits (429), 
 *   server overloads (503), and missing models (404).
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
 * Executes the generation process, cascading through models and failing over 
 * to backup API keys if rate limits or other API errors are encountered.
 * 
 * @param {Object} args.classification - The output from intentClassifier
 * @param {String} args.prompt - The final assembled prompt
 * @param {Array} args.modelSets - An array containing initialized models for EACH Api Key
 */
async function generate({ classification, prompt, modelSets }) {
  let lastError;

  // 🔄 OUTER LOOP: Iterate through the different API keys (Failover System)
  for (let keyIndex = 0; keyIndex < modelSets.length; keyIndex++) {
    const models = modelSets[keyIndex];
    const lineup = buildModelLineup(classification.intent, models);

    // 🔄 INNER LOOP: Iterate through the models on the current API key (Cascade System)
    for (const model of lineup) {
      if (!model) continue; // Safety check if a model wasn't passed correctly

      try {
        // Attempt to generate the response
        const result = await model.generateContent(prompt);
        
        // Return which model AND which key was used for your debug logs
        return { result, modelUsed: `${model.model} (Key ${keyIndex + 1})` };
        
      } catch (error) {
        // 🛡️ THE FIX: We now catch ALL errors (429, 503, 404, etc.) 
        // Instead of crashing, we log it and let the loop continue to the next model!
        const status = error.status || 'Unknown';
        console.warn(`⚠️ [ROUTER] ${model.model} on Key ${keyIndex + 1} failed (Error ${status}). Cascading to next model...`);
        lastError = error; 
        
        // The loop automatically continues to the next model here.
      }
    }
    
    // If we reach this point, every single model on THIS API key failed.
    console.warn(`⚠️ [ROUTER] API Key ${keyIndex + 1} is fully exhausted or malfunctioning. Failing over to backup key...`);
  }

  // If the outer loop finishes, ALL keys are rate limited or broken!
  console.error('❌ [ROUTER] Critical: ALL keys and ALL models failed!');
  throw lastError; // Throwing this triggers the "thoughts tangled up" message in api/gemini.js
}

module.exports = { buildModelLineup, generate };
