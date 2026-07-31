/**
 * router/modelRouter.js
 *
 * PURPOSE
 *   Executes Smart Tier Routing and Multi-Key Failover.
 *   - Casual / Fun / General -> Gen 2/2.5 Models (Saves token quota)
 *   - Science / Tech / Space / Business / Coding -> Gen 3 Models
 *   - Exhausts Key 1 model options before switching to Key 2 (aiapi)
 *
 * CHANGELOG (this refactor)
 *   - Aligned with the @google/genai SDK migration in api/gemini.js. A
 *     "model" entry in the lineup is now { id, ai } — a model id string
 *     plus the GoogleGenAI client for that API key — instead of a
 *     pre-configured model object from the old getGenerativeModel() API.
 *   - Call site changed: model.generateContent(prompt)
 *       -> model.ai.models.generateContent({ model: model.id, contents, config })
 *     `config` comes from the new `generationConfig` param (systemInstruction
 *     + tools), passed in by api/gemini.js on every call.
 *   - modelUsed tag now reads `model.id` — the new SDK's model entries don't
 *     carry a `.model` property the way the old SDK's model objects did.
 *   - Failover / cascade / logging behavior is otherwise unchanged.
 *   - DROPPED flash25 (gemini-2.5-flash) / flash2 (gemini-2.5-flash-lite)
 *     from both lineups: both are hard-404ing ("no longer available to
 *     new users") on this project's keys, ahead of and independent of the
 *     official Oct 16 2026 shutdown date. Down to a 4-model cascade. See
 *     api/gemini.js CHANGELOG for the full explanation before re-adding.
 */

const { INTENTS } = require('../classifier/intentClassifier');

// Keywords that force allocation to heavy Gen 3 models
const COMPLEX_CATEGORY_REGEX = /science|tech|technology|space|physics|coding|code|script|business|finance|economy|analyze|explain|history|stotram|mantra|lyrics/i;

// Intents requiring peak intelligence
const HEAVY_INTENTS = new Set([
  INTENTS.HEAVY_TASK,
  INTENTS.MODERATION,
  INTENTS.COMMAND,
  INTENTS.QUESTION,
  INTENTS.EMOTIONAL_DISCLOSURE
]);

/**
 * Determines whether a turn requires Gen 3 heavy models.
 */
function isComplexTask(intent, prompt) {
  if (HEAVY_INTENTS.has(intent)) return true;
  if (COMPLEX_CATEGORY_REGEX.test(prompt)) return true;
  if (prompt.length > 120) return true; // Long prompts benefit from Gen 3 reasoning
  return false;
}

/**
 * Builds the model cascade order based on task complexity, matching api.js tiers.
 * Each entry is { id, ai } (see api/gemini.js buildModelSets()).
 */
function buildModelLineup(isComplex, models) {
  if (isComplex) {
    // 🧠 COMPLEX LINEUP: Gen 3 heavy models first, falling back to lighter ones
    return [
      models.flash36,  // Gen 3.6 Flash
      models.flash35,  // Gen 3.5 Flash
      models.lite35,   // Gen 3.5 Flash Lite
      models.lite31    // Gen 3.1 Flash Lite (Fallback)
    ];
  }

  // ⚡ LIGHT / CASUAL LINEUP: cheapest/fastest tiers first to conserve quota
  return [
    models.lite31,    // Gen 3.1 Flash Lite
    models.lite35,    // Gen 3.5 Flash Lite
    models.flash35,   // Gen 3.5 Flash
    models.flash36    // Gen 3.6 Flash (Backup)
  ];
}

/**
 * Executes prompt generation through the Smart Cascade & Multi-Key Failover loop.
 *
 * @param {object} params
 * @param {object} params.classification - output of the intent classifier
 * @param {string} params.prompt - the fully-assembled prompt text
 * @param {Array<object>} params.modelSets - one { flash36, flash35, ... } bundle per API key
 * @param {object} [params.generationConfig] - { systemInstruction, tools } passed
 *   straight through to ai.models.generateContent's `config` on every call.
 */
async function generate({ classification, prompt, modelSets, generationConfig = {} }) {
  const complex = isComplexTask(classification?.intent, prompt);
  let lastError;

  // 🔄 OUTER LOOP: Iterate through API Keys (Key 1 -> Key 2 / aiapi)
  for (let keyIndex = 0; keyIndex < modelSets.length; keyIndex++) {
    const models = modelSets[keyIndex];
    const lineup = buildModelLineup(complex, models);

    // 🔄 INNER LOOP: Try all models in the current key's lineup first
    for (const model of lineup) {
      if (!model) continue;

      try {
        const result = await model.ai.models.generateContent({
          model: model.id,
          contents: prompt,
          config: generationConfig,
        });
        const tierTag = complex ? 'Gen3-Heavy' : 'Gen2-Light';

        return {
          result,
          modelUsed: `${model.id} [${tierTag}] (Key ${keyIndex + 1})`
        };

      } catch (error) {
        const status = error.status || 'Error';
        console.warn(`⚠️ [ROUTER] ${model.id} on Key ${keyIndex + 1} skipped (${status}). Cascading to next model...`);
        lastError = error;
      }
    }

    console.warn(`⚠️ [ROUTER] Key ${keyIndex + 1} lineup completely exhausted. Failing over to next API key...`);
  }

  console.error('❌ [ROUTER] Critical: All models across all API keys failed.');
  throw lastError;
}

module.exports = { buildModelLineup, generate };
